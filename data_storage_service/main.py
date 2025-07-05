from fastapi import FastAPI, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import redis
import json
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from bson import ObjectId
from pymongo import ASCENDING, DESCENDING

app = FastAPI(title="Data Storage Service", version="1.0.0")

# Configuration
MONGODB_URL = os.getenv('MONGODB_URL', 'mongodb://monitoring_user:monitoring_pass@mongodb:27017/monitoring_raw_data?authSource=admin')
REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379')
INTERNAL_API_KEY = os.getenv('INTERNAL_API_KEY', 'internal-service-key-change-in-production')

# MongoDB client
mongodb_client = AsyncIOMotorClient(MONGODB_URL)
db = mongodb_client.monitoring_raw_data

# Redis client
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)

# Pydantic models
class JobExecutionData(BaseModel):
    job_id: str
    job_run_id: str
    user_id: str
    job_name: str
    user_prompt: str
    sources: List[str]
    frequency_minutes: int
    threshold_score: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    
class SourceData(BaseModel):
    source_url: str
    raw_html: str
    cleaned_content: str
    scrape_timestamp: datetime
    response_time_ms: int
    status_code: int
    error_message: Optional[str] = None

class LLMAnalysisData(BaseModel):
    source_url: str
    llm_provider: str  # 'openai' or 'anthropic'
    model_name: str
    system_prompt: str
    user_prompt: str
    raw_response: str
    parsed_response: Dict[str, Any]
    relevance_score: int
    processing_time_ms: int
    analysis_timestamp: datetime
    alert_generated: bool
    alert_title: Optional[str] = None
    alert_content: Optional[str] = None

class JobExecutionRecord(BaseModel):
    job_execution: JobExecutionData
    source_data: List[SourceData]
    llm_analysis: List[LLMAnalysisData]
    summary: Dict[str, Any]
    created_at: datetime
    updated_at: Optional[datetime] = None

class JobExecutionStorage(BaseModel):
    job_id: str
    job_run_id: str
    user_id: str
    job_name: str
    user_prompt: str
    sources: List[str]
    frequency_minutes: int
    threshold_score: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    source_data: List[SourceData] = []
    llm_analysis: List[LLMAnalysisData] = []
    summary: Dict[str, Any] = {}

# Helper functions
def verify_internal_api_key(request: Request):
    """Verify internal API key for service-to-service communication"""
    api_key = request.headers.get("X-Internal-API-Key")
    if not api_key or api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal API key")
    return True

def serialize_document(doc):
    """Convert MongoDB document to JSON serializable format"""
    if doc is None:
        return None
    
    if isinstance(doc, dict):
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                doc[key] = str(value)
            elif isinstance(value, datetime):
                doc[key] = value.isoformat()
            elif isinstance(value, dict):
                doc[key] = serialize_document(value)
            elif isinstance(value, list):
                doc[key] = [serialize_document(item) if isinstance(item, dict) else item for item in value]
    
    return doc

