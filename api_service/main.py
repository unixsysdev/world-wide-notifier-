from fastapi import FastAPI, Depends, HTTPException, status, Request, Header
from fastapi.security import HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
import redis
import json
from datetime import datetime, timedelta
import uuid
from typing import List, Optional
from pydantic import BaseModel, validator
import os
import jwt
import requests
import stripe
import json
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

# Internal API authentication
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "internal-service-key-change-in-production")

# Stripe configuration
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_PREMIUM_PRICE_ID = os.getenv("STRIPE_PREMIUM_PRICE_ID")
STRIPE_PREMIUM_PLUS_PRICE_ID = os.getenv("STRIPE_PREMIUM_PLUS_PRICE_ID")

stripe.api_key = STRIPE_SECRET_KEY

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
    """Create new user with default subscription tier"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO users (email, google_id, name, subscription_tier, subscription_status, daily_alert_count) 
                   VALUES (%s, %s, %s, 'free', 'active', 0) RETURNING *""",
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
    subscription_tier: str = "free"
    subscription_status: str = "active"
    daily_alert_count: int = 0
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
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def verify_internal_api_key(request: Request):
    """Verify internal API key for service-to-service communication"""
    api_key = request.headers.get("X-Internal-API-Key")
    if not api_key or api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal API key")
    return True

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
    notification_channel_ids: List[str] = []
    alert_cooldown_minutes: int = 60
    max_alerts_per_hour: int = 5
    repeat_frequency_minutes: int = 60
    max_repeats: int = 5
    require_acknowledgment: bool = True
    
    @validator('frequency_minutes')
    def validate_frequency(cls, v):
        if v < 1:
            raise ValueError('Frequency must be at least 1 minute')
        return v



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

class AlertResponse(BaseModel):
    id: str
    job_id: str
    title: str
    content: str
    source_url: Optional[str]
    relevance_score: int
    is_sent: bool
    is_read: bool
    is_acknowledged: bool
    acknowledged_at: Optional[str]
    repeat_count: int
    next_repeat_at: Optional[str]
    created_at: str

class AlertAcknowledgeRequest(BaseModel):
    alert_id: str

class JobNotificationSettingsCreate(BaseModel):
    notification_channel_ids: List[str] = []
    repeat_frequency_minutes: int = 60
    max_repeats: int = 5
    require_acknowledgment: bool = True

class JobNotificationSettingsResponse(BaseModel):
    id: str
    job_id: str
    notification_channel_ids: List[str]
    repeat_frequency_minutes: int
    max_repeats: int
    require_acknowledgment: bool

class SubscriptionInfo(BaseModel):
    tier: str
    status: str
    daily_alert_count: int
    alert_limit: int
    min_frequency_minutes: int
    stripe_customer_id: Optional[str] = None

class StripeCheckoutRequest(BaseModel):
    price_id: str
    success_url: str = "http://localhost:3000/success"
    cancel_url: str = "http://localhost:3000/"

class StripeWebhookEvent(BaseModel):
    type: str
    data: dict

class SubscriptionUpgradeRequest(BaseModel):
    tier: str = "premium"  # premium or premium_plus
