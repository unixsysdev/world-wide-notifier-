import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const APIManagement = ({ user, logout, userSubscription, setCurrentView }) => {
  const [apiKeys, setApiKeys] = useState([]);
  const [showCreateApiKey, setShowCreateApiKey] = useState(false);
  const [apiKeyForm, setApiKeyForm] = useState({ name: '', rate_limit_per_minute: '' });

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
      
      // Show the API key in a modal or alert (only shown once)
      alert(`API Key Created Successfully!\n\nName: ${response.data.name}\nKey: ${response.data.key}\n\n⚠️ Save this key now - you won't be able to see it again!`);
      
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-gray-900">AI Monitoring</h1>
              <div className="flex space-x-4">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setCurrentView('alerts')}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Alerts
                </button>
                <button
                  onClick={() => setCurrentView('settings')}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Settings
                </button>
                <button
                  onClick={() => setCurrentView('api')}
                  className="px-3 py-2 rounded-md text-sm font-medium bg-blue-100 text-blue-700"
                >
                  API
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.name}</span>
              <button
                onClick={logout}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 flex items-center">
              <span className="mr-3">🔑</span> API Management
            </h2>
            <p className="text-gray-600 mt-2">Manage your API keys and access the AI Monitoring API programmatically</p>
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
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-3 rounded-xl">
                <span className="text-2xl">🔑</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{apiKeys.length}</div>
                <div className="text-sm text-gray-600">API Keys</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-3 rounded-xl">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{apiKeys.filter(k => k.is_active).length}</div>
                <div className="text-sm text-gray-600">Active Keys</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-3 rounded-xl">
                <span className="text-2xl">⚡</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800 capitalize">{userSubscription?.tier || 'Free'}</div>
                <div className="text-sm text-gray-600">Current Plan</div>
              </div>
            </div>
          </div>
        </div>

        {/* API Keys List */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Your API Keys</h3>
          </div>
          
          {apiKeys.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔑</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No API Keys Yet</h3>
              <p className="text-gray-600 mb-6">Create your first API key to start using the AI Monitoring API</p>
              <button
                onClick={() => setShowCreateApiKey(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg"
              >
                Create Your First API Key
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${apiKey.is_active ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                        <h4 className="text-lg font-semibold text-gray-900">{apiKey.name}</h4>
                        <span className={`px-2 py-1 text-xs rounded-full ${apiKey.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {apiKey.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded">{apiKey.key_prefix}</span>
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
        <div className="mt-8 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">API Documentation</h3>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-6">
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-2">Base URL</h4>
                <code className="bg-gray-100 px-3 py-2 rounded-md text-sm font-mono">{API_URL}/api/v1</code>
              </div>
              
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-2">Authentication</h4>
                <p className="text-gray-600 mb-2">Include your API key in the Authorization header:</p>
                <code className="bg-gray-100 px-3 py-2 rounded-md text-sm font-mono block">
                  Authorization: Bearer your_api_key_here
                </code>
              </div>
              
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-2">Available Endpoints</h4>
                <div className="space-y-3">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-mono">GET</span>
                      <code className="text-sm font-mono">/jobs</code>
                    </div>
                    <p className="text-sm text-gray-600">Get all your monitoring jobs</p>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-mono">POST</span>
                      <code className="text-sm font-mono">/jobs</code>
                    </div>
                    <p className="text-sm text-gray-600">Create a new monitoring job</p>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-mono">PUT</span>
                      <code className="text-sm font-mono">/jobs/{"{job_id}"}</code>
                    </div>
                    <p className="text-sm text-gray-600">Update a monitoring job</p>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-mono">DELETE</span>
                      <code className="text-sm font-mono">/jobs/{"{job_id}"}</code>
                    </div>
                    <p className="text-sm text-gray-600">Delete a monitoring job</p>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-mono">GET</span>
                      <code className="text-sm font-mono">/jobs/{"{job_id}"}/runs</code>
                    </div>
                    <p className="text-sm text-gray-600">Get execution history for a job</p>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-mono">GET</span>
                      <code className="text-sm font-mono">/jobs/{"{job_id}"}/alerts</code>
                    </div>
                    <p className="text-sm text-gray-600">Get alerts generated by a job</p>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-mono">POST</span>
                      <code className="text-sm font-mono">/jobs/{"{job_id}"}/run</code>
                    </div>
                    <p className="text-sm text-gray-600">Trigger immediate job execution</p>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-mono">GET</span>
                      <code className="text-sm font-mono">/alerts</code>
                    </div>
                    <p className="text-sm text-gray-600">Get all your alerts</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-2">Rate Limits</h4>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Your current rate limit:</strong> {userSubscription?.tier === 'free' ? '60' : userSubscription?.tier === 'premium' ? '120' : '300'} requests per minute
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Rate limits are enforced per API key and reset every minute.
                  </p>
                </div>
              </div>
              
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-2">Example Usage</h4>
                <div className="bg-gray-900 text-green-400 rounded-lg p-4 text-sm font-mono overflow-x-auto">
                  <div className="mb-2"># Get all jobs</div>
                  <div className="mb-4">curl -H "Authorization: Bearer your_api_key" {API_URL}/api/v1/jobs</div>
                  
                  <div className="mb-2"># Create a new job</div>
                  <div className="mb-4">curl -X POST -H "Authorization: Bearer your_api_key" \</div>
                  <div className="mb-4 ml-4">-H "Content-Type: application/json" \</div>
                  <div className="mb-4 ml-4">-d '{`{"name": "Oil Price Monitor", "sources": ["https://oilprice.com/rss"], "prompt": "Monitor for oil price changes", "frequency_minutes": 60, "threshold_score": 75}`}' \</div>
                  <div>{API_URL}/api/v1/jobs</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create API Key Modal */}
      {showCreateApiKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New API Key</h3>
              <form onSubmit={createApiKey}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Key Name *
                    </label>
                    <input
                      type="text"
                      value={apiKeyForm.name}
                      onChange={(e) => setApiKeyForm({...apiKeyForm, name: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Production Key"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rate Limit (requests/minute)
                    </label>
                    <input
                      type="number"
                      value={apiKeyForm.rate_limit_per_minute}
                      onChange={(e) => setApiKeyForm({...apiKeyForm, rate_limit_per_minute: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Default: ${userSubscription?.tier === 'free' ? '60' : userSubscription?.tier === 'premium' ? '120' : '300'}`}
                      min="1"
                      max={userSubscription?.tier === 'free' ? '60' : userSubscription?.tier === 'premium' ? '120' : '300'}
                    />
                    <p className="text-xs text-gray-500 mt-1">
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
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
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
    </div>
  );
};

export default APIManagement;
