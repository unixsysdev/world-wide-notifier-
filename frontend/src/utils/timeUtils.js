// Time utility functions for proper timezone handling

/**
 * Convert server UTC time to local browser time and format it
 * @param {string} utcTimestamp - UTC timestamp from server
 * @returns {Date} - Local Date object
 */
export const convertToLocalTime = (utcTimestamp) => {
  if (!utcTimestamp) return new Date();
  
  // Handle different timestamp formats from server
  let timestamp = utcTimestamp;
  
  // If timestamp doesn't end with Z, assume it's UTC and add Z
  if (!timestamp.endsWith('Z') && !timestamp.includes('+')) {
    timestamp = timestamp + 'Z';
  }
  
  return new Date(timestamp);
};

/**
 * Format time ago in local timezone
 * @param {string} utcTimestamp - UTC timestamp from server
 * @returns {string} - Human readable "time ago" string
 */
export const formatTimeAgoLocal = (utcTimestamp) => {
  const localTime = convertToLocalTime(utcTimestamp);
  const now = new Date();
  const diffMs = now - localTime;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffSeconds = Math.floor(diffMs / 1000);
  
  // Handle negative times (server clock ahead)
  if (diffSeconds < 0) {
    return 'Just now'; // Server clock issue, show as recent
  }
  
  if (diffSeconds < 30) return 'Just now';
  if (diffSeconds < 60) return 'Less than a minute ago';
  if (diffMins < 2) return '1 minute ago';
  if (diffMins < 15) return `${diffMins} minutes ago`;
  if (diffMins < 30) return 'About 15 minutes ago';
  if (diffMins < 60) return 'About 30 minutes ago';
  if (diffHours < 2) return 'About 1 hour ago';
  if (diffHours < 6) return `About ${diffHours} hours ago`;
  if (diffHours < 24) return 'Earlier today';
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return 'Last few weeks';
  
  // For very old stuff, show the actual local date
  return localTime.toLocaleDateString();
};

/**
 * Format timestamp as local date and time
 * @param {string} utcTimestamp - UTC timestamp from server
 * @returns {string} - Formatted local date and time
 */
export const formatLocalDateTime = (utcTimestamp) => {
  const localTime = convertToLocalTime(utcTimestamp);
  return localTime.toLocaleString();
};

/**
 * Format timestamp as local time only
 * @param {string} utcTimestamp - UTC timestamp from server
 * @returns {string} - Formatted local time
 */
export const formatLocalTime = (utcTimestamp) => {
  const localTime = convertToLocalTime(utcTimestamp);
  return localTime.toLocaleTimeString();
};

/**
 * Format timestamp as local date only
 * @param {string} utcTimestamp - UTC timestamp from server
 * @returns {string} - Formatted local date
 */
export const formatLocalDate = (utcTimestamp) => {
  const localTime = convertToLocalTime(utcTimestamp);
  return localTime.toLocaleDateString();
};

/**
 * Get timezone offset info for debugging
 * @returns {object} - Timezone information
 */
export const getTimezoneInfo = () => {
  const now = new Date();
  return {
    localTime: now.toLocaleString(),
    utcTime: now.toISOString(),
    timezoneOffset: now.getTimezoneOffset(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
};
