# Example Plugins - YOLO-PRO Modular Architecture

This directory contains example plugins that demonstrate the capabilities of the YOLO-PRO Modular Architecture system. These examples showcase various patterns and best practices for developing plugins within the ecosystem.

## Available Examples

### 1. Basic Plugin (`basic-plugin/`)
A simple plugin that demonstrates:
- Basic plugin structure and manifest
- Initialization and cleanup lifecycle
- Service registration with dependency injection
- Configuration management
- Inter-module communication

### 2. Data Processing Plugin (`data-processor/`)
A more complex plugin showcasing:
- Stream processing capabilities
- Worker thread integration
- Performance monitoring
- Error handling and recovery
- Hot-swappable components

### 3. Authentication Plugin (`auth-plugin/`)
Enterprise-grade security plugin featuring:
- JWT token management
- Role-based access control (RBAC)
- Security middleware
- Audit logging
- Integration with external identity providers

### 4. API Gateway Plugin (`api-gateway/`)
A comprehensive API gateway demonstrating:
- Route management and middleware
- Request/response transformation
- Rate limiting and throttling
- Load balancing
- WebSocket support

### 5. Database Plugin (`database-plugin/`)
Database abstraction layer showing:
- Multiple database adapter support
- Connection pooling
- Query builder integration
- Migration management
- Transaction handling

### 6. Real-time Communication Plugin (`realtime-plugin/`)
Real-time features plugin with:
- WebSocket server implementation
- Event-driven architecture
- Room/channel management
- Message broadcasting
- Presence tracking

## Getting Started

Each example plugin includes:
- `plugin.json` - Plugin manifest with metadata and dependencies
- `index.js` - Main plugin implementation
- `README.md` - Detailed documentation and usage instructions
- `tests/` - Unit and integration tests
- `config/` - Default configuration files (if applicable)

## Running Examples

1. **Install the modular architecture system:**
   ```bash
   npm install
   ```

2. **Copy example plugin to plugins directory:**
   ```bash
   cp -r examples/basic-plugin ./plugins/
   ```

3. **Initialize the engine and load plugins:**
   ```javascript
   import { ModularEngine } from './src/architecture/ModularEngine.js';
   
   const engine = new ModularEngine();
   await engine.initialize();
   
   // Discover and load plugins
   await engine.pluginManager.discoverPlugins();
   const plugin = await engine.pluginManager.loadPlugin('basic-plugin');
   ```

## Development Guidelines

### Plugin Structure
```
your-plugin/
├── plugin.json          # Plugin manifest
├── index.js            # Main plugin class
├── README.md           # Documentation
├── config/
│   └── default.json    # Default configuration
├── tests/
│   └── plugin.test.js  # Tests
└── lib/                # Additional modules
    └── helper.js
```

### Plugin Manifest (plugin.json)
```json
{
  "name": "Your Plugin Name",
  "version": "1.0.0",
  "main": "index.js",
  "description": "Plugin description",
  "author": "Your Name",
  "license": "MIT",
  "dependencies": [
    { "name": "other-plugin", "version": "^1.0.0" }
  ],
  "permissions": [
    "network",
    "filesystem"
  ],
  "provides": [
    "yourService"
  ],
  "requires": [
    "coreService"
  ]
}
```

### Plugin Implementation Pattern
```javascript
export default class YourPlugin {
  constructor(engine, options) {
    this.engine = engine;
    this.options = options;
    this.initialized = false;
  }

  async initialize(engine, manifest, options) {
    // Plugin initialization logic
    await this.setupServices();
    await this.registerComponents();
    
    this.initialized = true;
    return true;
  }

  async setupServices() {
    // Register services with the container
    this.engine.serviceContainer.registerSingleton(
      'yourService',
      () => this.createService()
    );
  }

  async registerComponents() {
    // Subscribe to events
    this.engine.moduleBridge.subscribe(
      'your-plugin',
      'events-channel',
      (message) => this.handleEvent(message)
    );
  }

  createService() {
    return {
      doSomething: () => 'Plugin functionality',
      getStatus: () => ({ healthy: true })
    };
  }

  handleEvent(message) {
    // Handle inter-module messages
  }

  async checkHealth() {
    return {
      status: 'healthy',
      uptime: Date.now() - this.startTime,
      initialized: this.initialized
    };
  }

  async cleanup() {
    // Cleanup resources
    this.initialized = false;
  }
}
```

## Best Practices

1. **Error Handling**: Always implement proper error handling and recovery
2. **Resource Management**: Clean up resources in the cleanup method
3. **Configuration**: Use the configuration system for customizable behavior
4. **Logging**: Use the centralized logging service
5. **Testing**: Include comprehensive tests for your plugin
6. **Documentation**: Provide clear documentation and examples
7. **Security**: Follow security best practices and use minimal permissions
8. **Performance**: Monitor and optimize plugin performance

## Security Considerations

- Request only necessary permissions
- Validate all inputs and configurations
- Use secure communication patterns
- Implement proper authentication/authorization
- Follow the principle of least privilege
- Audit and log security-relevant events

## Performance Guidelines

- Use lazy loading where possible
- Implement efficient algorithms and data structures
- Monitor memory usage and prevent leaks
- Use async/await for non-blocking operations
- Cache expensive computations
- Profile and optimize hot paths

## Testing Examples

Each example includes comprehensive tests:
- Unit tests for individual components
- Integration tests with the modular system
- Security tests for permission handling
- Performance tests for optimization
- E2E tests for complete workflows

## Contributing

When contributing new examples:
1. Follow the established structure and patterns
2. Include comprehensive documentation
3. Add unit and integration tests
4. Ensure security best practices
5. Optimize for performance
6. Update this README with your example

## Support

For questions about these examples or plugin development:
- Check the main documentation in `/docs`
- Review the test files for usage patterns
- Examine the source code for implementation details
- Open an issue for specific problems or questions

Happy plugin development! 🚀