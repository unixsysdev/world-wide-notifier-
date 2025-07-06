import React from 'react';

const ResponsiveNavigation = ({ 
  currentView, 
  handleViewChange, 
  alerts, 
  user, 
  isDarkMode, 
  toggleDarkMode, 
  logout,
  setSelectedJobFilter 
}) => {
  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2 md:space-x-8">
            <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white truncate">AI Monitoring</h1>
            
            {/* Desktop Navigation */}
            <div className="hidden lg:flex space-x-4">
              <button
                onClick={() => {
                  handleViewChange('dashboard');
                  if (setSelectedJobFilter) setSelectedJobFilter(null);
                }}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'dashboard' 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => handleViewChange('live')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'live' 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors'
                }`}
              >
                ⚡ Live Monitor
              </button>
              <button
                onClick={() => handleViewChange('alerts')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'alerts' 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors'
                }`}
              >
                Alerts
                {alerts.filter(a => !a.is_acknowledged).length > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {alerts.filter(a => !a.is_acknowledged).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleViewChange('settings')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'settings' 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors'
                }`}
              >
                Settings
              </button>
              <button
                onClick={() => handleViewChange('api')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'api' 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors'
                }`}
              >
                API
              </button>
            </div>

            {/* Mobile Navigation Dropdown */}
            <div className="lg:hidden">
              <select 
                value={currentView}
                onChange={(e) => {
                  handleViewChange(e.target.value);
                  if (setSelectedJobFilter && e.target.value === 'dashboard') {
                    setSelectedJobFilter(null);
                  }
                }}
                className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
              >
                <option value="dashboard">Dashboard</option>
                <option value="live">⚡ Live Monitor</option>
                <option value="alerts">
                  Alerts{alerts.filter(a => !a.is_acknowledged).length > 0 ? ` (${alerts.filter(a => !a.is_acknowledged).length})` : ''}
                </option>
                <option value="settings">Settings</option>
                <option value="api">API</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-4">
            <span className="hidden sm:block text-xs md:text-sm text-gray-600 dark:text-gray-400 truncate max-w-24 md:max-w-none">
              Welcome, {user?.name}
            </span>
            <button
              onClick={toggleDarkMode}
              className="p-1.5 md:p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? (
                <svg className="w-4 h-4 md:w-5 md:h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
            <button
              onClick={logout}
              className="text-xs md:text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default ResponsiveNavigation;
