from fastapi import FastAPI, Request, HTTPException, HTTPException
from pydantic import BaseModel
from playwright.async_api import async_playwright
import asyncio
import json
import random
import os
from typing import List, Optional, Dict
import redis

app = FastAPI(title="Browser Service", version="1.0.0")

# Redis connection
redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

# Internal API authentication
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "internal-service-key-change-in-production")

def verify_internal_api_key(request: Request):
    """Verify internal API key for service-to-service communication"""
    api_key = request.headers.get("X-Internal-API-Key")
    if not api_key or api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal API key")
    return True

class ScrapeRequest(BaseModel):
    url: str
    user_agent: Optional[str] = None
    cookies: Optional[Dict] = None
    wait_time: Optional[int] = 2
    javascript: bool = True

class ScrapeResponse(BaseModel):
    url: str
    content: str
    status_code: int
    headers: Dict
    cookies: Dict
    success: bool
    error: Optional[str] = None

class FingerprintManager:
    """Manages realistic browser fingerprints"""
    
    def __init__(self):
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ]
        
        self.viewport_sizes = [
            {"width": 1920, "height": 1080},
            {"width": 1366, "height": 768},
            {"width": 1440, "height": 900},
            {"width": 1536, "height": 864}
        ]
    
    def get_random_fingerprint(self):
        """Get a random but realistic fingerprint"""
        return {
            "user_agent": random.choice(self.user_agents),
            "viewport": random.choice(self.viewport_sizes)
        }