# Helper functions for subscription management
def get_user_subscription_info(user_id: str):
    """Get user subscription information with computed limits"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT subscription_tier, subscription_status, daily_alert_count, stripe_customer_id FROM users WHERE id = %s",
                (user_id,)
            )
            user_data = cur.fetchone()
    
    if not user_data:
        return None
    
    tier = user_data['subscription_tier']
    
    # Define tier limits based on requirements
    tier_config = {
        'free': {'alert_limit': 3, 'min_frequency_minutes': 60},  # 3 alerts/day, hourly checks
        'premium': {'alert_limit': 100, 'min_frequency_minutes': 10},  # 100 alerts/day, 10min checks
        'premium_plus': {'alert_limit': 999999, 'min_frequency_minutes': 1}  # Unlimited alerts, 1min checks
    }
    
    config = tier_config.get(tier, tier_config['free'])
    
    return {
        'tier': tier,
        'status': user_data['subscription_status'],
        'daily_alert_count': user_data['daily_alert_count'],
        'alert_limit': config['alert_limit'],
        'min_frequency_minutes': config['min_frequency_minutes'],
        'stripe_customer_id': user_data['stripe_customer_id']
    }


def can_create_job(user_id: str, frequency_minutes: int):
    """Check if user can create a job with given frequency"""
    subscription = get_user_subscription_info(user_id)
    if not subscription:
        return False, "User not found"
    
    # Check frequency limits
    if frequency_minutes < subscription['min_frequency_minutes']:
        return False, f"Minimum frequency for {subscription['tier']} tier is {subscription['min_frequency_minutes']} minutes"
    
    # Check alert count limits (for free tier)
    if subscription['tier'] == 'free':
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) as job_count FROM jobs WHERE user_id = %s AND is_active = true",
                    (user_id,)
                )
                result = cur.fetchone()
                if result['job_count'] >= subscription['alert_limit']:
                    return False, f"Free tier limited to {subscription['alert_limit']} active alerts"
    
    return True, ""

def generate_acknowledgment_token():
    """Generate a secure token for email acknowledgment"""
    return str(uuid.uuid4()) + str(uuid.uuid4()).replace('-', '')

def get_user_alerts(user_id: str, limit: int = 50, include_acknowledged: bool = False):
    """Get alerts for a user"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            where_clause = "WHERE j.user_id = %s"
            params = [user_id]
            
            if not include_acknowledged:
                where_clause += " AND a.is_acknowledged = false"
            
            cur.execute(f"""
                SELECT a.*, j.name as job_name
                FROM alerts a
                JOIN jobs j ON a.job_id = j.id
                {where_clause}
                ORDER BY a.created_at DESC
                LIMIT %s
            """, params + [limit])
            
            return cur.fetchall()

