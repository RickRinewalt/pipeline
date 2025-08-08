/**
 * Utility functions for GitHub client
 */

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff calculation
 */
function exponentialBackoff(attempt, baseDelay = 1000, maxDelay = 30000, factor = 2) {
  const delay = Math.min(baseDelay * Math.pow(factor, attempt), maxDelay);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay;
  return Math.floor(delay + jitter);
}

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    retries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    shouldRetry = () => true
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === retries || !shouldRetry(error, attempt)) {
        break;
      }

      const delay = exponentialBackoff(attempt, baseDelay, maxDelay, factor);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Deep merge objects
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (isObject(source[key]) && isObject(result[key])) {
        result[key] = deepMerge(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * Check if value is an object
 */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Throttle function execution
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Debounce function execution
 */
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Chunk array into smaller arrays
 */
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human readable string
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Generate random string
 */
function generateRandomString(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Validate URL format
 */
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Sanitize string for use in URLs or file names
 */
function sanitizeString(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Parse GitHub URL to extract owner and repo
 */
function parseGitHubUrl(url) {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+)/,
    /api\.github\.com\/repos\/([^\/]+)\/([^\/]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
        url
      };
    }
  }

  return null;
}

/**
 * Validate GitHub repository name
 */
function isValidRepoName(name) {
  // GitHub repository names can contain alphanumeric characters, hyphens, underscores, and periods
  // Must be 1-100 characters, cannot start with a period, and cannot be empty
  const pattern = /^[a-zA-Z0-9._-]{1,100}$/;
  return pattern.test(name) && !name.startsWith('.');
}

/**
 * Validate GitHub username/organization name
 */
function isValidGitHubName(name) {
  // GitHub usernames can contain alphanumeric characters and hyphens
  // Must be 1-39 characters, cannot start or end with hyphen
  const pattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
  return pattern.test(name) && name.length <= 39;
}

/**
 * Extract pagination info from Link header
 */
function parseLinkHeader(linkHeader) {
  if (!linkHeader) return {};

  const links = {};
  const parts = linkHeader.split(',');

  for (const part of parts) {
    const section = part.split(';');
    if (section.length !== 2) continue;

    const url = section[0].replace(/<(.*)>/, '$1').trim();
    const rel = section[1].replace(/rel="(.*)"/, '$1').trim();
    
    links[rel] = url;
  }

  return links;
}

/**
 * Calculate rate limit reset time in human readable format
 */
function formatRateLimitReset(resetTimestamp) {
  const resetTime = new Date(resetTimestamp * 1000);
  const now = new Date();
  const diffMs = resetTime.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 'now';
  }

  return formatDuration(diffMs);
}

/**
 * Safely parse JSON with error handling
 */
function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Create a promise that resolves after a timeout
 */
function timeout(promise, ms, errorMessage = 'Operation timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), ms)
    )
  ]);
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

/**
 * Convert camelCase to kebab-case
 */
function camelToKebab(str) {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Convert kebab-case to camelCase
 */
function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename) {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

/**
 * Check if running in Node.js environment
 */
function isNode() {
  return typeof process !== 'undefined' && process.versions && process.versions.node;
}

/**
 * Check if running in browser environment
 */
function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

module.exports = {
  sleep,
  exponentialBackoff,
  retryWithBackoff,
  deepMerge,
  isObject,
  throttle,
  debounce,
  chunkArray,
  formatBytes,
  formatDuration,
  generateRandomString,
  isValidUrl,
  sanitizeString,
  parseGitHubUrl,
  isValidRepoName,
  isValidGitHubName,
  parseLinkHeader,
  formatRateLimitReset,
  safeJsonParse,
  timeout,
  isValidEmail,
  camelToKebab,
  kebabToCamel,
  getFileExtension,
  isNode,
  isBrowser
};