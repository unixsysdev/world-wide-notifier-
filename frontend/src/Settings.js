import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Settings = ({ user, logout, userSubscription, setCurrentView, currentView, alerts, isDarkMode, toggleDarkMode, onBack }) => {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChannel, setNewChannel] = useState({
    channel_type: 'email',
    config: {}
  });
  const [billingHistory, setBillingHistory] = useState([]);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchChannels();
    fetchBillingHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchChannels = async () => {
    try {
      const response = await axios.get(`${API_URL}/notification-channels`);
      setChannels(response.data);
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    } finally {
      setLoading(false);
    }
  };



  const fetchBillingHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/subscription/billing-history`);
      setBillingHistory(response.data.invoices || []);
    } catch (error) {
      console.error('Error fetching billing history:', error);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await axios.post(`${API_URL}/subscription/manage`);
      const { portal_url } = response.data;
      
      // Redirect to Stripe Customer Portal
      window.location.href = portal_url;
    } catch (error) {
      console.error('Error creating customer portal session:', error);
      if (error.response?.data?.detail) {
        alert(error.response.data.detail);
      } else {
        alert('Failed to open subscription management. Please try again.');
      }
    }
  };

  const handleUpgrade = async (tier = 'premium') => {
    try {
      const response = await axios.post(`${API_URL}/subscription/upgrade`, { tier });
      const { checkout_url } = response.data;
      
      // Redirect to Stripe checkout
      window.location.href = checkout_url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start upgrade process. Please try again.');
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? It will remain active until the end of your current billing period.')) {
      return;
    }
    
    try {
      const response = await axios.post(`${API_URL}/subscription/cancel`);
      alert(response.data.message);
      // Subscription data will be refreshed by parent component
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      alert('Failed to cancel subscription. Please try again.');
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const handleAddChannel = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/notification-channels`, newChannel);
      setNewChannel({ channel_type: 'email', config: {} });
      setShowAddForm(false);
      fetchChannels();
    } catch (error) {
      console.error('Failed to add channel:', error);
    }
  };

  const handleDeleteChannel = async (channelId) => {
    if (window.confirm('Are you sure you want to delete this notification channel?')) {
      try {
        await axios.delete(`${API_URL}/notification-channels/${channelId}`);
        fetchChannels();
      } catch (error) {
        console.error('Failed to delete channel:', error);
      }
    }
  };

  const handleChannelTypeChange = (type) => {
    setNewChannel({
      channel_type: type,
      config: getDefaultConfig(type)
    });
  };

  const getDefaultConfig = (type) => {
    switch (type) {
      case 'email':
        return { email: '' };
      case 'teams':
        return { webhook_url: '' };
      case 'slack':
        return { webhook_url: '' };
      default:
        return {};
    }
  };

  const updateConfig = (key, value) => {
    setNewChannel(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value
      }
    }));
  };

  const renderChannelConfig = (channel) => {
    switch (channel.channel_type) {
      case 'email':
        return channel.config.email || 'Default email';
      case 'teams':
        return 'Teams webhook configured';
      case 'slack':
        return 'Slack webhook configured';
      default:
        return 'Custom configuration';
    }
  };

  const renderConfigForm = () => {
    switch (newChannel.channel_type) {
      case 'email':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
            <input
              type="email"
              value={newChannel.config.email || ''}
              onChange={(e) => updateConfig('email', e.target.value)}
              className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 dark:bg-gray-700 dark:text-white"
              placeholder="notifications@company.com"
            />
          </div>
        );
      case 'teams':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Teams Webhook URL</label>
            <input
              type="url"
              value={newChannel.config.webhook_url || ''}
              onChange={(e) => updateConfig('webhook_url', e.target.value)}
              className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 dark:bg-gray-700 dark:text-white"
              placeholder="https://your-org.webhook.office.com/..."
            />
          </div>
        );
      case 'slack':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Slack Webhook URL</label>
            <input
              type="url"
              value={newChannel.config.webhook_url || ''}
              onChange={(e) => updateConfig('webhook_url', e.target.value)}
              className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 dark:bg-gray-700 dark:text-white"
              placeholder="https://hooks.slack.com/services/..."
            />
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center transition-colors">
        <div className="text-xl text-gray-900 dark:text-white">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Navigation Header */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI Monitoring</h1>
              <div className="flex space-x-4">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'dashboard' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setCurrentView('alerts')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'alerts' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white'
                  }`}
                >
                  Alerts
                  {alerts && alerts.filter(a => !a.is_acknowledged).length > 0 && (
                    <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                      {alerts.filter(a => !a.is_acknowledged).length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setCurrentView('settings')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'settings' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white'
                  }`}
                >
                  Settings
                </button>
                <button
                  onClick={() => setCurrentView('api')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'api' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white'
                  }`}
                >
                  API
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-300">Welcome, {user?.name}</span>
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDarkMode ? (
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </button>
              <button
                onClick={logout}
                className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Settings for {user?.name}
              </h3>
              
              {/* Subscription Management Section */}
              <div className="mb-8">
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Subscription Management</h4>
                
                {userSubscription && (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-700 rounded-lg p-6 mb-4 border border-blue-200 dark:border-gray-600">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h5 className="text-lg font-semibold text-gray-900 dark:text-white capitalize flex items-center">
                          {userSubscription.tier} Plan
                          {userSubscription.tier === 'premium_plus' && (
                            <span className="ml-2 bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                              Premium+
                            </span>
                          )}
                          {userSubscription.tier === 'premium' && (
                            <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                              Pro
                            </span>
                          )}
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Status: <span className={`capitalize font-medium ${
                            userSubscription.status === 'active' ? 'text-green-600' : 'text-red-600'
                          }`}>{userSubscription.status}</span>
                        </p>
                        {userSubscription.tier === 'free' && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Daily alerts used: {userSubscription.daily_alert_count}/{userSubscription.alert_limit}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm border dark:border-gray-600">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Limits</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {userSubscription.alert_limit === 999999 ? 'Unlimited' : userSubscription.alert_limit} alerts
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {userSubscription.min_frequency_minutes}min frequency
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 mt-4">
                      {userSubscription.tier === 'free' ? (
                        <>
                          <button
                            onClick={() => handleUpgrade('premium')}
                            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                          >
                            Upgrade to Premium ($10/month)
                          </button>
                          <button
                            onClick={() => handleUpgrade('premium_plus')}
                            className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                          >
                            Upgrade to Premium Plus ($15/month)
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={handleManageSubscription}
                            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                          >
                            Manage Subscription
                          </button>
                          <button
                            onClick={() => window.location.reload()}
                            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                          </button>
                          <button
                            onClick={handleCancelSubscription}
                            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                          >
                            Cancel Subscription
                          </button>
                          <a
                            href="https://billing.stripe.com/p/login/test_3cIdRa0647m6bzgaOJeQM00"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Direct Stripe Portal
                          </a>
                        </>
                      )}
                    </div>
                    
                    {/* Plan Comparison */}
                    {userSubscription.tier === 'free' && (
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <h6 className="text-sm font-medium text-gray-900 mb-3">Plan Comparison</h6>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="bg-white p-3 rounded border">
                            <div className="font-medium text-gray-900">Free</div>
                            <div className="text-gray-600 text-xs mt-1">
                              • 3 alerts/day<br/>
                              • 60min frequency<br/>
                              • Basic features
                            </div>
                          </div>
                          <div className="bg-blue-50 p-3 rounded border border-blue-200">
                            <div className="font-medium text-blue-900">Premium</div>
                            <div className="text-blue-700 text-xs mt-1">
                              • 100 alerts/day<br/>
                              • 10min frequency<br/>
                              • All channels
                            </div>
                          </div>
                          <div className="bg-purple-50 p-3 rounded border border-purple-200">
                            <div className="font-medium text-purple-900">Premium Plus</div>
                            <div className="text-purple-700 text-xs mt-1">
                              • Unlimited alerts<br/>
                              • 1min frequency<br/>
                              • Priority support
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Billing History */}
                {billingHistory.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border dark:border-gray-600">
                    <h5 className="font-medium text-gray-900 dark:text-white mb-3">Recent Billing History</h5>
                    <div className="space-y-2">
                      {billingHistory.slice(0, 5).map((invoice) => (
                        <div key={invoice.id} className="flex justify-between items-center text-sm">
                          <div>
                            <span className="font-medium">{invoice.description}</span>
                            <span className="text-gray-500 ml-2">({formatDate(invoice.date)})</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">
                              {invoice.currency} {invoice.amount.toFixed(2)}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              invoice.status === 'paid' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {invoice.status}
                            </span>
                            {invoice.invoice_url && (
                              <a 
                                href={invoice.invoice_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                View
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white">Notification Channels</h4>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Add Channel
                  </button>
                </div>
                
                {channels.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">No notification channels configured</p>
                ) : (
                  <div className="space-y-4">
                    {channels.map((channel) => (
                      <div key={channel.id} className="flex items-center justify-between p-4 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                        <div>
                          <div className="font-medium capitalize text-gray-900 dark:text-white">{channel.channel_type}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{renderChannelConfig(channel)}</div>
                        </div>
                        <button
                          onClick={() => handleDeleteChannel(channel.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Channel Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
          <div className="relative top-20 mx-auto p-5 border dark:border-gray-600 w-11/12 md:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Add Notification Channel</h3>
              
              <form onSubmit={handleAddChannel} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Channel Type</label>
                  <select
                    value={newChannel.channel_type}
                    onChange={(e) => handleChannelTypeChange(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="email">Email</option>
                    <option value="teams">Microsoft Teams</option>
                    <option value="slack">Slack</option>
                  </select>
                </div>

                {renderConfigForm()}

                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  >
                    Add Channel
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

export default Settings;
