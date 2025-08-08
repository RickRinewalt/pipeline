/**
 * Unit tests for ServiceContainer - Dependency injection system
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ServiceContainer } from '../../src/architecture/ServiceContainer.js';

describe('ServiceContainer', () => {
  let container;
  let mockEngine;

  beforeEach(async () => {
    mockEngine = { test: 'engine' };
    container = new ServiceContainer(mockEngine);
    await container.initialize();
  });

  afterEach(async () => {
    await container.dispose();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(container.isInitialized).toBe(true);
      expect(container.has('container')).toBe(true);
      expect(container.has('engine')).toBe(true);
    });

    it('should throw error on double initialization', async () => {
      const newContainer = new ServiceContainer(mockEngine);
      await newContainer.initialize();
      
      await expect(newContainer.initialize()).rejects.toThrow('ServiceContainer already initialized');
      
      await newContainer.dispose();
    });
  });

  describe('Singleton Services', () => {
    it('should register and resolve singleton service', async () => {
      const factory = jest.fn(() => ({ value: 42 }));
      
      container.registerSingleton('testService', factory);
      
      const service1 = await container.resolve('testService');
      const service2 = await container.resolve('testService');
      
      expect(service1).toBe(service2); // Same instance
      expect(service1.value).toBe(42);
      expect(factory).toHaveBeenCalledTimes(1); // Factory called only once
    });

    it('should resolve singleton dependencies', async () => {
      container.registerSingleton('dependency', () => ({ dep: true }));
      container.registerSingleton('service', (dep) => ({ 
        dependency: dep,
        getValue: () => dep.dep 
      }), ['dependency']);
      
      const service = await container.resolve('service');
      
      expect(service.getValue()).toBe(true);
      expect(service.dependency.dep).toBe(true);
    });

    it('should emit singleton creation events', async () => {
      const createdHandler = jest.fn();
      container.on('service:singleton-created', createdHandler);
      
      container.registerSingleton('eventService', () => ({ test: true }));
      await container.resolve('eventService');
      
      expect(createdHandler).toHaveBeenCalledWith({ name: 'eventService' });
    });
  });

  describe('Transient Services', () => {
    it('should register and resolve transient service', async () => {
      const factory = jest.fn(() => ({ value: Math.random() }));
      
      container.registerTransient('transientService', factory);
      
      const service1 = await container.resolve('transientService');
      const service2 = await container.resolve('transientService');
      
      expect(service1).not.toBe(service2); // Different instances
      expect(service1.value).not.toBe(service2.value);
      expect(factory).toHaveBeenCalledTimes(2); // Factory called twice
    });

    it('should resolve transient dependencies each time', async () => {
      let counter = 0;
      container.registerTransient('counter', () => ({ value: ++counter }));
      container.registerTransient('service', (counter) => ({ 
        counter: counter.value 
      }), ['counter']);
      
      const service1 = await container.resolve('service');
      const service2 = await container.resolve('service');
      
      expect(service1.counter).toBe(1);
      expect(service2.counter).toBe(2);
    });

    it('should emit transient creation events', async () => {
      const createdHandler = jest.fn();
      container.on('service:transient-created', createdHandler);
      
      container.registerTransient('eventTransient', () => ({ test: true }));
      await container.resolve('eventTransient');
      
      expect(createdHandler).toHaveBeenCalledWith({ name: 'eventTransient' });
    });
  });

  describe('Factory Services', () => {
    it('should register and resolve factory service', async () => {
      const factoryFn = jest.fn(() => ({ create: () => ({ instance: true }) }));
      
      container.registerFactory('factoryService', factoryFn);
      
      const factory = await container.resolve('factoryService');
      const instance = factory.create();
      
      expect(instance.instance).toBe(true);
      expect(factoryFn).toHaveBeenCalledTimes(1);
    });

    it('should emit factory creation events', async () => {
      const createdHandler = jest.fn();
      container.on('service:factory-created', createdHandler);
      
      container.registerFactory('eventFactory', () => ({}));
      await container.resolve('eventFactory');
      
      expect(createdHandler).toHaveBeenCalledWith({ name: 'eventFactory' });
    });
  });

  describe('Instance Registration', () => {
    it('should register existing instance', async () => {
      const instance = { existing: true };
      
      container.register('existingService', instance);
      
      const resolved = await container.resolve('existingService');
      expect(resolved).toBe(instance);
    });
  });

  describe('Service Resolution', () => {
    it('should throw error for unregistered service', async () => {
      await expect(container.resolve('nonExistent'))
        .rejects.toThrow("Service 'nonExistent' not registered");
    });

    it('should detect circular dependencies', async () => {
      container.registerSingleton('serviceA', (serviceB) => ({ b: serviceB }), ['serviceB']);
      container.registerSingleton('serviceB', (serviceA) => ({ a: serviceA }), ['serviceA']);
      
      await expect(container.resolve('serviceA'))
        .rejects.toThrow('Circular dependency detected for service');
    });

    it('should resolve multiple services', async () => {
      container.registerSingleton('service1', () => ({ id: 1 }));
      container.registerSingleton('service2', () => ({ id: 2 }));
      
      const services = await container.resolveAll(['service1', 'service2']);
      
      expect(services.service1.id).toBe(1);
      expect(services.service2.id).toBe(2);
    });

    it('should handle async factory functions', async () => {
      const asyncFactory = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { async: true };
      });
      
      container.registerSingleton('asyncService', asyncFactory);
      
      const service = await container.resolve('asyncService');
      expect(service.async).toBe(true);
      expect(asyncFactory).toHaveBeenCalledTimes(1);
    });
  });

  describe('Service Information', () => {
    it('should check if service exists', () => {
      container.registerSingleton('existingService', () => ({}));
      
      expect(container.has('existingService')).toBe(true);
      expect(container.has('nonExistentService')).toBe(false);
    });

    it('should get service definition', () => {
      container.registerTransient('defService', () => ({}), ['dependency']);
      
      const definition = container.getDefinition('defService');
      
      expect(definition.type).toBe('transient');
      expect(definition.dependencies).toEqual(['dependency']);
    });

    it('should list all services', async () => {
      container.registerSingleton('singleton', () => ({}));
      container.registerTransient('transient', () => ({}));
      
      const services = container.listServices();
      
      expect(services).toHaveLength(4); // 2 registered + 2 built-in
      expect(services.find(s => s.name === 'singleton').type).toBe('singleton');
      expect(services.find(s => s.name === 'transient').type).toBe('transient');
    });
  });

  describe('Service Interceptors', () => {
    it('should add and apply interceptors', async () => {
      const interceptor = jest.fn((service) => {
        service.intercepted = true;
        return service;
      });
      
      container.registerSingleton('interceptedService', () => ({ original: true }));
      container.addInterceptor('interceptedService', interceptor);
      
      const service = await container.resolve('interceptedService');
      
      expect(service.intercepted).toBe(true);
      expect(service.original).toBe(true);
      expect(interceptor).toHaveBeenCalled();
    });

    it('should apply multiple interceptors in order', async () => {
      const interceptor1 = (service) => {
        service.order = (service.order || []);
        service.order.push('first');
        return service;
      };
      
      const interceptor2 = (service) => {
        service.order = (service.order || []);
        service.order.push('second');
        return service;
      };
      
      container.registerSingleton('multiIntercepted', () => ({}));
      container.addInterceptor('multiIntercepted', interceptor1);
      container.addInterceptor('multiIntercepted', interceptor2);
      
      const service = await container.resolve('multiIntercepted');
      
      expect(service.order).toEqual(['first', 'second']);
    });
  });

  describe('Child Containers', () => {
    it('should create child container with inherited services', () => {
      container.registerSingleton('parentService', () => ({ parent: true }));
      
      const child = container.createChild();
      
      expect(child.has('parentService')).toBe(true);
      expect(child.parent).toBe(container);
    });

    it('should override parent services in child', async () => {
      container.registerSingleton('overrideable', () => ({ source: 'parent' }));
      
      const child = container.createChild();
      child.registerSingleton('overrideable', () => ({ source: 'child' }));
      
      const parentService = await container.resolve('overrideable');
      const childService = await child.resolve('overrideable');
      
      expect(parentService.source).toBe('parent');
      expect(childService.source).toBe('child');
    });
  });

  describe('Service Disposal', () => {
    it('should dispose singleton services with dispose method', async () => {
      const disposeMock = jest.fn();
      
      container.registerSingleton('disposableService', () => ({
        dispose: disposeMock
      }));
      
      await container.resolve('disposableService');
      await container.dispose();
      
      expect(disposeMock).toHaveBeenCalled();
    });

    it('should handle dispose errors gracefully', async () => {
      const errorHandler = jest.fn();
      container.on('service:dispose-error', errorHandler);
      
      container.registerSingleton('errorService', () => ({
        dispose: () => { throw new Error('Dispose error'); }
      }));
      
      await container.resolve('errorService');
      await container.dispose();
      
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Service Metrics', () => {
    it('should track service registration metrics', async () => {
      const initialMetrics = container.getMetrics();
      
      container.registerSingleton('metricService1', () => ({}));
      container.registerTransient('metricService2', () => ({}));
      
      const metrics = container.getMetrics();
      
      expect(metrics.servicesRegistered).toBe(initialMetrics.servicesRegistered + 2);
    });

    it('should track singleton creation metrics', async () => {
      const initialMetrics = container.getMetrics();
      
      container.registerSingleton('singletonMetric', () => ({}));
      await container.resolve('singletonMetric');
      
      const metrics = container.getMetrics();
      
      expect(metrics.singletonsCreated).toBe(initialMetrics.singletonsCreated + 1);
    });

    it('should track transient instance metrics', async () => {
      const initialMetrics = container.getMetrics();
      
      container.registerTransient('transientMetric', () => ({}));
      await container.resolve('transientMetric');
      await container.resolve('transientMetric');
      
      const metrics = container.getMetrics();
      
      expect(metrics.transientInstancesCreated).toBe(initialMetrics.transientInstancesCreated + 2);
    });
  });

  describe('Error Handling', () => {
    it('should handle factory errors', async () => {
      const errorHandler = jest.fn();
      container.on('service:factory-error', errorHandler);
      
      container.registerSingleton('errorService', () => {
        throw new Error('Factory error');
      });
      
      await expect(container.resolve('errorService')).rejects.toThrow('Factory error');
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should validate service names', () => {
      expect(() => container.registerSingleton('', () => {}))
        .toThrow('Service name must be a non-empty string');
      
      expect(() => container.registerSingleton(null, () => {}))
        .toThrow('Service name must be a non-empty string');
    });

    it('should prevent duplicate registrations', () => {
      container.registerSingleton('duplicate', () => ({}));
      
      expect(() => container.registerSingleton('duplicate', () => ({})))
        .toThrow("Service 'duplicate' is already registered");
    });
  });
});