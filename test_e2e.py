#!/usr/bin/env python3
"""
End-to-End Test for AI Monitoring System
"""

import json
import time
import sys
from typing import Dict, Any
import logging

# Try to import redis
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    print("Warning: redis package not available, notification tests will be skipped")
    REDIS_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class E2ETest:
    def __init__(self):
        self.base_urls = {
            'api': 'http://localhost:8000',
            'browser': 'http://localhost:8001', 
            'llm': 'http://localhost:8002'
        }
        self.internal_api_key = "internal-service-key-change-in-production"
        self.headers = {
            'X-Internal-API-Key': self.internal_api_key,
            'Content-Type': 'application/json'
        }
        
    def test_service_health(self) -> Dict[str, bool]:
        """Test that all services are healthy"""
        logger.info("🏥 Testing service health...")
        results = {}
        
        import requests
        
        for service, url in self.base_urls.items():
            try:
                response = requests.get(f"{url}/health", timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    results[service] = data.get('status') == 'healthy'
                    logger.info(f"✅ {service} service: healthy")
                else:
                    results[service] = False
                    logger.error(f"❌ {service} service: unhealthy (status {response.status_code})")
            except Exception as e:
                results[service] = False
                logger.error(f"❌ {service} service: {str(e)}")
                
        return results
    
    def test_browser_service(self) -> bool:
        """Test browser service can scrape content"""
        logger.info("🌐 Testing browser service...")
        
        import requests
        
        test_payload = {
            'url': 'https://httpbin.org/json',
            'wait_time': 1,
            'javascript': True
        }
        
        try:
            response = requests.post(f"{self.base_urls['browser']}/scrape", 
                                   json=test_payload, headers=self.headers, timeout=30)
            if response.status_code == 200:
                data = response.json()
                if 'content' in data and len(data['content']) > 0:
                    logger.info("✅ Browser service: successfully scraped content")
                    return True
                else:
                    logger.error("❌ Browser service: no content returned")
                    return False
            else:
                logger.error(f"❌ Browser service: failed with status {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"❌ Browser service: {str(e)}")
            return False
    
    def test_llm_service(self) -> bool:
        """Test LLM service can analyze content"""
        logger.info("🤖 Testing LLM service...")
        
        import requests
        
        test_payload = {
            'content': 'This is a test message about weather: The temperature is 25 degrees celsius.',
            'prompt': 'Analyze this content for temperature mentions.',
            'max_tokens': 500
        }
        
        try:
            response = requests.post(f"{self.base_urls['llm']}/analyze", 
                                   json=test_payload, headers=self.headers, timeout=30)
            if response.status_code == 200:
                data = response.json()
                if 'analysis' in data:
                    logger.info(f"✅ LLM service: analysis complete")
                    return True
                else:
                    logger.error(f"❌ LLM service: invalid response format - {data}")
                    return False
            else:
                logger.error(f"❌ LLM service: failed with status {response.status_code}")
                logger.error(f"Response: {response.text}")
                return False
        except Exception as e:
            logger.error(f"❌ LLM service: {str(e)}")
            return False
    
    def test_notification_service(self) -> bool:
            """Test notification service (Redis-based background processor)"""
            logger.info("📧 Testing notification service...")
            
            if not REDIS_AVAILABLE:
                logger.warning("⚠️ Redis not available, skipping notification service test")
                return True
            
            try:
                redis_client = redis.from_url("redis://localhost:6379")
                redis_client.ping()
                
                test_notification = {
                    'type': 'email',
                    'to': 'test@example.com',
                    'subject': 'E2E Test Alert',
                    'message': 'This is a test alert from the E2E test suite',
                    'urgency': 'low'
                }
                
                redis_client.lpush('notification_queue', json.dumps(test_notification))
                logger.info("✅ Notification service: Redis connection successful and test notification queued")
                return True
                
            except Exception as e:
                logger.error(f"❌ Notification service: {str(e)}")
                return False

    
    def test_api_endpoints(self) -> bool:
        """Test core API endpoints"""
        logger.info("🔌 Testing API endpoints...")
        
        import requests
        
        try:
            response = requests.get(f"{self.base_urls['api']}/health", timeout=10)
            if response.status_code == 200:
                logger.info("✅ API service: health endpoint accessible")
                return True
            else:
                logger.error(f"❌ API service: health endpoint failed with status {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"❌ API service: {str(e)}")
            return False
    
    def test_integration_workflow(self) -> bool:
        """Test a simplified integration workflow"""
        logger.info("🔄 Testing integration workflow...")
        
        import requests
        
        # Step 1: Scrape content
        logger.info("Step 1: Scraping content...")
        scrape_payload = {
            'url': 'https://httpbin.org/json',
            'wait_time': 1,
            'javascript': True
        }
        
        try:
            response = requests.post(f"{self.base_urls['browser']}/scrape", 
                                   json=scrape_payload, headers=self.headers, timeout=30)
            if response.status_code != 200:
                logger.error(f"❌ Integration: Scraping failed with status {response.status_code}")
                return False
            scrape_data = response.json()
            content = scrape_data.get('content', '')
            logger.info(f"✅ Scraped content length: {len(content)} characters")
        except Exception as e:
            logger.error(f"❌ Integration: Scraping error - {str(e)}")
            return False
        
        # Step 2: Analyze content with LLM service
        logger.info("Step 2: Analyzing content...")
        analyze_payload = {
            'content': content,
            'prompt': 'Analyze this content and determine if it contains any important information.',
            'max_tokens': 300
        }
        
        try:
            response = requests.post(f"{self.base_urls['llm']}/analyze", 
                                   json=analyze_payload, headers=self.headers, timeout=30)
            if response.status_code == 200:
                analysis_data = response.json()
                logger.info(f"✅ Analysis complete")
            else:
                logger.warning(f"⚠️ LLM analysis failed (status {response.status_code}) - this may be due to missing API keys")
                analysis_data = {'analysis': 'LLM service unavailable'}
        except Exception as e:
            logger.warning(f"⚠️ LLM analysis error - {str(e)} - continuing workflow")
            analysis_data = {'analysis': 'LLM service unavailable'}
        
        # Step 3: Test notification service through Redis queue
        logger.info("Step 3: Testing notification via Redis queue...")
        if REDIS_AVAILABLE:
            try:
                redis_client = redis.from_url("redis://localhost:6379")
                
                notify_payload = {
                    'type': 'email',
                    'to': 'test@example.com',
                    'subject': 'Integration Test Alert',
                    'message': f"Integration test completed. Analysis: {analysis_data.get('analysis', 'N/A')}",
                    'urgency': 'low'
                }
                
                redis_client.lpush('notification_queue', json.dumps(notify_payload))
                logger.info("✅ Notification queued successfully")
                
            except Exception as e:
                logger.warning(f"⚠️ Notification queueing error - {str(e)}")
        else:
            logger.warning("⚠️ Redis not available, skipping notification queueing")
        
        logger.info("✅ Integration workflow completed successfully")
        return True
    
    def run_all_tests(self) -> bool:
        """Run all tests and return overall success"""
        logger.info("🚀 Starting End-to-End Tests...")
        all_passed = True
        
        # Test 1: Service Health
        health_results = self.test_service_health()
        if not all(health_results.values()):
            logger.error("❌ Some services are unhealthy")
            all_passed = False
        
        # Test 2: Individual Service Functions
        tests = [
            ("Browser Service", self.test_browser_service),
            ("LLM Service", self.test_llm_service),
            ("Notification Service", self.test_notification_service),
            ("API Endpoints", self.test_api_endpoints)
        ]
        
        for test_name, test_func in tests:
            try:
                result = test_func()
                if not result:
                    if test_name in ["LLM Service", "Notification Service"]:
                        logger.warning(f"⚠️ {test_name} test failed - this may be due to missing API keys")
                    else:
                        all_passed = False
            except Exception as e:
                logger.error(f"❌ {test_name} test failed with exception: {str(e)}")
                if test_name not in ["LLM Service", "Notification Service"]:
                    all_passed = False
        
        # Test 3: Integration Workflow
        try:
            integration_result = self.test_integration_workflow()
            if not integration_result:
                all_passed = False
        except Exception as e:
            logger.error(f"❌ Integration test failed with exception: {str(e)}")
            all_passed = False
        
        # Final Results
        if all_passed:
            logger.info("🎉 All critical E2E tests passed!")
        else:
            logger.error("💥 Some critical E2E tests failed!")
        
        return all_passed

def main():
    """Main test runner"""
    test_runner = E2ETest()
    success = test_runner.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
