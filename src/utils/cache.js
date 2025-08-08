/**
 * Efficient request cache with TTL and LRU eviction
 */
class RequestCache {
  constructor(options = {}) {
    this.config = {
      ttl: options.ttl || 300, // 5 minutes default
      maxSize: options.maxSize || 1000,
      cleanupInterval: options.cleanupInterval || 60000, // 1 minute
      ...options
    };

    this.cache = new Map();
    this.accessOrder = new Map(); // For LRU tracking
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };

    // Start cleanup interval
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Get item from cache
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (now > item.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.misses++;
      this.stats.deletes++;
      return null;
    }

    // Update access order for LRU
    this.accessOrder.set(key, now);
    this.stats.hits++;
    
    return item.value;
  }

  /**
   * Set item in cache
   */
  set(key, value, customTtl = null) {
    const now = Date.now();
    const ttl = customTtl || this.config.ttl;
    
    const item = {
      value: this.deepClone(value),
      createdAt: now,
      expiresAt: now + (ttl * 1000),
      size: this.calculateSize(value)
    };

    // Check if we need to make space
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, item);
    this.accessOrder.set(key, now);
    this.stats.sets++;

    return true;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.deletes++;
      return false;
    }

    return true;
  }

  /**
   * Delete item from cache
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    this.accessOrder.delete(key);
    
    if (deleted) {
      this.stats.deletes++;
    }
    
    return deleted;
  }

  /**
   * Clear all items from cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder.clear();
    this.stats.deletes += size;
  }

  /**
   * Evict least recently used item
   */
  evictLRU() {
    if (this.accessOrder.size === 0) {
      return;
    }

    // Find the key with the oldest access time
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, accessTime] of this.accessOrder) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Clean up expired items
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.deletes += cleaned;
    }

    return cleaned;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
      : 0;

    return {
      ...this.stats,
      hitRate: parseFloat(hitRate.toFixed(2)),
      size: this.cache.size,
      maxSize: this.config.maxSize,
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * Get memory usage estimation
   */
  getMemoryUsage() {
    let totalSize = 0;
    
    for (const [key, item] of this.cache) {
      totalSize += key.length * 2; // String overhead
      totalSize += item.size || 0;
      totalSize += 100; // Metadata overhead estimate
    }

    return {
      bytes: totalSize,
      mb: parseFloat((totalSize / 1024 / 1024).toFixed(2))
    };
  }

  /**
   * Calculate approximate size of an object
   */
  calculateSize(obj) {
    if (obj === null || obj === undefined) {
      return 0;
    }

    if (typeof obj === 'string') {
      return obj.length * 2; // UTF-16 encoding
    }

    if (typeof obj === 'number') {
      return 8; // 64-bit number
    }

    if (typeof obj === 'boolean') {
      return 4;
    }

    if (Array.isArray(obj)) {
      return obj.reduce((acc, item) => acc + this.calculateSize(item), 0);
    }

    if (typeof obj === 'object') {
      return Object.entries(obj).reduce((acc, [key, value]) => {
        return acc + key.length * 2 + this.calculateSize(value);
      }, 0);
    }

    return 0;
  }

  /**
   * Deep clone an object for cache storage
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }

    if (typeof obj === 'object') {
      const cloned = {};
      for (const [key, value] of Object.entries(obj)) {
        cloned[key] = this.deepClone(value);
      }
      return cloned;
    }

    return obj;
  }

  /**
   * Get items by pattern
   */
  getByPattern(pattern) {
    const regex = new RegExp(pattern);
    const results = [];

    for (const [key, item] of this.cache) {
      if (regex.test(key) && Date.now() <= item.expiresAt) {
        results.push({
          key,
          value: item.value,
          createdAt: item.createdAt,
          expiresAt: item.expiresAt
        });
      }
    }

    return results;
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.clear();
  }
}

module.exports = { RequestCache };