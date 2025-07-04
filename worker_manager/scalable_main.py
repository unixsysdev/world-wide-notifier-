import json
import redis
import requests
import time
import asyncio
import aiohttp
from datetime import datetime, timedelta
import os
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from dataclasses import dataclass
from typing import List, Dict, Optional
import uuid

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class JobTask:
    job_id: str
    job_name: str
    source_url: str
    prompt: str
    threshold_score: int
    user_id: str
    job_run_id: str

class ScalableWorkerManager:
    def __init__(self):
        self.redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
        hostname = os.getenv("HOSTNAME", "localhost")
        self.browser_service_url = os.getenv("BROWSER_SERVICE_URL", f"http://{hostname}:8001")
        self.llm_service_url = os.getenv("LLM_SERVICE_URL", f"http://{hostname}:8002")
        self.worker_id = str(uuid.uuid4())[:8]
        self.running = True
        
        # Scalability settings
        self.max_concurrent_jobs = int(os.getenv("MAX_CONCURRENT_JOBS", "50"))
        self.max_concurrent_sources = int(os.getenv("MAX_CONCURRENT_SOURCES", "10"))
        self.job_batch_size = int(os.getenv("JOB_BATCH_SIZE", "100"))
        
        # Thread pool for I/O operations
        self.executor = ThreadPoolExecutor(max_workers=self.max_concurrent_jobs)
        
        logger.info(f"Worker {self.worker_id} initialized with {self.max_concurrent_jobs} max concurrent jobs")
    
    def get_database_jobs(self) -> List[Dict]:
        """Get jobs from database via API (more reliable than Redis scan)"""
        try:
            # This would ideally connect directly to DB, but for now use internal API
            response = requests.get(f"http://api_service:8000/internal/jobs/active", timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to fetch jobs from API: {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"Error fetching jobs from database: {e}")
            return []
    
    def should_run_job(self, job: Dict) -> bool:
        """Check if job should run based on frequency with distributed locking"""
        job_id = job['id']
        frequency_minutes = int(job['frequency_minutes'])
        
        # Use Redis distributed lock to prevent multiple workers from processing same job
        lock_key = f"job_lock:{job_id}"
        lock_value = f"{self.worker_id}:{int(time.time())}"
        
        # Try to acquire lock with expiration
        if self.redis_client.set(lock_key, lock_value, nx=True, ex=frequency_minutes * 60):
            # Check if job is actually due
            last_run_key = f"job_last_run:{job_id}"
            last_run = self.redis_client.get(last_run_key)
            
            if not last_run:
                return True
                
            last_run_time = datetime.fromisoformat(last_run.decode())
            next_run_time = last_run_time + timedelta(minutes=frequency_minutes)
            
            if datetime.now() >= next_run_time:
                return True
            else:
                # Release lock if job is not due
                self.redis_client.delete(lock_key)
                return False
        
        return False
    
    def create_job_tasks(self, job: Dict) -> List[JobTask]:
        """Break job into individual source tasks for parallel processing"""
        job_run_id = f"run_{job['id']}_{int(time.time())}"
        tasks = []
        
        for source_url in job['sources']:
            task = JobTask(
                job_id=job['id'],
                job_name=job['name'],
                source_url=source_url,
                prompt=job['prompt'],
                threshold_score=int(job['threshold_score']),
                user_id=job['user_id'],
                job_run_id=job_run_id
            )
            tasks.append(task)
        
        return tasks
    
    async def scrape_source_async(self, session: aiohttp.ClientSession, source_url: str) -> Optional[Dict]:
        """Async scrape using aiohttp for better concurrency"""
        try:
            async with session.post(
                f"{self.browser_service_url}/scrape",
                json={"url": source_url, "wait_time": 3},
                timeout=aiohttp.ClientTimeout(total=60)
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    logger.error(f"Browser service error for {source_url}: {response.status}")
                    return None
        except Exception as e:
            logger.error(f"Error scraping {source_url}: {e}")
            return None
    
    async def analyze_content_async(self, session: aiohttp.ClientSession, content: str, prompt: str) -> Optional[Dict]:
        """Async LLM analysis"""
        try:
            async with session.post(
                f"{self.llm_service_url}/analyze",
                json={
                    "content": content,
                    "prompt": prompt,
                    "max_tokens": 1000
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    logger.error(f"LLM service error: {response.status}")
                    return None
        except Exception as e:
            logger.error(f"Error analyzing content: {e}")
            return None
    
    async def process_task_async(self, session: aiohttp.ClientSession, task: JobTask) -> bool:
        """Process a single task (job + source) asynchronously"""
        try:
            logger.info(f"Processing task: {task.job_name} - {task.source_url}")
            
            # Scrape content
            scrape_result = await self.scrape_source_async(session, task.source_url)
            if not scrape_result or not scrape_result.get('success'):
                logger.warning(f"Failed to scrape {task.source_url}")
                return False
            
            # Analyze content
            analysis_result = await self.analyze_content_async(
                session, 
                scrape_result['content'], 
                task.prompt
            )
            
            if not analysis_result:
                logger.warning(f"Failed to analyze content from {task.source_url}")
                return False
            
            # Check if alert should be generated
            relevance_score = analysis_result.get('relevance_score', 0)
            
            if relevance_score >= task.threshold_score:
                alert_data = {
                    'job_id': task.job_id,
                    'job_run_id': task.job_run_id,
                    'source_url': task.source_url,
                    'relevance_score': relevance_score,
                    'title': analysis_result.get('title', 'Alert'),
                    'content': analysis_result.get('summary', 'No summary available'),
                    'timestamp': datetime.now().isoformat(),
                    'user_id': task.user_id
                }
                
                # Queue alert for notification service
                self.redis_client.lpush("alert_queue", json.dumps(alert_data))
                
                logger.info(f"🚨 ALERT GENERATED! {task.source_url} (score: {relevance_score})")
                return True
            else:
                logger.info(f"Score {relevance_score} below threshold {task.threshold_score}")
                return False
                
        except Exception as e:
            logger.error(f"Error processing task {task.job_name} - {task.source_url}: {e}")
            return False
    
    async def process_job_batch_async(self, jobs: List[Dict]) -> None:
        """Process a batch of jobs concurrently"""
        if not jobs:
            return
            
        # Create all tasks from all jobs
        all_tasks = []
        for job in jobs:
            if self.should_run_job(job):
                tasks = self.create_job_tasks(job)
                all_tasks.extend(tasks)
        
        if not all_tasks:
            return
        
        logger.info(f"Processing {len(all_tasks)} tasks from {len(jobs)} jobs")
        
        # Process tasks in batches to avoid overwhelming services
        async with aiohttp.ClientSession() as session:
            semaphore = asyncio.Semaphore(self.max_concurrent_sources)
            
            async def process_with_semaphore(task):
                async with semaphore:
                    return await self.process_task_async(session, task)
            
            # Process all tasks concurrently
            results = await asyncio.gather(
                *[process_with_semaphore(task) for task in all_tasks],
                return_exceptions=True
            )
            
            # Update job run times
            job_ids = set(task.job_id for task in all_tasks)
            for job_id in job_ids:
                self.redis_client.set(f"job_last_run:{job_id}", datetime.now().isoformat())
        
        successful_tasks = sum(1 for r in results if r is True)
        logger.info(f"Completed batch: {successful_tasks}/{len(all_tasks)} tasks successful")
    
    def run_async_processor(self):
        """Run the async event loop"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            loop.run_until_complete(self.process_jobs_continuously())
        finally:
            loop.close()
    
    async def process_jobs_continuously(self):
        """Main processing loop with async/await"""
        logger.info(f"Worker {self.worker_id} started async processing")
        
        while self.running:
            try:
                # Get active jobs
                active_jobs = self.get_database_jobs()
                
                if active_jobs:
                    # Process jobs in batches
                    for i in range(0, len(active_jobs), self.job_batch_size):
                        batch = active_jobs[i:i + self.job_batch_size]
                        await self.process_job_batch_async(batch)
                
                # Sleep between cycles
                await asyncio.sleep(30)
                
            except Exception as e:
                logger.error(f"Error in main processing loop: {e}")
                await asyncio.sleep(30)
    
    def run_scheduler(self):
        """Main entry point - starts async processing"""
        logger.info(f"Scalable Worker Manager {self.worker_id} starting...")
        
        # Run async processor in thread
        processor_thread = threading.Thread(target=self.run_async_processor)
        processor_thread.daemon = True
        processor_thread.start()
        
        # Keep main thread alive
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Shutting down worker manager...")
            self.stop()
    
    def stop(self):
        """Stop the worker manager"""
        self.running = False
        self.executor.shutdown(wait=True)

if __name__ == "__main__":
    manager = ScalableWorkerManager()
    
    try:
        manager.run_scheduler()
    except KeyboardInterrupt:
        logger.info("Shutting down worker manager...")
        manager.stop()
