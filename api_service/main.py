from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
import redis
import json
from datetime import datetime, timedelta
import uuid
from typing import List, Optional
from pydantic import BaseModel
import os
import jwt
import requests
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import psycopg2
from psycopg2.extras import RealDictCursor

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

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://monitoring_user:monitoring_pass@localhost:5432/monitoring_db")

# Google OAuth configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer(auto_error=False)

# Database helper functions
def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def get_user_by_id(user_id: str):
    """Get user by ID"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            return cur.fetchone()

def get_user_by_google_id(google_id: str):
    """Get user by Google ID"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE google_id = %s", (google_id,))
            return cur.fetchone()

def create_user(email: str, google_id: str, name: str):
    """Create new user"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (email, google_id, name) VALUES (%s, %s, %s) RETURNING *",
                (email, google_id, name)
            )
            conn.commit()
            return cur.fetchone()

def get_user_notification_channels(user_id: str):
    """Get user's notification channels"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM notification_channels WHERE user_id = %s", (user_id,))
            return cur.fetchall()

def create_notification_channel(user_id: str, channel_type: str, config: dict):
    """Create notification channel"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO notification_channels (user_id, channel_type, config) VALUES (%s, %s, %s) RETURNING *",
                (user_id, channel_type, json.dumps(config))
            )
            conn.commit()
            return cur.fetchone()

# Authentication models
class GoogleTokenRequest(BaseModel):
    token: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

class NotificationChannelCreate(BaseModel):
    channel_type: str  # 'email', 'teams', 'slack'
    config: dict  # Configuration specific to channel type

class NotificationChannelResponse(BaseModel):
    id: str
    channel_type: str
    config: dict
    created_at: str

# JWT helper functions
def create_access_token(data: dict):
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str):
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(request: Request):
    """Get current authenticated user"""
    authorization = request.headers.get("Authorization")
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        payload = verify_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        user = get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
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

@app.post("/auth/google")
async def google_auth(token_request: GoogleTokenRequest):
    """Authenticate user with Google OAuth token"""
    try:
        # Verify Google token
        idinfo = id_token.verify_oauth2_token(
            token_request.token, 
            google_requests.Request(), 
            GOOGLE_CLIENT_ID
        )
        
        # Extract user info
        google_id = idinfo['sub']
        email = idinfo['email']
        name = idinfo['name']
        
        # Check if user exists
        user = get_user_by_google_id(google_id)
        if not user:
            # Create new user
            user = create_user(email, google_id, name)
        
        # Create JWT token
        access_token = create_access_token({"sub": user['id']})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user['id'],
                "email": user['email'],
                "name": user['name']
            }
        }
        
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication error: {str(e)}")

@app.get("/auth/me")
async def get_current_user_info(current_user=Depends(get_current_user)):
    """Get current authenticated user info"""
    return {
        "id": current_user['id'],
        "email": current_user['email'],
        "name": current_user['name'],
        "created_at": current_user['created_at'].isoformat()
    }

@app.get("/notification-channels")
async def get_notification_channels(current_user=Depends(get_current_user)):
    """Get user's notification channels"""
    channels = get_user_notification_channels(current_user['id'])
    return [
        {
            "id": channel['id'],
            "channel_type": channel['channel_type'],
            "config": channel['config'] if isinstance(channel['config'], dict) else json.loads(channel['config']) if channel['config'] else {},
            "created_at": channel['created_at'].isoformat()
        }
        for channel in channels
    ]

