import json
import redis
import requests
import time
import schedule
import threading
from datetime import datetime, timedelta
import os
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WorkerManager:
    def __init__(self):
        self.redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
        self.browser_service_url = os.getenv("BROWSER_SERVICE_URL", "http://duckerhub.com:8001")
        self.llm_service_url = os.getenv("LLM_SERVICE_URL", "http://duckerhub.com:8002")
        self.running = True
        
    def get_active_jobs(self):
        """Get all active jobs from Redis"""
        jobs = []
        for key in self.redis_client.scan_iter(match="job:*"):
            job_data = self.redis_client.hgetall(key)
            if job_data and job_data.get(b'is_active', b'true') == b'true':
                # Convert bytes to strings
                job = {k.decode(): v.decode() for k, v in job_data.items()}
                job['sources'] = json.loads(job['sources'])
                jobs.append(job)
        return jobs
    
    def should_run_job(self, job):
        """Check if job should run based on frequency"""
        last_run_key = f"job_last_run:{job['id']}"
        last_run = self.redis_client.get(last_run_key)
        
        if not last_run:
            return True
            
        last_run_time = datetime.fromisoformat(last_run.decode())
        frequency_minutes = int(job['frequency_minutes'])
        next_run_time = last_run_time + timedelta(minutes=frequency_minutes)
        
        return datetime.now() >= next_run_time
    
    def scrape_source(self, source_url):
        """Scrape a single source using browser service"""
        try:
            response = requests.post(
                f"{self.browser_service_url}/scrape",
                json={"url": source_url, "wait_time": 3},
                timeout=60
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Browser service error for {source_url}: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error scraping {source_url}: {e}")
            return None
    
    def analyze_content(self, content, prompt):
        """Analyze content using LLM service"""
        try:
            # Use requests with proper JSON handling
            response = requests.post(
                f"{self.llm_service_url}/analyze",
                json={
                    "content": content,
                    "prompt": prompt,
                    "max_tokens": 1000
                },
                timeout=30,
                headers={"Content-Type": "application/json"}
            )
            
            logger.info(f"LLM service response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"LLM analysis result: score={result.get('relevance_score', 0)}")
                return result
            else:
                logger.error(f"LLM service error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error analyzing content: {e}")
            return None
    
    def process_job(self, job):
        """Process a single job"""
        logger.info(f"Processing job: {job['name']}")
        
        job_run_id = f"run_{job['id']}_{int(time.time())}"
        alerts_generated = 0
        
        try:
            # Process each source
            for source_url in job['sources']:
                logger.info(f"Processing source: {source_url}")
                
                # Scrape content
                scrape_result = self.scrape_source(source_url)
                if not scrape_result or not scrape_result.get('success'):
                    logger.warning(f"Failed to scrape {source_url}")
                    continue
                
                logger.info(f"Scraped content length: {len(scrape_result.get('content', ''))}")
                
                # Analyze content
                analysis_result = self.analyze_content(
                    scrape_result['content'],
                    job['prompt']
                )
                
                if not analysis_result:
                    logger.warning(f"Failed to analyze content from {source_url}")
                    continue
                
                # Check if alert should be generated
                relevance_score = analysis_result.get('relevance_score', 0)
                threshold = int(job['threshold_score'])
                
                logger.info(f"Analysis: score={relevance_score}, threshold={threshold}")
                
                if relevance_score >= threshold:
                    alert_data = {
                        'job_id': job['id'],
                        'job_run_id': job_run_id,
                        'source_url': source_url,
                        'relevance_score': relevance_score,
                        'title': analysis_result.get('title', 'Alert'),
                        'content': analysis_result.get('summary', 'No summary available'),
                        'timestamp': datetime.now().isoformat()
                    }
                    
                    # Queue alert for notification service
                    self.redis_client.lpush("alert_queue", json.dumps(alert_data))
                    alerts_generated += 1
                    
                    logger.info(f"🚨 ALERT GENERATED! {source_url} (score: {relevance_score})")
                else:
                    logger.info(f"Score {relevance_score} below threshold {threshold}, no alert")
            
            # Update last run time
            self.redis_client.set(f"job_last_run:{job['id']}", datetime.now().isoformat())
            
            logger.info(f"Job {job['name']} completed. Alerts generated: {alerts_generated}")
            
        except Exception as e:
            logger.error(f"Error processing job {job['name']}: {e}")
    
    def run_scheduler(self):
        """Main scheduler loop"""
        logger.info("Worker Manager started")
        
        while self.running:
            try:
                # Get active jobs
                active_jobs = self.get_active_jobs()
                
                # Process jobs that are due
                for job in active_jobs:
                    if self.should_run_job(job):
                        # Run job in separate thread to avoid blocking
                        thread = threading.Thread(target=self.process_job, args=(job,))
                        thread.daemon = True
                        thread.start()
                
                # Sleep for 30 seconds before next check
                time.sleep(30)
                
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                time.sleep(30)
    
    def stop(self):
        """Stop the worker manager"""
        self.running = False

if __name__ == "__main__":
    manager = WorkerManager()
    
    try:
        manager.run_scheduler()
    except KeyboardInterrupt:
        logger.info("Shutting down worker manager...")
        manager.stop()
