/**
 * Module Communication Bridge - Inter-module communication system
 * Provides message passing, event routing, and data sharing between modules
 */

import EventEmitter from 'events';

export class ModuleBridge extends EventEmitter {
  constructor(engine) {
    super();
    this.engine = engine;
    this.channels = new Map();
    this.subscriptions = new Map();
    this.messageQueue = new Map();
    this.middleware = [];
    this.filters = new Map();
    this.routers = new Map();
    
    this.config = {
      enablePersistence: false,
      maxMessageQueue: 1000,
      messageTimeout: 30000,
      enableCompression: false,
      enableEncryption: false,
      enableMetrics: true,
      defaultChannel: 'global'
    };

    this.messageTypes = {
      BROADCAST: 'broadcast',
      DIRECT: 'direct',
      REQUEST: 'request',
      RESPONSE: 'response',
      EVENT: 'event'
    };

    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      messagesDropped: 0,
      channelsCreated: 0,
      subscriptionsCreated: 0,
      requestsHandled: 0,
      responsesReturned: 0
    };

    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      throw new Error('ModuleBridge already initialized');
    }

    this.emit('bridge:initializing');

    // Create default global channel
    this.createChannel(this.config.defaultChannel);

    // Setup built-in message handlers
    this.setupBuiltinHandlers();

    // Setup message persistence if enabled
    if (this.config.enablePersistence) {
      await this.setupPersistence();
    }

    this.isInitialized = true;
    this.emit('bridge:initialized');
  }

  /**
   * Create a communication channel
   */
  createChannel(channelName, options = {}) {
    if (this.channels.has(channelName)) {
      throw new Error(`Channel '${channelName}' already exists`);
    }

    const channel = {
      name: channelName,
      subscribers: new Set(),
      messageQueue: [],
      persistent: options.persistent || false,
      encrypted: options.encrypted || false,
      compressed: options.compressed || false,
      maxSubscribers: options.maxSubscribers || 1000,
      messageHistory: options.keepHistory ? [] : null,
      created: Date.now()
    };

    this.channels.set(channelName, channel);
    this.messageQueue.set(channelName, []);
    this.metrics.channelsCreated++;

    this.emit('channel:created', { channelName, options });
    return channel;
  }

  /**
   * Subscribe to a channel
   */
  subscribe(moduleId, channelName, handler, options = {}) {
    // Create channel if it doesn't exist
    if (!this.channels.has(channelName)) {
      this.createChannel(channelName);
    }

    const channel = this.channels.get(channelName);
    
    // Check subscriber limits
    if (channel.subscribers.size >= channel.maxSubscribers) {
      throw new Error(`Channel '${channelName}' subscriber limit reached`);
    }

    const subscription = {
      moduleId,
      channelName,
      handler: this.wrapHandler(handler, moduleId, channelName),
      options,
      subscribed: Date.now()
    };

    // Store subscription
    if (!this.subscriptions.has(moduleId)) {
      this.subscriptions.set(moduleId, new Map());
    }
    this.subscriptions.get(moduleId).set(channelName, subscription);

    // Add to channel
    channel.subscribers.add(subscription);
    this.metrics.subscriptionsCreated++;

    this.emit('subscription:created', { moduleId, channelName });

    // Deliver queued messages if any
    this.deliverQueuedMessages(moduleId, channelName);

    return subscription;
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(moduleId, channelName) {
    const moduleSubscriptions = this.subscriptions.get(moduleId);
    
    if (!moduleSubscriptions || !moduleSubscriptions.has(channelName)) {
      return false;
    }

    const subscription = moduleSubscriptions.get(channelName);
    const channel = this.channels.get(channelName);

    if (channel) {
      channel.subscribers.delete(subscription);
    }

    moduleSubscriptions.delete(channelName);
    
    if (moduleSubscriptions.size === 0) {
      this.subscriptions.delete(moduleId);
    }

    this.emit('subscription:removed', { moduleId, channelName });
    return true;
  }

  /**
   * Send message to a channel
   */
  async sendMessage(fromModuleId, channelName, message, type = this.messageTypes.BROADCAST, options = {}) {
    if (!this.isInitialized) {
      throw new Error('ModuleBridge not initialized');
    }

    const messageObj = {
      id: this.generateMessageId(),
      from: fromModuleId,
      to: options.to || null,
      channel: channelName,
      type,
      payload: message,
      timestamp: Date.now(),
      ttl: options.ttl || this.config.messageTimeout,
      priority: options.priority || 'normal',
      metadata: options.metadata || {}
    };

    try {
      this.emit('message:sending', messageObj);

      // Apply middleware
      const processedMessage = await this.applyMiddleware(messageObj, 'outgoing');

      // Route message
      await this.routeMessage(processedMessage);

      this.metrics.messagesSent++;
      this.emit('message:sent', processedMessage);

      return processedMessage.id;

    } catch (error) {
      this.metrics.messagesDropped++;
      this.emit('message:send-error', { messageObj, error });
      throw error;
    }
  }

  /**
   * Send direct message to specific module
   */
  async sendDirectMessage(fromModuleId, toModuleId, message, options = {}) {
    const directChannel = `direct:${toModuleId}`;
    
    // Create direct channel if not exists
    if (!this.channels.has(directChannel)) {
      this.createChannel(directChannel, { persistent: false });
    }

    return this.sendMessage(
      fromModuleId,
      directChannel,
      message,
      this.messageTypes.DIRECT,
      { ...options, to: toModuleId }
    );
  }

  /**
   * Send request and wait for response
   */
  async sendRequest(fromModuleId, channelName, request, timeout = 10000) {
    const requestId = this.generateMessageId();
    const responseChannel = `response:${requestId}`;

    // Create temporary response channel
    this.createChannel(responseChannel, { persistent: false });

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.channels.delete(responseChannel);
        reject(new Error(`Request timeout: ${requestId}`));
      }, timeout);

      // Subscribe to response
      this.subscribe('__system__', responseChannel, (response) => {
        clearTimeout(timeoutId);
        this.channels.delete(responseChannel);
        
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.payload);
        }
      });

      // Send request
      this.sendMessage(
        fromModuleId,
        channelName,
        request,
        this.messageTypes.REQUEST,
        { 
          requestId,
          responseChannel,
          metadata: { expectsResponse: true }
        }
      ).catch(reject);
    });
  }

  /**
   * Send response to a request
   */
  async sendResponse(toRequestId, response, error = null) {
    const responseChannel = `response:${toRequestId}`;
    
    if (!this.channels.has(responseChannel)) {
      throw new Error(`Response channel not found: ${toRequestId}`);
    }

    const responseObj = {
      requestId: toRequestId,
      payload: response,
      error: error ? error.message : null,
      timestamp: Date.now()
    };

    await this.sendMessage(
      '__system__',
      responseChannel,
      responseObj,
      this.messageTypes.RESPONSE
    );

    this.metrics.responsesReturned++;
  }

  /**
   * Add middleware for message processing
   */
  use(middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }

    this.middleware.push(middleware);
    this.emit('middleware:added');
  }

  /**
   * Add message filter
   */
  addFilter(channelName, filterFn) {
    if (!this.filters.has(channelName)) {
      this.filters.set(channelName, []);
    }

    this.filters.get(channelName).push(filterFn);
    this.emit('filter:added', { channelName });
  }

  /**
   * Add message router
   */
  addRouter(pattern, routerFn) {
    this.routers.set(pattern, routerFn);
    this.emit('router:added', { pattern });
  }

  /**
   * Get channel information
   */
  getChannelInfo(channelName) {
    const channel = this.channels.get(channelName);
    
    if (!channel) {
      return null;
    }

    return {
      name: channel.name,
      subscriberCount: channel.subscribers.size,
      messageQueueLength: this.messageQueue.get(channelName)?.length || 0,
      persistent: channel.persistent,
      encrypted: channel.encrypted,
      created: channel.created,
      messageHistory: channel.messageHistory?.length || 0
    };
  }

  /**
   * List all channels
   */
  listChannels() {
    return Array.from(this.channels.keys()).map(name => this.getChannelInfo(name));
  }

  /**
   * Get module subscriptions
   */
  getModuleSubscriptions(moduleId) {
    const subscriptions = this.subscriptions.get(moduleId);
    
    if (!subscriptions) {
      return [];
    }

    return Array.from(subscriptions.entries()).map(([channel, sub]) => ({
      channel,
      subscribed: sub.subscribed,
      options: sub.options
    }));
  }

  /**
   * Get bridge metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      channelsActive: this.channels.size,
      subscriptionsActive: Array.from(this.subscriptions.values())
        .reduce((sum, subs) => sum + subs.size, 0),
      queuedMessages: Array.from(this.messageQueue.values())
        .reduce((sum, queue) => sum + queue.length, 0),
      middlewareCount: this.middleware.length,
      filtersCount: Array.from(this.filters.values())
        .reduce((sum, filters) => sum + filters.length, 0),
      routersCount: this.routers.size
    };
  }

  async shutdown() {
    this.emit('bridge:shutting-down');

    // Clear all subscriptions
    this.subscriptions.clear();

    // Clear all channels
    this.channels.clear();

    // Clear message queues
    this.messageQueue.clear();

    // Clear middleware and filters
    this.middleware.length = 0;
    this.filters.clear();
    this.routers.clear();

    this.emit('bridge:shutdown');
  }

  // Private methods

  wrapHandler(handler, moduleId, channelName) {
    return async (message) => {
      try {
        this.metrics.messagesReceived++;
        this.emit('message:received', { moduleId, channelName, message });

        // Apply security checks
        if (await this.checkMessageSecurity(message, moduleId)) {
          await handler(message);
        } else {
          this.metrics.messagesDropped++;
          this.emit('message:security-blocked', { moduleId, channelName, message });
        }

      } catch (error) {
        this.emit('message:handler-error', { moduleId, channelName, error });
      }
    };
  }

  async routeMessage(message) {
    const channel = this.channels.get(message.channel);
    
    if (!channel) {
      if (message.type !== this.messageTypes.DIRECT) {
        // Queue message for when channel is created
        this.queueMessage(message);
        return;
      } else {
        throw new Error(`Channel '${message.channel}' not found`);
      }
    }

    // Apply channel filters
    if (!(await this.applyFilters(message))) {
      this.metrics.messagesDropped++;
      return;
    }

    // Handle different message types
    switch (message.type) {
      case this.messageTypes.BROADCAST:
        await this.deliverBroadcast(channel, message);
        break;

      case this.messageTypes.DIRECT:
        await this.deliverDirect(channel, message);
        break;

      case this.messageTypes.REQUEST:
        await this.deliverRequest(channel, message);
        break;

      case this.messageTypes.RESPONSE:
        await this.deliverResponse(channel, message);
        break;

      case this.messageTypes.EVENT:
        await this.deliverEvent(channel, message);
        break;

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }

    // Store in message history if enabled
    if (channel.messageHistory) {
      channel.messageHistory.push(message);
      
      // Limit history size
      if (channel.messageHistory.length > 1000) {
        channel.messageHistory.shift();
      }
    }
  }

  async deliverBroadcast(channel, message) {
    const deliveryPromises = [];
    
    for (const subscription of channel.subscribers) {
      deliveryPromises.push(this.deliverToSubscriber(subscription, message));
    }

    await Promise.allSettled(deliveryPromises);
  }

  async deliverDirect(channel, message) {
    // Find target subscriber
    const targetSubscription = Array.from(channel.subscribers)
      .find(sub => sub.moduleId === message.to);

    if (targetSubscription) {
      await this.deliverToSubscriber(targetSubscription, message);
    } else {
      // Queue for later delivery
      this.queueMessage(message);
    }
  }

  async deliverRequest(channel, message) {
    this.metrics.requestsHandled++;
    
    // Broadcast request to all subscribers
    await this.deliverBroadcast(channel, message);
  }

  async deliverResponse(channel, message) {
    // Response should only go to specific handler
    await this.deliverBroadcast(channel, message);
  }

  async deliverEvent(channel, message) {
    // Events are broadcast to all interested subscribers
    await this.deliverBroadcast(channel, message);
  }

  async deliverToSubscriber(subscription, message) {
    try {
      await subscription.handler(message);
    } catch (error) {
      this.emit('delivery:error', { subscription, message, error });
    }
  }

  async applyMiddleware(message, direction) {
    let processedMessage = { ...message };

    for (const middleware of this.middleware) {
      try {
        const result = await middleware(processedMessage, direction);
        if (result) {
          processedMessage = result;
        }
      } catch (error) {
        this.emit('middleware:error', { middleware, error });
        throw error;
      }
    }

    return processedMessage;
  }

  async applyFilters(message) {
    const filters = this.filters.get(message.channel) || [];

    for (const filter of filters) {
      try {
        if (!(await filter(message))) {
          return false;
        }
      } catch (error) {
        this.emit('filter:error', { filter, message, error });
        return false;
      }
    }

    return true;
  }

  queueMessage(message) {
    const queue = this.messageQueue.get(message.channel) || [];
    
    if (queue.length >= this.config.maxMessageQueue) {
      queue.shift(); // Remove oldest message
    }
    
    queue.push(message);
    this.messageQueue.set(message.channel, queue);
  }

  deliverQueuedMessages(moduleId, channelName) {
    const queue = this.messageQueue.get(channelName) || [];
    const subscription = this.subscriptions.get(moduleId)?.get(channelName);

    if (subscription && queue.length > 0) {
      // Deliver queued messages
      queue.forEach(message => {
        this.deliverToSubscriber(subscription, message);
      });

      // Clear queue
      this.messageQueue.set(channelName, []);
    }
  }

  async checkMessageSecurity(message, receiverModuleId) {
    // Basic security check - can be extended
    if (message.from === receiverModuleId) {
      return true; // Allow self-messages
    }

    // Check if sender module exists and is trusted
    const senderModule = this.engine.getModule(message.from);
    const receiverModule = this.engine.getModule(receiverModuleId);

    if (!senderModule || !receiverModule) {
      return false;
    }

    // Additional security checks can be added here
    return true;
  }

  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setupBuiltinHandlers() {
    // System ping handler
    this.subscribe('__system__', 'system:ping', (message) => {
      this.sendMessage('__system__', message.channel, {
        type: 'pong',
        originalMessage: message.id,
        timestamp: Date.now()
      });
    });

    // Module discovery handler
    this.subscribe('__system__', 'system:discover', (message) => {
      const modules = this.engine.listModules();
      this.sendResponse(message.metadata?.requestId, modules);
    });
  }

  async setupPersistence() {
    // Simplified persistence setup
    this.emit('bridge:persistence-initialized');
  }
}

export default ModuleBridge;