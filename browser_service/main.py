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
    """Handle common cookie consent dialogs, especially Yahoo Finance GDPR"""
    try:
        # Wait a bit for the page to fully load
        await page.wait_for_timeout(2000)
        
        # Check if this is a Yahoo consent page (contains specific Slovak text)
        page_content = await page.content()
        
        if "Yahoo je súčasťou skupiny značiek" in page_content or "Prijať všetko" in page_content:
            # Yahoo GDPR consent page detected - try to click accept
            
            # Wait for the button to be ready
            await page.wait_for_timeout(1000)
            
            try:
                # Try to find and click the "Accept all" button
                accept_button = page.locator('button[name="agree"]').first
                if await accept_button.is_visible(timeout=3000):
                    await accept_button.click()
                    # Wait for page to navigate
                    await page.wait_for_load_state("networkidle", timeout=15000)
                    return
            except:
                pass
            
            try:
                # Try the class-based selector
                accept_button = page.locator('.accept-all').first
                if await accept_button.is_visible(timeout=3000):
                    await accept_button.click()
                    await page.wait_for_load_state("networkidle", timeout=15000)
                    return
            except:
                pass
            
            try:
                # Try text-based selection
                accept_button = page.get_by_text("Prijať všetko")
                if await accept_button.is_visible(timeout=3000):
                    await accept_button.click()
                    await page.wait_for_load_state("networkidle", timeout=15000)
                    return
            except:
                pass
        
        # Generic consent dialog handling for other sites
        consent_selectors = [
            'button[id*="accept"]',
            'button[class*="accept"]',
            'button:has-text("Accept")',
            'button:has-text("OK")',
            'button:has-text("I agree")',
            'button:has-text("Continue")',
            '#onetrust-accept-btn-handler',
            '#truste-consent-button',
            '.cc-dismiss',
        ]
        
        for selector in consent_selectors:
            try:
                button = page.locator(selector).first
                if await button.is_visible(timeout=2000):
                    await button.click()
                    await page.wait_for_timeout(1000)
                    return
            except:
                continue
                
    except Exception as e:
        # If consent handling fails, continue anyway
        pass



@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_url(scrape_request: ScrapeRequest, http_request: Request):
    """Scrape a URL with realistic browser behavior"""
    # Verify internal API key
    verify_internal_api_key(http_request)
    
    fingerprint = fingerprint_manager.get_random_fingerprint()
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--disable-default-apps"
                ]
            )
            
            context = await browser.new_context(
                user_agent=fingerprint["user_agent"],
                viewport=fingerprint["viewport"]
            )
            
            page = await context.new_page()
            
            # Set realistic headers
            await page.set_extra_http_headers({
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1"
            })
            
            # Navigate to target URL
            response = await page.goto(scrape_request.url, wait_until="networkidle", timeout=30000)
            
            # Wait for dynamic content
            await page.wait_for_timeout(scrape_request.wait_time * 1000)
            
            # Handle cookie consent dialogs (especially for Yahoo Finance)
            await handle_consent_dialogs(page)
            
            # Wait a bit more for content to load after consent handling
            await page.wait_for_timeout(2000)
            
            # Extract content
            content = await page.content()
            
            # Get response details
            status_code = response.status if response else 0
            headers = dict(response.headers) if response else {}
            cookies = await context.cookies()
            
            await browser.close()
            
            return ScrapeResponse(
                url=scrape_request.url,
                content=content,
                status_code=status_code,
                headers=headers,
                cookies={cookie['name']: cookie['value'] for cookie in cookies},
                success=True
            )
            
    except Exception as e:
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
