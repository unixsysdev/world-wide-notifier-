import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import axios from 'axios';

const Settings = ({ onBack }) => {
  const { user } = useAuth();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChannel, setNewChannel] = useState({
    channel_type: 'email',
    config: {}
  });
  const [userSubscription, setUserSubscription] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchChannels();
    fetchSubscription();
    fetchBillingHistory();
  }, []);

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

  const fetchSubscription = async () => {
    try {
      const response = await axios.get(`${API_URL}/subscription`);
      setUserSubscription(response.data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
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
      fetchSubscription(); // Refresh subscription data
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
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              type="email"
              value={newChannel.config.email || ''}
              onChange={(e) => updateConfig('email', e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="notifications@company.com"
            />
          </div>
        );
      case 'teams':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700">Teams Webhook URL</label>
            <input
              type="url"
              value={newChannel.config.webhook_url || ''}
              onChange={(e) => updateConfig('webhook_url', e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="https://your-org.webhook.office.com/..."
            />
          </div>
        );
      case 'slack':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700">Slack Webhook URL</label>
            <input
              type="url"
              value={newChannel.config.webhook_url || ''}
              onChange={(e) => updateConfig('webhook_url', e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <button
              onClick={onBack}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Dashboard
            </button>
          </div>
          
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Settings for {user?.name}
              </h3>
              
              {/* Subscription Management Section */}
              <div className="mb-8">
                <h4 className="text-md font-medium text-gray-900 mb-4">Subscription Management</h4>
                
                {userSubscription && (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-4 border border-blue-200">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h5 className="text-lg font-semibold text-gray-900 capitalize flex items-center">
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
                        <p className="text-sm text-gray-600 mt-1">
                          Status: <span className={`capitalize font-medium ${
                            userSubscription.status === 'active' ? 'text-green-600' : 'text-red-600'
                          }`}>{userSubscription.status}</span>
                        </p>
                        {userSubscription.tier === 'free' && (
                          <p className="text-sm text-gray-600 mt-1">
                            Daily alerts used: {userSubscription.daily_alert_count}/{userSubscription.alert_limit}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="bg-white rounded-lg p-3 shadow-sm">
                          <p className="text-xs text-gray-500 mb-1">Limits</p>
                          <p className="text-sm font-medium text-gray-900">
                            {userSubscription.alert_limit === 999999 ? 'Unlimited' : userSubscription.alert_limit} alerts
                          </p>
                          <p className="text-sm text-gray-600">
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
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h5 className="font-medium text-gray-900 mb-3">Recent Billing History</h5>
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
                  <h4 className="text-md font-medium text-gray-900">Notification Channels</h4>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Add Channel
                  </button>
                </div>
                
                {channels.length === 0 ? (
                  <p className="text-gray-500">No notification channels configured</p>
                ) : (
                  <div className="space-y-4">
                    {channels.map((channel) => (
                      <div key={channel.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-medium capitalize">{channel.channel_type}</div>
                          <div className="text-sm text-gray-600">{renderChannelConfig(channel)}</div>
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
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add Notification Channel</h3>
              
              <form onSubmit={handleAddChannel} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Channel Type</label>
                  <select
                    value={newChannel.channel_type}
                    onChange={(e) => handleChannelTypeChange(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
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
