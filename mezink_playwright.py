import pandas as pd
import time
import asyncio
from playwright.async_api import async_playwright
import logging
import os
import json
import sys
from datetime import datetime
from pathlib import Path
from platform_login_manager import PlatformLoginManager

# Configure UTF-8 encoding for console output
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Set up logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('mezink_automation.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class MezinkPlaywrightAutomator:
    def __init__(self):
        self.browser = None
        self.context = None
        self.page = None
        self.script_dir = Path(__file__).parent
        self.excel_file = self.script_dir / "profile_links.xlsx"
        self.processed_urls = []
        self.failed_urls = []
        self.first_tiktok_handled = False  # Track if we've handled first TikTok URL
        self.login_manager = None  # Will be initialized after browser setup
        
        # Chrome user data directory
        if os.name == 'nt':  # Windows
            self.user_data_dir = Path.home() / "AppData/Local/Google/Chrome/User Data"
        else:  # Mac/Linux
            self.user_data_dir = Path.home() / ".config/google-chrome"
            
        self.selected_profile = None
        
    def get_chrome_profiles(self):
        """Get list of available Chrome profiles"""
        profiles = []
        
        try:
            # Check Default profile
            if (self.user_data_dir / "Default").exists():
                profiles.append("Default")
                
            # Check numbered profiles
            for item in self.user_data_dir.iterdir():
                if item.is_dir() and item.name.startswith("Profile "):
                    profiles.append(item.name)
                    
        except Exception as e:
            logger.error(f"Error reading Chrome profiles: {e}")
                    
        return sorted(profiles)
        
    def select_profile(self):
        """Let user select a Chrome profile"""
        profiles = self.get_chrome_profiles()
        
        if not profiles:
            logger.error("No Chrome profiles found!")
            return False
        
        print("\nAvailable Chrome profiles:")
        for i, profile in enumerate(profiles, 1):
            print(f"{i}. {profile}")
            
        while True:
            try:
                choice = int(input("\nEnter the number of the profile where Mezink is installed: "))
                if 1 <= choice <= len(profiles):
                    self.selected_profile = profiles[choice-1]
                    logger.info(f"Selected profile: {self.selected_profile}")
                    return True
                print("Invalid selection. Please try again.")
            except ValueError:
                print("Please enter a valid number.")
            except KeyboardInterrupt:
                logger.info("User cancelled profile selection")
                return False
    
    async def setup_browser(self):
        """Set up Playwright browser with Chrome profile"""
        try:
            if not self.select_profile():
                return False
            
            logger.info("Starting Playwright browser...")
            
            playwright = await async_playwright().start()
            
            # Get extension path - using absolute path
            crx_path = Path(r"C:\Users\debji\Downloads\Mezink Code Files\Extension_automation\Mezink_Social_AI.crx")
            unpacked_path = self.script_dir / "unpacked_extension"
            
            # Create unpacked extension directory if it doesn't exist
            unpacked_path.mkdir(exist_ok=True)
            
            # Unpack the .crx file if needed
            if not (unpacked_path / "manifest.json").exists():
                logger.info("Unpacking extension...")
                # Use 7z to extract the .crx file (assumes 7z is installed)
                os.system(f'7z x "{crx_path}" -o"{unpacked_path}" -y')
                
            if not (unpacked_path / "manifest.json").exists():
                logger.error("Failed to unpack extension")
                return False
                
            logger.info(f"Loading extension from: {unpacked_path}")
            
            # Set up browser arguments for anti-detection and extension
            browser_args = [
                '--start-maximized',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                f'--disable-extensions-except={unpacked_path}',
                f'--load-extension={unpacked_path}',
                '--disable-web-security',  # Add this to help with network issues
                '--ignore-certificate-errors',  # Add this to help with HTTPS issues
                '--force-device-scale-factor=1',  # Force 100% zoom
                '--high-dpi-support=1',  # Better high DPI support
                '--window-size=1920,1080',  # Force window size to match viewport
                '--high-dpi-support=1'  # Better high DPI support
            ]
            
            # Launch persistent context with proper configuration
            self.browser = await playwright.chromium.launch_persistent_context(
                user_data_dir=str(self.user_data_dir / self.selected_profile),
                headless=False,
                args=browser_args,
                viewport={'width': 1920, 'height': 1080},  # Full HD resolution
                screen={'width': 1920, 'height': 1080},  # Match viewport
                device_scale_factor=1,  # Force 100% scaling
                ignore_default_args=[
                    '--enable-automation',
                    '--enable-blink-features=AutomationControlled',
                    '--enable-extensions'  # Allow extension loading
                ],
                channel='chrome',
                timeout=10000  # Increase default timeout to 60 seconds
            )
            
            # Use the first page from the context instead of creating a new one
            self.page = self.browser.pages[0]
            
            # Initialize login manager
            self.login_manager = PlatformLoginManager(self.page)
            
            # Set zoom level and viewport
            await self.page.evaluate("""
                document.body.style.zoom = '100%';
                document.documentElement.style.zoom = '100%';
                document.documentElement.style.transformOrigin = 'top left';
                document.documentElement.style.transform = 'scale(1)';
            """)
            await self.page.set_viewport_size({'width': 1920, 'height': 1080})
            
            # Add stealth modifications
            await self.page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                
                // Remove automation indicators
                delete window.chrome;
                delete window.navigator.chrome;
                
                // Mock permissions
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );
            """)
            
            # Verify logins for all platforms
            logger.info("Verifying platform logins...")
            if not await self.login_manager.verify_all_logins():
                logger.error("Failed to verify all platform logins")
                return False
                
            return True
            
        except Exception as e:
            logger.error(f"Failed to setup browser: {str(e)}")
            if self.browser:
                await self.close()
            return False
    
    def validate_url(self, url):
        """Validate if URL is accessible"""
        try:
            if not url or pd.isna(url):
                return False
            
            url = str(url).strip()
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url
                
            return url
        except Exception:
            return False
    
    async def wait_for_page_load(self, timeout=30000):
        """Wait for page to fully load"""
        try:
            await self.page.wait_for_load_state('networkidle', timeout=timeout)
            return True
        except Exception as e:
            logger.warning(f"Page load timeout: {e}")
            return False
    
    async def check_login_status(self, url):
        """Check login status based on the platform"""
        try:
            if 'instagram.com' in url.lower():
                # Check Instagram login
                await self.page.wait_for_selector('a[href="/"] svg[aria-label="Home"], a[href="/"] img[alt="Home"]', timeout=5000)
            # Add other platforms if they need login checks
            return True
        except Exception as e:
            if 'instagram.com' in url.lower():
                logger.error("Lost Instagram login session!")
                return False
            return True  # For other platforms, continue even if selector not found
    
    async def process_profiles(self):
        """Process each profile URL from the Excel file"""
        try:
            # Read Excel file
            logger.info(f"Reading URLs from {self.excel_file}")
            
            try:
                df = pd.read_excel(self.excel_file)
            except Exception as e:
                logger.error(f"Could not read Excel file: {e}")
                return False
            
            # Find URL column (try different possible names)
            url_column = None
            possible_columns = ['URL', 'url', 'Link', 'link', 'Profile', 'profile', 'Address', 'links', 'Links']
            
            for col in possible_columns:
                if col in df.columns:
                    url_column = col
                    break
            
            if url_column is None:
                logger.error(f"Could not find URL column. Available columns: {list(df.columns)}")
                return False
            
            urls = df[url_column].tolist()
            
            # Filter out invalid URLs
            valid_urls = []
            for url in urls:
                validated_url = self.validate_url(url)
                if validated_url:
                    valid_urls.append(validated_url)
                else:
                    logger.warning(f"Skipping invalid URL: {url}")
            
            if not valid_urls:
                logger.error("No valid URLs found in Excel file")
                return False
            
            logger.info(f"Found {len(valid_urls)} valid URLs to process")
            
            # Process each URL
            for i, url in enumerate(valid_urls, 1):
                try:
                    logger.info(f"\n{'='*50}")
                    logger.info(f"Processing URL {i}/{len(valid_urls)}: {url}")
                    logger.info(f"{'='*50}")
                    
                    # Set timeout based on platform
                    timeout = 20000  # Reduced to 20 seconds
                    is_tiktok = 'tiktok.com' in url.lower()
                    
                    # Verify platform-specific login
                    if not self.login_manager.is_platform_logged_in(url):
                        logger.error(f"Not logged in to platform for URL: {url}")
                        return False

                    # Navigate to URL using the same page with optimized loading
                    try:
                        await self.page.goto(url, wait_until='domcontentloaded', timeout=timeout)
                        logger.info("Page loaded successfully")
                    except Exception as e:
                        logger.error(f"Failed to load URL: {str(e)}")
                        self.failed_urls.append(url)
                        continue

                    # Handle first TikTok URL specially (only for captcha)
                    if is_tiktok and not self.first_tiktok_handled:
                        logger.info("First TikTok URL detected, waiting for captcha...")
                        await asyncio.sleep(10)  # Reduced wait for captcha
                        self.first_tiktok_handled = True

                    # Wait for initial processing (10 seconds)
                    logger.info("Processing...")
                    await asyncio.sleep(10)
                    
                    # Mark as processed (no need for refresh)
                    self.processed_urls.append(url)
                    logger.info(f"[OK] Successfully processed: {url}")
                    
                    # 5 second delay between profiles
                    if i < len(valid_urls):
                        logger.info("Waiting before next profile...")
                        await asyncio.sleep(5)
                        
                except Exception as e:
                    logger.error(f"[ERROR] Failed processing URL {url}: {str(e)}")
                    self.failed_urls.append(url)
                    continue
            
            # Log summary
            logger.info(f"\n{'='*50}")
            logger.info("PROCESSING SUMMARY")
            logger.info(f"{'='*50}")
            logger.info(f"Total URLs processed: {len(self.processed_urls)}")
            logger.info(f"Failed URLs: {len(self.failed_urls)}")
            
            if self.failed_urls:
                logger.info("Failed URLs:")
                for url in self.failed_urls:
                    logger.info(f"  - {url}")
            
            # Save results to file
            self.save_results()
            
            return len(self.processed_urls) > 0
            
        except Exception as e:
            logger.error(f"Failed to process profiles: {str(e)}")
            return False
    
    def save_results(self):
        """Save processing results to a JSON file"""
        try:
            results = {
                'timestamp': datetime.now().isoformat(),
                'total_processed': len(self.processed_urls),
                'total_failed': len(self.failed_urls),
                'processed_urls': self.processed_urls,
                'failed_urls': self.failed_urls
            }
            
            results_file = self.script_dir / 'processing_results.json'
            with open(results_file, 'w') as f:
                json.dump(results, f, indent=2)
            
            logger.info(f"Results saved to: {results_file}")
            
        except Exception as e:
            logger.error(f"Could not save results: {e}")
    
    async def close(self):
        """Clean up resources"""
        try:
            if self.browser:
                logger.info("Closing browser...")
                try:
                    await asyncio.wait_for(self.browser.close(), timeout=5.0)
                except asyncio.TimeoutError:
                    logger.warning("Browser close timed out")
                except Exception as e:
                    logger.warning(f"Error during browser close: {e}")
                finally:
                    self.browser = None
                    
        except Exception as e:
            logger.error(f"Error during cleanup: {str(e)}")
            self.browser = None  # Ensure browser reference is cleared
    
    async def run(self):
        """Main execution flow"""
        try:
            logger.info("Starting Mezink Automation with Playwright")
            logger.info(f"Script directory: {self.script_dir}")
            
            if not self.excel_file.exists():
                logger.error(f"Excel file not found: {self.excel_file}")
                print(f"\nPlease ensure '{self.excel_file.name}' exists in the same directory as this script.")
                return False
                
            if not await self.setup_browser():
                logger.error("Browser setup failed")
                return False
                
            success = await self.process_profiles()
            
            if success:
                logger.info("[SUCCESS] Automation completed successfully")
            else:
                logger.error("[ERROR] Automation completed with errors")
            
            return success
            
        except KeyboardInterrupt:
            logger.info("Automation interrupted by user")
            return False
            
        except Exception as e:
            logger.error(f"Automation failed: {str(e)}")
            return False
            
        finally:
            await self.close()

async def main():
    print("Mezink Profile Automation Tool (Playwright)")
    print("=" * 50)
    
    automator = MezinkPlaywrightAutomator()
    
    try:
        if await automator.run():
            print("\n[SUCCESS] Automation completed successfully!")
        else:
            print("\n[ERROR] Automation failed or completed with errors.")
            print("Check the log file 'mezink_automation.log' for details.")
    except KeyboardInterrupt:
        print("\n\nAutomation stopped by user.")
    
    input("\nPress Enter to exit...")

if __name__ == "__main__":
    asyncio.run(main())