# Performance Monitoring & Analytics System

A comprehensive, real-time performance monitoring solution designed specifically for YOLO-PRO systems with advanced analytics, alerting, and optimization capabilities.

## 🚀 Features

### Core Monitoring
- **Real-time Metrics Collection**: System, process, network, and CLI performance metrics
- **Multi-source Data Aggregation**: Intelligent data fusion from multiple collectors
- **Historical Data Storage**: Configurable retention with automatic cleanup
- **Performance Analysis**: Advanced bottleneck detection and trend analysis

### Analytics & Intelligence
- **Real-time Dashboard**: Interactive performance visualization
- **Anomaly Detection**: ML-powered performance anomaly identification
- **Bottleneck Analysis**: Automated identification and optimization recommendations
- **Predictive Analytics**: Performance forecasting based on historical trends

### Alerting & Notifications
- **Configurable Thresholds**: Custom alert rules for different metrics
- **Multiple Notification Channels**: Email, webhook, and log notifications
- **Alert Suppression**: Intelligent alert management to reduce noise
- **Escalation Policies**: Automated alert escalation based on severity

### YOLO-PRO Integration
- **CLI Command Tracking**: Performance monitoring for all CLI operations
- **Workflow Monitoring**: End-to-end workflow performance analysis
- **SPARC Phase Tracking**: Detailed performance metrics for each SPARC phase
- **Seamless Integration**: Hook-based integration with existing systems

## 📋 Quick Start

### Installation

```bash
npm install
```

### Basic Usage

```javascript
const { quickStart } = require('./src/monitoring');

// Start monitoring with default configuration
const monitoringSystem = await quickStart();

// Get current performance metrics
const metrics = monitoringSystem.getCurrentMetrics();
console.log('System Health:', metrics.summary.healthScore);
```

### Advanced Configuration

```javascript
const { PerformanceMonitoringSystem } = require('./src/monitoring');

const config = {
  monitoring: {
    collectInterval: 5000,    // 5 seconds
    retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxDataPoints: 1000
  },
  dashboard: {
    enabled: true,
    refreshInterval: 3000,    // 3 seconds
    enableRealTime: true
  },
  integration: {
    enabled: true,
    yoloPro: true,
    trackCLICommands: true,
    trackWorkflows: true,
    trackSparCPhases: true
  },
  collectors: {
    system: true,    // CPU, Memory, Disk
    process: true,   // Node.js process metrics
    network: true,   // Network performance
    cli: true        // CLI operation metrics
  }
};

const system = new PerformanceMonitoringSystem(config);
await system.start();
```

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                Performance Monitoring System                │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────── │
│  │ MonitoringEngine │  │PerformanceDash- │  │ YoloProInteg- │
│  │                 │  │board            │  │ration        │
│  │ • Data Collection│  │ • Real-time UI  │  │ • CLI Hooks   │
│  │ • Storage       │  │ • Widgets       │  │ • Workflow    │
│  │ • Processing    │  │ • Charts        │  │   Tracking    │
│  └─────────────────┘  └─────────────────┘  └─────────────── │
│           │                     │                    │      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────── │
│  │ Data Collectors │  │ Alert Manager   │  │ Performance   │
│  │                 │  │                 │  │ Analyzer      │
│  │ • System        │  │ • Threshold     │  │ • Bottleneck  │
│  │ • Process       │  │   Monitoring    │  │   Detection   │
│  │ • Network       │  │ • Notifications │  │ • Trend       │
│  │ • CLI           │  │ • Escalation    │  │   Analysis    │
│  └─────────────────┘  └─────────────────┘  └─────────────── │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Collectors → MetricsCollector → DataProcessor → PerformanceAnalyzer
     ↓              ↓               ↓                ↓
   Storage    → AlertManager  → Dashboard    → Recommendations
     ↓              ↓               ↓                ↓
