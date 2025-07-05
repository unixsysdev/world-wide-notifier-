#!/bin/bash

API_KEY="ak_live_iRhEXcLohpl-TPIHGNESGjNKYCGrwb3J0uXb-tEeZYM"
BASE_URL="https://mon.duckerhub.com/api/v1"

echo "🔍 MONITORING DEDUPLICATION TEST RESULTS..."
echo "$(date): Starting monitoring..."
echo ""

# Get all alerts
echo "📊 CHECKING ALERTS:"
alerts_response=$(curl -s "$BASE_URL/alerts?limit=100" \
  -H "Authorization: Bearer $API_KEY")

# Count total alerts
total_alerts=$(echo "$alerts_response" | grep -o '"id":' | wc -l)
echo "📈 Total alerts found: $total_alerts"

if [ $total_alerts -gt 0 ]; then
  # Analyze is_sent status
  sent_true=$(echo "$alerts_response" | grep -o '"is_sent":true' | wc -l)
  sent_false=$(echo "$alerts_response" | grep -o '"is_sent":false' | wc -l)
  
  echo "✅ Alerts with is_sent=true: $sent_true"
  echo "❌ Alerts with is_sent=false: $sent_false"
  
  # Check acknowledgment status
  ack_true=$(echo "$alerts_response" | grep -o '"is_acknowledged":true' | wc -l)
  ack_false=$(echo "$alerts_response" | grep -o '"is_acknowledged":false' | wc -l)
  
  echo "✅ Acknowledged alerts: $ack_true"
  echo "⏰ Unacknowledged alerts: $ack_false"
  
  # Check repeat counts
  echo ""
  echo "🔄 REPEAT ANALYSIS:"
  echo "$alerts_response" | grep -o '"repeat_count":[0-9]*' | sort | uniq -c
  
  echo ""
  echo "📝 RECENT ALERT SAMPLES:"
  echo "$alerts_response" | head -c 1000
  echo "..."
else
  echo "⚠️ No alerts found yet. Jobs may still be processing..."
fi

echo ""
echo "🏃 JOB EXECUTION STATUS:"

# Check a few sample jobs
sample_jobs=($(head -5 test_job_ids.txt))

for job_id in "${sample_jobs[@]}"; do
  echo "🔍 Checking job: $job_id"
  
  # Get job alerts
  job_alerts=$(curl -s "$BASE_URL/jobs/$job_id/alerts" \
    -H "Authorization: Bearer $API_KEY")
  
  job_alert_count=$(echo "$job_alerts" | grep -o '"id":' | wc -l)
  echo "   📊 Alerts for this job: $job_alert_count"
  
  if [ $job_alert_count -gt 0 ]; then
    job_sent_true=$(echo "$job_alerts" | grep -o '"is_sent":true' | wc -l)
    job_sent_false=$(echo "$job_alerts" | grep -o '"is_sent":false' | wc -l)
    echo "   ✅ is_sent=true: $job_sent_true"
    echo "   ❌ is_sent=false: $job_sent_false"
  fi
  echo ""
done

echo "⏰ Monitoring complete at $(date)"
echo ""
echo "🎯 KEY METRICS TO VERIFY OUR FIX:"
echo "1. is_sent=true means notification was sent"
echo "2. is_sent=false means blocked by deduplication/rate limiting"
echo "3. repeat_count > 0 means repeat notifications working"
echo "4. Multiple alerts from same job should show deduplication"
