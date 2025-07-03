from fastapi import FastAPI, HTTPException
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

@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_url(request: ScrapeRequest):
    """Scrape a URL with realistic browser behavior"""
    
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
            response = await page.goto(request.url, wait_until="networkidle", timeout=30000)
            
            # Wait for dynamic content
            await page.wait_for_timeout(request.wait_time * 1000)
            
            # Extract content
            content = await page.content()
            
            # Get response details
            status_code = response.status if response else 0
            headers = dict(response.headers) if response else {}
            cookies = await context.cookies()
            
            await browser.close()
            
            return ScrapeResponse(
                url=request.url,
                content=content,
                status_code=status_code,
                headers=headers,
                cookies={cookie['name']: cookie['value'] for cookie in cookies},
                success=True
            )
            
    except Exception as e:
        return ScrapeResponse(
            url=request.url,
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