fingerprint_manager = FingerprintManager()
async def handle_consent_dialogs(page):
    """Advanced consent dialog and anti-bot handling with multi-language support"""
    try:
        # Wait for page to stabilize
        await page.wait_for_timeout(3000)
        
        # Check page content for various consent indicators
        page_content = await page.content()
        page_text = await page.evaluate('() => document.body.innerText.toLowerCase()')
        
        # Multi-language consent detection patterns
        consent_patterns = [
            # GDPR/Cookie consent keywords in multiple languages
            'cookie', 'gdpr', 'privacy', 'consent', 'accept', 'agree', 'continue',
            'cookies', 'datenschutz', 'zustimmen', 'akzeptieren', 'weiter',  # German
            'consentement', 'accepter', 'continuer', 'cookies',  # French  
            'consentimiento', 'aceptar', 'continuar', 'galletas',  # Spanish
            'consenso', 'accettare', 'continuare', 'biscotti',  # Italian
            'toestemming', 'accepteren', 'doorgaan', 'koekjes',  # Dutch
            'súhlas', 'prijať', 'pokračovať',  # Slovak
            'zgoda', 'zaakceptuj', 'kontynuuj',  # Polish
            'suostumus', 'hyväksy', 'jatka',  # Finnish
            'samtykke', 'acceptér', 'fortsæt',  # Danish
            'συναίνεση', 'αποδοχή', 'συνέχεια',  # Greek
            'soglasie', 'prinyat', 'prodolzhit',  # Russian (transliterated)
        ]
        
        # Check if this looks like a consent page
        is_consent_page = any(pattern in page_text for pattern in consent_patterns)
        
        # Additional consent page indicators
        consent_indicators = [
            'data protection', 'privacy policy', 'cookie policy', 'gdpr',
            'we use cookies', 'this website uses', 'terms and conditions',
            'manage preferences', 'cookie settings', 'advertising cookies',
            'essential cookies', 'analytics cookies', 'marketing cookies'
        ]
        
        is_consent_page = is_consent_page or any(indicator in page_text for indicator in consent_indicators)
        
        if is_consent_page:
            print(f"CONSENT: Detected consent page, attempting to handle...")
            
            # Comprehensive button selection strategies
            accept_strategies = [
                # Direct button selectors (most reliable)
                'button[name="agree"]',
                'button[name="accept"]', 
                'button[name="consent"]',
                'input[name="agree"]',
                'input[name="accept"]',
                
                # Class-based selectors
                'button.accept-all',
                'button.accept-cookies', 
                'button.consent-accept',
                'button.gdpr-accept',
                '.cookie-accept',
                '.consent-btn',
                '.accept-btn',
                
                # ID-based selectors
                '#accept-all',
                '#accept-cookies',
                '#consent-accept',
                '#cookie-accept',
                '#gdpr-accept',
                
                # Popular consent management platforms
                '#onetrust-accept-btn-handler',  # OneTrust
                '#truste-consent-button',        # TrustArc
                '.cc-dismiss',                   # Cookie Consent
                '.cmpboxbtn.cmpboxbtnyes',      # CMP
                '.sp_choice_type_11',           # SourcePoint
                'button[data-cli-action="accept"]',  # CLI
                '.cli-user-preference-checkbox',
                
                # Data attributes
                'button[data-accept="true"]',
                'button[data-consent="accept"]',
                'button[data-action="accept"]',
                'button[data-cy="accept"]',
                'button[data-testid*="accept"]',
                
                # ARIA labels and roles
                'button[aria-label*="accept" i]',
                'button[aria-label*="agree" i]',
                'button[role="button"][aria-label*="cookie" i]',
            ]
            
            # Multi-language text-based strategies
            text_patterns = [
                # English
                'Accept All', 'Accept all', 'ACCEPT ALL', 'Accept All Cookies',
                'I Agree', 'I agree', 'Agree', 'Continue', 'OK', 'Got it',
                'Allow All', 'Accept & Continue', 'Accept and Continue',
                
                # German  
                'Alle akzeptieren', 'Akzeptieren', 'Zustimmen', 'Einverstanden',
                'Alle Cookies akzeptieren', 'Weiter', 'OK',
                
                # French
                'Accepter tout', 'Accepter', 'J\'accepte', 'Continuer', 'D\'accord',
                'Accepter tous les cookies', 'Tout accepter',
                
                # Spanish
                'Aceptar todo', 'Aceptar', 'De acuerdo', 'Continuar', 'Vale',
                'Aceptar todas las cookies',
                
                # Italian
                'Accetta tutto', 'Accetta', 'Accetto', 'Continua', 'OK',
                'Accetta tutti i cookie',
                
                # Dutch
                'Alles accepteren', 'Accepteren', 'Akkoord', 'Doorgaan', 'Oké',
                'Alle cookies accepteren',
                
                # Slovak
                'Prijať všetko', 'Prijať', 'Súhlasím', 'Pokračovať',
                
                # Polish  
                'Zaakceptuj wszystko', 'Zaakceptuj', 'Zgadzam się', 'Kontynuuj',
                
                # Finnish
                'Hyväksy kaikki', 'Hyväksy', 'Jatka', 'OK',
                
                # Danish
                'Acceptér alle', 'Acceptér', 'Fortsæt', 'OK',
                
                # Portuguese
                'Aceitar tudo', 'Aceitar', 'Continuar', 'OK',
                
                # Russian (common)
                'Принять все', 'Принять', 'Согласен', 'Продолжить',
            ]
            
            # Try selector-based strategies first (more reliable)
            for selector in accept_strategies:
                try:
                    button = page.locator(selector).first
                    if await button.is_visible(timeout=2000):
                        print(f"CONSENT: Found button with selector: {selector}")
                        await button.click()
                        await page.wait_for_load_state("networkidle", timeout=10000)
                        print(f"CONSENT: Successfully clicked button")
                        return True
                except Exception as e:
                    continue
            
            # Try text-based strategies
            for text in text_patterns:
                try:
                    # Try exact text match
                    button = page.get_by_text(text, exact=True).first
                    if await button.is_visible(timeout=1000):
                        print(f"CONSENT: Found button with exact text: {text}")
                        await button.click()
                        await page.wait_for_load_state("networkidle", timeout=10000)
                        print(f"CONSENT: Successfully clicked text button")
                        return True
                except:
                    try:
                        # Try partial text match
                        button = page.get_by_text(text).first
                        if await button.is_visible(timeout=1000):
                            print(f"CONSENT: Found button with partial text: {text}")
                            await button.click()
                            await page.wait_for_load_state("networkidle", timeout=10000)
                            print(f"CONSENT: Successfully clicked partial text button")
                            return True
                    except:
                        continue
            
            # Fallback: try any button with "accept" in various attributes
            fallback_selectors = [
                'button:has-text("accept")',
                'button:has-text("Accept")',
                'button:has-text("agree")',
                'button:has-text("Agree")',
                'input[type="submit"][value*="accept" i]',
                'input[type="button"][value*="accept" i]',
                'a[href*="accept"]',
                '[role="button"]:has-text("accept")',
            ]
            
            for selector in fallback_selectors:
                try:
                    button = page.locator(selector).first
                    if await button.is_visible(timeout=1000):
                        print(f"CONSENT: Found fallback button: {selector}")
                        await button.click()
                        await page.wait_for_timeout(2000)
                        return True
                except:
                    continue
                    
            print(f"CONSENT: Could not find any accept buttons on consent page")
            
        # Check for CAPTCHA or other blocking mechanisms
        captcha_indicators = [
            'captcha', 'recaptcha', 'hcaptcha', 'cloudflare', 'datadome',
            'bot detection', 'security check', 'verification',
            'prove you are human', 'verify you are human',
            'access denied', 'blocked', 'forbidden'
        ]
        
        is_blocked = any(indicator in page_text for indicator in captcha_indicators)
        
        if is_blocked:
            print(f"BLOCKING: Detected anti-bot protection (CAPTCHA/blocking)")
            # For blocked pages, we could try different strategies
            # but for now, we'll just log it and continue
            return False
            
        return True
        
    except Exception as e:
        print(f"CONSENT: Error in consent handling: {e}")
        return False




