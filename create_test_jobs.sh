#!/bin/bash

# Create test jobs for reliable triggering and monitoring
API_URL=${API_URL:-"http://localhost:8000"}

echo "🚀 Creating reliable test jobs for monitoring..."

# Job 1: Fast triggering job with simple content check
echo "Creating Job 1: Fast Letter Detection..."
curl -X POST "$API_URL/jobs" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Fast Letter A Detection",
    "description": "Quick test job that checks for letter A (should always trigger)",
    "sources": [
      "https://httpbin.org/json",
      "https://httpbin.org/get"
    ],
    "prompt": "Check if this content contains the letter 'a' (case insensitive). This should always be found.",
    "frequency_minutes": 2,
    "threshold_score": 10,
    "notification_channel_ids": [],
    "alert_cooldown_minutes": 1,
    "max_alerts_per_hour": 30,
    "repeat_frequency_minutes": 5,
    "max_repeats": 3,
    "require_acknowledgment": false
  }'

echo -e "\n"

# Job 2: Medium frequency with word detection
echo "Creating Job 2: Word Detection..."
curl -X POST "$API_URL/jobs" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Word Detection",
    "description": "Looks for common words in HTTP responses",
    "sources": [
      "https://httpbin.org/html",
      "https://httpbin.org/robots.txt",
      "https://httpbin.org/status/200"
    ],
    "prompt": "Look for any common English words like: the, and, or, a, an, is, are, was, were. Report if any are found.",
    "frequency_minutes": 3,
    "threshold_score": 15,
    "notification_channel_ids": [],
    "alert_cooldown_minutes": 2,
    "max_alerts_per_hour": 20,
    "repeat_frequency_minutes": 10,
    "max_repeats": 2,
    "require_acknowledgment": false
  }'

echo -e "\n"

# Job 3: JSON structure detection
echo "Creating Job 3: JSON Structure Detection..."
curl -X POST "$API_URL/jobs" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test JSON Structure Analysis",
    "description": "Analyzes JSON responses for structure changes",
    "sources": [
      "https://httpbin.org/json",
      "https://httpbin.org/uuid",
      "https://httpbin.org/base64/SFRUUEJJTiBpcyBhd2Vzb21l"
    ],
    "prompt": "Analyze if this content contains JSON structure, UUID format, or base64 encoded content. Look for patterns and data types.",
    "frequency_minutes": 5,
    "threshold_score": 20,
    "notification_channel_ids": [],
    "alert_cooldown_minutes": 3,
    "max_alerts_per_hour": 15,
    "repeat_frequency_minutes": 15,
    "max_repeats": 2,
    "require_acknowledgment": false
  }'

echo -e "\n"

# Job 4: HTTP response codes monitoring
echo "Creating Job 4: HTTP Response Analysis..."
curl -X POST "$API_URL/jobs" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test HTTP Response Monitor",
    "description": "Monitors different HTTP response patterns",
    "sources": [
      "https://httpbin.org/status/200",
      "https://httpbin.org/headers",
      "https://httpbin.org/user-agent"
    ],
    "prompt": "Check if the HTTP response contains status indicators, headers information, or user agent data. Look for successful responses.",
    "frequency_minutes": 4,
    "threshold_score": 25,
    "notification_channel_ids": [],
    "alert_cooldown_minutes": 2,
    "max_alerts_per_hour": 20,
    "repeat_frequency_minutes": 12,
    "max_repeats": 3,
    "require_acknowledgment": false
  }'

echo -e "\n"

# Job 5: Content length monitoring with low threshold
echo "Creating Job 5: Content Length Monitor..."
curl -X POST "$API_URL/jobs" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Content Length Analysis",
    "description": "Monitors content length and basic patterns - designed to trigger easily",
    "sources": [
      "https://httpbin.org/html",
      "https://httpbin.org/robots.txt"
    ],
    "prompt": "Check if the content has more than 10 characters. This should always trigger as most web content exceeds this length.",
    "frequency_minutes": 1,
    "threshold_score": 5,
    "notification_channel_ids": [],
    "alert_cooldown_minutes": 1,
    "max_alerts_per_hour": 60,
    "repeat_frequency_minutes": 5,
    "max_repeats": 2,
    "require_acknowledgment": false
  }'

echo -e "\n✅ All test jobs created! They should start executing within their frequency intervals."
echo "🔍 Monitor them in the Live Dashboard to see execution steps."
echo "⚡ Job 5 (1-minute frequency) should trigger fastest."
echo "🎯 All jobs have low thresholds and simple criteria to ensure triggering."
