/**
 * File Reference Cache
 * High-performance caching layer for file reference results
 */

/**
 * In-memory cache for file reference results with TTL support
 */
class FileReferenceCache {
  constructor(options = {}) {
    this.options = {
      defaultTTL: options.cacheTimeout || 300000, // 5 minutes default
      maxSize: options.maxCacheSize || 1000,
      cleanupInterval: options.cleanupInterval || 60000, // 1 minute
      ...options
    };

    this.cache = new Map();
    this.timers = new Map();
    
    // Start cleanup interval
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  /**
   * Store value in cache with TTL
   * @param {string} key - Cache key (typically file path)
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = null) {
    try {
      const finalTTL = ttl || this.options.defaultTTL;
      const expiry = Date.now() + finalTTL;

      // Evict oldest entries if at max size
      if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
        this.evictLRU();
      }

      // Clear existing timer if any
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
      }

      // Store value with metadata
      const cacheEntry = {
        value,
        timestamp: Date.now(),
        expiry,
        hits: 0,
        ttl: finalTTL
      };

      this.cache.set(key, cacheEntry);

      // Set expiration timer
      const timer = setTimeout(() => {
        this.delete(key);
      }, finalTTL);

      this.timers.set(key, timer);

      return true;

    } catch (error) {
      console.warn('Cache set failed:', error.message);
      return false;
    }
  }

  /**
   * Retrieve value from cache
   * @param {string} key - Cache key
   * @returns {Promise<*>} Cached value or null if not found/expired
   */
  async get(key) {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        return null;
      }

      // Check if expired
      if (Date.now() > entry.expiry) {
        this.delete(key);
        return null;
      }

      // Update hit count and access time
      entry.hits++;
      entry.lastAccess = Date.now();
      
      // Move to end (LRU)
      this.cache.delete(key);
      this.cache.set(key, entry);

      return entry.value;

    } catch (error) {
      console.warn('Cache get failed:', error.message);
      return null;
    }
  }

  /**
   * Delete entry from cache
   * @param {string} key - Cache key
   * @returns {boolean} Whether entry was deleted
   */
  delete(key) {
    try {
      // Clear timer
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }

      return this.cache.delete(key);

    } catch (error) {
      console.warn('Cache delete failed:', error.message);
      return false;
    }
  }

  /**
   * Check if key exists in cache and is not expired
   * @param {string} key - Cache key
   * @returns {boolean} Whether key exists
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiry) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    this.cache.clear();
    this.timers.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let totalHits = 0;
    let oldestEntry = now;
    let newestEntry = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiry) {
        expired++;
      }
      totalHits += entry.hits;
      oldestEntry = Math.min(oldestEntry, entry.timestamp);
      newestEntry = Math.max(newestEntry, entry.timestamp);
    }

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      expired,
      totalHits,
      utilization: (this.cache.size / this.options.maxSize * 100).toFixed(2) + '%',
      oldestEntryAge: oldestEntry < now ? now - oldestEntry : 0,
      newestEntryAge: newestEntry > 0 ? now - newestEntry : 0
    };
  }

  /**
   * Get all cache keys
   * @returns {string[]} Array of cache keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   * @returns {number} Number of entries in cache
   */
  size() {
    return this.cache.size;
  }

  /**
   * Update TTL for existing entry
   * @param {string} key - Cache key
   * @param {number} newTTL - New TTL in milliseconds
   * @returns {boolean} Success status
   */
  updateTTL(key, newTTL) {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Update expiry
    entry.expiry = Date.now() + newTTL;
    entry.ttl = newTTL;

    // Set new timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, newTTL);

    this.timers.set(key, timer);

    return true;
  }

  /**
   * Cleanup expired entries
   * @private
   */
  cleanup() {
    const now = Date.now();
    const toDelete = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.delete(key));

    if (toDelete.length > 0) {
      console.debug(`Cleaned up ${toDelete.length} expired cache entries`);
    }
  }

  /**
   * Evict least recently used entry
   * @private
   */
  evictLRU() {
    // Cache uses Map which maintains insertion order
    // First entry is least recently used due to our get() implementation
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.delete(firstKey);
    }
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.clear();
  }

  /**
   * Export cache data for persistence
   * @returns {Object} Serializable cache data
   */
  export() {
    const data = {};
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      // Only export non-expired entries
      if (now <= entry.expiry) {
        data[key] = {
          value: entry.value,
          timestamp: entry.timestamp,
          expiry: entry.expiry,
          hits: entry.hits,
          ttl: entry.ttl
        };
      }
    }

    return {
      data,
      exportTime: now,
      options: this.options
    };
  }

  /**
   * Import cache data from persistence
   * @param {Object} exportedData - Previously exported cache data
   * @returns {number} Number of entries imported
   */
  import(exportedData) {
    if (!exportedData || !exportedData.data) {
      return 0;
    }

    let imported = 0;
    const now = Date.now();

    for (const [key, entry] of Object.entries(exportedData.data)) {
      // Only import non-expired entries
      if (now <= entry.expiry) {
        const remainingTTL = entry.expiry - now;
        this.set(key, entry.value, remainingTTL);
        imported++;
      }
    }

    return imported;
  }
}

module.exports = { FileReferenceCache };