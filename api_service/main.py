from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
import redis
import json
from datetime import datetime
import uuid
from typing import List, Optional
from pydantic import BaseModel
import os

app = FastAPI(title="AI Monitoring API", version="1.0.0")

# CORS setup - Allow everything for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis connection
redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

# Pydantic models
class JobCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sources: List[str]
    prompt: str
    frequency_minutes: int = 60
    threshold_score: int = 75

class JobResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    sources: List[str]
    prompt: str
    frequency_minutes: int
    threshold_score: int
    is_active: bool
    created_at: str

@app.get("/")
async def root():
    return {"message": "AI Monitoring API is running"}

@app.post("/jobs")
async def create_job(job: JobCreate):
    """Create a new monitoring job"""
    job_id = str(uuid.uuid4())
    
    # Store as simple key-value pairs in Redis
    redis_client.hset(f"job:{job_id}", "id", job_id)
    redis_client.hset(f"job:{job_id}", "name", job.name)
    redis_client.hset(f"job:{job_id}", "description", job.description or "")
    redis_client.hset(f"job:{job_id}", "sources", json.dumps(job.sources))
    redis_client.hset(f"job:{job_id}", "prompt", job.prompt)
    redis_client.hset(f"job:{job_id}", "frequency_minutes", str(job.frequency_minutes))
    redis_client.hset(f"job:{job_id}", "threshold_score", str(job.threshold_score))
    redis_client.hset(f"job:{job_id}", "is_active", "true")
    redis_client.hset(f"job:{job_id}", "created_at", datetime.now().isoformat())
    
    # Queue the job for processing
    redis_client.lpush("job_queue", json.dumps({"job_id": job_id, "action": "create"}))
    
    return {
        "id": job_id,
        "name": job.name,
        "description": job.description,
        "sources": job.sources,
        "prompt": job.prompt,
        "frequency_minutes": job.frequency_minutes,
        "threshold_score": job.threshold_score,
        "is_active": True,
        "created_at": datetime.now().isoformat()
    }

@app.get("/jobs")
async def get_jobs():
    """Get all monitoring jobs"""
    jobs = []
    for key in redis_client.scan_iter(match="job:*"):
        job_data = redis_client.hgetall(key)
        if job_data:
            # Convert Redis data to proper format
            job = {
                "id": job_data[b'id'].decode(),
                "name": job_data[b'name'].decode(),
                "description": job_data[b'description'].decode(),
                "sources": json.loads(job_data[b'sources'].decode()),
                "prompt": job_data[b'prompt'].decode(),
                "frequency_minutes": int(job_data[b'frequency_minutes'].decode()),
                "threshold_score": int(job_data[b'threshold_score'].decode()),
                "is_active": job_data[b'is_active'].decode() == "true",
                "created_at": job_data[b'created_at'].decode()
            }
            jobs.append(job)
    return jobs

@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Get a specific monitoring job"""
    job_data = redis_client.hgetall(f"job:{job_id}")
    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "id": job_data[b'id'].decode(),
        "name": job_data[b'name'].decode(),
        "description": job_data[b'description'].decode(),
        "sources": json.loads(job_data[b'sources'].decode()),
        "prompt": job_data[b'prompt'].decode(),
        "frequency_minutes": int(job_data[b'frequency_minutes'].decode()),
        "threshold_score": int(job_data[b'threshold_score'].decode()),
        "is_active": job_data[b'is_active'].decode() == "true",
        "created_at": job_data[b'created_at'].decode()
    }

@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a monitoring job"""
    if not redis_client.exists(f"job:{job_id}"):
        raise HTTPException(status_code=404, detail="Job not found")
    
    redis_client.delete(f"job:{job_id}")
    redis_client.lpush("job_queue", json.dumps({"job_id": job_id, "action": "delete"}))
    
    return {"message": "Job deleted successfully"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        redis_client.ping()
        return {"status": "healthy", "redis": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}
