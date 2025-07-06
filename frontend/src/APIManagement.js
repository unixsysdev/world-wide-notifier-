import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ResponsiveNavigation from './components/ResponsiveNavigation';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const APIManagement = ({ user, logout, userSubscription, setCurrentView, currentView, alerts, isDarkMode, toggleDarkMode }) => {
  const [apiKeys, setApiKeys] = useState([]);
  const [showCreateApiKey, setShowCreateApiKey] = useState(false);
  const [apiKeyForm, setApiKeyForm] = useState({ name: '', rate_limit_per_minute: '' });
  const [createdApiKey, setCreatedApiKey] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await axios.get(`${API_URL}/api-keys`);
      setApiKeys(response.data);
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };

  const createApiKey = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/api-keys`, {
        name: apiKeyForm.name,
        rate_limit_per_minute: apiKeyForm.rate_limit_per_minute ? parseInt(apiKeyForm.rate_limit_per_minute) : null
      });
      
      // Show the API key in a proper modal with copy functionality
      setCreatedApiKey(response.data);
      
      setApiKeyForm({ name: '', rate_limit_per_minute: '' });
      setShowCreateApiKey(false);
      fetchApiKeys();
    } catch (error) {
      console.error('Error creating API key:', error);
      alert('Failed to create API key: ' + (error.response?.data?.detail || error.message));
    }
  };

  const deleteApiKey = async (keyId) => {
    if (!window.confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }
    
    try {
      await axios.delete(`${API_URL}/api-keys/${keyId}`);
      fetchApiKeys();
    } catch (error) {
      console.error('Error deleting API key:', error);
      alert('Failed to delete API key');
    }
  };

  const toggleApiKey = async (keyId, isActive) => {
    try {
      await axios.put(`${API_URL}/api-keys/${keyId}`, { is_active: !isActive });
      fetchApiKeys();
    } catch (error) {
      console.error('Error updating API key:', error);
      alert('Failed to update API key');
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <ResponsiveNavigation 
        currentView={currentView}
        handleViewChange={setCurrentView}
        alerts={alerts}
        user={user}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        logout={logout}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <span className="mr-3">🔑</span> API Management
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Manage your API keys and access the AI Monitoring API programmatically</p>
          </div>
          <button
            onClick={() => setShowCreateApiKey(true)}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 flex items-center space-x-2"
          >
            <span className="text-lg">➕</span>
            <span>Create API Key</span>
          </button>
        </div>

        {/* API Usage Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-xl">
                <span className="text-2xl">🔑</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800 dark:text-white">{apiKeys.length}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">API Keys</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 dark:bg-green-900 p-3 rounded-xl">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800 dark:text-white">{apiKeys.filter(k => k.is_active).length}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Active Keys</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-xl">
                <span className="text-2xl">⚡</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800 dark:text-white capitalize">{userSubscription?.tier || 'Free'}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Current Plan</div>
              </div>
            </div>
          </div>
        </div>

        {/* API Keys List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Your API Keys</h3>
          </div>
          
          {apiKeys.length === 0 ? (
            <div className="text-center py-12 dark:text-white">
              <div className="text-6xl mb-4">🔑</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No API Keys Yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Create your first API key to start using the AI Monitoring API</p>
              <button
                onClick={() => setShowCreateApiKey(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg"
              >
                Create Your First API Key
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${apiKey.is_active ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{apiKey.name}</h4>
                        <span className={`px-2 py-1 text-xs rounded-full ${apiKey.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {apiKey.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-mono bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">{apiKey.key_prefix}</span>
                        <span>Rate limit: {apiKey.rate_limit_per_minute}/min</span>
                        <span>Created: {new Date(apiKey.created_at).toLocaleDateString()}</span>
                        {apiKey.last_used_at && (
                          <span>Last used: {new Date(apiKey.last_used_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleApiKey(apiKey.id, apiKey.is_active)}
                        className={`px-3 py-1 text-sm rounded-md font-medium ${
                          apiKey.is_active 
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' 
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {apiKey.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => deleteApiKey(apiKey.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 hover:bg-red-200 rounded-md font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API Documentation */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900 dark:to-pink-900 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">API Documentation</h3>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-6">
              <div>
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-2">Base URL</h4>
                <code className="bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-md text-sm font-mono">{API_URL}/v1</code>
              </div>
              
              <div>
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-2">Authentication</h4>
                <p className="text-gray-600 dark:text-gray-400 mb-2">Include your API key in the Authorization header:</p>
                <code className="bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-md text-sm font-mono block">
                  Authorization: Bearer your_api_key_here
                </code>
              </div>
              
              <div>
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-2">Available Endpoints</h4>
                <div className="space-y-3">
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 dark:bg-gray-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-mono">GET</span>
                      <code className="text-sm font-mono">/jobs</code>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Get all your monitoring jobs</p>
                    <details className="mt-2">
                      <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">Sample Response</summary>
                      <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-x-auto">
{`[
  {
    "id": "abc123",
    "name": "News Monitor",
    "description": "Monitor tech news",
    "sources": ["https://news.ycombinator.com"],
    "prompt": "Alert on AI developments",
    "frequency_minutes": 60,
    "threshold_score": 75,
    "is_active": true,
    "notification_channel_ids": ["ch_abc123"],
    "created_at": "2024-01-01T12:00:00Z"
  }
]`}
                      </pre>
                    </details>
                  </div>
                  
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 dark:bg-gray-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-mono">POST</span>
                      <code className="text-sm font-mono">/jobs</code>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Create a new monitoring job</p>
                    <details className="mt-2">
                      <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">Sample Request Body</summary>
                      <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-x-auto">
{`{
  "name": "Tech News Monitor",
  "description": "Monitor tech news for AI developments",
  "sources": ["https://news.ycombinator.com"],
  "prompt": "Alert me about AI breakthroughs and developments",
  "frequency_minutes": 60,
  "threshold_score": 75,
  "notification_channel_ids": ["ch_abc123"],
  "alert_cooldown_minutes": 30,
  "max_alerts_per_hour": 10
}`}
                      </pre>
                    </details>
                  </div>
                  
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 dark:bg-gray-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-mono">PUT</span>
                      <code className="text-sm font-mono">/jobs/{"{job_id}"}</code>
                    </div>
                    <p className="text-sm text-gray-600">Update a monitoring job</p>
                  </div>
                  
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 dark:bg-gray-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-mono">DELETE</span>
                      <code className="text-sm font-mono">/jobs/{"{job_id}"}</code>
                    </div>
                    <p className="text-sm text-gray-600">Delete a monitoring job</p>
                  </div>
                  
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 dark:bg-gray-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-mono">GET</span>
                      <code className="text-sm font-mono">/jobs/{"{job_id}"}/runs</code>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Get execution history for a job</p>
                    <details className="mt-2">
                      <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">Sample Response</summary>
                      <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-x-auto">
{`[
  {
    "id": "run_123",
    "started_at": "2024-01-01T12:00:00Z",
    "completed_at": "2024-01-01T12:01:00Z",
    "status": "completed",
    "sources_processed": 1,
    "alerts_generated": 1,
    "error_message": null,
    "analysis_summary": {
      "total_sources": 1,
      "alerts_generated": 1,
      "completed_at": "2024-01-01T12:01:00Z"
    }
  }
]`}
                      </pre>
                    </details>
                  </div>
                  
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 dark:bg-gray-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-mono">GET</span>
                      <code className="text-sm font-mono">/jobs/{"{job_id}"}/alerts</code>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Get alerts generated by a job</p>
                    <details className="mt-2">
                      <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">Sample Response</summary>
                      <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-x-auto">
{`[
  {
    "id": "alert_123",
    "job_id": "abc123",
    "title": "AI Development Alert",
    "content": "New AI breakthrough detected in article",
    "source_url": "https://news.ycombinator.com/item?id=123",
    "relevance_score": 85,
    "is_sent": true,
    "is_read": false,
    "is_acknowledged": false,
    "acknowledged_at": null,
    "repeat_count": 0,
    "next_repeat_at": null,
    "created_at": "2024-01-01T12:00:00Z"
  }
]`}
                      </pre>
                    </details>
                  </div>
                  
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 dark:bg-gray-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-mono">POST</span>
                      <code className="text-sm font-mono">/jobs/{"{job_id}"}/run</code>
                    </div>
                    <p className="text-sm text-gray-600">Trigger immediate job execution</p>
                  </div>
                  
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 dark:bg-gray-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-mono">GET</span>
                      <code className="text-sm font-mono">/jobs/{"{job_id}"}/historical-data</code>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Get complete historical data with HTML content and LLM analysis</p>
                    <details className="mt-2">
                      <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">Sample Response</summary>
                      <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-x-auto">
{`{
  "executions": [
    {
      "job_id": "abc123",
      "job_run_id": "run_123",
      "job_name": "News Monitor",
      "user_prompt": "Monitor for AI developments",
      "sources": ["https://news.ycombinator.com"],
      "started_at": "2024-01-01T12:00:00Z",
      "completed_at": "2024-01-01T12:01:00Z",
      "source_data": [
        {
          "source_url": "https://news.ycombinator.com",
          "raw_html": "<html>...",
          "cleaned_content": "AI breakthrough announced...",
          "scrape_timestamp": "2024-01-01T12:00:30Z",
          "status_code": 200
        }
      ],
      "llm_analysis": [
        {
          "source_url": "https://news.ycombinator.com",
          "user_prompt": "Monitor for AI developments",
          "relevance_score": 85,
          "alert_generated": true,
          "alert_title": "AI Development Alert",
          "alert_content": "New AI breakthrough detected"
        }
      ]
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}`}
                      </pre>
                    </details>
                  </div>
                  
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 dark:bg-gray-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-mono">GET</span>
                      <code className="text-sm font-mono">/alerts</code>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Get all your alerts</p>
                    <details className="mt-2">
                      <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">Sample Response</summary>
                      <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-x-auto">
{`[
  {
    "id": "alert_123",
    "job_id": "abc123",
    "title": "Market Update Alert",
    "content": "Significant market movement detected",
    "source_url": "https://example.com/market-news",
    "relevance_score": 90,
    "is_sent": true,
    "is_read": false,
    "is_acknowledged": false,
    "acknowledged_at": null,
    "repeat_count": 0,
    "next_repeat_at": null,
    "created_at": "2024-01-01T12:00:00Z"
  }
]`}
                      </pre>
                    </details>
                  </div>
                </div>
                
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 dark:bg-gray-700">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-mono">GET</span>
                    <code className="text-sm font-mono">/user/profile</code>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">Get your user profile including notification channels</p>
                  <details className="mt-2">
                    <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">Sample Response</summary>
                    <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-x-auto">
{`{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "subscription_tier": "premium",
    "subscription_status": "active",
    "created_at": "2024-01-01T10:00:00Z"
  },
  "notification_channels": [
    {
      "id": "channel_123",
      "channel_type": "email",
      "config": {
        "email": "user@example.com",
        "name": "Primary Email"
      },
      "created_at": "2024-01-01T10:00:00Z"
    }
  ],
  "subscription": {
    "tier": "premium",
    "status": "active",
    "daily_alert_count": 5,
    "alert_limit": 100,
    "min_frequency_minutes": 1,
    "max_jobs": 10
  }
}`}
                    </pre>
                  </details>
                </div>
              </div>
              
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-2">Rate Limits</h4>
                <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Your current rate limit:</strong> {userSubscription?.tier === 'free' ? '60' : userSubscription?.tier === 'premium' ? '120' : '300'} requests per minute
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Rate limits are enforced per API key and reset every minute.
                  </p>
                </div>
              </div>
              
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-2">Example Usage</h4>
                <div className="bg-gray-900 text-green-400 rounded-lg p-4 text-sm font-mono overflow-x-auto border dark:border-gray-600">
                  <div className="mb-2"># Get all jobs</div>
                  <div className="mb-4">curl -H "Authorization: Bearer your_api_key" {API_URL}/v1/jobs</div>
                  
                  <div className="mb-2"># Create a new job</div>
                  <div className="mb-4">curl -X POST -H "Authorization: Bearer your_api_key" \</div>
                  <div className="mb-4 ml-4">-H "Content-Type: application/json" \</div>
                  <div className="mb-4 ml-4">-d '{`{"name": "Oil Price Monitor", "sources": ["https://oilprice.com/rss"], "prompt": "Monitor for oil price changes", "frequency_minutes": 60, "threshold_score": 75}`}' \</div>
                  <div>{API_URL}/v1/jobs</div>
                  
                  <div className="mb-2"># Get your profile with notification channels</div>
                  <div>curl -H "Authorization: Bearer your_api_key" {API_URL}/v1/user/profile</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create API Key Modal */}
      {showCreateApiKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border dark:border-gray-600 w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Create New API Key</h3>
              <form onSubmit={createApiKey}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Key Name *
                    </label>
                    <input
                      type="text"
                      value={apiKeyForm.name}
                      onChange={(e) => setApiKeyForm({...apiKeyForm, name: e.target.value})}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., Production Key"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Rate Limit (requests/minute)
                    </label>
                    <input
                      type="number"
                      value={apiKeyForm.rate_limit_per_minute}
                      onChange={(e) => setApiKeyForm({...apiKeyForm, rate_limit_per_minute: e.target.value})}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder={`Default: ${userSubscription?.tier === 'free' ? '60' : userSubscription?.tier === 'premium' ? '120' : '300'}`}
                      min="1"
                      max={userSubscription?.tier === 'free' ? '60' : userSubscription?.tier === 'premium' ? '120' : '300'}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Leave blank for tier default. Max: {userSubscription?.tier === 'free' ? '60' : userSubscription?.tier === 'premium' ? '120' : '300'} requests/minute
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateApiKey(false);
                      setApiKeyForm({ name: '', rate_limit_per_minute: '' });
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Create API Key
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* API Key Success Modal */}
      {createdApiKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border dark:border-gray-600 w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 dark:bg-green-800 rounded-full mb-4">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white text-center mb-4">API Key Created Successfully!</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 dark:text-white">
                    {createdApiKey.name}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                  <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 font-mono text-sm break-all dark:text-white">
                    {createdApiKey.key}
                  </div>
                  <button
                    onClick={() => copyToClipboard(createdApiKey.key)}
                    className="mt-2 w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
                  >
                    {copied ? '✅ Copied!' : '📋 Copy API Key'}
                  </button>
                </div>
                
                <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">Important!</h3>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        Save this API key now - you won't be able to see it again! Store it securely.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setCreatedApiKey(null)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  I've Saved It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default APIManagement;
