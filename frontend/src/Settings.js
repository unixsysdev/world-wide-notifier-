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

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchChannels();
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
