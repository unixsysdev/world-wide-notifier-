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
import json
import psycopg2
import psycopg2.extras

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
        self.data_storage_url = os.getenv("DATA_STORAGE_URL", f"http://{hostname}:8004")
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
            internal_api_key = os.getenv("INTERNAL_API_KEY", "internal-service-key-change-in-production")
            headers = {"X-Internal-API-Key": internal_api_key}
            response = requests.get(f"http://api_service:8000/internal/jobs/active", headers=headers, timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to fetch jobs from API: {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"Error fetching jobs from database: {e}")
            return []
    
    def get_job_for_immediate_run(self, job_id: str) -> Dict or None:
            """Get a specific job for immediate run, regardless of schedule"""
            try:
                internal_api_key = os.getenv("INTERNAL_API_KEY", "internal-service-key-change-in-production")
                headers = {"X-Internal-API-Key": internal_api_key}
                response = requests.get(f"http://api_service:8000/internal/jobs/{job_id}", headers=headers, timeout=10)
                if response.status_code == 200:
                    job_data = response.json()
                    # Ensure the job is active
                    if job_data.get('is_active', False):
                        logger.info(f"Successfully fetched job {job_id} for immediate run")
                        return job_data
                    else:
                        logger.warning(f"Job {job_id} is not active, skipping immediate run")
                        return None
                else:
                    logger.error(f"Failed to fetch job {job_id}: {response.status_code}")
                    return None
            except Exception as e:
                logger.error(f"Error fetching job {job_id}: {e}")
                return None
        

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
        from datetime import datetime
        
        # Create a proper job_run record in the database
        job_run_id = str(uuid.uuid4())
        
        try:
            # Connect to database to create job_run record
            DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://monitoring_user:monitoring_pass@localhost:5432/monitoring_db")
            conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
            conn.autocommit = True
            
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO job_runs (id, job_id, status, started_at, sources_processed, alerts_generated)
                    VALUES (%s, %s, 'running', NOW(), 0, 0)
                """, (job_run_id, job['id']))
            
            conn.close()
            logger.info(f"Created job_run record: {job_run_id} for job {job['id']}")
            
            # Start MongoDB tracking (non-blocking)
            try:
                loop = asyncio.get_event_loop()
                loop.create_task(self.start_job_execution_tracking(job, job_run_id))
            except Exception as e:
                logger.warning(f"Could not start job execution tracking: {e}")
            
        except Exception as e:
            logger.error(f"Failed to create job_run record: {e}")
            # Fallback to time-based ID if database fails
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

    async def start_job_execution_tracking(self, job: Dict, job_run_id: str) -> bool:
        """Start tracking job execution in MongoDB"""
        try:
            internal_api_key = os.getenv("INTERNAL_API_KEY", "internal-service-key-change-in-production")
            headers = {"X-Internal-API-Key": internal_api_key, "Content-Type": "application/json"}
            
            execution_data = {
                "job_id": job['id'],
                "job_run_id": job_run_id,
                "user_id": job['user_id'],
                "job_name": job['name'],
                "user_prompt": job['prompt'],
                "sources": job['sources'],
                "frequency_minutes": job['frequency_minutes'],
                "threshold_score": job['threshold_score'],
                "started_at": datetime.now().isoformat()
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.data_storage_url}/job-execution/start",
                    json=execution_data,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        logger.info(f"✅ Started job execution tracking for {job_run_id}")
                        return True
                    else:
                        logger.warning(f"Failed to start job execution tracking: {response.status}")
                        return False
        except Exception as e:
            logger.warning(f"Error starting job execution tracking: {e}")
            return False

    async def store_source_data(self, job_run_id: str, source_url: str, scrape_result: Dict) -> bool:
        """Store raw source data in MongoDB"""
        try:
            internal_api_key = os.getenv("INTERNAL_API_KEY", "internal-service-key-change-in-production")
            headers = {"X-Internal-API-Key": internal_api_key, "Content-Type": "application/json"}
            
            source_data = {
                "source_url": source_url,
                "raw_html": scrape_result.get('raw_html', ''),
                "cleaned_content": scrape_result.get('content', ''),
                "scrape_timestamp": datetime.now().isoformat(),
                "response_time_ms": scrape_result.get('response_time_ms', 0),
                "status_code": scrape_result.get('status_code', 200),
                "error_message": scrape_result.get('error_message')
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.data_storage_url}/job-execution/{job_run_id}/source-data",
                    json=source_data,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        logger.debug(f"✅ Stored source data for {source_url}")
                        return True
                    else:
                        logger.warning(f"Failed to store source data: {response.status}")
                        return False
        except Exception as e:
            logger.warning(f"Error storing source data: {e}")
            return False

    async def store_llm_analysis(self, job_run_id: str, source_url: str, analysis_result: Dict, 
                                user_prompt: str, alert_generated: bool) -> bool:
        """Store LLM analysis data in MongoDB"""
        try:
            internal_api_key = os.getenv("INTERNAL_API_KEY", "internal-service-key-change-in-production")
            headers = {"X-Internal-API-Key": internal_api_key, "Content-Type": "application/json"}
            
            analysis_data = {
                "source_url": source_url,
                "llm_provider": analysis_result.get('provider', 'unknown'),
                "model_name": analysis_result.get('model', 'unknown'),
                "system_prompt": analysis_result.get('system_prompt', 'Default monitoring prompt'),
                "user_prompt": user_prompt,
                "raw_response": analysis_result.get('raw_response', ''),
                "parsed_response": analysis_result.get('parsed_response', {}),
                "relevance_score": analysis_result.get('relevance_score', 0),
                "processing_time_ms": analysis_result.get('processing_time_ms', 0),
                "analysis_timestamp": datetime.now().isoformat(),
                "alert_generated": alert_generated,
                "alert_title": analysis_result.get('title') if alert_generated else None,
                "alert_content": analysis_result.get('summary') if alert_generated else None
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.data_storage_url}/job-execution/{job_run_id}/llm-analysis",
                    json=analysis_data,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        logger.debug(f"✅ Stored LLM analysis for {source_url}")
                        return True
                    else:
                        logger.warning(f"Failed to store LLM analysis: {response.status}")
                        return False
        except Exception as e:
            logger.warning(f"Error storing LLM analysis: {e}")
            return False

    async def update_job_progress(self, job_run_id: str, sources_processed: int, 
                                  analysis_results: List[Dict] = None, alerts_generated: int = 0):
        """Update job run progress in real-time for live dashboard"""
        try:
            DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://monitoring_user:monitoring_pass@localhost:5432/monitoring_db")
            conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
            conn.autocommit = True
            
            # Prepare incremental analysis summary for live tracking
            analysis_summary = {}
            if analysis_results:
                analysis_summary = {
                    "sources_analyzed": len(analysis_results),
                    "alerts_generated": alerts_generated,
                    "analysis_details": analysis_results[-10:],  # Keep last 10 for live view
                    "last_updated": datetime.now().isoformat(),
                    "status": "in_progress"
                }
            
            with conn.cursor() as cur:
                if analysis_results:
                    cur.execute("""
                        UPDATE job_runs 
                        SET sources_processed = %s,
                            alerts_generated = %s,
                            analysis_summary = %s
                        WHERE id = %s
                    """, (
                        sources_processed,
                        alerts_generated,
                        json.dumps(analysis_summary),
                        job_run_id
                    ))
                else:
                    cur.execute("""
                        UPDATE job_runs 
                        SET sources_processed = %s,
                            alerts_generated = %s
                        WHERE id = %s
                    """, (
                        sources_processed,
                        alerts_generated,
                        job_run_id
                    ))
            
            conn.close()
            logger.debug(f"Updated job_run {job_run_id} progress: {sources_processed} sources processed, {alerts_generated} alerts")
            
            # Broadcast job execution update via WebSocket
            await self.broadcast_execution_update(job_run_id, sources_processed, analysis_results, alerts_generated)
            
        except Exception as e:
            logger.warning(f"Failed to update job_run progress {job_run_id}: {e}")

    async def broadcast_execution_update(self, job_run_id: str, sources_processed: int, 
                                       analysis_results: List[Dict] = None, alerts_generated: int = 0):
        """Broadcast job execution update to WebSocket clients"""
        try:
            api_url = os.getenv("API_SERVICE_URL", "http://api_service:8000")
            headers = {
                "X-Internal-API-Key": os.getenv("INTERNAL_API_KEY", "internal-service-key-change-in-production"),
                "Content-Type": "application/json"
            }
            
            execution_data = {
                "run_id": job_run_id,
                "sources_processed": sources_processed,
                "alerts_generated": alerts_generated,
                "last_updated": datetime.now().isoformat(),
                "analysis_details": analysis_results[-5:] if analysis_results else []  # Last 5 for live updates
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{api_url}/jobs/execution-update",
                    json=execution_data,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    if response.status == 200:
                        logger.debug(f"✅ Broadcasted execution update for {job_run_id}")
                    else:
                        logger.warning(f"Failed to broadcast execution update: {response.status}")
                        
        except Exception as e:
            logger.warning(f"Error broadcasting execution update: {e}")

    async def complete_job_execution_tracking(self, job_run_id: str, summary: Dict) -> bool:
        """Complete job execution tracking with final summary"""
        try:
            internal_api_key = os.getenv("INTERNAL_API_KEY", "internal-service-key-change-in-production")
            headers = {"X-Internal-API-Key": internal_api_key, "Content-Type": "application/json"}
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.data_storage_url}/job-execution/{job_run_id}/complete",
                    json=summary,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        logger.info(f"✅ Completed job execution tracking for {job_run_id}")
                        return True
                    else:
                        logger.warning(f"Failed to complete job execution tracking: {response.status}")
                        return False
        except Exception as e:
            logger.warning(f"Error completing job execution tracking: {e}")
            return False

    
    async def should_create_alert(self, task: JobTask, analysis_result: Dict) -> bool:
        """Check if alert should be created based on cooldown and rate limiting"""
        try:
            # Get job settings from database
            job_settings = await self.get_job_settings(task.job_id)
            if not job_settings:
                return True  # Default to allow if no settings found
            
            alert_cooldown_minutes = job_settings.get('alert_cooldown_minutes', 60)
            max_alerts_per_hour = job_settings.get('max_alerts_per_hour', 5)
            
            # Check cooldown - based on content hash to prevent duplicates
            content_hash = self.get_content_hash(analysis_result.get('summary', ''))
            cooldown_key = f"alert_cooldown:{task.job_id}:{content_hash}"
            
            if self.redis_client.exists(cooldown_key):
                logger.info(f"Alert suppressed - cooldown active for job {task.job_id}")
                return False
            
            # Check rate limiting - max alerts per hour for this job
            rate_limit_key = f"alert_rate_limit:{task.job_id}:{datetime.now().strftime('%Y-%m-%d-%H')}"
            current_alert_count = self.redis_client.get(rate_limit_key)
            
            if current_alert_count and int(current_alert_count) >= max_alerts_per_hour:
                logger.info(f"Alert suppressed - rate limit exceeded for job {task.job_id}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking alert cooldown/rate limiting: {e}")
            return True  # Default to allow on error
    
    
    async def get_unacknowledged_alert(self, job_id: str, source_url: str) -> Dict or None:
        """Get existing unacknowledged alert for the same job+source"""
        try:
            api_url = os.getenv("API_SERVICE_URL", "http://api_service:8000")
            headers = {
                "X-Internal-API-Key": os.getenv("INTERNAL_API_KEY", "internal-service-key-change-in-production"),
                "Content-Type": "application/json"
            }
            
            # Query for unacknowledged alerts for this job+source
            params = {
                "job_id": job_id,
                "source_url": source_url,
                "unacknowledged_only": "true",
                "limit": 1
            }
            
            response = requests.get(f"{api_url}/internal/alerts", params=params, headers=headers, timeout=5)
            if response.status_code == 200:
                alerts = response.json()
                return alerts[0] if alerts else None
            else:
                logger.warning(f"Failed to get unacknowledged alerts: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error checking for unacknowledged alerts: {e}")
            return None
    
    async def set_acknowledgment_cooldown(self, job_id: str, source_url: str, cooldown_minutes: int):
        """Set cooldown period after alert acknowledgment"""
        try:
            alert_identity = f"{job_id}:{source_url}"
            cooldown_key = f"alert_cooldown:{alert_identity}"
            
            # Set cooldown period
            self.redis_client.setex(cooldown_key, cooldown_minutes * 60, "1")
            logger.info(f"Set {cooldown_minutes}min cooldown for {source_url}")
            
        except Exception as e:
            logger.error(f"Error setting acknowledgment cooldown: {e}")    
    async def record_alert_created(self, task: JobTask) -> None:
        """Record that an alert was created for cooldown and rate limiting"""
        try:
            # Get job settings from database
            job_settings = await self.get_job_settings(task.job_id)
            if not job_settings:
                return
            
            alert_cooldown_minutes = job_settings.get('alert_cooldown_minutes', 60)
            
            # Set cooldown key
            content_hash = self.get_content_hash(task.source_url)  # Use source URL as proxy for content
            cooldown_key = f"alert_cooldown:{task.job_id}:{content_hash}"
            self.redis_client.setex(cooldown_key, alert_cooldown_minutes * 60, "1")
            
            # Increment rate limit counter
            rate_limit_key = f"alert_rate_limit:{task.job_id}:{datetime.now().strftime('%Y-%m-%d-%H')}"
            self.redis_client.incr(rate_limit_key)
            self.redis_client.expire(rate_limit_key, 3600)  # Expire in 1 hour
            
        except Exception as e:
            logger.error(f"Error recording alert creation: {e}")
    
    def get_content_hash(self, content: str) -> str:
        """Generate a hash for content to detect duplicates"""
        import hashlib
        return hashlib.md5(content.encode()).hexdigest()[:16]
    
    async def get_job_settings(self, job_id: str) -> Optional[Dict]:
        """Get job settings from cache or database"""
        try:
            # Check cache first
            cache_key = f"job_settings:{job_id}"
            cached_settings = self.redis_client.get(cache_key)
            
            if cached_settings:
                return json.loads(cached_settings)
            
            # Get from database via API
            api_url = os.getenv("API_SERVICE_URL", "http://api_service:8000")
            headers = {
                "X-Internal-API-Key": os.getenv("INTERNAL_API_KEY", "internal-service-key-change-in-production"),
                "Content-Type": "application/json"
            }
            
            response = requests.get(f"{api_url}/internal/jobs/{job_id}", headers=headers, timeout=5)
            if response.status_code == 200:
                job_data = response.json()
                settings = {
                    'alert_cooldown_minutes': job_data.get('alert_cooldown_minutes', 60),
                    'max_alerts_per_hour': job_data.get('max_alerts_per_hour', 5),
                    'notification_channel_ids': job_data.get('notification_channel_ids', [])
                }
                
                # Cache for 5 minutes
                self.redis_client.setex(cache_key, 300, json.dumps(settings))
                return settings
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting job settings for {job_id}: {e}")
            return None
    
    async def scrape_source_async(self, session: aiohttp.ClientSession, source_url: str) -> Optional[Dict]:
        """Async scrape using aiohttp for better concurrency"""
        try:
            internal_api_key = os.getenv("INTERNAL_API_KEY", "internal-service-key-change-in-production")
            headers = {"X-Internal-API-Key": internal_api_key}
            async with session.post(
                f"{self.browser_service_url}/scrape",
                json={"url": source_url, "wait_time": 3},
                headers=headers,
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
            internal_api_key = os.getenv("INTERNAL_API_KEY", "internal-service-key-change-in-production")
            headers = {"X-Internal-API-Key": internal_api_key}
            async with session.post(
                f"{self.llm_service_url}/analyze",
                json={
                    "content": content,
                    "prompt": prompt,
                    "max_tokens": 1000
                },
                headers=headers,
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
    
    async def process_task_async(self, session: aiohttp.ClientSession, task: JobTask) -> dict or bool:
            """Process a single task (job + source) asynchronously"""
            try:
                logger.info(f"Processing task: {task.job_name} - {task.source_url}")
                
                # Scrape content
                scrape_result = await self.scrape_source_async(session, task.source_url)
                if not scrape_result or not scrape_result.get('success'):
                    logger.warning(f"Failed to scrape {task.source_url}")
                    return False
                
                # Store source data (non-blocking)
                asyncio.create_task(self.store_source_data(task.job_run_id, task.source_url, scrape_result))
                
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
                
                # Prepare detailed analysis info for tracking
                analysis_info = {
                    'source_url': task.source_url,
                    'relevance_score': relevance_score,
                    'title': analysis_result.get('title', 'No title'),
                    'summary': analysis_result.get('summary', 'No summary available'),
                    'threshold_score': task.threshold_score,
                    'alert_generated': False,
                    'processed_at': datetime.now().isoformat()
                }
                
                if relevance_score >= task.threshold_score:
                    # Check alert cooldown and rate limiting
                    if not await self.should_create_alert(task, analysis_result):
                        logger.info(f"Alert suppressed due to cooldown/rate limiting for {task.source_url}")
                        analysis_info['alert_generated'] = False
                        analysis_info['suppressed_reason'] = 'cooldown/rate limiting'
                        return analysis_info
                    
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
                    # Save alert to database via API
                    try:
                        api_url = os.getenv("API_SERVICE_URL", "http://api_service:8000")
                        headers = {
                            "X-Internal-API-Key": os.getenv("INTERNAL_API_KEY", "internal-service-key-change-in-production"),
                            "Content-Type": "application/json"
                        }
                        
                        response = requests.post(f"{api_url}/alerts", json=alert_data, headers=headers, timeout=5)
                        if response.status_code == 200:
                            logger.info(f"✅ Alert saved to database")
                            # Record alert creation for rate limiting
                            await self.record_alert_created(task)
                            analysis_info['alert_generated'] = True
                            
                            # Get the alert ID from the response and add it to alert_data
                            response_data = response.json()
                            alert_data['id'] = response_data.get('alert_id')
                            logger.info(f"Alert ID from database: {alert_data['id']}")
                        else:
                            logger.error(f"Failed to save alert to database: {response.status_code}")
                            analysis_info['alert_generated'] = False
                            analysis_info['error'] = f"Database save failed: {response.status_code}"
                    except Exception as e:
                        logger.error(f"Error saving alert to database: {e}")
                        analysis_info['alert_generated'] = False
                        analysis_info['error'] = f"Database save error: {e}"
                    
                    # Queue alert for notification service (only if successfully saved)
                    if analysis_info.get('alert_generated'):
                        self.redis_client.lpush("alert_queue", json.dumps(alert_data))
                        logger.info(f"Alert queued for notification with ID: {alert_data.get('id')}")
                    
                    logger.info(f"🚨 ALERT GENERATED! {task.source_url} (score: {relevance_score})")
                    
                    # Store LLM analysis with alert info (non-blocking)
                    asyncio.create_task(self.store_llm_analysis(
                        task.job_run_id, task.source_url, analysis_result, 
                        task.prompt, True
                    ))
                    
                    return analysis_info
                else:
                    logger.info(f"Score {relevance_score} below threshold {task.threshold_score}")
                    analysis_info['alert_generated'] = False
                    analysis_info['below_threshold'] = True
                    
                    # Store LLM analysis without alert (non-blocking)
                    asyncio.create_task(self.store_llm_analysis(
                        task.job_run_id, task.source_url, analysis_result, 
                        task.prompt, False
                    ))
                    
                    return analysis_info
                    
            except Exception as e:
                logger.error(f"Error processing task {task.job_name} - {task.source_url}: {e}")
                return False

    
    async def process_job_batch_async(self, jobs: List[Dict], is_immediate: bool = False) -> None:
                """Process a batch of jobs concurrently"""
                if not jobs:
                    return
                    
                # Create all tasks from all jobs and track job runs
                all_tasks = []
                job_run_tracking = {}  # job_run_id -> {job_id, sources_total, sources_processed, alerts_generated}
                
                for job in jobs:
                    # For immediate jobs, skip the frequency check
                    if is_immediate or self.should_run_job(job):
                        tasks = self.create_job_tasks(job)
                        all_tasks.extend(tasks)
                        
                        # Track job run for finalization
                        if tasks:
                            job_run_id = tasks[0].job_run_id
                            job_run_tracking[job_run_id] = {
                                "job_id": job["id"],
                                "sources_total": len(tasks),
                                "sources_processed": 0,
                                "alerts_generated": 0,
                                "analysis_results": []
                            }
                
                if not all_tasks:
                    return
                
                logger.info(f"Processing {len(all_tasks)} tasks from {len(jobs)} jobs")
                
                # Process tasks in batches to avoid overwhelming services
                async with aiohttp.ClientSession() as session:
                    semaphore = asyncio.Semaphore(self.max_concurrent_sources)
                    
                    async def process_with_semaphore(task):
                        async with semaphore:
                            result = await self.process_task_async(session, task)
                            # Track results for job run finalization
                            if task.job_run_id in job_run_tracking:
                                job_run_tracking[task.job_run_id]["sources_processed"] += 1
                                if result and isinstance(result, dict):
                                    # Store analysis details for all results (alert generated or not)
                                    job_run_tracking[task.job_run_id]["analysis_results"].append(result)
                                    # Count alerts only if actually generated
                                    if result.get('alert_generated', False):
                                        job_run_tracking[task.job_run_id]["alerts_generated"] += 1
                                elif result is True:
                                    # Legacy case - just count as alert generated
                                    job_run_tracking[task.job_run_id]["alerts_generated"] += 1
                                
                                # Update progress in real-time for live dashboard
                                tracking = job_run_tracking[task.job_run_id]
                                await self.update_job_progress(
                                    task.job_run_id,
                                    tracking["sources_processed"],
                                    tracking["analysis_results"],
                                    tracking["alerts_generated"]
                                )
                            return result
                    
                    # Process all tasks concurrently
                    results = await asyncio.gather(
                        *[process_with_semaphore(task) for task in all_tasks],
                        return_exceptions=True
                    )
                    
                    # Finalize all job runs with proper source counts
                    for job_run_id, tracking in job_run_tracking.items():
                        await self.finalize_job_run(
                            job_run_id,
                            tracking["sources_processed"],
                            tracking["alerts_generated"],
                            tracking.get("analysis_results", [])
                        )
                    
                    # Update job run times
                    job_ids = set(task.job_id for task in all_tasks)
                    for job_id in job_ids:
                        self.redis_client.set(f"job_last_run:{job_id}", datetime.now().isoformat())
                
                successful_tasks = sum(1 for r in results if r is True or (isinstance(r, dict) and r.get('relevance_score') is not None))
                logger.info(f"Completed batch: {successful_tasks}/{len(all_tasks)} tasks successful")


    async def finalize_job_run(self, job_run_id: str, sources_processed: int, alerts_generated: int, 
                              analysis_results: List[Dict], error_message: str = None):
            """Update job_run record with final results and analysis summary"""
            from datetime import datetime
            
            try:
                # Connect to database
                DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://monitoring_user:monitoring_pass@localhost:5432/monitoring_db")
                conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
                conn.autocommit = True
                
                # Prepare analysis summary
                analysis_summary = {
                    "total_sources": sources_processed,
                    "sources_analyzed": len(analysis_results),
                    "alerts_generated": alerts_generated,
                    "analysis_details": analysis_results,
                    "completed_at": datetime.now().isoformat()
                }
                
                if error_message:
                    analysis_summary["error"] = error_message
                
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE job_runs 
                        SET status = %s, 
                            completed_at = NOW(),
                            sources_processed = %s,
                            alerts_generated = %s,
                            analysis_summary = %s
                        WHERE id = %s
                    """, (
                        'failed' if error_message else 'completed',
                        sources_processed,
                        alerts_generated,
                        json.dumps(analysis_summary),
                        job_run_id
                    ))
                
                conn.close()
                logger.info(f"Finalized job_run {job_run_id}: {sources_processed} sources, {alerts_generated} alerts")
                
                # Complete MongoDB tracking (non-blocking)
                try:
                    loop = asyncio.get_event_loop()
                    loop.create_task(self.complete_job_execution_tracking(job_run_id, analysis_summary))
                except Exception as e:
                    logger.warning(f"Could not complete job execution tracking: {e}")
                
            except Exception as e:
                logger.error(f"Failed to finalize job_run {job_run_id}: {e}")
    
    
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
                    # Check for immediate run requests from job_queue
                    immediate_jobs = []
                    while True:
                        queued_job = self.redis_client.rpop("job_queue")
                        if not queued_job:
                            break
                        
                        try:
                            job_message = json.loads(queued_job.decode())
                            job_id = job_message.get("job_id")
                            if job_id:
                                logger.info(f"Processing immediate run request for job {job_id}")
                                # Get the specific job directly from API regardless of schedule
                                job_data = self.get_job_for_immediate_run(job_id)
                                if job_data:
                                    immediate_jobs.append(job_data)
                                else:
                                    logger.error(f"Could not fetch job {job_id} for immediate run")
                        except Exception as e:
                            logger.error(f"Error processing queued job: {e}")
                    
                    # Process immediate jobs first
                    if immediate_jobs:
                        logger.info(f"Processing {len(immediate_jobs)} immediate jobs")
                        await self.process_job_batch_async(immediate_jobs, is_immediate=True)
                    
                    # Get scheduled active jobs (but skip if we just processed immediate jobs)
                    if not immediate_jobs:
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
