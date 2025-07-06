import json
import redis
import requests
import time
import hashlib
import uuid
import json
import threading
from datetime import datetime, timedelta
import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self):
        self.redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
        self.sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
        self.notification_email = os.getenv("NOTIFICATION_EMAIL", "marcelbutucea@gmail.com")
        self.teams_webhook = os.getenv("TEAMS_WEBHOOK")
        self.database_url = os.getenv("DATABASE_URL", "postgresql://monitoring_user:monitoring_pass@localhost:5432/monitoring_db")
        self.running = True
        
        logger.info(f"SendGrid key configured: {'Yes' if self.sendgrid_api_key else 'No'}")
        logger.info(f"Teams webhook configured: {'Yes' if self.teams_webhook else 'No'}")
        logger.info(f"Notification email: {self.notification_email}")
        
        # Deduplication settings
        self.dedup_window_hours = 6
        
        # Start repeat notification worker
        self.start_repeat_notification_worker()

    
    
    def start_repeat_notification_worker(self):
        """Start background worker to handle repeat notifications"""
        def repeat_worker():
            logger.info("🔄 Starting repeat notification worker...")
            while True:
                try:
                    self.process_repeat_notifications()
                    time.sleep(60)  # Check every minute
                except Exception as e:
                    logger.error(f"Error in repeat notification worker: {e}")
                    time.sleep(30)  # Wait 30 seconds on error
        
        # Start worker thread
        repeat_thread = threading.Thread(target=repeat_worker, daemon=True)
        repeat_thread.start()
        logger.info("✅ Repeat notification worker started")
    
    def process_repeat_notifications(self):
            """Process alerts that need to be repeated"""
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    # Get unacknowledged alerts that are due for repeat
                    with psycopg2.connect(
                        self.database_url,
                        connect_timeout=10,
                        cursor_factory=RealDictCursor
                    ) as conn:
                        with conn.cursor() as cur:
                            current_time = datetime.now()
                            
                            # Find alerts that need repeating
                            cur.execute("""
                                SELECT a.id, a.job_id, a.source_url, a.title, a.content, a.relevance_score,
                                       a.repeat_count, a.next_repeat_at, a.created_at,
                                       jns.repeat_frequency_minutes, jns.max_repeats, jns.require_acknowledgment
                                FROM alerts a
                                JOIN jobs j ON a.job_id = j.id
                                LEFT JOIN job_notification_settings jns ON j.id = jns.job_id
                                WHERE a.is_acknowledged = FALSE 
                                AND a.is_sent = TRUE
                                AND jns.require_acknowledgment = TRUE
                                AND (a.next_repeat_at IS NULL OR a.next_repeat_at <= %s)
                                AND (a.repeat_count < jns.max_repeats OR jns.max_repeats = 0)
                                AND j.is_active = TRUE
                            """, (current_time,))
                            
                            alerts_to_repeat = cur.fetchall()
                            
                            for alert in alerts_to_repeat:
                                try:
                                    self.send_repeat_notification(alert)
                                except psycopg2.ProgrammingError as e:
                                    if "updated_at" in str(e) and "does not exist" in str(e):
                                        logger.error(f"Database schema error - missing updated_at column in alerts table: {e}")
                                        logger.error("Please run the migration: migration_add_updated_at_to_alerts.sql")
                                        return  # Stop processing to prevent spam
                                    else:
                                        logger.error(f"Database error processing alert {alert.get('id', 'unknown')}: {e}")
                                except Exception as e:
                                    logger.error(f"Error processing individual alert {alert.get('id', 'unknown')}: {e}")
                    
                    # If we get here, the operation was successful
                    break
                            
                except psycopg2.OperationalError as e:
                    logger.error(f"Database connection error (attempt {attempt + 1}/{max_retries}): {e}")
                    if attempt < max_retries - 1:
                        # Wait before retry with exponential backoff
                        time.sleep((attempt + 1) * 2)
                    else:
                        logger.error("Failed to connect to database after all retries")
                except psycopg2.ProgrammingError as e:
                    if "updated_at" in str(e) and "does not exist" in str(e):
                        logger.error(f"Database schema error - missing updated_at column in alerts table: {e}")
                        logger.error("Please run the migration: migration_add_updated_at_to_alerts.sql or apply_migration.sh")
                        return  # Stop processing to prevent spam
                    else:
                        logger.error(f"Database error: {e}")
                        break
                except Exception as e:
                    logger.error(f"Error processing repeat notifications: {e}")
                    break


    
    def send_repeat_notification(self, alert):
            """Send repeat notification for an alert"""
            try:
                with psycopg2.connect(self.database_url) as conn:
                    with conn.cursor() as cur:
                        # Check rate limiting for repeats (separate from new alerts)
                        current_hour = datetime.now().strftime('%Y-%m-%d-%H')
                        repeat_rate_key = f"repeat_rate_limit:{alert['job_id']}:{current_hour}"
                        repeat_count_this_hour = self.redis_client.get(repeat_rate_key)
                        
                        # Allow up to 10 repeats per hour (separate limit from new alerts)
                        if repeat_count_this_hour and int(repeat_count_this_hour) >= 10:
                            logger.info(f"Repeat rate limit exceeded for job {alert['job_id']}")
                            return
                        
                        # Prepare alert data for notification
                        alert_data = {
                            'id': alert['id'],
                            'job_id': alert['job_id'],
                            'source_url': alert['source_url'],
                            'title': f"🔄 REMINDER: {alert['title']}",
                            'content': f"This is repeat #{alert['repeat_count'] + 1}.\n\n{alert['content']}",
                            'relevance_score': alert['relevance_score'],
                            'timestamp': datetime.now().isoformat(),
                            'is_repeat': True,
                            'original_created_at': alert['created_at'].isoformat()
                        }
                        
                        # Process the repeat notification (reuse existing logic)
                        self.process_alert(alert_data)
                        
                        # Update repeat tracking
                        next_repeat_time = datetime.now() + timedelta(minutes=alert['repeat_frequency_minutes'])
                        new_repeat_count = alert['repeat_count'] + 1
                        
                        # Update without referencing updated_at column (in case it doesn't exist)
                        cur.execute("""
                            UPDATE alerts 
                            SET repeat_count = %s, 
                                next_repeat_at = %s
                            WHERE id = %s
                        """, (new_repeat_count, next_repeat_time, alert['id']))
                        
                        conn.commit()
                        
                        # Update rate limiting for repeats
                        self.redis_client.incr(repeat_rate_key)
                        self.redis_client.expire(repeat_rate_key, 3600)  # 1 hour
                        
                        logger.info(f"✅ Sent repeat notification #{new_repeat_count} for alert {alert['id']}")
                        
            except Exception as e:
                logger.error(f"Error sending repeat notification: {e}")    
    
    def get_db_connection(self):
        """Get database connection"""
        return psycopg2.connect(self.database_url, cursor_factory=RealDictCursor)
    
    def get_user_notification_channels(self, user_id):
            """Get user's notification channels"""
            with self.get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM notification_channels WHERE user_id = %s AND is_active = true",
                        (user_id,)
                    )
                    channels = cur.fetchall()
                    logger.info(f"Found {len(channels)} active notification channels for user {user_id}")
                    return channels
    
    def get_job_notification_channels(self, job_id):
        """Get job's notification channel IDs"""
        with self.get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT notification_channel_ids FROM jobs WHERE id = %s",
                    (job_id,)
                )
                result = cur.fetchone()
                if result and result['notification_channel_ids']:
                    return result['notification_channel_ids']
                return []
    
    def get_user_notification_channels_for_job(self, user_id, job_channel_ids):
        """Get user's notification channels that are specified in job"""
        if not job_channel_ids:
            return []
        
        with self.get_db_connection() as conn:
            with conn.cursor() as cur:
                # Convert job_channel_ids to tuple for SQL IN clause
                placeholders = ','.join(['%s'] * len(job_channel_ids))
                cur.execute(
                    f"SELECT * FROM notification_channels WHERE user_id = %s AND id = ANY(%s::uuid[]) AND is_active = true",
                    (user_id, job_channel_ids)
                )
                channels = cur.fetchall()
                logger.info(f"Found {len(channels)} notification channels for job (user {user_id})")
                return channels


        
    def get_job_user_id(self, job_id):
        """Get user ID for a job"""
        with self.get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT user_id FROM jobs WHERE id = %s", (job_id,))
                result = cur.fetchone()
                return result['user_id'] if result else None
                
    def generate_alert_hash(self, alert):
        """Generate stable hash for alert deduplication (consistent with worker manager)"""
        # Use same logic as worker manager: job_id + source_url (not content-dependent)
        stable_string = f"{alert['job_id']}:{alert['source_url']}"
        return hashlib.md5(stable_string.encode()).hexdigest()

    
    def is_duplicate_alert(self, alert):
        """Check if alert is a duplicate within time window (content-based, not acknowledgment-based)"""
        # Generate stable identity hash
        alert_identity = f"{alert['job_id']}:{alert['source_url']}"
        
        # Check content deduplication for current hour (same as worker manager)
        current_hour = datetime.now().strftime('%Y-%m-%d-%H')
        content_dedup_key = f"content_dedup:{alert_identity}:{current_hour}"
        
        if self.redis_client.exists(content_dedup_key):
            return True
        
        # Mark as seen for current hour (this is handled in worker manager, but backup here)
        self.redis_client.setex(content_dedup_key, 3600, "1")  # 1 hour
        return False

    
    def send_sendgrid_email(self, subject, body_text, body_html=None):
        """Send email via SendGrid"""
        try:
            if not self.sendgrid_api_key:
                logger.error("SendGrid API key not configured!")
                return False
            
            logger.info(f"Sending email to {self.notification_email}")
            
            # SendGrid API payload
            payload = {
                "personalizations": [
                    {
                        "to": [{"email": self.notification_email}]
                    }
                ],
                "from": {"email": "marcelbutucea@gmail.com"},
                "subject": subject,
                "content": [
                    {"type": "text/plain", "value": body_text}
                ]
            }
            
            # Add HTML content if provided
            if body_html:
                payload["content"].append({"type": "text/html", "value": body_html})
            
            # Send request
            response = requests.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {self.sendgrid_api_key}",
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=10
            )
            
            logger.info(f"SendGrid response: {response.status_code}")
            
            if response.status_code == 202:
                logger.info(f"✅ Email sent successfully to {self.notification_email}")
                return True
            else:
                logger.error(f"SendGrid error: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False
    
    def send_teams_notification(self, title, message, source_url):
        """Send notification to Microsoft Teams"""
        try:
            if not self.teams_webhook:
                logger.warning("Teams webhook not configured, skipping Teams notification")
                return False
            
            # Format Teams message card
            payload = {
                "@type": "MessageCard",
                "@context": "https://schema.org/extensions",
                "summary": title,
                "themeColor": "FF6B35",
                "sections": [
                    {
                        "activityTitle": "🚨 AI Monitoring Alert",
                        "activitySubtitle": title,
                        "activityText": message,
                        "facts": [
                            {
                                "name": "Source",
                                "value": source_url
                            },
                            {
                                "name": "Time",
                                "value": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            }
                        ]
                    }
                ],
                "potentialAction": [
                    {
                        "@type": "OpenUri",
                        "name": "View Source",
                        "targets": [
                            {
                                "os": "default",
                                "uri": source_url
                            }
                        ]
                    }
                ]
            }
            
            response = requests.post(
                self.teams_webhook,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == 200:
                logger.info("✅ Teams notification sent successfully")
                return True
            else:
                logger.error(f"Teams notification failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to send Teams notification: {e}")
            return False
    
    def send_email_to_address(self, subject, body_text, body_html, email_address):
            """Send email to specific address"""
            try:
                if not self.sendgrid_api_key:
                    logger.error("SendGrid API key not configured!")
                    return False
                
                logger.info(f"Sending email to {email_address}")
                
                # SendGrid API payload
                payload = {
                    "personalizations": [
                        {
                            "to": [{"email": email_address}]
                        }
                    ],
                    "from": {"email": self.notification_email},
                    "subject": subject,
                    "content": [
                        {"type": "text/plain", "value": body_text}
                    ]
                }
                
                # Add HTML content if provided
                if body_html:
                    payload["content"].append({"type": "text/html", "value": body_html})
                
                # Send request
                response = requests.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    headers={
                        "Authorization": f"Bearer {self.sendgrid_api_key}",
                        "Content-Type": "application/json"
                    },
                    json=payload,
                    timeout=10
                )
                
                if response.status_code == 202:
                    logger.info(f"✅ Email sent successfully to {email_address}")
                    return True
                else:
                    logger.error(f"SendGrid error: {response.status_code} - {response.text}")
                    return False
                    
            except Exception as e:
                logger.error(f"Failed to send email to {email_address}: {e}")
                return False
        
    def send_teams_notification_to_webhook(self, title, message, source_url, webhook_url):
            """Send notification to specific Teams webhook"""
            try:
                # Format Teams message card
                payload = {
                    "@type": "MessageCard",
                    "@context": "https://schema.org/extensions",
                    "summary": title,
                    "themeColor": "FF6B35",
                    "sections": [
                        {
                            "activityTitle": "🚨 AI Monitoring Alert",
                            "activitySubtitle": title,
                            "activityText": message,
                            "facts": [
                                {
                                    "name": "Source",
                                    "value": source_url
                                },
                                {
                                    "name": "Time",
                                    "value": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                                }
                            ]
                        }
                    ],
                    "potentialAction": [
                        {
                            "@type": "OpenUri",
                            "name": "View Source",
                            "targets": [
                                {
                                    "os": "default",
                                    "uri": source_url
                                }
                            ]
                        }
                    ]
                }
                
                response = requests.post(
                    webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=10
                )
                
                if response.status_code == 200:
                    logger.info("✅ Teams notification sent successfully")
                    return True
                else:
                    logger.error(f"Teams notification failed: {response.status_code} - {response.text}")
                    return False
                    
            except Exception as e:
                logger.error(f"Failed to send Teams notification: {e}")
                return False
        
    def send_slack_notification(self, title, message, source_url, webhook_url):
            """Send notification to Slack webhook"""
            try:
                payload = {
                    "text": f"🚨 *{title}*",
                    "attachments": [
                        {
                            "color": "danger",
                            "fields": [
                                {
                                    "title": "Message",
                                    "value": message,
                                    "short": False
                                },
                                {
                                    "title": "Source",
                                    "value": f"<{source_url}|View Source>",
                                    "short": True
                                },
                                {
                                    "title": "Time",
                                    "value": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                    "short": True
                                }
                            ]
                        }
                    ]
                }
                
                response = requests.post(
                    webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=10
                )
                
                if response.status_code == 200:
                    logger.info("✅ Slack notification sent successfully")
                    return True
                else:
                    logger.error(f"Slack notification failed: {response.status_code} - {response.text}")
                    return False
                    
            except Exception as e:
                logger.error(f"Failed to send Slack notification: {e}")
                return False
    
    def format_alert_content(self, alert):
        """Format alert content for notifications"""
        # Generate acknowledgment token if not present
        ack_token = alert.get('acknowledgment_token', str(uuid.uuid4()) + str(uuid.uuid4()).replace('-', ''))
        # Just use dashboard URL - no acknowledgment link in emails
        dashboard_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        
        text_content = f"""
🚨 AI MONITORING ALERT - {alert['title']}

═══════════════════════════════════════════════════════════
🎯 RELEVANCE SCORE: {alert['relevance_score']}/100
🔗 SOURCE: {alert['source_url']}
⏰ TIME: {alert['timestamp']}
🚀 STATUS: ACTIVE ALERT
═══════════════════════════════════════════════════════════

📝 ALERT SUMMARY:
{alert['content']}

═══════════════════════════════════════════════════════════
🚀 TAKE ACTION:
🎯 Go to Dashboard: {dashboard_url}

🔧 SYSTEM STATUS:
✅ MONITORING ACTIVE
✅ NOTIFICATIONS ENABLED  
✅ AI ANALYSIS COMPLETE

═══════════════════════════════════════════════════════════
🤖 AI Monitoring System - World Wide Notifier

Dashboard: {os.getenv('FRONTEND_URL', 'http://localhost:3000')}/
Settings: {os.getenv('FRONTEND_URL', 'http://localhost:3000')}/settings
All Alerts: {os.getenv('FRONTEND_URL', 'http://localhost:3000')}/alerts

This alert was generated by your AI monitoring system.
Need help? Contact support or check your notification settings.
═══════════════════════════════════════════════════════════
        """
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f8f9fa;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                
                <!-- Header Section -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: bold;">
                        🚨 AI Monitoring Alert
                    </h1>
                    <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">
                        {alert['title']}
                    </p>
                </div>
                
                <!-- Status Badge -->
                <div style="text-align: center; margin: 20px 0;">
                    <span style="display: inline-block; background-color: {'#dc3545' if alert['relevance_score'] >= 80 else '#ffc107' if alert['relevance_score'] >= 60 else '#28a745'}; 
                                 color: white; padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 16px;">
                        🎯 RELEVANCE SCORE: {alert['relevance_score']}/100
                    </span>
                </div>
                
                <!-- Alert Details -->
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                    <h3 style="color: #495057; margin: 0 0 15px 0; font-size: 18px;">📊 Alert Details</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #6c757d; font-weight: bold; width: 30%;">Source:</td>
                            <td style="padding: 8px 0;">
                                <a href="{alert['source_url']}" style="color: #667eea; text-decoration: none; font-weight: bold;">
                                    {alert['source_url'][:50]}{'...' if len(alert['source_url']) > 50 else ''}
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6c757d; font-weight: bold;">Time:</td>
                            <td style="padding: 8px 0; color: #495057;">{alert['timestamp']}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6c757d; font-weight: bold;">Status:</td>
                            <td style="padding: 8px 0;">
                                <span style="background-color: #28a745; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                                    🟢 ACTIVE ALERT
                                </span>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Content Section -->
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e9ecef;">
                    <h3 style="color: #495057; margin: 0 0 15px 0; font-size: 18px;">📝 Alert Summary</h3>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745;">
                        <p style="margin: 0; color: #495057; line-height: 1.6;">
                            {alert['content']}
                        </p>
                    </div>
                </div>
                
                <!-- Action Section -->
                <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 25px; border-radius: 8px; text-align: center; margin: 30px 0;">
                    <h3 style="margin: 0 0 15px 0; font-size: 20px;">🚀 Take Action</h3>
                    <p style="margin: 0 0 20px 0; opacity: 0.9; font-size: 14px;">
                        Visit your dashboard to manage all alerts and acknowledge this notification.
                    </p>
                    <div style="margin: 20px 0;">
                        <a href="{dashboard_url}/" 
                           style="display: inline-block; background-color: white; color: #28a745; padding: 15px 30px; 
                                  text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;
                                  box-shadow: 0 2px 10px rgba(0,0,0,0.1); transition: all 0.3s ease;">
                            🎯 Go to Dashboard
                        </a>
                    </div>
                    <p style="margin: 15px 0 0 0; font-size: 12px; opacity: 0.8;">
                        Or visit your <a href="{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/" style="color: white; text-decoration: underline;">dashboard</a> to manage all alerts
                    </p>
                </div>
                
                <!-- System Status -->
                <div style="background-color: #e9ecef; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="color: #495057; margin: 0 0 10px 0; font-size: 14px;">🔧 System Status</h4>
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                        <span style="color: #28a745; font-weight: bold; font-size: 12px;">✅ MONITORING ACTIVE</span>
                        <span style="color: #6c757d; font-size: 12px;">✅ NOTIFICATIONS ENABLED</span>
                        <span style="color: #667eea; font-size: 12px;">✅ AI ANALYSIS COMPLETE</span>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="border-top: 1px solid #e9ecef; padding: 20px 0; margin: 30px 0 0 0; text-align: center;">
                    <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px; font-weight: bold;">
                        🤖 AI Monitoring System - World Wide Notifier
                    </p>
                    <p style="margin: 0; color: #adb5bd; font-size: 12px; line-height: 1.4;">
                        This alert was generated by your AI monitoring system.<br>
                        Need help? Contact support or check your notification settings in the dashboard.
                    </p>
                    <div style="margin: 15px 0 0 0;">
                        <a href="{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/" style="color: #667eea; text-decoration: none; font-size: 12px; margin: 0 10px;">Dashboard</a>
                        <a href="{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/settings" style="color: #667eea; text-decoration: none; font-size: 12px; margin: 0 10px;">Settings</a>
                        <a href="{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/alerts" style="color: #667eea; text-decoration: none; font-size: 12px; margin: 0 10px;">All Alerts</a>
                    </div>
                </div>
                
            </div>
        </body>
        </html>
        """
        
        return text_content, html_content
    
    def process_alert(self, alert):
        """Process a single alert"""
        logger.info(f"Processing alert: {alert['title']}")
        
        # Generate acknowledgment token if not present
        if 'acknowledgment_token' not in alert:
            alert['acknowledgment_token'] = str(uuid.uuid4()) + str(uuid.uuid4()).replace('-', '')
        
        # Store acknowledgment token in database if alert has an ID
        if 'id' in alert:
            try:
                with self.get_db_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE alerts SET acknowledgment_token = %s WHERE id = %s",
                            (alert['acknowledgment_token'], alert['id'])
                        )
                        conn.commit()
            except Exception as e:
                logger.warning(f"Could not update acknowledgment token in database: {e}")
        
        # Check for duplicates
        is_duplicate = self.is_duplicate_alert(alert)
        if is_duplicate:
            logger.info(f"Skipping duplicate alert: {alert['title']} - but marking as sent")
            # Still mark duplicate alerts as sent since they were processed
            try:
                with psycopg2.connect(self.database_url) as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE alerts SET is_sent = TRUE WHERE id = %s",
                            (alert['id'],)
                        )
                        conn.commit()
                        logger.info(f"✅ Updated duplicate alert {alert['id']} - marked as sent in database")
            except Exception as e:
                logger.error(f"Failed to update is_sent flag for duplicate alert: {e}")
            return
        
        # Get user ID for this job
        user_id = self.get_job_user_id(alert['job_id'])
        if not user_id:
            logger.error(f"No user found for job {alert['job_id']}")
            return
        
        # Get job's notification channel settings
        job_channels = self.get_job_notification_channels(alert['job_id'])
        if not job_channels:
            logger.info(f"No notification channels configured for job {alert['job_id']}")
            return
        
        # Get user's notification channels that are specified in the job
        channels = self.get_user_notification_channels_for_job(user_id, job_channels)
        if not channels:
            logger.warning(f"No valid notification channels found for job {alert['job_id']}")
            return
        
        # Format content
        text_content, html_content = self.format_alert_content(alert)
        
        # Send notifications through user's configured channels
        notifications_sent = {
            'email': 0,
            'teams': 0,
            'slack': 0
        }
        
        for channel in channels:
            channel_config = channel['config'] if isinstance(channel['config'], dict) else json.loads(channel['config']) if channel['config'] else {}
            
            if channel['channel_type'] == 'email':
                email_address = channel_config.get('email', self.notification_email)
                email_subject = f"AI Pipeline Alert: {alert['title']}"
                if self.send_email_to_address(email_subject, text_content, html_content, email_address):
                    notifications_sent['email'] += 1
                    
            elif channel['channel_type'] == 'teams':
                webhook_url = channel_config.get('webhook_url')
                if webhook_url and self.send_teams_notification_to_webhook(
                    alert['title'], alert['content'], alert['source_url'], webhook_url
                ):
                    notifications_sent['teams'] += 1
                    
            elif channel['channel_type'] == 'slack':
                webhook_url = channel_config.get('webhook_url')
                if webhook_url and self.send_slack_notification(
                    alert['title'], alert['content'], alert['source_url'], webhook_url
                ):
                    notifications_sent['slack'] += 1
        
        # Mark alert as processed
        processed_alert = {
            'job_id': str(alert['job_id']),
            'title': str(alert['title']),
            'processed_at': datetime.now().isoformat(),
            'email_sent': str(notifications_sent['email']),
            'teams_sent': str(notifications_sent['teams']),
            'slack_sent': str(notifications_sent['slack']),
            'relevance_score': str(alert['relevance_score'])
        }
        
        try:
            self.redis_client.hset(f"processed_alert:{alert['job_run_id']}", mapping=processed_alert)
        except Exception as e:
            logger.warning(f"Could not store processed alert: {e}")
        
        total_sent = sum(notifications_sent.values())
        
        # Update database to mark alert as sent if any notifications were sent
        logger.info(f"Attempting to update is_sent flag - total_sent: {total_sent}, alert_id: {alert['id']}")
        if total_sent > 0:
            try:
                logger.info(f"Connecting to database: {self.database_url}")
                with psycopg2.connect(self.database_url) as conn:
                    with conn.cursor() as cur:
                        logger.info(f"Executing UPDATE query for alert {alert['id']}")
                        cur.execute(
                            "UPDATE alerts SET is_sent = TRUE WHERE id = %s",
                            (alert['id'],)
                        )
                        rows_affected = cur.rowcount
                        conn.commit()
                        logger.info(f"✅ Updated alert {alert['id']} - marked as sent in database (rows affected: {rows_affected})")
            except Exception as e:
                logger.error(f"Failed to update is_sent flag in database: {e}")
                logger.error(f"Database URL: {self.database_url}")
                logger.error(f"Alert ID: {alert['id']}")
        else:
            logger.info(f"No notifications sent (total_sent: {total_sent}), not updating is_sent flag")
        logger.info(f"Alert processed - {total_sent} notifications sent: {notifications_sent}")
    
    def run_processor(self):
        """Main alert processing loop"""
        logger.info("Notification Service started with SendGrid and Teams")
        
        while self.running:
            try:
                # Get alert from queue (blocking with 1 second timeout)
                alert_data = self.redis_client.brpop("alert_queue", timeout=1)
                
                if alert_data:
                    # Parse alert
                    alert = json.loads(alert_data[1])
                    
                    # Process alert
                    self.process_alert(alert)
                
            except Exception as e:
                logger.error(f"Error processing alert: {e}")
                time.sleep(1)
    
    def stop(self):
        """Stop the notification service"""
        self.running = False

if __name__ == "__main__":
    service = NotificationService()
    
    try:
        service.run_processor()
    except KeyboardInterrupt:
        logger.info("Shutting down notification service...")
        service.stop()