Integration  → Notifications → Real-time UI → Optimizations
```

## 📊 Dashboard Widgets

### System Health Widget
- Overall system health score (0-100)
- Component-level health breakdown
- Health trend indicators
- Visual gauge representation

### Real-time Metrics Widget
- CPU, Memory, Disk usage
- Network performance metrics
- Response times and throughput
- Trend indicators for each metric

### Alerts Widget
- Active alerts by severity
- Recent alert history
- Alert acknowledgment actions
- Escalation status

### Performance Trends Widget
- Historical performance charts
- Multi-metric trend visualization
- Configurable time ranges
- Interactive zoom and pan

### Bottlenecks Widget
- Active performance bottlenecks
- Impact assessment
- Duration tracking
- Optimization recommendations

### Recommendations Widget
- AI-generated optimization suggestions
- Priority-based categorization
- Implementation tracking
- Cost-benefit analysis

## 🔧 Collectors

### System Metrics Collector
```javascript
// Metrics collected:
{
  cpu: {
    usage: 45.2,        // CPU usage percentage
    cores: 8,           // Number of CPU cores
    loadAverage: [1.2, 1.1, 0.9] // 1, 5, 15 minute load averages
  },
  memory: {
    total: 16777216000,     // Total memory in bytes
    used: 8388608000,       // Used memory in bytes
    usagePercent: 50.0,     // Memory usage percentage
    available: 8388608000   // Available memory in bytes
  },
  disk: {
    usage: [{
      path: '/',
      total: 500000000000,  // Total disk space
      used: 250000000000,   // Used disk space
      usagePercent: 50.0    // Disk usage percentage
    }]
  }
}
```

### Process Metrics Collector
```javascript
// Node.js process specific metrics:
{
  memory: {
    heapUsed: 50000000,     // Heap memory used
    heapTotal: 100000000,   // Total heap memory
    external: 5000000,      // External memory
    rss: 120000000          // Resident Set Size
  },
  cpu: {
    user: 1000000,          // User CPU time (microseconds)
    system: 500000,         // System CPU time (microseconds)
    percent: 15.5           // CPU usage percentage
  },
  eventLoop: {
    lag: 2.5,               // Event loop lag (ms)
    utilization: 0.45       // Event loop utilization
  }
}
```

### Network Metrics Collector
```javascript
// Network performance metrics:
{
  latency: {
    averageLatency: 45.2,   // Average network latency (ms)
    minLatency: 23.1,       // Minimum latency
    maxLatency: 156.7,      // Maximum latency
    packetLoss: 0.1         // Packet loss percentage
  },
  dns: {
    resolutions: [...],     // DNS resolution results
    averageTime: 12.5,      // Average DNS resolution time
    successRate: 99.2       // DNS success rate
  },
  quality: {
    score: 95,              // Overall network quality (0-100)
    rating: 'excellent'     // Quality rating
  }
}
```

### CLI Metrics Collector
```javascript
// CLI operation performance:
{
  commands: {
    total: 1250,            // Total commands executed
    successful: 1225,       // Successful commands
    failed: 25,             // Failed commands
    successRate: 98.0,      // Success rate percentage
    averageExecutionTime: 125.5 // Average execution time (ms)
  },
  recent: {
    count: 15,              // Recent commands (last 5 minutes)
    commands: [...]         // Recent command details
  },
  performance: {
    commandThroughput: 5.2, // Commands per minute
    errorRate: 2.0,         // Error rate percentage
    slowestCommand: {...},  // Slowest command details
    fastestCommand: {...}   // Fastest command details
  }
}
```

## 🚨 Alert Configuration

### Threshold Configuration
```javascript
const alertConfig = {
  thresholds: {
    cpu: { warning: 70, critical: 90 },
    memory: { warning: 75, critical: 90 },
    disk: { warning: 80, critical: 95 },
    responseTime: { warning: 1000, critical: 3000 },
    errorRate: { warning: 1, critical: 5 }
  },
  notifications: {
    email: {
      enabled: true,
      recipients: ['admin@example.com']
    },
    webhook: {
      enabled: true,
      urls: ['https://hooks.slack.com/...']
    }
  },
  escalation: {
    enabled: true,
    levels: [
      { severity: 'warning', delay: 300000 }, // 5 minutes
      { severity: 'critical', delay: 120000 } // 2 minutes
    ]
  }
};
```

### Custom Alert Rules
```javascript
// Define custom alert conditions
const customRules = [
  {
    name: 'High CLI Error Rate',
    condition: (metrics) => {
      return metrics.cli?.performance?.errorRate > 5;
    },
    severity: 'warning',
    message: 'CLI error rate is above 5%'
  },
  {
    name: 'SPARC Phase Timeout',
    condition: (metrics) => {
      return metrics.sparc?.currentPhase?.duration > 300000; // 5 minutes
    },
    severity: 'critical',
    message: 'SPARC phase execution exceeded timeout'
  }
];
```

## 🔗 YOLO-PRO Integration

### CLI Command Tracking
```javascript
const { hookCLICommand } = require('./src/monitoring');

// Hook existing CLI commands
const originalCommand = async (args) => {
  // Original command implementation
  return result;
};

// Create performance-tracked version
const trackedCommand = hookCLICommand('command-name', originalCommand);

// Use tracked version
const result = await trackedCommand(args);
```

### Workflow Monitoring
```javascript
const { hookWorkflow } = require('./src/monitoring');

const workflow = async (workflowData) => {
  // Workflow implementation
  return workflowResult;
};

// Hook workflow for performance tracking
const monitoredWorkflow = hookWorkflow('workflow-name', workflow);
```

### SPARC Phase Tracking
```javascript
const { hookSparcPhase } = require('./src/monitoring');

const sparcPhase = async (phaseData) => {
  // SPARC phase implementation
  return phaseResult;
};

// Hook SPARC phase
const monitoredPhase = hookSparcPhase('specification', sparcPhase);
```

## 📈 Performance Analysis

### Bottleneck Detection
The system automatically identifies performance bottlenecks:

- **CPU Bottlenecks**: Sustained high CPU usage
- **Memory Bottlenecks**: High memory usage and leaks
- **I/O Bottlenecks**: Disk and network performance issues
- **Application Bottlenecks**: CLI command and workflow slowdowns

### Trend Analysis
Advanced trend analysis provides insights into:

- **Performance Degradation**: Identifying declining metrics
- **Capacity Planning**: Predicting resource needs
- **Optimization Opportunities**: Suggesting improvements
- **Seasonal Patterns**: Understanding usage patterns

### Anomaly Detection
Machine learning-powered anomaly detection:

- **Statistical Anomalies**: Z-score and IQR-based detection
- **Pattern Anomalies**: Deviation from historical patterns
- **Behavioral Anomalies**: Unusual system behavior
- **Predictive Alerts**: Early warning system

## 🧪 Testing

### Unit Tests
```bash
# Run all monitoring tests
npm test tests/monitoring/

