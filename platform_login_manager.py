import logging
import asyncio
from playwright.async_api import Page

logger = logging.getLogger(__name__)

class PlatformLoginManager:
    def __init__(self, page: Page):
        self.page = page
        self._instagram_logged_in = False
        self._tiktok_logged_in = False
        self._twitter_logged_in = False

    async def verify_instagram_login(self) -> bool:
        """Verify if logged into Instagram"""
        try:
            logger.info("Checking Instagram login status...")
            await self.page.goto("https://www.instagram.com", 
                wait_until='domcontentloaded',
                timeout=30000
            )
            
            try:
                # Check for home icon which indicates login
                is_logged_in = await self.page.wait_for_selector(
                    'a[href="/"] svg[aria-label="Home"], a[href="/"] img[alt="Home"]',
                    timeout=5000
                )
                if is_logged_in:
                    logger.info("[OK] Already logged in to Instagram")
                    self._instagram_logged_in = True
                    return True
            except:
                logger.warning("[!] Not logged in to Instagram")
                logger.info("Please log in to Instagram manually...")
                await asyncio.sleep(60)  # Wait 1 minute for manual login
                
                # Verify login after wait
                try:
                    await self.page.wait_for_selector(
                        'a[href="/"] svg[aria-label="Home"], a[href="/"] img[alt="Home"]',
                        timeout=5000
                    )
                    logger.info("[OK] Instagram login successful!")
                    self._instagram_logged_in = True
                    return True
                except:
                    logger.error("[X] Instagram login failed even after waiting")
                    self._instagram_logged_in = False
                    return False
                    
        except Exception as e:
            logger.error(f"Error checking Instagram login: {e}")
            return False

    async def verify_tiktok_login(self) -> bool:
        """Verify if logged into TikTok"""
        try:
            logger.info("Checking TikTok login status...")
            
            # First try with domcontentloaded (faster)
            try:
                await self.page.goto("https://www.tiktok.com", 
                    wait_until='domcontentloaded',
                    timeout=45000  # 45 seconds timeout
                )
            except Exception as e:
                logger.warning(f"[!] Initial page load failed, trying with load condition: {e}")
                try:
                    # Fallback to load if domcontentloaded fails
                    await self.page.goto("https://www.tiktok.com", 
                        wait_until='load',
                        timeout=45000
                    )
                except Exception as e:
                    logger.error(f"[X] Failed to load TikTok even with fallback: {e}")
                    return False

            # Check if page is accessible before proceeding
            try:
                # Wait for any basic page element to ensure page is actually loaded
                await self.page.wait_for_selector('body', timeout=5000)
            except Exception as e:
                logger.error(f"[X] TikTok page not accessible: {e}")
                return False
            
            # Try multiple selectors that indicate logged-in state
            login_selectors = [
                '[data-e2e="profile-icon"]',  # Profile icon
                '[data-e2e="top-login-button"] { display: none }',  # Login button should not be visible
                'button[data-e2e="upload-icon"]',  # Upload button (only shown when logged in)
                'a[data-e2e="nav-profile"]',  # Profile link
                '.header-profile-avatar',  # Profile avatar
                '[data-e2e="user-profile"]',  # User profile section
                '.video-publish-button' # Upload video button
            ]
            
            # First quick check for any obviously visible elements
            for selector in login_selectors:
                try:
                    if selector.endswith(' { display: none }'):
                        # Check if element is not visible
                        selector = selector.replace(' { display: none }', '')
                        is_visible = await self.page.is_visible(selector)
                        if not is_visible:
                            logger.info(f"[OK] TikTok login confirmed ('{selector}' not visible)")
                            self._tiktok_logged_in = True
                            return True
                    else:
                        # First try a quick visibility check
                        is_visible = await self.page.is_visible(selector, timeout=1000)
                        if is_visible:
                            logger.info(f"[OK] TikTok login confirmed ('{selector}' found)")
                            self._tiktok_logged_in = True
                            return True
                except:
                    continue

            # If quick checks failed, try waiting for selectors
            for selector in login_selectors:
                try:
                    if selector.endswith(' { display: none }'):
                        continue  # Already checked above
                    else:
                        # Wait for any of the selectors that should be visible
                        is_visible = await self.page.wait_for_selector(
                            selector,
                            timeout=5000  # 5 second timeout per selector
                        )
                        if is_visible:
                            logger.info(f"[OK] TikTok login confirmed ('{selector}' found)")
                            self._tiktok_logged_in = True
                            return True
                except:
                    continue
            
            # If we get here, we couldn't find any login indicators
            logger.warning("[!] Not logged in to TikTok")
            logger.info("Please log in to TikTok manually...")
            await asyncio.sleep(60)  # Wait 1 minute for manual login
            
            # After manual login wait, do quick visibility check first
            for selector in login_selectors:
                try:
                    if selector.endswith(' { display: none }'):
                        selector = selector.replace(' { display: none }', '')
                        is_visible = await self.page.is_visible(selector)
                        if not is_visible:
                            logger.info(f"[OK] TikTok login successful! ('{selector}' not visible)")
                            self._tiktok_logged_in = True
                            return True
                    else:
                        is_visible = await self.page.is_visible(selector, timeout=1000)
                        if is_visible:
                            logger.info(f"[OK] TikTok login successful! ('{selector}' found)")
                            self._tiktok_logged_in = True
                            return True
                except:
                    continue

            # If quick checks failed after manual login, try waiting
            for selector in login_selectors:
                try:
                    if selector.endswith(' { display: none }'):
                        continue  # Already checked above
                    else:
                        is_visible = await self.page.wait_for_selector(
                            selector,
                            timeout=5000
                        )
                        if is_visible:
                            logger.info(f"[OK] TikTok login successful! ('{selector}' found)")
                            self._tiktok_logged_in = True
                            return True
                except:
                    continue
            
            logger.error("[X] TikTok login failed even after waiting")
            self._tiktok_logged_in = False
            return False
                    
        except Exception as e:
            logger.error(f"[X] Error checking TikTok login: {e}")
            return False

    async def verify_twitter_login(self) -> bool:
        """Verify if logged into Twitter"""
        try:
            logger.info("Checking Twitter login status...")
            
            # First try with domcontentloaded (faster)
            try:
                await self.page.goto("https://twitter.com", 
                    wait_until='domcontentloaded',
                    timeout=30000
                )
            except Exception as e:
                logger.warning(f"[!] Initial page load failed, trying with load condition: {e}")
                try:
                    await self.page.goto("https://twitter.com", 
                        wait_until='load',
                        timeout=30000
                    )
                except Exception as e:
                    logger.error(f"[X] Failed to load Twitter even with fallback: {e}")
                    return False

            # Check if page is accessible
            try:
                await self.page.wait_for_selector('body', timeout=5000)
            except Exception as e:
                logger.error(f"[X] Twitter page not accessible: {e}")
                return False
            
            # Try multiple selectors that indicate logged-in state
            login_selectors = [
                '[data-testid="SideNav_NewTweet_Button"]',  # New tweet button
                '[aria-label="Primary"]',  # Primary navigation menu
                '[data-testid="AppTabBar_Profile_Link"]',  # Profile link
                '[data-testid="AppTabBar_Home_Link"]',  # Home link
                'a[href="/home"]',  # Home link alternative
                '[data-testid="Tweet"]:first-of-type',  # First tweet in timeline
            ]
            
            # Quick check for any obviously visible elements
            for selector in login_selectors:
                try:
                    is_visible = await self.page.is_visible(selector, timeout=1000)
                    if is_visible:
                        logger.info(f"[OK] Twitter login confirmed ('{selector}' found)")
                        self._twitter_logged_in = True
                        return True
                except:
                    continue

            # If quick checks failed, try waiting for selectors
            for selector in login_selectors:
                try:
                    is_visible = await self.page.wait_for_selector(
                        selector,
                        timeout=5000  # 5 second timeout per selector
                    )
                    if is_visible:
                        logger.info(f"[OK] Twitter login confirmed ('{selector}' found)")
                        self._twitter_logged_in = True
                        return True
                except:
                    continue
            
            # If we get here, we're not logged in
            logger.warning("[!] Not logged in to Twitter")
            logger.info("Please log in to Twitter manually...")
            await asyncio.sleep(60)  # Wait 1 minute for manual login
            
            # After manual login wait, check again
            for selector in login_selectors:
                try:
                    is_visible = await self.page.is_visible(selector, timeout=1000)
                    if is_visible:
                        logger.info(f"[OK] Twitter login successful! ('{selector}' found)")
                        self._twitter_logged_in = True
                        return True
                except:
                    continue

            # If quick check failed, try waiting
            for selector in login_selectors:
                try:
                    is_visible = await self.page.wait_for_selector(
                        selector,
                        timeout=5000
                    )
                    if is_visible:
                        logger.info(f"[OK] Twitter login successful! ('{selector}' found)")
                        self._twitter_logged_in = True
                        return True
                except:
                    continue
            
            logger.error("[X] Twitter login failed even after waiting")
            self._twitter_logged_in = False
            return False
                    
        except Exception as e:
            logger.error(f"[X] Error checking Twitter login: {e}")
            return False

    async def verify_all_logins(self) -> bool:
        """Verify login status for all platforms"""
        # First check Instagram
        if not await self.verify_instagram_login():
            logger.error("Failed to verify Instagram login")
            return False
            
        # Then check TikTok
        if not await self.verify_tiktok_login():
            logger.error("Failed to verify TikTok login")
            return False
            
        # Finally check Twitter
        if not await self.verify_twitter_login():
            logger.error("Failed to verify Twitter login")
            return False
            
        logger.info("[OK] All platform logins verified successfully!")
        return True

    def is_platform_logged_in(self, url: str) -> bool:
        """Check if a specific platform is logged in based on URL"""
        url = url.lower()
        if 'instagram.com' in url:
            return self._instagram_logged_in
        elif 'tiktok.com' in url:
            return self._tiktok_logged_in
        elif 'twitter.com' in url:
            return self._twitter_logged_in
        return True  # For other platforms (like YouTube), assume no login needed