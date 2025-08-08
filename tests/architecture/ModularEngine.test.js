/**
 * Unit tests for ModularEngine - Core modular architecture system
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ModularEngine } from '../../src/architecture/ModularEngine.js';

describe('ModularEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new ModularEngine({
      enableHotSwap: true,
      securityLevel: 'strict',
      maxConcurrentPlugins: 10
    });
  });

  afterEach(async () => {
    if (engine.isInitialized) {
      await engine.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await engine.initialize();
      
      expect(engine.isInitialized).toBe(true);
      expect(engine.serviceContainer).toBeDefined();
      expect(engine.pluginManager).toBeDefined();
      expect(engine.moduleLifecycle).toBeDefined();
    });

    it('should throw error on double initialization', async () => {
      await engine.initialize();
      
      await expect(engine.initialize()).rejects.toThrow('ModularEngine already initialized');
    });

    it('should emit initialization events', async () => {
      const initializingHandler = jest.fn();
      const initializedHandler = jest.fn();

      engine.on('engine:initializing', initializingHandler);
      engine.on('engine:initialized', initializedHandler);

      await engine.initialize();

      expect(initializingHandler).toHaveBeenCalled();
      expect(initializedHandler).toHaveBeenCalled();
    });
  });

  describe('Module Loading', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should load a simple module', async () => {
      const moduleSpec = {
        id: 'test-module',
        name: 'Test Module',
        version: '1.0.0',
        factory: () => ({ test: true, initialize: jest.fn() })
      };

      const module = await engine.loadModule(moduleSpec);

      expect(module).toBeDefined();
      expect(module.test).toBe(true);
      expect(engine.modules.has('test-module')).toBe(true);
      expect(engine.getModule('test-module')).toBe(module);
    });

    it('should load module with dependencies', async () => {
      // Load dependency first
      const depSpec = {
        id: 'dependency',
        name: 'Dependency',
        version: '1.0.0',
        factory: () => ({ value: 42, initialize: jest.fn() })
      };
      await engine.loadModule(depSpec);

      // Load module that depends on it
      const moduleSpec = {
        id: 'dependent-module',
        name: 'Dependent Module',
        version: '1.0.0',
        dependencies: [depSpec],
        factory: (dep) => ({ 
          dependency: dep, 
          initialize: jest.fn(),
          getDependencyValue: () => dep.value 
        })
      };

      const module = await engine.loadModule(moduleSpec);

      expect(module.getDependencyValue()).toBe(42);
    });

    it('should emit module loading events', async () => {
      const loadingHandler = jest.fn();
      const loadedHandler = jest.fn();

      engine.on('module:loading', loadingHandler);
      engine.on('module:loaded', loadedHandler);

      const moduleSpec = {
        id: 'event-test',
        name: 'Event Test',
        version: '1.0.0',
        factory: () => ({ initialize: jest.fn() })
      };

      await engine.loadModule(moduleSpec);

      expect(loadingHandler).toHaveBeenCalledWith({ moduleId: 'event-test', spec: moduleSpec });
      expect(loadedHandler).toHaveBeenCalledWith({ moduleId: 'event-test', module: expect.any(Object) });
    });

    it('should handle module loading errors', async () => {
      const errorHandler = jest.fn();
      engine.on('module:error', errorHandler);

      const moduleSpec = {
        id: 'error-module',
        name: 'Error Module',
        version: '1.0.0',
        factory: () => {
          throw new Error('Module loading error');
        }
      };

      await expect(engine.loadModule(moduleSpec)).rejects.toThrow('Module loading error');
      expect(errorHandler).toHaveBeenCalled();
      expect(engine.failedModules.has('error-module')).toBe(true);
    });

    it('should reject module with security violations', async () => {
      // Mock security validation to fail
      jest.spyOn(engine.moduleSecurity, 'validateModule').mockResolvedValue({
        valid: false,
        reason: 'Security violation detected'
      });

      const moduleSpec = {
        id: 'insecure-module',
        name: 'Insecure Module',
        version: '1.0.0',
        factory: () => ({ initialize: jest.fn() })
      };

      await expect(engine.loadModule(moduleSpec)).rejects.toThrow('Security validation failed');
    });
  });

  describe('Hot Swapping', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should hot-swap a module successfully', async () => {
      // Load initial module
      const initialSpec = {
        id: 'swappable-module',
        name: 'Swappable Module',
        version: '1.0.0',
        factory: () => ({ 
          version: '1.0.0',
          initialize: jest.fn(),
          getValue: () => 'old-value'
        })
      };

      const initialModule = await engine.loadModule(initialSpec);
      expect(initialModule.getValue()).toBe('old-value');

      // Hot swap with new version
      const newSpec = {
        id: 'swappable-module',
        name: 'Swappable Module',
        version: '2.0.0',
        factory: () => ({ 
          version: '2.0.0',
          initialize: jest.fn(),
          getValue: () => 'new-value'
        })
      };

      await engine.hotSwapModule('swappable-module', newSpec);

      const swappedModule = engine.getModule('swappable-module');
      expect(swappedModule.getValue()).toBe('new-value');
      expect(swappedModule.version).toBe('2.0.0');
    });

    it('should emit hot swap events', async () => {
      const hotSwappingHandler = jest.fn();
      const hotSwappedHandler = jest.fn();

      engine.on('module:hot-swapping', hotSwappingHandler);
      engine.on('module:hot-swapped', hotSwappedHandler);

      // Load and swap module
      const initialSpec = {
        id: 'event-swap-module',
        name: 'Event Swap Module',
        version: '1.0.0',
        factory: () => ({ initialize: jest.fn() })
      };

      await engine.loadModule(initialSpec);

      const newSpec = { ...initialSpec, version: '2.0.0' };
      await engine.hotSwapModule('event-swap-module', newSpec);

      expect(hotSwappingHandler).toHaveBeenCalled();
      expect(hotSwappedHandler).toHaveBeenCalled();
    });

    it('should throw error when hot swap is disabled', async () => {
      const engineWithoutSwap = new ModularEngine({ enableHotSwap: false });
      await engineWithoutSwap.initialize();

      const moduleSpec = {
        id: 'no-swap-module',
        name: 'No Swap Module',
        version: '1.0.0',
        factory: () => ({ initialize: jest.fn() })
      };

      await engineWithoutSwap.loadModule(moduleSpec);

      await expect(
        engineWithoutSwap.hotSwapModule('no-swap-module', { ...moduleSpec, version: '2.0.0' })
      ).rejects.toThrow('Hot swapping is disabled');

      await engineWithoutSwap.shutdown();
    });
  });

  describe('Module Unloading', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should unload a module successfully', async () => {
      const moduleSpec = {
        id: 'unloadable-module',
        name: 'Unloadable Module',
        version: '1.0.0',
        factory: () => ({ 
          initialize: jest.fn(),
          cleanup: jest.fn()
        })
      };

      const module = await engine.loadModule(moduleSpec);
      expect(engine.modules.has('unloadable-module')).toBe(true);

      await engine.unloadModule('unloadable-module');

      expect(engine.modules.has('unloadable-module')).toBe(false);
      expect(module.cleanup).toHaveBeenCalled();
    });

    it('should prevent unloading module with dependents', async () => {
      // Load dependency
      const depSpec = {
        id: 'dependency-module',
        name: 'Dependency Module',
        version: '1.0.0',
        factory: () => ({ initialize: jest.fn() })
      };
      await engine.loadModule(depSpec);

      // Load dependent module
      const dependentSpec = {
        id: 'dependent-module',
        name: 'Dependent Module',
        version: '1.0.0',
        dependencies: [depSpec],
        factory: () => ({ initialize: jest.fn() })
      };
      await engine.loadModule(dependentSpec);

      // Try to unload dependency
      await expect(engine.unloadModule('dependency-module'))
        .rejects.toThrow('Cannot unload module dependency-module: has dependents dependent-module');
    });

    it('should emit unloading events', async () => {
      const unloadingHandler = jest.fn();
      const unloadedHandler = jest.fn();

      engine.on('module:unloading', unloadingHandler);
      engine.on('module:unloaded', unloadedHandler);

      const moduleSpec = {
        id: 'event-unload-module',
        name: 'Event Unload Module',
        version: '1.0.0',
        factory: () => ({ initialize: jest.fn() })
      };

      await engine.loadModule(moduleSpec);
      await engine.unloadModule('event-unload-module');

      expect(unloadingHandler).toHaveBeenCalledWith({ moduleId: 'event-unload-module' });
      expect(unloadedHandler).toHaveBeenCalledWith({ moduleId: 'event-unload-module' });
    });
  });

  describe('Module Health Checking', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should check module health', async () => {
      const moduleSpec = {
        id: 'health-module',
        name: 'Health Module',
        version: '1.0.0',
        factory: () => ({
          initialize: jest.fn(),
          checkHealth: jest.fn().mockResolvedValue({ status: 'healthy', uptime: 1000 })
        })
      };

      await engine.loadModule(moduleSpec);
      const health = await engine.checkModuleHealth('health-module');

      expect(health.status).toBe('healthy');
      expect(health.id).toBe('health-module');
      expect(health.uptime).toBeGreaterThan(0);
    });

    it('should handle module health check errors', async () => {
      const moduleSpec = {
        id: 'unhealthy-module',
        name: 'Unhealthy Module',
        version: '1.0.0',
        factory: () => ({
          initialize: jest.fn(),
          checkHealth: jest.fn().mockRejectedValue(new Error('Health check failed'))
        })
      };

      await engine.loadModule(moduleSpec);
      const health = await engine.checkModuleHealth('unhealthy-module');

      expect(health.status).toBe('unhealthy');
      expect(health.error).toBe('Health check failed');
    });

    it('should return not-found for non-existent module', async () => {
      const health = await engine.checkModuleHealth('non-existent');
      expect(health.status).toBe('not-found');
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should track module loading metrics', async () => {
      const initialMetrics = engine.getMetrics();
      expect(initialMetrics.modulesLoaded).toBe(0);

      const moduleSpec = {
        id: 'metrics-module',
        name: 'Metrics Module',
        version: '1.0.0',
        factory: () => ({ initialize: jest.fn() })
      };

      await engine.loadModule(moduleSpec);

      const updatedMetrics = engine.getMetrics();
      expect(updatedMetrics.modulesLoaded).toBe(1);
      expect(updatedMetrics.modulesActive).toBe(1);
    });

    it('should track hot swap metrics', async () => {
      const moduleSpec = {
        id: 'swap-metrics-module',
        name: 'Swap Metrics Module',
        version: '1.0.0',
        factory: () => ({ initialize: jest.fn() })
      };

      await engine.loadModule(moduleSpec);
      const initialMetrics = engine.getMetrics();

      await engine.hotSwapModule('swap-metrics-module', { ...moduleSpec, version: '2.0.0' });

      const updatedMetrics = engine.getMetrics();
      expect(updatedMetrics.hotSwapsPerformed).toBe(initialMetrics.hotSwapsPerformed + 1);
    });
  });

  describe('Shutdown', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should shutdown gracefully', async () => {
      const shutdownHandler = jest.fn();
      engine.on('engine:shutdown', shutdownHandler);

      // Load some modules
      await engine.loadModule({
        id: 'shutdown-module-1',
        name: 'Shutdown Module 1',
        version: '1.0.0',
        factory: () => ({ initialize: jest.fn(), cleanup: jest.fn() })
      });

      await engine.loadModule({
        id: 'shutdown-module-2',
        name: 'Shutdown Module 2',
        version: '1.0.0',
        factory: () => ({ initialize: jest.fn(), cleanup: jest.fn() })
      });

      await engine.shutdown();

      expect(shutdownHandler).toHaveBeenCalled();
      expect(engine.modules.size).toBe(0);
      expect(engine.isShuttingDown).toBe(true);
    });

    it('should handle shutdown errors gracefully', async () => {
      const shutdownErrorHandler = jest.fn();
      engine.on('module:shutdown-error', shutdownErrorHandler);

      // Load module that throws error on cleanup
      await engine.loadModule({
        id: 'error-shutdown-module',
        name: 'Error Shutdown Module',
        version: '1.0.0',
        factory: () => ({
          initialize: jest.fn(),
          cleanup: jest.fn().mockRejectedValue(new Error('Cleanup error'))
        })
      });

      await engine.shutdown();

      expect(shutdownErrorHandler).toHaveBeenCalled();
    });
  });

  describe('Module Listing', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should list loaded modules', async () => {
      const moduleSpec1 = {
        id: 'list-module-1',
        name: 'List Module 1',
        version: '1.0.0',
        factory: () => ({ initialize: jest.fn() })
      };

      const moduleSpec2 = {
        id: 'list-module-2',
        name: 'List Module 2',
        version: '2.0.0',
        factory: () => ({ initialize: jest.fn() })
      };

      await engine.loadModule(moduleSpec1);
      await engine.loadModule(moduleSpec2);

      const modules = engine.listModules();

      expect(modules).toHaveLength(2);
      expect(modules[0].id).toBe('list-module-1');
      expect(modules[1].id).toBe('list-module-2');
      expect(modules[0].instance).toBeDefined();
    });

    it('should return empty list when no modules loaded', async () => {
      const modules = engine.listModules();
      expect(modules).toHaveLength(0);
    });
  });
});