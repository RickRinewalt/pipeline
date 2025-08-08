const { RequestCache } = require('../../src/utils/cache');

describe('RequestCache', () => {
  let cache;

  beforeEach(() => {
    cache = new RequestCache({
      ttl: 1, // 1 second for testing
      maxSize: 5,
      cleanupInterval: 100 // 100ms for testing
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      const key = 'test-key';
      const value = { data: 'test-data' };

      cache.set(key, value);
      const retrieved = cache.get(key);

      expect(retrieved).toEqual(value);
      expect(retrieved).not.toBe(value); // Should be deep cloned
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should check if key exists', () => {
      const key = 'test-key';
      const value = 'test-value';

      expect(cache.has(key)).toBe(false);
      
      cache.set(key, value);
      expect(cache.has(key)).toBe(true);
    });

    it('should delete keys', () => {
      const key = 'test-key';
      const value = 'test-value';

      cache.set(key, value);
      expect(cache.has(key)).toBe(true);

      const deleted = cache.delete(key);
      expect(deleted).toBe(true);
      expect(cache.has(key)).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);

      cache.clear();

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(false);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', async () => {
      const key = 'expire-test';
      const value = 'test-value';

      cache.set(key, value);
      expect(cache.get(key)).toBe(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(cache.get(key)).toBeNull();
    });

    it('should use custom TTL when provided', async () => {
      const key = 'custom-ttl';
      const value = 'test-value';
      const customTtl = 2; // 2 seconds

      cache.set(key, value, customTtl);
      
      // Should still exist after 1 second
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(cache.get(key)).toBe(value);

      // Should expire after 2 seconds
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(cache.get(key)).toBeNull();
    });

    it('should handle has() correctly with expired entries', async () => {
      const key = 'expire-has-test';
      const value = 'test-value';

      cache.set(key, value);
      expect(cache.has(key)).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(cache.has(key)).toBe(false);
    });
  });

  describe('LRU (Least Recently Used)', () => {
    it('should evict least recently used items when max size reached', () => {
      // Fill cache to max capacity
      for (let i = 1; i <= 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // All should exist
      for (let i = 1; i <= 5; i++) {
        expect(cache.has(`key${i}`)).toBe(true);
      }

      // Add one more item to trigger LRU eviction
      cache.set('key6', 'value6');

      // key1 should be evicted (least recently used)
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key6')).toBe(true);
    });

    it('should update access order when getting items', () => {
      // Fill cache
      for (let i = 1; i <= 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // Access key1 to make it recently used
      cache.get('key1');

      // Add new item
      cache.set('key6', 'value6');

      // key2 should be evicted instead of key1
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key6')).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should automatically clean up expired entries', async () => {
      cache.set('expire1', 'value1');
      cache.set('expire2', 'value2');
      cache.set('expire3', 'value3');

      // Wait for expiration and cleanup
      await new Promise(resolve => setTimeout(resolve, 1200));

      const stats = cache.getStats();
      expect(stats.size).toBe(0);
    });

    it('should return count of cleaned items', async () => {
      cache.set('expire1', 'value1');
      cache.set('expire2', 'value2');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const cleaned = cache.cleanup();
      expect(cleaned).toBe(2);
    });
  });

  describe('Statistics', () => {
    it('should track hit and miss statistics', () => {
      const key = 'stats-test';
      const value = 'test-value';

      // Initial stats
      let stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);

      // Miss
      cache.get(key);
      stats = cache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0);

      // Set and hit
      cache.set(key, value);
      cache.get(key);
      stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50);
    });

    it('should track memory usage', () => {
      cache.set('memory-test', { data: 'x'.repeat(1000) });
      
      const stats = cache.getStats();
      expect(stats.memoryUsage.bytes).toBeGreaterThan(1000);
      expect(stats.memoryUsage.mb).toBeGreaterThan(0);
    });

    it('should track cache size', () => {
      expect(cache.getStats().size).toBe(0);

      cache.set('size1', 'value1');
      expect(cache.getStats().size).toBe(1);

      cache.set('size2', 'value2');
      expect(cache.getStats().size).toBe(2);

      cache.delete('size1');
      expect(cache.getStats().size).toBe(1);
    });
  });

  describe('Pattern Matching', () => {
    it('should find items by pattern', () => {
      cache.set('user:123', { id: 123, name: 'Alice' });
      cache.set('user:456', { id: 456, name: 'Bob' });
      cache.set('repo:789', { id: 789, name: 'test-repo' });

      const userResults = cache.getByPattern('user:');
      expect(userResults).toHaveLength(2);
      
      const repoResults = cache.getByPattern('repo:');
      expect(repoResults).toHaveLength(1);
    });

    it('should not return expired items in pattern search', async () => {
      cache.set('pattern:1', 'value1');
      cache.set('pattern:2', 'value2');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const results = cache.getByPattern('pattern:');
      expect(results).toHaveLength(0);
    });
  });

  describe('Size Calculation', () => {
    it('should calculate size for strings', () => {
      const size = cache.calculateSize('test');
      expect(size).toBe(8); // 4 characters * 2 bytes each
    });

    it('should calculate size for numbers', () => {
      const size = cache.calculateSize(42);
      expect(size).toBe(8); // 64-bit number
    });

    it('should calculate size for booleans', () => {
      const size = cache.calculateSize(true);
      expect(size).toBe(4);
    });

    it('should calculate size for objects', () => {
      const obj = { name: 'test', value: 42 };
      const size = cache.calculateSize(obj);
      expect(size).toBeGreaterThan(0);
    });

    it('should calculate size for arrays', () => {
      const arr = ['a', 'b', 'c'];
      const size = cache.calculateSize(arr);
      expect(size).toBe(6); // 3 * 2 bytes each
    });
  });

  describe('Deep Cloning', () => {
    it('should deep clone objects', () => {
      const original = {
        name: 'test',
        nested: { value: 42 },
        array: [1, 2, 3]
      };

      const cloned = cache.deepClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.nested).not.toBe(original.nested);
      expect(cloned.array).not.toBe(original.array);
    });

    it('should clone dates correctly', () => {
      const date = new Date();
      const cloned = cache.deepClone(date);

      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date);
      expect(cloned instanceof Date).toBe(true);
    });

    it('should handle null and undefined', () => {
      expect(cache.deepClone(null)).toBe(null);
      expect(cache.deepClone(undefined)).toBe(undefined);
    });
  });

  describe('Destruction', () => {
    it('should clean up resources on destroy', () => {
      cache.set('cleanup-test', 'value');
      expect(cache.getStats().size).toBe(1);

      cache.destroy();

      expect(cache.getStats().size).toBe(0);
      expect(cache.cleanupTimer).toBeNull();
    });
  });
});