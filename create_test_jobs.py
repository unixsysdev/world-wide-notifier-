#!/usr/bin/env python3
"""
Create test jobs for reliable monitoring and execution visibility.
Run this script when the system is running to create jobs that will trigger easily.
"""

import requests
import json
import sys
import os

def get_auth_headers():
    """Get authentication token from environment or prompt"""
    token = os.getenv('AUTH_TOKEN')
    if not token:
        print("❌ No AUTH_TOKEN environment variable found.")
        print("💡 You need to:")
        print("   1. Login to the web UI")
        print("   2. Get your auth token from browser dev tools (localStorage.getItem('token'))")
        print("   3. Set it: export AUTH_TOKEN='your_token_here'")
        print("   4. Re-run this script")
        sys.exit(1)
    return {'Authorization': f'Bearer {token}'}

def create_job(api_url, job_data, headers):
    """Create a single job"""
    try:
        response = requests.post(f"{api_url}/jobs", json=job_data, headers=headers)
        if response.status_code == 200 or response.status_code == 201:
            job = response.json()
            print(f"✅ Created job: {job_data['name']} (ID: {job.get('id', 'unknown')})")
            return True
        else:
            print(f"❌ Failed to create job {job_data['name']}: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating job {job_data['name']}: {e}")
        return False

def main():
    api_url = os.getenv('API_URL', 'http://localhost:8000')
    
    print("🚀 Creating reliable test jobs for monitoring...")
    print(f"📡 API URL: {api_url}")
    
    try:
        headers = get_auth_headers()
    except SystemExit:
        return
    
    # Test authentication first
    try:
        test_response = requests.get(f"{api_url}/jobs", headers=headers)
        if test_response.status_code != 200:
            print(f"❌ Authentication failed: {test_response.status_code}")
            print("💡 Check your token and try again")
            return
        print("✅ Authentication successful")
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return
    
    # Define test jobs with guaranteed triggers
    jobs = [
        {
            "name": "🔤 Letter A Detection Test",
            "description": "Fast test - always triggers by finding letter 'a'",
            "sources": [
                "https://httpbin.org/json",
                "https://httpbin.org/get"
            ],
            "prompt": "Check if this content contains the letter 'a' or 'A'. This should always be found in any text.",
            "frequency_minutes": 2,
            "threshold_score": 10,
            "notification_channel_ids": [],
            "alert_cooldown_minutes": 1,
            "max_alerts_per_hour": 30,
            "repeat_frequency_minutes": 5,
            "max_repeats": 2,
            "require_acknowledgment": False
        },
        {
            "name": "📝 Common Words Test", 
            "description": "Medium speed - detects common English words",
            "sources": [
                "https://httpbin.org/html",
                "https://httpbin.org/robots.txt"
            ],
            "prompt": "Look for common English words: 'the', 'and', 'or', 'is', 'a'. These appear in most web content.",
            "frequency_minutes": 3,
            "threshold_score": 15,
            "notification_channel_ids": [],
            "alert_cooldown_minutes": 2,
            "max_alerts_per_hour": 20,
            "repeat_frequency_minutes": 8,
            "max_repeats": 2,
            "require_acknowledgment": False
        },
        {
            "name": "🔍 JSON & Data Pattern Test",
            "description": "Analyzes structured data patterns",
            "sources": [
                "https://httpbin.org/json",
                "https://httpbin.org/uuid",
                "https://httpbin.org/base64/aGVsbG8gd29ybGQ="
            ],
            "prompt": "Check for JSON format, UUID patterns, or base64 encoded data. Look for structured data indicators.",
            "frequency_minutes": 4,
            "threshold_score": 20,
            "notification_channel_ids": [],
            "alert_cooldown_minutes": 3,
            "max_alerts_per_hour": 15,
            "repeat_frequency_minutes": 12,
            "max_repeats": 2,
            "require_acknowledgment": False
        },
        {
            "name": "📊 HTTP Response Monitor",
            "description": "Monitors HTTP response characteristics",
            "sources": [
                "https://httpbin.org/status/200",
                "https://httpbin.org/headers",
                "https://httpbin.org/user-agent"
            ],
            "prompt": "Check for HTTP status codes, header information, or user agent data in the response.",
            "frequency_minutes": 5,
            "threshold_score": 25,
            "notification_channel_ids": [],
            "alert_cooldown_minutes": 3,
            "max_alerts_per_hour": 12,
            "repeat_frequency_minutes": 15,
            "max_repeats": 2,
            "require_acknowledgment": False
        },
        {
            "name": "⚡ Ultra-Fast Content Length",
            "description": "1-minute frequency - checks content length (always triggers)",
            "sources": [
                "https://httpbin.org/html",
                "https://httpbin.org/robots.txt"
            ],
            "prompt": "Check if content has more than 5 characters. This should always trigger since web pages have text.",
            "frequency_minutes": 1,
            "threshold_score": 5,
            "notification_channel_ids": [],
            "alert_cooldown_minutes": 1,
            "max_alerts_per_hour": 60,
            "repeat_frequency_minutes": 3,
            "max_repeats": 1,
            "require_acknowledgment": False
        }
    ]
    
    # Create all jobs
    created_count = 0
    for job_data in jobs:
        if create_job(api_url, job_data, headers):
            created_count += 1
    
    print(f"\n🎉 Successfully created {created_count}/{len(jobs)} test jobs!")
    
    if created_count > 0:
        print("\n📈 What to expect:")
        print("   ⚡ Ultra-Fast job: Should execute every 1 minute")
        print("   🔤 Letter A job: Should execute every 2 minutes") 
        print("   📝 Common Words job: Should execute every 3 minutes")
        print("   🔍 JSON Pattern job: Should execute every 4 minutes")
        print("   📊 HTTP Monitor job: Should execute every 5 minutes")
        print("\n👀 Watch them in the Live Dashboard - you should see execution steps!")
        print("🎯 All jobs have low thresholds designed to trigger alerts.")
    
    print(f"\n💡 Monitor at: {api_url.replace('8000', '3000')}/live")

if __name__ == "__main__":
    main()