# API endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check MongoDB connection
        await db.command("ping")
        
        # Check Redis connection
        redis_client.ping()
        
        return {
            "status": "healthy",
            "mongodb": "connected",
            "redis": "connected",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@app.post("/job-execution/start")
async def start_job_execution(
    execution_data: JobExecutionData,
    request: Request,
    _: bool = Depends(verify_internal_api_key)
):
    """Start tracking a job execution"""
    try:
        # Create initial document
        doc = JobExecutionStorage(
            job_id=execution_data.job_id,
            job_run_id=execution_data.job_run_id,
            user_id=execution_data.user_id,
            job_name=execution_data.job_name,
            user_prompt=execution_data.user_prompt,
            sources=execution_data.sources,
            frequency_minutes=execution_data.frequency_minutes,
            threshold_score=execution_data.threshold_score,
            started_at=execution_data.started_at,
            completed_at=execution_data.completed_at
        )
        
        # Insert into MongoDB
        result = await db.job_executions.insert_one(doc.dict())
        
        return {
            "status": "started",
            "execution_id": str(result.inserted_id),
            "job_run_id": execution_data.job_run_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start job execution tracking: {str(e)}")

@app.post("/job-execution/{job_run_id}/source-data")
async def add_source_data(
    job_run_id: str,
    source_data: SourceData,
    request: Request,
    _: bool = Depends(verify_internal_api_key)
):
    """Add source data to job execution"""
    try:
        # Update document with source data
        await db.job_executions.update_one(
            {"job_run_id": job_run_id},
            {
                "$push": {"source_data": source_data.dict()},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        return {"status": "added", "source_url": source_data.source_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add source data: {str(e)}")

@app.post("/job-execution/{job_run_id}/llm-analysis")
async def add_llm_analysis(
    job_run_id: str,
    analysis_data: LLMAnalysisData,
    request: Request,
    _: bool = Depends(verify_internal_api_key)
):
    """Add LLM analysis data to job execution"""
    try:
        # Update document with LLM analysis
        await db.job_executions.update_one(
            {"job_run_id": job_run_id},
            {
                "$push": {"llm_analysis": analysis_data.dict()},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        return {"status": "added", "source_url": analysis_data.source_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add LLM analysis: {str(e)}")

@app.post("/job-execution/{job_run_id}/complete")
async def complete_job_execution(
    job_run_id: str,
    summary: Dict[str, Any],
    request: Request,
    _: bool = Depends(verify_internal_api_key)
):
    """Mark job execution as complete with summary"""
    try:
        # Update document with completion
        await db.job_executions.update_one(
            {"job_run_id": job_run_id},
            {
                "$set": {
                    "completed_at": datetime.utcnow(),
                    "summary": summary,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return {"status": "completed", "job_run_id": job_run_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to complete job execution: {str(e)}")

@app.get("/job-execution/{job_run_id}")
async def get_job_execution(
    job_run_id: str,
    request: Request,
    _: bool = Depends(verify_internal_api_key)
):
    """Get complete job execution data"""
    try:
        doc = await db.job_executions.find_one({"job_run_id": job_run_id})
        
        if not doc:
            raise HTTPException(status_code=404, detail="Job execution not found")
        
        return serialize_document(doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job execution: {str(e)}")

@app.get("/job-executions/job/{job_id}")
async def get_job_executions(
    job_id: str,
    request: Request,
    limit: int = 50,
    offset: int = 0,
    _: bool = Depends(verify_internal_api_key)
):
    """Get all executions for a job"""
    try:
        cursor = db.job_executions.find({"job_id": job_id}).sort("started_at", DESCENDING)
        
        # Apply pagination
        cursor = cursor.skip(offset).limit(limit)
        
        docs = []
        async for doc in cursor:
            docs.append(serialize_document(doc))
        
        # Get total count
        total = await db.job_executions.count_documents({"job_id": job_id})
        
        return {
            "executions": docs,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job executions: {str(e)}")

@app.get("/job-executions/user/{user_id}")
async def get_user_job_executions(
    user_id: str,
    request: Request,
    limit: int = 50,
    offset: int = 0,
    _: bool = Depends(verify_internal_api_key)
):
    """Get all executions for a user"""
    try:
        cursor = db.job_executions.find({"user_id": user_id}).sort("started_at", DESCENDING)
        
        # Apply pagination
        cursor = cursor.skip(offset).limit(limit)
        
        docs = []
        async for doc in cursor:
            docs.append(serialize_document(doc))
        
        # Get total count
        total = await db.job_executions.count_documents({"user_id": user_id})
        
        return {
            "executions": docs,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user job executions: {str(e)}")

@app.delete("/job-execution/{job_run_id}")
async def delete_job_execution(
    job_run_id: str,
    request: Request,
    _: bool = Depends(verify_internal_api_key)
):
    """Delete job execution data"""
    try:
        result = await db.job_executions.delete_one({"job_run_id": job_run_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Job execution not found")
        
        return {"status": "deleted", "job_run_id": job_run_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete job execution: {str(e)}")

@app.get("/stats")
async def get_storage_stats(
    request: Request,
    _: bool = Depends(verify_internal_api_key)
):
    """Get storage statistics"""
    try:
        # Collection stats
        total_executions = await db.job_executions.count_documents({})
        completed_executions = await db.job_executions.count_documents({"completed_at": {"$ne": None}})
        
        # Recent activity
        recent_pipeline = [
            {"$match": {"started_at": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)}}},
            {"$count": "today_count"}
        ]
        recent_result = await db.job_executions.aggregate(recent_pipeline).to_list(1)
        today_count = recent_result[0]["today_count"] if recent_result else 0
        
        # Database stats
        db_stats = await db.command("dbStats")
        
        return {
            "total_executions": total_executions,
            "completed_executions": completed_executions,
            "pending_executions": total_executions - completed_executions,
            "today_executions": today_count,
            "database_size_mb": round(db_stats["dataSize"] / (1024 * 1024), 2),
            "storage_size_mb": round(db_stats["storageSize"] / (1024 * 1024), 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get storage stats: {str(e)}")

# Initialize database indexes
@app.on_event("startup")
async def startup_event():
    """Initialize database indexes for optimal performance"""
    try:
        # Create indexes for better performance
        await db.job_executions.create_index([("job_id", ASCENDING), ("started_at", DESCENDING)])
        await db.job_executions.create_index([("user_id", ASCENDING), ("started_at", DESCENDING)])
        await db.job_executions.create_index([("job_run_id", ASCENDING)], unique=True)
        await db.job_executions.create_index([("started_at", DESCENDING)])
        await db.job_executions.create_index([("completed_at", ASCENDING)])
        
        print("✅ Database indexes created successfully")
    except Exception as e:
        print(f"❌ Failed to create database indexes: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
