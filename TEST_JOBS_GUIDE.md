# Test Jobs Creation Guide

## Quick Setup for Testing Live Dashboard

### Step 1: Get Your Auth Token
1. Open the web UI and login
2. Open browser Developer Tools (F12)
3. Go to Console tab
4. Run: `localStorage.getItem('token')`
5. Copy the token (without quotes)

### Step 2: Create Test Jobs
```bash
# Set your auth token
export AUTH_TOKEN="your_token_here"

# Run the Python script to create test jobs
python3 create_test_jobs.py
```

### What These Jobs Do:
- **⚡ Ultra-Fast (1min)**: Triggers every minute - fastest to see execution
- **🔤 Letter A (2min)**: Looks for common letters - always triggers  
- **📝 Common Words (3min)**: Finds English words - reliable triggering
- **🔍 JSON Pattern (4min)**: Detects data structures
- **📊 HTTP Monitor (5min)**: Analyzes response patterns

### Expected Behavior:
✅ All jobs should trigger alerts (low thresholds)  
⚡ Ultra-Fast job executes every minute for quick testing  
👀 Watch live execution in `/live` dashboard  
🔍 You should see all execution steps including:
- Initializing scrape
- Processing sources  
- LLM analysis
- Alert generation
- Completion status

### Testing the Live Monitor:
1. Go to `/live` in the web UI
2. Wait 1-2 minutes for jobs to start
3. Watch the "Live Executing Jobs" section
4. Click "Show Details" to see step-by-step progress
5. Check "Recent Execution History" for completed runs

### Cleanup:
Jobs can be deleted from the main Dashboard after testing.
