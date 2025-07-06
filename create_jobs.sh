#!/bin/bash

API_KEY="ak_live_uLVuegqmNd0Z2ae9-vHwPV5BCCQuXWJoQm7XToedvoU"
BASE_URL="https://mon.duckerhub.com/api/v1/jobs"

# Array of diverse sources and prompts
sources=(
  "https://feeds.bbci.co.uk/news/rss.xml"
  "https://feeds.bbci.co.uk/news/technology/rss.xml"
  "https://techcrunch.com/feed/"
  "https://rss.cnn.com/rss/edition.rss"
  "https://feeds.reuters.com/reuters/technologyNews"
  "https://www.wired.com/feed/"
  "https://feeds.arstechnica.com/arstechnica/index"
  "https://www.theverge.com/rss/index.xml"
  "https://www.engadget.com/rss.xml"
  "https://mashable.com/feeds/all"
)

prompts=(
  "Monitor for breaking technology news and innovations"
  "Track AI and machine learning developments"
  "Watch for cybersecurity threats and updates"
  "Monitor global business and finance news"
  "Track startup funding and venture capital news"
  "Monitor scientific breakthroughs and research"
  "Watch for social media platform updates"
  "Track cloud computing and infrastructure news"
  "Monitor mobile technology and app developments"
  "Watch for data privacy and regulation changes"
)

job_names=(
  "Tech Pulse Monitor"
  "AI Development Tracker"
  "Security Alert Scanner"
  "Business News Watcher"
  "Startup Funding Monitor"
  "Science Discovery Tracker"
  "Social Media Scanner"
  "Cloud Infrastructure Monitor"
  "Mobile Tech Tracker"
  "Privacy Policy Watcher"
)

echo "Creating 50 monitoring jobs..."

for i in {1..50}; do
  # Random frequency between 1-3 minutes
  freq=$((1 + RANDOM % 3))
  
  # Cycle through sources, prompts, and names
  source_index=$((($i - 1) % ${#sources[@]}))
  prompt_index=$((($i - 1) % ${#prompts[@]}))
  name_index=$((($i - 1) % ${#job_names[@]}))
  
  source="${sources[$source_index]}"
  prompt="${prompts[$prompt_index]}"
  name="${job_names[$name_index]} $i"
  
  # Random threshold between 60-80
  threshold=$((60 + RANDOM % 21))
  
  echo "Creating job $i: $name (freq: ${freq}m, threshold: $threshold)"
  
  curl -X POST -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$name\",
    \"sources\": [\"$source\"],
    \"prompt\": \"$prompt - Monitor $i\",
    \"frequency_minutes\": $freq,
    \"threshold_score\": $threshold,
    \"notification_channel_ids\": [],
    \"active\": true
  }" \
  "$BASE_URL" > /dev/null 2>&1
  
  if [ $? -eq 0 ]; then
    echo "✅ Created: $name"
  else
    echo "❌ Failed: $name"
  fi
  
  # Small delay to avoid overwhelming the API
  sleep 0.2
done

echo "🎉 Finished creating 50 jobs!"
