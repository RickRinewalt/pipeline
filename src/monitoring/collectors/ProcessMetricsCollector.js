const process = require('process');
const fs = require('fs').promises;

/**
 * Process Metrics Collector
 * Collects process-specific performance metrics for the current Node.js process
 */
class ProcessMetricsCollector {
  constructor(options = {}) {
    this.config = {
      collectMemory: true,
      collectCPU: true,
      collectIO: true,
      collectGC: true,
      collectEventLoop: true,
      collectHandles: true,
      ...options
    };

    this.previousCPUUsage = process.cpuUsage();
    this.previousHRTime = process.hrtime.bigint();
    this.gcStats = this.initializeGCStats();
    this.eventLoopMonitor = null;
  }

  /**
   * Collect all process metrics
   */
  async collect() {
    const timestamp = Date.now();
    const metrics = { timestamp };

    try {
      // Memory metrics
      if (this.config.collectMemory) {
        metrics.memory = await this.collectMemoryMetrics();
      }

      // CPU metrics
      if (this.config.collectCPU) {
        metrics.cpu = await this.collectCPUMetrics();
      }

      // I/O metrics
      if (this.config.collectIO) {
        metrics.io = await this.collectIOMetrics();
      }

      // Garbage collection metrics
      if (this.config.collectGC) {
        metrics.gc = await this.collectGCMetrics();
      }

      // Event loop metrics
      if (this.config.collectEventLoop) {
        metrics.eventLoop = await this.collectEventLoopMetrics();
      }

      // Handle metrics
      if (this.config.collectHandles) {
        metrics.handles = await this.collectHandleMetrics();
      }

      // Process info
      metrics.process = await this.collectProcessInfo();

      return {
        success: true,
        timestamp,
        metrics
      };

    } catch (error) {
      return {
        success: false,
        timestamp,
        error: error.message
      };
    }
  }

  /**
   * Collect memory metrics
   */
  async collectMemoryMetrics() {
    const memoryUsage = process.memoryUsage();
    
    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      arrayBuffers: memoryUsage.arrayBuffers || 0,
      
      // Calculate percentages
      heapUsagePercent: memoryUsage.heapTotal > 0 ? 
        (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100 : 0,
      
      // Additional derived metrics
      heapFree: memoryUsage.heapTotal - memoryUsage.heapUsed,
      
      // Try to get more detailed memory info
      ...(await this.getDetailedMemoryInfo())
    };
  }

  /**
   * Collect CPU metrics
   */
  async collectCPUMetrics() {
    const currentCPUUsage = process.cpuUsage();
    const currentHRTime = process.hrtime.bigint();

    // Calculate CPU usage percentage
    let cpuPercent = 0;
    
    if (this.previousCPUUsage && this.previousHRTime) {
      const cpuDiff = process.cpuUsage(this.previousCPUUsage);
      const hrTimeDiff = currentHRTime - this.previousHRTime;
      
      // Convert to microseconds and calculate percentage
      const totalCPUTime = cpuDiff.user + cpuDiff.system;
      const totalRealTime = Number(hrTimeDiff) / 1000; // Convert nanoseconds to microseconds
      
      if (totalRealTime > 0) {
        cpuPercent = (totalCPUTime / totalRealTime) * 100;
      }
    }

    // Update previous values
    this.previousCPUUsage = currentCPUUsage;
    this.previousHRTime = currentHRTime;

    return {
      user: currentCPUUsage.user,
      system: currentCPUUsage.system,
      total: currentCPUUsage.user + currentCPUUsage.system,
      percent: Math.round(cpuPercent * 100) / 100,
      
      // Process timing
      uptime: process.uptime(),
      hrtime: process.hrtime()
    };
  }

  /**
   * Collect I/O metrics
   */
  async collectIOMetrics() {
    const metrics = {
      stdin: this.getStreamMetrics(process.stdin),
      stdout: this.getStreamMetrics(process.stdout),
      stderr: this.getStreamMetrics(process.stderr)
    };

    // Try to get more detailed I/O info on Linux
    try {
      const procIO = await this.getProcIOInfo();
      if (procIO) {
        Object.assign(metrics, procIO);
      }
    } catch (error) {
      // I/O info not available
    }

    return metrics;
  }