@app.post("/notification-channels")
async def create_notification_channel_endpoint(
    channel_data: NotificationChannelCreate,
    current_user=Depends(get_current_user)
):
    """Create a new notification channel"""
    try:
        channel = create_notification_channel(
            current_user['id'],
            channel_data.channel_type,
            channel_data.config
        )
        
        return {
            "id": channel['id'],
            "channel_type": channel['channel_type'],
            "config": channel['config'] if isinstance(channel['config'], dict) else json.loads(channel['config']) if channel['config'] else {},
            "created_at": channel['created_at'].isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create notification channel: {str(e)}")

@app.delete("/notification-channels/{channel_id}")
async def delete_notification_channel(
    channel_id: str,
    current_user=Depends(get_current_user)
):
    """Delete a notification channel"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Check if channel belongs to user
                cur.execute(
                    "SELECT id FROM notification_channels WHERE id = %s AND user_id = %s",
                    (channel_id, current_user['id'])
                )
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Notification channel not found")
                
                # Delete channel
                cur.execute("DELETE FROM notification_channels WHERE id = %s", (channel_id,))
                conn.commit()
                
                return {"message": "Notification channel deleted successfully"}
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete notification channel: {str(e)}")

@app.post("/jobs")
async def create_job(job: JobCreate, current_user=Depends(get_current_user)):
    """Create a new monitoring job"""
    job_id = str(uuid.uuid4())
    
    # Store job in database
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO jobs (id, user_id, name, description, sources, prompt, frequency_minutes, threshold_score)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (job_id, current_user['id'], job.name, job.description or "", 
                 json.dumps(job.sources), job.prompt, job.frequency_minutes, job.threshold_score)
            )
            conn.commit()
    
    # Also store in Redis for quick access
    redis_client.hset(f"job:{job_id}", "id", job_id)
    redis_client.hset(f"job:{job_id}", "user_id", current_user['id'])
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
async def get_jobs(current_user=Depends(get_current_user)):
    """Get all monitoring jobs for authenticated user"""
    jobs = []
    
    # Get jobs from database for the current user
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM jobs WHERE user_id = %s ORDER BY created_at DESC",
                (current_user['id'],)
            )
            db_jobs = cur.fetchall()
    
    for job in db_jobs:
        jobs.append({
            "id": job['id'],
            "name": job['name'],
            "description": job['description'],
            "sources": job['sources'],
            "prompt": job['prompt'],
            "frequency_minutes": job['frequency_minutes'],
            "threshold_score": job['threshold_score'],
            "is_active": job['is_active'],
            "created_at": job['created_at'].isoformat()
        })
    
    return jobs

@app.get("/jobs/{job_id}")
async def get_job(job_id: str, current_user=Depends(get_current_user)):
    """Get a specific monitoring job for authenticated user"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM jobs WHERE id = %s AND user_id = %s",
                (job_id, current_user['id'])
            )
            job = cur.fetchone()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "id": job['id'],
        "name": job['name'],
        "description": job['description'],
        "sources": job['sources'],
        "prompt": job['prompt'],
        "frequency_minutes": job['frequency_minutes'],
        "threshold_score": job['threshold_score'],
        "is_active": job['is_active'],
        "created_at": job['created_at'].isoformat()
    }

@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str, current_user=Depends(get_current_user)):
    """Delete a monitoring job for authenticated user"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Check if job belongs to user
            cur.execute(
                "SELECT id FROM jobs WHERE id = %s AND user_id = %s",
                (job_id, current_user['id'])
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Job not found")
            
            # Delete job
            cur.execute("DELETE FROM jobs WHERE id = %s", (job_id,))
            conn.commit()
    
    # Also remove from Redis
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

@app.get("/internal/jobs/active")
async def get_active_jobs_internal():
    """Internal endpoint for worker managers to get active jobs efficiently"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, user_id, name, sources, prompt, frequency_minutes, 
                           threshold_score, created_at, updated_at
                    FROM jobs 
                    WHERE is_active = true
                    ORDER BY updated_at DESC
                """)
                jobs = cur.fetchall()
        
        return [
            {
                "id": job['id'],
                "user_id": job['user_id'],
                "name": job['name'],
                "sources": job['sources'],
                "prompt": job['prompt'],
                "frequency_minutes": job['frequency_minutes'],
                "threshold_score": job['threshold_score'],
                "created_at": job['created_at'].isoformat(),
                "updated_at": job['updated_at'].isoformat()
            }
            for job in jobs
        ]
        
    except Exception as e:
        logger.error(f"Error fetching active jobs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch active jobs")