@app.post("/alerts")
async def create_alert(
    alert_data: dict,
    internal_key: str = Header(None, alias="X-Internal-Key")
):
    """Create a new alert (internal API for worker_manager)"""
    if internal_key != os.getenv("INTERNAL_API_KEY", "internal-service-key-change-in-production"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Generate alert ID and acknowledgment token
                alert_id = str(uuid.uuid4())
                ack_token = str(uuid.uuid4())
                
                # Create a job_run record first
                job_run_id = str(uuid.uuid4())
                cur.execute(
                    """INSERT INTO job_runs (id, job_id, started_at, completed_at, status, sources_processed, alerts_generated)
                       VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                    (job_run_id, alert_data.get('job_id'), datetime.now(), datetime.now(), 'completed', 1, 1)
                )
                
                cur.execute(
                    """INSERT INTO alerts (
                        id, job_id, job_run_id, title, content, source_url, 
                        relevance_score, is_acknowledged, acknowledgment_token,
                        created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id""",
                    (
                        alert_id,
                        alert_data.get('job_id'),
                        job_run_id,
                        alert_data.get('title'),
                        alert_data.get('content'),
                        alert_data.get('source_url'),
                        alert_data.get('relevance_score'),
                        False,  # is_acknowledged
                        ack_token,
                        datetime.now()
                    )
                )
                conn.commit()
                
                return {"alert_id": alert_id, "status": "created"}
    except Exception as e:
        print(f"ERROR creating alert: {e}")
        print(f"Alert data: {alert_data}")
        raise HTTPException(status_code=500, detail=f"Failed to create alert: {str(e)}")
def acknowledge_alert(alert_id: str, user_id: str, token: str = None):
    """Acknowledge an alert"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Verify alert belongs to user and get current state
            cur.execute("""
                SELECT a.id, a.is_acknowledged, a.acknowledgment_token, j.user_id
                FROM alerts a
                JOIN jobs j ON a.job_id = j.id
                WHERE a.id = %s
            """, (alert_id,))
            
            alert = cur.fetchone()
            if not alert:
                return False, "Alert not found"
            
            if alert['user_id'] != user_id:
                return False, "Alert does not belong to user"
            
            if alert['is_acknowledged']:
                return False, "Alert already acknowledged"
            
            # If token provided, verify it
            if token and alert['acknowledgment_token'] != token:
                return False, "Invalid acknowledgment token"
            
            # Acknowledge the alert
            cur.execute("""
                UPDATE alerts 
                SET is_acknowledged = true, acknowledged_at = CURRENT_TIMESTAMP, acknowledged_by = %s
                WHERE id = %s
            """, (user_id, alert_id))
            
            conn.commit()
            return True, "Alert acknowledged successfully"@app.get("/")
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
    subscription = get_user_subscription_info(current_user['id'])
    
    return {
        "id": current_user['id'],
        "email": current_user['email'],
        "name": current_user['name'],
        "subscription_tier": current_user.get('subscription_tier', 'free'),
        "subscription_status": current_user.get('subscription_status', 'active'),
        "daily_alert_count": current_user.get('daily_alert_count', 0),
        "created_at": current_user['created_at'].isoformat(),
        "subscription": subscription
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
    
    # Check if user can create job with this frequency
    can_create, error_message = can_create_job(current_user['id'], job.frequency_minutes)
    if not can_create:
        raise HTTPException(status_code=403, detail=error_message)
    
    job_id = str(uuid.uuid4())
    
    # Store job in database
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Insert job
            cur.execute(
                """INSERT INTO jobs (id, user_id, name, description, sources, prompt, frequency_minutes, threshold_score, 
                   notification_channel_ids, alert_cooldown_minutes, max_alerts_per_hour)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (job_id, current_user['id'], job.name, job.description or "", 
                 json.dumps(job.sources), job.prompt, job.frequency_minutes, job.threshold_score,
                 json.dumps(job.notification_channel_ids), job.alert_cooldown_minutes, job.max_alerts_per_hour)
            )
            
            # Insert job notification settings
            cur.execute(
                """INSERT INTO job_notification_settings (job_id, notification_channel_ids, repeat_frequency_minutes, 
                   max_repeats, require_acknowledgment)
                   VALUES (%s, %s, %s, %s, %s)""",
                (job_id, json.dumps(job.notification_channel_ids), job.repeat_frequency_minutes, 
                 job.max_repeats, job.require_acknowledgment)
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
        "notification_channel_ids": job.notification_channel_ids,
        "alert_cooldown_minutes": job.alert_cooldown_minutes,
        "max_alerts_per_hour": job.max_alerts_per_hour,
        "repeat_frequency_minutes": job.repeat_frequency_minutes,
        "max_repeats": job.max_repeats,
        "require_acknowledgment": job.require_acknowledgment,
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
            cur.execute("""
                SELECT j.*, jns.repeat_frequency_minutes, jns.max_repeats, jns.require_acknowledgment
                FROM jobs j
                LEFT JOIN job_notification_settings jns ON j.id = jns.job_id
                WHERE j.user_id = %s 
                ORDER BY j.created_at DESC
            """, (current_user['id'],))
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
            "notification_channel_ids": job.get('notification_channel_ids', []),
            "alert_cooldown_minutes": job.get('alert_cooldown_minutes', 60),
            "max_alerts_per_hour": job.get('max_alerts_per_hour', 5),
            "repeat_frequency_minutes": job.get('repeat_frequency_minutes', 60),
            "max_repeats": job.get('max_repeats', 5),
            "require_acknowledgment": job.get('require_acknowledgment', True),
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

@app.get("/alerts")
async def get_alerts(
    current_user=Depends(get_current_user),
    limit: int = 50,
    include_acknowledged: bool = False
):
    """Get alerts for the current user"""
    alerts = get_user_alerts(current_user['id'], limit, include_acknowledged)
    
    return [
        {
            "id": alert['id'],
            "job_id": alert['job_id'],
            "job_name": alert['job_name'],
            "title": alert['title'],
            "content": alert['content'],
            "source_url": alert['source_url'],
            "relevance_score": alert['relevance_score'],
            "is_sent": alert['is_sent'],
            "is_read": alert['is_read'],
            "is_acknowledged": alert['is_acknowledged'],
            "acknowledged_at": alert['acknowledged_at'].isoformat() if alert['acknowledged_at'] else None,
            "repeat_count": alert['repeat_count'],
            "next_repeat_at": alert['next_repeat_at'].isoformat() if alert['next_repeat_at'] else None,
            "created_at": alert['created_at'].isoformat()
        }
        for alert in alerts
    ]

@app.get("/jobs/{job_id}/alerts")
async def get_job_alerts(
    job_id: str,
    current_user=Depends(get_current_user),
    limit: int = 50,
    include_acknowledged: bool = False
):
    """Get alerts for a specific job"""
    # First verify the job belongs to the current user
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT user_id FROM jobs WHERE id = %s",
                (job_id,)
            )
            job_data = cur.fetchone()
            
            if not job_data:
                raise HTTPException(status_code=404, detail="Job not found")
            
            if job_data['user_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied")
            
            # Get alerts for this job
            query = """
                SELECT a.*, j.name as job_name 
                FROM alerts a 
                JOIN jobs j ON a.job_id = j.id 
                WHERE a.job_id = %s
            """
            params = [job_id]
            
            if not include_acknowledged:
                query += " AND a.is_acknowledged = FALSE"
            
            query += " ORDER BY a.created_at DESC LIMIT %s"
            params.append(limit)
            
            cur.execute(query, params)
            alerts = cur.fetchall()
    
    return [
        {
            "id": alert['id'],
            "job_id": alert['job_id'],
            "job_name": alert['job_name'],
            "title": alert['title'],
            "content": alert['content'],
            "source_url": alert['source_url'],
            "relevance_score": alert['relevance_score'],
            "is_sent": alert['is_sent'],
            "is_read": alert['is_read'],
            "is_acknowledged": alert['is_acknowledged'],
            "acknowledged_at": alert['acknowledged_at'].isoformat() if alert['acknowledged_at'] else None,
            "repeat_count": alert['repeat_count'],
            "next_repeat_at": alert['next_repeat_at'].isoformat() if alert['next_repeat_at'] else None,
            "created_at": alert['created_at'].isoformat()
        }
        for alert in alerts
    ]

@app.get("/user/stats")
async def get_user_stats(current_user=Depends(get_current_user)):
    """Get user statistics for dashboard"""
    user_id = current_user['id']
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Get job count
            cur.execute("SELECT COUNT(*) as job_count FROM jobs WHERE user_id = %s", (user_id,))
            job_count = cur.fetchone()['job_count']
            
            # Get active job count
            cur.execute("SELECT COUNT(*) as active_jobs FROM jobs WHERE user_id = %s AND is_active = TRUE", (user_id,))
            active_jobs = cur.fetchone()['active_jobs']
            
            # Get alert statistics
            cur.execute("""
                SELECT 
                    COUNT(*) as total_alerts,
                    COUNT(CASE WHEN is_acknowledged = FALSE THEN 1 END) as unack_alerts,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as alerts_24h,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as alerts_7d
                FROM alerts a
                JOIN jobs j ON a.job_id = j.id
                WHERE j.user_id = %s
            """, (user_id,))
            alert_stats = cur.fetchone()
            
            # Get subscription info
            subscription_info = get_user_subscription_info(user_id)
    
    return {
        "jobs": {
            "total": job_count,
            "active": active_jobs,
            "inactive": job_count - active_jobs
        },
        "alerts": {
            "total": alert_stats['total_alerts'],
            "unacknowledged": alert_stats['unack_alerts'],
            "last_24_hours": alert_stats['alerts_24h'],
            "last_7_days": alert_stats['alerts_7d']
        },
        "subscription": subscription_info
    }

@app.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert_endpoint(
    alert_id: str,
    current_user=Depends(get_current_user)
):
    """Acknowledge an alert"""
    success, message = acknowledge_alert(alert_id, current_user['id'])
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"message": message}

@app.get("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert_via_email(alert_id: str, token: str):
    """Acknowledge alert via email link (no auth required)"""
    # Get alert to find user
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT j.user_id
                FROM alerts a
                JOIN jobs j ON a.job_id = j.id
                WHERE a.id = %s
            """, (alert_id,))
            
            result = cur.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="Alert not found")
            
            user_id = result['user_id']
    
    success, message = acknowledge_alert(alert_id, user_id, token)
    
    if not success:
        return {"error": message}
    
    return {"message": "Alert acknowledged successfully! You can close this page."}

@app.get("/subscription")
async def get_subscription_info(current_user=Depends(get_current_user)):
    """Get current user's subscription information"""
    subscription = get_user_subscription_info(current_user['id'])
    
    if not subscription:
        raise HTTPException(status_code=404, detail="User not found")
    
    return subscription

@app.post("/subscription/upgrade")
async def create_stripe_session(
    upgrade_request: SubscriptionUpgradeRequest,
    current_user=Depends(get_current_user)
):
    """Create Stripe checkout session for subscription upgrade"""
    try:
        # Define price IDs from environment variables
        PRICE_IDS = {
            "premium": STRIPE_PREMIUM_PRICE_ID,
            "premium_plus": STRIPE_PREMIUM_PLUS_PRICE_ID
        }
        
        # Get or create Stripe customer
        user_email = current_user['email']
        stripe_customer_id = current_user.get('stripe_customer_id')
        
        if not stripe_customer_id:
            # Create new Stripe customer
            customer = stripe.Customer.create(
                email=user_email,
                name=current_user['name'],
                metadata={
                    'user_id': current_user['id']
                }
            )
            stripe_customer_id = customer.id
            
            # Update user with Stripe customer ID
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE users SET stripe_customer_id = %s WHERE id = %s",
                        (stripe_customer_id, current_user['id'])
                    )
                    conn.commit()
        
        # Create checkout session
        price_id = PRICE_IDS.get(upgrade_request.tier)
        if not price_id:
            raise HTTPException(status_code=400, detail="Invalid subscription tier")
        
        session = stripe.checkout.Session.create(
            customer=stripe_customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f'{os.getenv("FRONTEND_URL", "http://localhost:3000")}/success?session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{os.getenv("FRONTEND_URL", "http://localhost:3000")}/',
            metadata={
                'user_id': current_user['id'],
                'tier': upgrade_request.tier
            }
        )
        
        return {
            "checkout_url": session.url,
            "session_id": session.id
        }
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")

@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks for subscription events"""
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        await handle_successful_payment(session)
    elif event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        await handle_subscription_updated(subscription)
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        await handle_subscription_cancelled(subscription)
    elif event['type'] == 'invoice.payment_failed':
        invoice = event['data']['object']
        await handle_payment_failed(invoice)
    
    # Log the event
    try:
        # Extract user_id from event metadata
        user_id = None
        event_data = event.get('data', {}).get('object', {})
        
        # Try to get user_id from different event types
        if 'metadata' in event_data and 'user_id' in event_data['metadata']:
            user_id = event_data['metadata']['user_id']
        elif 'customer' in event_data:
            # Get user_id from customer record
            customer_id = event_data['customer']
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT id FROM users WHERE stripe_customer_id = %s",
                        (customer_id,)
                    )
                    result = cur.fetchone()
                    if result:
                        user_id = result['id']
        
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO subscription_events (user_id, event_type, stripe_event_id, event_data)
                       VALUES (%s, %s, %s, %s)""",
                    (user_id, event['type'], event['id'], json.dumps(event))
                )
                conn.commit()
    except Exception as e:
        print(f"Failed to log webhook event: {e}")
    
    return {"status": "success"}

@app.post("/subscription/manage")
async def create_customer_portal_session(current_user=Depends(get_current_user)):
    """Create a Stripe customer portal session for subscription management"""
    try:
        stripe_customer_id = current_user.get('stripe_customer_id')
        
        print(f"DEBUG: User {current_user.get('id')} stripe_customer_id: {stripe_customer_id}")
        
        if not stripe_customer_id:
            raise HTTPException(
                status_code=400, 
                detail="No Stripe customer found. Please upgrade to a paid plan first."
            )
        
        # Create customer portal session
        print(f"Creating portal session for customer: {stripe_customer_id}")
        session = stripe.billing_portal.Session.create(
            customer=stripe_customer_id,
            return_url=os.getenv('FRONTEND_URL', 'http://localhost:3000'),
        )
        print(f"Portal session created: {session.url}")
        
        return {
            "portal_url": session.url
        }
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create portal session: {str(e)}")

@app.get("/subscription/billing-history")
async def get_billing_history(current_user=Depends(get_current_user)):
    """Get user's billing history from Stripe"""
    try:
        stripe_customer_id = current_user.get('stripe_customer_id')
        
        if not stripe_customer_id:
            return {"invoices": []}
        
        # Get customer's invoices
        invoices = stripe.Invoice.list(
            customer=stripe_customer_id,
            limit=10
        )
        
        billing_history = []
        for invoice in invoices.data:
            billing_history.append({
                "id": invoice.id,
                "amount": invoice.amount_paid / 100,  # Convert from cents
                "currency": invoice.currency.upper(),
                "status": invoice.status,
                "date": invoice.created,
                "description": invoice.description or "Monthly subscription",
                "invoice_url": invoice.hosted_invoice_url
            })
        
        return {"invoices": billing_history}
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch billing history: {str(e)}")

@app.post("/subscription/cancel")
async def cancel_subscription(current_user=Depends(get_current_user)):
    """Cancel user's subscription"""
    try:
        stripe_customer_id = current_user.get('stripe_customer_id')
        
        if not stripe_customer_id:
            raise HTTPException(
                status_code=400, 
                detail="No active subscription found"
            )
        
        # Get customer's subscriptions
        subscriptions = stripe.Subscription.list(
            customer=stripe_customer_id,
            status='active'
        )
        
        if not subscriptions.data:
            raise HTTPException(
                status_code=400, 
                detail="No active subscription found"
            )
        
        # Cancel the subscription (at period end)
        subscription = subscriptions.data[0]
        updated_subscription = stripe.Subscription.modify(
            subscription.id,
            cancel_at_period_end=True
        )
        
        return {
            "status": "success",
            "message": "Subscription will be cancelled at the end of the current billing period",
            "cancel_at": updated_subscription.cancel_at
        }
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel subscription: {str(e)}")
async def handle_successful_payment(session):
    """Handle successful payment from Stripe"""
    user_id = session['metadata'].get('user_id')
    tier = session['metadata'].get('tier', 'premium')
    
    if user_id:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """UPDATE users 
                       SET subscription_tier = %s, 
                           subscription_status = 'active',
                           subscription_created_at = CURRENT_TIMESTAMP,
                           subscription_updated_at = CURRENT_TIMESTAMP
                       WHERE id = %s""",
                    (tier, user_id)
                )
                conn.commit()

