import json
import redis
import requests
import time
import hashlib
import uuid
import json
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


        
    def get_job_user_id(self, job_id):
        """Get user ID for a job"""
        with self.get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT user_id FROM jobs WHERE id = %s", (job_id,))
                result = cur.fetchone()
                return result['user_id'] if result else None
                
    def generate_alert_hash(self, alert):
        """Generate hash for alert deduplication"""
        content_string = f"{alert['job_id']}:{alert['title']}:{alert['source_url']}"
        return hashlib.md5(content_string.encode()).hexdigest()
    
    def is_duplicate_alert(self, alert):
        """Check if alert is a duplicate within time window"""
        alert_hash = self.generate_alert_hash(alert)
        recent_key = f"recent_alert:{alert_hash}"
        
        if self.redis_client.exists(recent_key):
            return True
        
        # Mark as seen for next 6 hours
        self.redis_client.setex(recent_key, 6 * 3600, "1")
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
        api_url = os.getenv('API_URL', 'http://localhost:8000')
        
        # Only create acknowledgment URL if alert has an ID
        alert_id = alert.get('id')
        if alert_id:
            ack_url = f"{api_url}/alerts/{alert_id}/acknowledge?token={ack_token}"
        else:
            ack_url = f"{api_url.replace(':8000', ':3000')}/"  # Fallback to dashboard
        
        text_content = f"""
🚨 NEW AI ALERT: {alert['title']}

Relevance Score: {alert['relevance_score']}/100
Source: {alert['source_url']}
Time: {alert['timestamp']}

Summary:
{alert['content']}

---
🔗 MANAGE THIS ALERT:
{f"Click here to acknowledge: {ack_url}" if alert_id else f"View in dashboard: {ack_url}"}

Or visit the dashboard: {api_url.replace(':8000', ':3000')}/

Your AI Monitoring System found this relevant content!
        """
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #d32f2f; border-left: 4px solid #d32f2f; padding-left: 10px;">
                    🚨 AI Pipeline Alert: {alert['title']}
                </h2>
                
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Relevance Score:</strong> 
                        <span style="color: {'#d32f2f' if alert['relevance_score'] >= 80 else '#f57c00' if alert['relevance_score'] >= 60 else '#1976d2'};">
                            {alert['relevance_score']}/100
                        </span>
                    </p>
                    <p><strong>Source:</strong> <a href="{alert['source_url']}" style="color: #1976d2;">{alert['source_url']}</a></p>
                    <p><strong>Time:</strong> {alert['timestamp']}</p>
                </div>
                
                <h3 style="color: #333;">Summary:</h3>
                <div style="background-color: #fff; padding: 15px; border-left: 3px solid #1976d2; margin: 15px 0;">
                    <p>{alert['content']}</p>
                </div>
                
                <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; text-align: center; margin: 30px 0;">
                    <h3 style="color: #2e7d32; margin-top: 0;">Alert Management</h3>
                    {f'''<p style="margin: 15px 0;">Click the button below to acknowledge this alert and stop further notifications:</p>
                    <a href="{ack_url}" 
                       style="display: inline-block; background-color: #4caf50; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px;">
                        ✓ Acknowledge Alert
                    </a>''' if alert_id else f'''<p style="margin: 15px 0;">Visit your dashboard to manage this alert:</p>
                    <a href="{ack_url}" 
                       style="display: inline-block; background-color: #1976d2; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px;">
                        → Go to Dashboard
                    </a>'''}
                    <p style="font-size: 12px; color: #666; margin-top: 15px;">
                        Visit your <a href="{api_url.replace(':8000', ':3000')}/" style="color: #1976d2;">dashboard</a> to manage all alerts
                    </p>
                </div>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="font-size: 12px; color: #666; text-align: center;">
                    This alert was generated by your AI Monitoring System<br>
                    Need help? Contact support or check your notification settings.
                </p>
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
        if self.is_duplicate_alert(alert):
            logger.info(f"Skipping duplicate alert: {alert['title']}")
            return
        
        # Get user ID for this job
        user_id = self.get_job_user_id(alert['job_id'])
        if not user_id:
            logger.error(f"No user found for job {alert['job_id']}")
            return
        
        # Get user's notification channels
        channels = self.get_user_notification_channels(user_id)
        if not channels:
            logger.warning(f"No notification channels configured for user {user_id}")
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
