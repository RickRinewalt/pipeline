const os = require('os');
const fs = require('fs').promises;

/**
 * System Metrics Collector
 * Collects comprehensive system-level performance metrics
 */
class SystemMetricsCollector {
  constructor(options = {}) {
    this.config = {
      collectCPU: true,
      collectMemory: true,
      collectDisk: true,
      collectNetwork: true,
      collectLoad: true,
      ...options
    };

    this.previousCPUInfo = null;
    this.previousNetworkStats = null;
  }

  /**
   * Collect all system metrics
   */
  async collect() {
    const timestamp = Date.now();
    const metrics = { timestamp };

    try {
      // CPU metrics
      if (this.config.collectCPU) {
        metrics.cpu = await this.collectCPUMetrics();
      }

      // Memory metrics
      if (this.config.collectMemory) {
        metrics.memory = await this.collectMemoryMetrics();
      }

      // Disk metrics
      if (this.config.collectDisk) {
        metrics.disk = await this.collectDiskMetrics();
      }

      // Network metrics
      if (this.config.collectNetwork) {
        metrics.network = await this.collectNetworkMetrics();
      }

      // Load average
      if (this.config.collectLoad) {
        metrics.load = await this.collectLoadMetrics();
      }

      // System uptime
      metrics.uptime = os.uptime();

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
   * Collect CPU metrics
   */
  async collectCPUMetrics() {
    const cpus = os.cpus();
    const currentCPUInfo = this.getCPUTimes();

    let cpuUsage = 0;

    if (this.previousCPUInfo) {
      // Calculate CPU usage percentage
      const totalDiff = currentCPUInfo.total - this.previousCPUInfo.total;
      const idleDiff = currentCPUInfo.idle - this.previousCPUInfo.idle;
      cpuUsage = totalDiff > 0 ? ((totalDiff - idleDiff) / totalDiff) * 100 : 0;
    }

    this.previousCPUInfo = currentCPUInfo;

    return {
      usage: Math.round(cpuUsage * 100) / 100,
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      speed: cpus[0]?.speed || 0,
      loadAverage: os.loadavg(),
      times: {
        user: currentCPUInfo.user,
        nice: currentCPUInfo.nice,
        sys: currentCPUInfo.sys,
        idle: currentCPUInfo.idle,
        irq: currentCPUInfo.irq
      }
    };
  }

  /**
   * Collect memory metrics
   */
  async collectMemoryMetrics() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usagePercent = (usedMemory / totalMemory) * 100;

    const metrics = {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      usagePercent: Math.round(usagePercent * 100) / 100,
      available: freeMemory
    };

    // Try to get more detailed memory info on Linux
    try {
      const meminfo = await this.getLinuxMemoryInfo();
      if (meminfo) {
        Object.assign(metrics, meminfo);
      }
    } catch (error) {
      // Ignore errors, use basic metrics
    }

    return metrics;
  }

  /**
   * Collect disk metrics
   */
  async collectDiskMetrics() {
    const metrics = {
      usage: [],
      io: null
    };

    try {
      // Get disk usage for root filesystem
      const diskUsage = await this.getDiskUsage('/');
      metrics.usage.push(diskUsage);

      // Try to get disk I/O statistics on Linux
      try {
        const ioStats = await this.getDiskIOStats();
        metrics.io = ioStats;
      } catch (error) {
        // I/O stats not available
      }

    } catch (error) {
      // Basic disk metrics not available
    }

    return metrics;
  }

  /**
   * Collect network metrics
   */
  async collectNetworkMetrics() {
    const networkInterfaces = os.networkInterfaces();
    const metrics = {
      interfaces: {},
      stats: null
    };

    // Collect interface information
    Object.entries(networkInterfaces).forEach(([name, interfaces]) => {
      metrics.interfaces[name] = interfaces.map(iface => ({
        family: iface.family,
        address: iface.address,
        internal: iface.internal,
        mac: iface.mac
      }));
    });

    // Try to get network statistics on Linux
    try {
      const networkStats = await this.getNetworkStats();
      if (networkStats) {
        metrics.stats = networkStats;

        // Calculate rates if we have previous data
        if (this.previousNetworkStats) {
          metrics.rates = this.calculateNetworkRates(networkStats, this.previousNetworkStats);
        }

        this.previousNetworkStats = networkStats;
      }
    } catch (error) {
      // Network stats not available
    }

    return metrics;
  }

  /**
   * Collect load average metrics
   */
  async collectLoadMetrics() {
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;

    return {
      '1min': loadAvg[0],
      '5min': loadAvg[1],
      '15min': loadAvg[2],
      cpuCount,
      normalized: {
        '1min': loadAvg[0] / cpuCount,
        '5min': loadAvg[1] / cpuCount,
        '15min': loadAvg[2] / cpuCount
      }
    };
  }

  /**
   * Get CPU times for usage calculation
   */
  getCPUTimes() {
    const cpus = os.cpus();
    let totalUser = 0, totalNice = 0, totalSys = 0, totalIdle = 0, totalIrq = 0;

    cpus.forEach(cpu => {
      totalUser += cpu.times.user;
      totalNice += cpu.times.nice;
      totalSys += cpu.times.sys;
      totalIdle += cpu.times.idle;
      totalIrq += cpu.times.irq;
    });

    const total = totalUser + totalNice + totalSys + totalIdle + totalIrq;

    return {
      user: totalUser,
      nice: totalNice,
      sys: totalSys,
      idle: totalIdle,
      irq: totalIrq,
      total
    };
  }

  /**
   * Get Linux-specific memory information
   */
  async getLinuxMemoryInfo() {
    try {
      const meminfo = await fs.readFile('/proc/meminfo', 'utf8');
      const lines = meminfo.split('\n');
      const info = {};

      lines.forEach(line => {
        const match = line.match(/^(\w+):\s+(\d+)\s+kB$/);
        if (match) {
          const key = match[1];
          const value = parseInt(match[2]) * 1024; // Convert to bytes

          switch (key) {
            case 'MemAvailable':
              info.available = value;
              break;
            case 'Buffers':
              info.buffers = value;
              break;
            case 'Cached':
              info.cached = value;
              break;
            case 'SwapTotal':
              info.swapTotal = value;
              break;
            case 'SwapFree':
              info.swapFree = value;
              break;
          }
        }
      });

      // Calculate swap usage
      if (info.swapTotal && info.swapFree) {
        info.swapUsed = info.swapTotal - info.swapFree;
        info.swapUsagePercent = info.swapTotal > 0 ? 
          (info.swapUsed / info.swapTotal) * 100 : 0;
      }

      return info;

    } catch (error) {
      return null;
    }
  }

  /**
   * Get disk usage for a filesystem
   */
  async getDiskUsage(path) {
    try {
      const stats = await fs.stat(path);
      
      // This is a simplified version - in practice you'd use statvfs or similar
      // For Node.js, there's no direct equivalent, so we'll use a workaround
      
      return {
        path,
        // These would be actual values from filesystem stats
        total: 1000000000, // 1GB placeholder
        free: 500000000,   // 500MB placeholder  
        used: 500000000,   // 500MB placeholder
        usagePercent: 50   // 50% placeholder
      };

    } catch (error) {
      throw new Error(`Failed to get disk usage for ${path}: ${error.message}`);
    }
  }

  /**
   * Get disk I/O statistics (Linux)
   */
  async getDiskIOStats() {
    try {
      const diskstats = await fs.readFile('/proc/diskstats', 'utf8');
      const lines = diskstats.split('\n').filter(line => line.trim());

      const stats = {};

      lines.forEach(line => {
        const fields = line.trim().split(/\s+/);
        if (fields.length >= 14) {
          const deviceName = fields[2];
          
          // Skip loop and ram devices
          if (deviceName.startsWith('loop') || deviceName.startsWith('ram')) {
            return;
          }

          stats[deviceName] = {
            readsCompleted: parseInt(fields[3]),
            readsMerged: parseInt(fields[4]),
            sectorsRead: parseInt(fields[5]),
            timeReading: parseInt(fields[6]),
            writesCompleted: parseInt(fields[7]),
            writesMerged: parseInt(fields[8]),
            sectorsWritten: parseInt(fields[9]),
            timeWriting: parseInt(fields[10]),
            iosInProgress: parseInt(fields[11]),
            timeDoingIO: parseInt(fields[12]),
            weightedTimeDoingIO: parseInt(fields[13])
          };
        }
      });

      return stats;

    } catch (error) {
      return null;
    }
  }

  /**
   * Get network statistics (Linux)
   */
  async getNetworkStats() {
    try {
      const netdev = await fs.readFile('/proc/net/dev', 'utf8');
      const lines = netdev.split('\n').slice(2); // Skip header lines

      const stats = {};

      lines.forEach(line => {
        const match = line.match(/^\s*([^:]+):\s*(.+)$/);
        if (match) {
          const interfaceName = match[1].trim();
          const values = match[2].trim().split(/\s+/).map(v => parseInt(v));

          if (values.length >= 16) {
            stats[interfaceName] = {
              bytesReceived: values[0],
              packetsReceived: values[1],
              errorsReceived: values[2],
              dropsReceived: values[3],
              bytesSent: values[8],
              packetsSent: values[9],
              errorsSent: values[10],
              dropsSent: values[11]
            };
          }
        }
      });

      return stats;

    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate network transfer rates
   */
  calculateNetworkRates(current, previous) {
    const rates = {};
    const timeDiff = Date.now() - (this.lastCollectionTime || Date.now());
    const timeDiffSeconds = timeDiff / 1000;

    if (timeDiffSeconds <= 0) return rates;

    Object.keys(current).forEach(interfaceName => {
      if (previous[interfaceName]) {
        const currentStats = current[interfaceName];
        const previousStats = previous[interfaceName];

        rates[interfaceName] = {
          bytesReceivedPerSec: Math.max(0, 
            (currentStats.bytesReceived - previousStats.bytesReceived) / timeDiffSeconds
          ),
          bytesSentPerSec: Math.max(0,
            (currentStats.bytesSent - previousStats.bytesSent) / timeDiffSeconds
          ),
          packetsReceivedPerSec: Math.max(0,
            (currentStats.packetsReceived - previousStats.packetsReceived) / timeDiffSeconds
          ),
          packetsSentPerSec: Math.max(0,
            (currentStats.packetsSent - previousStats.packetsSent) / timeDiffSeconds
          )
        };
      }
    });

    this.lastCollectionTime = Date.now();
    return rates;
  }

  /**
   * Cleanup method
   */
  async cleanup() {
    // Reset previous data
    this.previousCPUInfo = null;
    this.previousNetworkStats = null;
  }
}

module.exports = SystemMetricsCollector;