async def handle_subscription_updated(subscription):
    """Handle subscription updates from Stripe"""
    customer_id = subscription['customer']
    status = subscription['status']
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE users 
                   SET subscription_status = %s,
                       subscription_updated_at = CURRENT_TIMESTAMP
                   WHERE stripe_customer_id = %s""",
                (status, customer_id)
            )
            conn.commit()

async def handle_subscription_cancelled(subscription):
    """Handle subscription cancellation from Stripe"""
    customer_id = subscription['customer']
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE users 
                   SET subscription_tier = 'free',
                       subscription_status = 'cancelled',
                       subscription_updated_at = CURRENT_TIMESTAMP
                   WHERE stripe_customer_id = %s""",
                (customer_id,)
            )
            conn.commit()

async def handle_payment_failed(invoice):
    """Handle failed payment from Stripe"""
    customer_id = invoice['customer']
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE users 
                   SET subscription_status = 'past_due',
                       subscription_updated_at = CURRENT_TIMESTAMP
                   WHERE stripe_customer_id = %s""",
                (customer_id,)
            )
            conn.commit()

@app.get("/stripe/config")
async def get_stripe_config():
    """Get Stripe publishable key for frontend"""
    return {
        "publishable_key": STRIPE_PUBLISHABLE_KEY
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        redis_client.ping()
        return {"status": "healthy", "redis": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

@app.get("/internal/jobs/active")
async def get_active_jobs_internal(request: Request):
    """Internal endpoint for worker managers to get active jobs efficiently"""
    # Verify internal API key
    verify_internal_api_key(request)
    
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
                "notification_channel_ids": job.get('notification_channel_ids', []),
                "alert_cooldown_minutes": job.get('alert_cooldown_minutes', 60),
                "max_alerts_per_hour": job.get('max_alerts_per_hour', 5),
                "created_at": job['created_at'].isoformat(),
                "updated_at": job['updated_at'].isoformat()
            }
            for job in jobs
        ]
        
    except Exception as e:
        logger.error(f"Error fetching active jobs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch active jobs")

@app.get("/internal/jobs/{job_id}")
async def get_job_internal(job_id: str, request: Request):
    """Internal endpoint for worker managers to get specific job settings"""
    # Verify internal API key
    verify_internal_api_key(request)
    
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, user_id, name, sources, prompt, frequency_minutes, 
                           threshold_score, is_active, notification_channel_ids,
                           alert_cooldown_minutes, max_alerts_per_hour
                    FROM jobs 
                    WHERE id = %s
                """, (job_id,))
                
                job = cur.fetchone()
                
                if not job:
                    raise HTTPException(status_code=404, detail="Job not found")
                
                return {
                    "id": job['id'],
                    "user_id": job['user_id'],
                    "name": job['name'],
                    "sources": job['sources'],
                    "prompt": job['prompt'],
                    "frequency_minutes": job['frequency_minutes'],
                    "threshold_score": job['threshold_score'],
                    "is_active": job['is_active'],
                    "notification_channel_ids": job.get('notification_channel_ids', []),
                    "alert_cooldown_minutes": job.get('alert_cooldown_minutes', 60),
                    "max_alerts_per_hour": job.get('max_alerts_per_hour', 5)
                }
                
    except Exception as e:
        logger.error(f"Error getting job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
@app.post("/internal/scrape")
async def scrape_content_internal(request: Request, url: str):
    """Internal proxy to browser service"""
    verify_internal_api_key(request)
    
    try:
        response = requests.post(
            "http://browser_service:8001/scrape",
            json={"url": url, "wait_time": 3},
            headers={"X-Internal-API-Key": INTERNAL_API_KEY},
            timeout=60
        )
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")

@app.post("/internal/analyze")
async def analyze_content_internal(request: Request, content: str, prompt: str):
    """Internal proxy to LLM service"""
    verify_internal_api_key(request)
    
    try:
        response = requests.post(
            "http://llm_service:8002/analyze",
            json={"content": content, "prompt": prompt, "max_tokens": 1000},
            headers={"X-Internal-API-Key": INTERNAL_API_KEY},
            timeout=30
        )
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