  /**
   * Collect garbage collection metrics
   */
  async collectGCMetrics() {
    if (!global.gc) {
      return {
        available: false,
        message: 'GC stats not available (run with --expose-gc)'
      };
    }

    try {
      // Get performance GC entries if available
      if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        const gcEntries = performance.getEntriesByType('gc');
        
        return this.analyzeGCEntries(gcEntries);
      }

      return {
        available: true,
        entries: 0,
        message: 'Performance API not available for detailed GC stats'
      };

    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Collect event loop metrics
   */
  async collectEventLoopMetrics() {
    const metrics = {
      lag: await this.measureEventLoopLag(),
      utilization: this.getEventLoopUtilization()
    };

    // Active handles and requests
    if (process._getActiveHandles) {
      metrics.activeHandles = process._getActiveHandles().length;
    }

    if (process._getActiveRequests) {
      metrics.activeRequests = process._getActiveRequests().length;
    }

    return metrics;
  }

  /**
   * Collect handle metrics
   */
  async collectHandleMetrics() {
    const metrics = {
      handles: 0,
      requests: 0
    };

    try {
      if (process._getActiveHandles) {
        const handles = process._getActiveHandles();
        metrics.handles = handles.length;
        
        // Categorize handles by type
        const handleTypes = {};
        handles.forEach(handle => {
          const type = handle.constructor.name;
          handleTypes[type] = (handleTypes[type] || 0) + 1;
        });
        metrics.handleTypes = handleTypes;
      }

      if (process._getActiveRequests) {
        const requests = process._getActiveRequests();
        metrics.requests = requests.length;
        
        // Categorize requests by type
        const requestTypes = {};
        requests.forEach(request => {
          const type = request.constructor.name;
          requestTypes[type] = (requestTypes[type] || 0) + 1;
        });
        metrics.requestTypes = requestTypes;
      }

    } catch (error) {
      metrics.error = error.message;
    }

    return metrics;
  }

  /**
   * Collect general process information
   */
  async collectProcessInfo() {
    return {
      pid: process.pid,
      ppid: process.ppid,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      versions: process.versions,
      title: process.title,
      argv: process.argv,
      execPath: process.execPath,
      cwd: process.cwd(),
      uid: process.getuid ? process.getuid() : null,
      gid: process.getgid ? process.getgid() : null,
      groups: process.getgroups ? process.getgroups() : null
    };
  }

  /**
   * Get detailed memory information
   */
  async getDetailedMemoryInfo() {
    const details = {};

    try {
      // Try to get V8 heap statistics
      if (typeof v8 !== 'undefined' && v8.getHeapStatistics) {
        const v8HeapStats = v8.getHeapStatistics();
        details.v8HeapStats = v8HeapStats;
        
        // Calculate additional metrics
        details.heapSizeLimit = v8HeapStats.heap_size_limit;
        details.totalPhysicalSize = v8HeapStats.total_physical_size;
        details.totalAvailableSize = v8HeapStats.total_available_size;
        details.usedHeapSize = v8HeapStats.used_heap_size;
        details.mallocedMemory = v8HeapStats.malloced_memory;
        details.externalMemory = v8HeapStats.external_memory;
      }

      // Try to get heap space statistics
      if (typeof v8 !== 'undefined' && v8.getHeapSpaceStatistics) {
        const heapSpaces = v8.getHeapSpaceStatistics();
        details.heapSpaces = heapSpaces;
      }

    } catch (error) {
      details.error = error.message;
    }

    return details;
  }

  /**
   * Get stream metrics
   */
  getStreamMetrics(stream) {
    if (!stream || typeof stream !== 'object') {
      return { available: false };
    }

    return {
      readable: stream.readable,
      writable: stream.writable,
      readableEnded: stream.readableEnded,
      writableEnded: stream.writableEnded,
      readableFlowing: stream.readableFlowing,
      writableCorked: stream.writableCorked,
      readableHighWaterMark: stream.readableHighWaterMark,
      writableHighWaterMark: stream.writableHighWaterMark,
      readableLength: stream.readableLength,
      writableLength: stream.writableLength
    };
  }

  /**
   * Get process I/O information (Linux)
   */
  async getProcIOInfo() {
    try {
      const ioContent = await fs.readFile(`/proc/${process.pid}/io`, 'utf8');
      const lines = ioContent.split('\n');
      const ioStats = {};

      lines.forEach(line => {
        const match = line.match(/^(\w+):\s+(\d+)$/);
        if (match) {
          const key = match[1];
          const value = parseInt(match[2]);

          // Map to more readable names
          switch (key) {
            case 'rchar':
              ioStats.bytesRead = value;
              break;
            case 'wchar':
              ioStats.bytesWritten = value;
              break;
            case 'syscr':
              ioStats.readSyscalls = value;
              break;
            case 'syscw':
              ioStats.writeSyscalls = value;
              break;
            case 'read_bytes':
              ioStats.diskBytesRead = value;
              break;
            case 'write_bytes':
              ioStats.diskBytesWritten = value;
              break;
            case 'cancelled_write_bytes':
              ioStats.cancelledWrites = value;
              break;
          }
        }
      });

      return ioStats;

    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze garbage collection entries
   */
  analyzeGCEntries(gcEntries) {
    if (!gcEntries || gcEntries.length === 0) {
      return {
        available: true,
        totalEntries: 0,
        totalDuration: 0
      };
    }

    const analysis = {
      available: true,
      totalEntries: gcEntries.length,
      totalDuration: 0,
      averageDuration: 0,
      maxDuration: 0,
      minDuration: Number.MAX_VALUE,
      byKind: {}
    };

    gcEntries.forEach(entry => {
      analysis.totalDuration += entry.duration;
      analysis.maxDuration = Math.max(analysis.maxDuration, entry.duration);
      analysis.minDuration = Math.min(analysis.minDuration, entry.duration);

      // Group by GC kind if available
      const kind = entry.detail?.kind || 'unknown';
      if (!analysis.byKind[kind]) {
        analysis.byKind[kind] = {
          count: 0,
          totalDuration: 0,
          averageDuration: 0
        };
      }

      analysis.byKind[kind].count++;
      analysis.byKind[kind].totalDuration += entry.duration;
      analysis.byKind[kind].averageDuration = 
        analysis.byKind[kind].totalDuration / analysis.byKind[kind].count;
    });

    analysis.averageDuration = analysis.totalDuration / analysis.totalEntries;
    
    if (analysis.minDuration === Number.MAX_VALUE) {
      analysis.minDuration = 0;
    }

    return analysis;
  }

  /**
   * Measure event loop lag
   */
  async measureEventLoopLag() {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to milliseconds
        resolve(Math.round(lag * 100) / 100);
      });
    });
  }

  /**
   * Get event loop utilization
   */
  getEventLoopUtilization() {
    try {
      if (typeof performance !== 'undefined' && performance.eventLoopUtilization) {
        const elu = performance.eventLoopUtilization();
        return {
          idle: elu.idle,
          active: elu.active,
          utilization: elu.utilization
        };
      }

      return {
        available: false,
        message: 'Event loop utilization not available'
      };

    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Initialize GC statistics tracking
   */
  initializeGCStats() {
    const stats = {
      collections: 0,
      totalTime: 0,
      averageTime: 0,
      lastCollection: null
    };

    try {
      // Set up GC tracking if performance API is available
      if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        // This would set up a performance observer for GC events
        // For now, we'll just return the empty stats object
      }
    } catch (error) {
      // GC tracking not available
    }

    return stats;
  }

  /**
   * Start monitoring event loop
   */
  startEventLoopMonitoring() {
    if (this.eventLoopMonitor) {
      return;
    }

    this.eventLoopLagHistory = [];
    this.eventLoopMonitor = setInterval(() => {
      this.measureEventLoopLag().then(lag => {
        this.eventLoopLagHistory.push({
          timestamp: Date.now(),
          lag
        });

        // Keep only recent history
        if (this.eventLoopLagHistory.length > 100) {
          this.eventLoopLagHistory.shift();
        }
      });
    }, 1000);
  }

  /**
   * Stop monitoring event loop
   */
  stopEventLoopMonitoring() {
    if (this.eventLoopMonitor) {
      clearInterval(this.eventLoopMonitor);
      this.eventLoopMonitor = null;
    }
  }

  /**
   * Get event loop lag history
   */
  getEventLoopLagHistory() {
    return this.eventLoopLagHistory || [];
  }

  /**
   * Cleanup method
   */
  async cleanup() {
    this.stopEventLoopMonitoring();
    this.previousCPUUsage = null;
    this.previousHRTime = null;
  }
}

module.exports = ProcessMetricsCollector;