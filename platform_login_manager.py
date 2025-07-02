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
                logger.info("Please log in to Instagram manually in the opened browser window...")
                await asyncio.sleep(120)  # Wait 2 minutes for manual login
                # Ask user for confirmation
                confirm = input("Have you completed Instagram login? (yes/no): ").strip().lower()
                if confirm != 'yes':
                    logger.error("[X] Instagram login not confirmed by user")
                    self._instagram_logged_in = False
                    return False
                # Verify login after confirmation
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
            try:
                await self.page.goto("https://www.tiktok.com", 
                    wait_until='domcontentloaded',
                    timeout=45000
                )
            except Exception as e:
                logger.warning(f"[!] Initial page load failed, trying with load condition: {e}")
                try:
                    await self.page.goto("https://www.tiktok.com", 
                        wait_until='load',
                        timeout=45000
                    )
                except Exception as e:
                    logger.error(f"[X] Failed to load TikTok even with fallback: {e}")
                    return False
            try:
                await self.page.wait_for_selector('body', timeout=5000)
            except Exception as e:
                logger.error(f"[X] TikTok page not accessible: {e}")
                return False
            login_selectors = [
                '[data-e2e="profile-icon"]',
                '[data-e2e="top-login-button"] { display: none }',
                'button[data-e2e="upload-icon"]',
                'a[data-e2e="nav-profile"]',
                '.header-profile-avatar',
                '[data-e2e="user-profile"]',
                '.video-publish-button'
            ]
            for selector in login_selectors:
                try:
                    if selector.endswith(' { display: none }'):
                        selector = selector.replace(' { display: none }', '')
                        is_visible = await self.page.is_visible(selector)
                        if not is_visible:
                            logger.info(f"[OK] TikTok login confirmed ('{selector}' not visible)")
                            self._tiktok_logged_in = True
                            return True
                    else:
                        is_visible = await self.page.is_visible(selector, timeout=1000)
                        if is_visible:
                            logger.info(f"[OK] TikTok login confirmed ('{selector}' found)")
                            self._tiktok_logged_in = True
                            return True
                except:
                    continue
            for selector in login_selectors:
                try:
                    if selector.endswith(' { display: none }'):
                        continue
                    else:
                        is_visible = await self.page.wait_for_selector(
                            selector,
                            timeout=5000
                        )
                        if is_visible:
                            logger.info(f"[OK] TikTok login confirmed ('{selector}' found)")
                            self._tiktok_logged_in = True
                            return True
                except:
                    continue
            logger.warning("[!] Not logged in to TikTok")
            logger.info("Please log in to TikTok manually in the opened browser window...")
            await asyncio.sleep(120)  # Wait 2 minutes for manual login
            confirm = input("Have you completed TikTok login? (yes/no): ").strip().lower()
            if confirm != 'yes':
                logger.error("[X] TikTok login not confirmed by user")
                self._tiktok_logged_in = False
                return False
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
            for selector in login_selectors:
                try:
                    if selector.endswith(' { display: none }'):
                        continue
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
        logger.info("[OK] Both Instagram and TikTok logins verified successfully!")
        return True

    def is_platform_logged_in(self, url: str) -> bool:
        """Check if a specific platform is logged in based on URL"""
        url = url.lower()
        if 'instagram.com' in url:
            return self._instagram_logged_in
        elif 'tiktok.com' in url:
            return self._tiktok_logged_in
        return True  # For other platforms (like YouTube), assume no login needed