@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_url(scrape_request: ScrapeRequest, http_request: Request):
    """Scrape a URL with advanced anti-detection and consent handling"""
    # Verify internal API key
    verify_internal_api_key(http_request)
    
    fingerprint = fingerprint_manager.get_random_fingerprint()
    
    try:
        async with async_playwright() as p:
            # Enhanced browser launch with stealth features
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox", 
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--disable-default-apps",
                    "--disable-extensions",
                    "--disable-plugins",
                    "--disable-images",  # Faster loading
                    "--disable-javascript-harmony-promises",
                    "--disable-background-timer-throttling",
                    "--disable-backgrounding-occluded-windows",
                    "--disable-renderer-backgrounding",
                    "--disable-features=TranslateUI",
                    "--disable-ipc-flooding-protection",
                    "--enable-features=NetworkService,NetworkServiceInProcess",
                    "--force-color-profile=srgb",
                    "--metrics-recording-only",
                    "--use-mock-keychain",
                ]
            )
            
            # Enhanced context with realistic settings and geolocation
            context = await browser.new_context(
                user_agent=fingerprint["user_agent"],
                viewport=fingerprint["viewport"],
                locale="en-US",
                timezone_id="America/New_York",
                # Simulate US user to avoid EU GDPR in some cases
                geolocation={"latitude": 40.7128, "longitude": -74.0060},  # NYC
                permissions=["geolocation"],
                # Add realistic browser features
                has_touch=False,
                is_mobile=False,
                device_scale_factor=1,
                screen={"width": 1920, "height": 1080},
            )
            
            # Set common cookies that might help with some sites
            common_cookies = [
                {"name": "cookieconsent_status", "value": "allow", "domain": ".yahoo.com", "path": "/"},
                {"name": "euconsent-v2", "value": "granted", "domain": ".yahoo.com", "path": "/"},
                {"name": "gdpr_status", "value": "accepted", "domain": ".reuters.com", "path": "/"},
            ]
            
            # Extract domain from URL for cookie setting
            from urllib.parse import urlparse
            domain = urlparse(scrape_request.url).netloc
            
            # Set cookies for the target domain
            try:
                domain_cookies = [
                    {"name": "cookieconsent_status", "value": "allow", "domain": f".{domain}", "path": "/"},
                    {"name": "consent", "value": "accepted", "domain": f".{domain}", "path": "/"},
                    {"name": "gdpr", "value": "true", "domain": f".{domain}", "path": "/"},
                ]
                await context.add_cookies(domain_cookies)
            except:
                pass  # Some domains might reject these cookies
            
            page = await context.new_page()
            
            # Enhanced realistic headers with more variety
            await page.set_extra_http_headers({
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate", 
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Cache-Control": "max-age=0",
                "DNT": "1",
                "Sec-GPC": "1"
            })
            
            # Add some realistic browser behavior
            await page.evaluate("""
                // Override webdriver detection
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                
                // Override permissions query
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );
                
                // Override plugin detection
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
                
                // Override language detection
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
            """)
            
            print(f"SCRAPING: Starting to scrape {scrape_request.url}")
            
            # Navigate with retry logic
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    response = await page.goto(
                        scrape_request.url, 
                        wait_until="networkidle", 
                        timeout=30000
                    )
                    break
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise e
                    print(f"SCRAPING: Retry {attempt + 1} after error: {e}")
                    await page.wait_for_timeout(2000)
            
            # Wait for dynamic content with progressive loading
            await page.wait_for_timeout(scrape_request.wait_time * 1000)
            
            # Enhanced consent dialog handling
            consent_handled = await handle_consent_dialogs(page)
            
            if consent_handled:
                # Wait for page to potentially reload after consent
                await page.wait_for_timeout(3000)
                
                # Check if page has changed/reloaded
                try:
                    await page.wait_for_load_state("networkidle", timeout=10000)
                except:
                    pass  # Continue even if networkidle times out
            
            # Additional wait for any lazy-loaded content
            await page.wait_for_timeout(2000)
            
            # Try to scroll to trigger lazy loading
            try:
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
                await page.wait_for_timeout(1000)
                await page.evaluate("window.scrollTo(0, 0)")
            except:
                pass
            
            # Extract content
            content = await page.content()
            
            # Get response details
            status_code = response.status if response else 0
            headers = dict(response.headers) if response else {}
            cookies = await context.cookies()
            
            await browser.close()
            
            print(f"SCRAPING: Successfully scraped {len(content)} characters from {scrape_request.url}")
            
            return ScrapeResponse(
                url=scrape_request.url,
                content=content,
                status_code=status_code,
                headers=headers,
                cookies={cookie['name']: cookie['value'] for cookie in cookies},
                success=True
            )
            
    except Exception as e:
        print(f"SCRAPING: Error scraping {scrape_request.url}: {e}")
        return ScrapeResponse(
            url=scrape_request.url,
            content="",
            status_code=0,
            headers={},
            cookies={},
            success=False,
            error=str(e)
        )



@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "browser_service"}
