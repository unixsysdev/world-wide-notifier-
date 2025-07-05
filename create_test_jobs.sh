#!/bin/bash

# Create multiple test jobs for deduplication testing
API_KEY="ak_live_iRhEXcLohpl-TPIHGNESGjNKYCGrwb3J0uXb-tEeZYM"
BASE_URL="https://mon.duckerhub.com/api/v1"
CHANNEL_ID="5c2c498e-04b6-4335-a5ca-7ee227eb23eb"

# Array of test URLs
urls=(
  "https://www.bbc.com/news"
  "https://www.cnn.com/tech" 
  "https://techcrunch.com"
  "https://www.reuters.com/technology"
  "https://www.theverge.com"
  "https://arstechnica.com"
  "https://www.bloomberg.com/technology"
  "https://www.wsj.com/tech"
  "https://finance.yahoo.com"
  "https://www.marketwatch.com"
  "https://www.cnbc.com/technology"
  "https://venturebeat.com"
  "https://mashable.com"
  "https://www.engadget.com"
  "https://gizmodo.com"
  "https://www.cnet.com"
  "https://www.zdnet.com"
  "https://www.wired.com"
  "https://www.apple.com/newsroom"
  "https://blog.google"
)

echo "🚀 Creating ${#urls[@]} test jobs with deduplication fix..."

job_ids=()
success_count=0

for i in "${!urls[@]}"; do
  url="${urls[$i]}"
  job_num=$((i + 1))
  
  echo "📝 Creating job $job_num: $url"
  
  response=$(curl -s "$BASE_URL/jobs" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -X POST \
    -d "{
      \"name\": \"Dedup Test $job_num\",
      \"description\": \"Testing deduplication fix - $url\",
      \"sources\": [\"$url\"],
      \"prompt\": \"Look for JSON data, API changes, or technical updates. Alert if you see JSON structures or API documentation.\",
      \"frequency_minutes\": 1,
      \"threshold_score\": 40,
      \"notification_channel_ids\": [\"$CHANNEL_ID\"],
      \"alert_cooldown_minutes\": 60,
      \"max_alerts_per_hour\": 5, 
      \"repeat_frequency_minutes\": 60,
      \"max_repeats\": 5,
      \"require_acknowledgment\": true
    }")
  
  # Extract job ID from response
  job_id=$(echo "$response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  
  if [ ! -z "$job_id" ]; then
    echo "✅ Created job $job_num: $job_id"
    job_ids+=("$job_id")
    success_count=$((success_count + 1))
  else
    echo "❌ Failed job $job_num: $response"
  fi
  
  # Small delay to avoid rate limiting
  sleep 0.2
done

echo ""
echo "📊 RESULTS:"
echo "✅ Successfully created: $success_count jobs"
echo "❌ Failed: $((${#urls[@]} - success_count)) jobs"
echo ""
echo "🎯 Created Job IDs:"
printf '%s\n' "${job_ids[@]}"

# Save job IDs to file for monitoring
printf '%s\n' "${job_ids[@]}" > test_job_ids.txt
echo "💾 Job IDs saved to test_job_ids.txt"
echo ""
echo "🚀 Jobs should start running with 1-minute frequency!"
echo "⏰ Wait 2-3 minutes then check for alerts..."