# Run specific test suites
npm test tests/monitoring/MonitoringEngine.test.js
npm test tests/monitoring/PerformanceDashboard.test.js
npm test tests/monitoring/integration.test.js
```

### Integration Tests
```bash
# Full system integration tests
npm test tests/monitoring/integration.test.js

# Performance benchmarks
npm test tests/performance/
```

### Load Testing
```bash
# Simulate high load scenarios
npm run test:load
```

## 🚀 Deployment

### Production Configuration
```javascript
const productionConfig = {
  monitoring: {
    collectInterval: 10000,  // Less frequent collection
    retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxDataPoints: 10000     // Higher retention
  },
  alerts: {
    notifications: {
      email: {
        enabled: true,
        recipients: ['alerts@company.com']
      },
      webhook: {
        enabled: true,
        urls: ['https://monitoring.company.com/webhooks/alerts']
      }
    }
  },
  dashboard: {
    enableRealTime: true,
    refreshInterval: 5000
  }
};
```

### Docker Deployment
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY docs/ ./docs/

EXPOSE 3000

CMD ["node", "src/monitoring/index.js"]
```

### Environment Variables
```bash
# Monitoring configuration
MONITORING_ENABLED=true
MONITORING_INTERVAL=5000
MONITORING_RETENTION=2592000000  # 30 days

# Alert configuration
ALERTS_ENABLED=true
ALERT_EMAIL_RECIPIENTS=admin@example.com
ALERT_WEBHOOK_URL=https://hooks.slack.com/...

# Dashboard configuration
DASHBOARD_ENABLED=true
DASHBOARD_REFRESH_INTERVAL=5000
```

## 🤝 Contributing

### Development Setup
```bash
# Clone repository
git clone <repository-url>
cd pipeline

# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev
```

### Adding New Collectors
```javascript
class CustomMetricsCollector {
  constructor(options = {}) {
    this.config = options;
  }

  async collect() {
    // Implement metrics collection
    return {
      success: true,
      timestamp: Date.now(),
      metrics: {
        // Your custom metrics
      }
    };
  }

  async cleanup() {
    // Cleanup resources
  }
}

module.exports = CustomMetricsCollector;
```

### Adding New Widgets
```javascript
getCustomWidget() {
  return {
    type: 'customWidget',
    title: 'Custom Widget',
    size: 'medium',
    data: {
      // Widget data
    },
    visualization: 'chart', // or 'table', 'gauge', etc.
    options: {
      // Visualization options
    }
  };
}
```

## 📖 API Reference

### MonitoringEngine API
- `start()` - Start monitoring engine
- `stop()` - Stop monitoring engine
- `registerCollector(name, collector)` - Register metrics collector
- `collectMetrics()` - Trigger metrics collection
- `getCurrentMetrics()` - Get current performance metrics
- `getHistoricalMetrics(options)` - Get historical data
- `analyzePerformance(options)` - Get performance analysis

### PerformanceDashboard API
- `start()` - Start dashboard
- `stop()` - Stop dashboard
- `getDashboardData()` - Get complete dashboard data
- `getAllWidgets()` - Get all widget data
- `getChartData(chartType, timeRange)` - Get chart data
- `exportDashboard(format)` - Export dashboard data

### YoloProIntegration API
- `start()` - Start integration
- `stop()` - Stop integration
- `hookCLICommand(name, fn)` - Hook CLI command
- `hookWorkflowExecution(name, fn)` - Hook workflow
- `hookSparcPhase(name, fn)` - Hook SPARC phase
- `getYoloProMetrics()` - Get integration metrics

## 🔧 Troubleshooting

### Common Issues

#### High Memory Usage
- Reduce `maxDataPoints` in configuration
- Decrease `retentionPeriod`
- Enable automatic cleanup

#### Slow Dashboard Performance
- Increase `refreshInterval`
- Disable real-time updates
- Reduce number of enabled widgets

#### Missing Metrics
- Check collector registration
- Verify collector permissions
- Review system compatibility

#### Alert Spam
- Adjust alert thresholds
- Enable alert suppression
- Configure proper escalation policies

### Debug Mode
```javascript
const config = {
  debug: true,
  logging: {
    level: 'debug',
    enableConsole: true
  }
};
```

### Performance Profiling
```bash
# Enable Node.js profiling
node --prof src/monitoring/index.js

# Generate profile report
node --prof-process isolate-*.log > profile.txt
```

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Node.js and modern JavaScript
- Inspired by industry-standard monitoring solutions
- Designed for YOLO-PRO workflow optimization
- Comprehensive testing with Jest
- Real-time capabilities with EventEmitter architecture