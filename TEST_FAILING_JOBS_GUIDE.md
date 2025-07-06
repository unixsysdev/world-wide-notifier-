# Test Failing Jobs Guide

## Overview
This guide shows how to create test jobs that will fail, allowing you to test the Failed Jobs functionality.

## Prerequisites
- The world-wide-notifier application is running
- You have a user account and are logged in
- Python 3 is installed on your system

## Steps to Create Test Failing Jobs

### 1. Get Your Authentication Token
1. Open your browser and log into the application
2. Open Developer Tools (F12)
3. Go to the Application/Storage tab
4. Find "Local Storage" → Your app URL
5. Copy the value of the "token" key

### 2. Run the Test Script
```bash
# From the project root directory
python create_test_failing_jobs.py YOUR_TOKEN_HERE
```

Replace `YOUR_TOKEN_HERE` with the token you copied from localStorage.

### 3. View the Failed Jobs
1. Wait 1-2 minutes for the jobs to execute and fail
2. Go to your application dashboard
3. Click on the "🔧 Failed Jobs" tab
4. You should see the failed jobs listed there

## What the Test Jobs Do

The script creates several test jobs that will fail for different reasons:

1. **Invalid Domain** - Uses a non-existent domain to trigger DNS failure
2. **Connection Timeout** - Uses a URL that will timeout
3. **404 Error** - Uses a URL that returns 404
4. **Invalid URL Format** - Uses a malformed URL
5. **Server Error** - Uses a URL that returns 500 error
6. **SSL Certificate Error** - Uses a URL with SSL issues
7. **Rate Limited** - Uses a URL that returns 429 rate limit error

## Clean Up
After testing, you can delete these test jobs from the dashboard to clean up your job list.

## Example Usage
```bash
# Example command
python create_test_failing_jobs.py eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c

# Expected output:
# Creating test jobs that will fail...
# ✅ Created job: 🚨 Test - Invalid Domain
#    🔄 Triggered immediate execution for 🚨 Test - Invalid Domain
# ✅ Created job: 🚨 Test - Connection Timeout
#    🔄 Triggered immediate execution for 🚨 Test - Connection Timeout
# ...
```

## Troubleshooting

### "Failed to create job" errors
- Check that your token is valid and not expired
- Ensure the API service is running on localhost:8000
- Verify you're logged in to the application

### Jobs not appearing in Failed Jobs tab
- Wait a few minutes for the jobs to execute
- Check the Live Monitor tab to see if jobs are running
- Refresh the Failed Jobs tab
- Check the API service logs for any errors

### Token issues
- Make sure you copied the complete token from localStorage
- Check that the token hasn't expired (login again if needed)
- Ensure there are no extra spaces or characters in the token
