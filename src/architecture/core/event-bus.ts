/**
 * Inter-Module Communication and Event System - SPARC Phase 2 Pseudocode
 * 
 * PSEUDOCODE ALGORITHMS:
 * 1. Event Registration: plugins.register(event_pattern) → subscription_id
 * 2. Event Emission: event_bus.emit(event_type, payload) → dispatch_to_subscribers
 * 3. Message Routing: route_message(source, target, message) → secure_delivery
 * 4. Event Filtering: filter_events(subscription, criteria) → filtered_stream
 * 5. Priority Handling: priority_queue.process(events) → ordered_execution
 * 6. Dead Letter Queue: failed_events → retry_mechanism → eventual_consistency
 * 7. Event Persistence: store_event(event) → replay_capability
 * 8. Circuit Breaker: monitor_subscriber_health → fail_fast_pattern
 */

export interface IEventBus {
  // Core event operations
  emit<T = any>(event: string, data: T, options?: EmitOptions): Promise<void>;
  subscribe<T = any>(event: string, handler: EventHandler<T>, options?: SubscriptionOptions): string;
  unsubscribe(subscriptionId: string): void;
  
  // Pattern-based subscriptions
  subscribePattern<T = any>(pattern: string, handler: EventHandler<T>): string;
  subscribeWildcard<T = any>(wildcard: string, handler: EventHandler<T>): string;
  
  // Message routing
  sendMessage<T = any>(targetPluginId: string, message: T): Promise<void>;
  broadcast<T = any>(message: T, filter?: BroadcastFilter): Promise<void>;
  
  // Event streams
  createStream(filter: EventFilter): IEventStream;
  pipe(sourceEvent: string, targetEvent: string, transform?: EventTransform): void;
  
  // Middleware support
  use(middleware: EventMiddleware): void;
  
  // Management operations
  clear(): void;
  getSubscriptions(): SubscriptionInfo[];
  getMetrics(): EventMetrics;
}

export interface EventHandler<T = any> {
  (event: EventData<T>): void | Promise<void>;
}

export interface EventData<T = any> {
  id: string;
  type: string;
  data: T;
  source: string;
  timestamp: Date;
  correlationId?: string;
  metadata: EventMetadata;
}

export interface EventMetadata {
  priority: EventPriority;
  ttl?: number;
  retry?: RetryPolicy;
  persistent?: boolean;
  encrypted?: boolean;
  compressed?: boolean;
}

export enum EventPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: BackoffStrategy;
  backoffMultiplier: number;
  maxDelay: number;
}

export enum BackoffStrategy {
  FIXED = 'fixed',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  RANDOM = 'random'
}

export interface EmitOptions {
  priority?: EventPriority;
  ttl?: number;
  persistent?: boolean;
  skipSelf?: boolean;
  targetPlugins?: string[];
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface SubscriptionOptions {
  priority?: number;
  filter?: EventFilter;
  once?: boolean;
  debounce?: number;
  throttle?: number;
  maxEvents?: number;
}

export interface BroadcastFilter {
  includePlugins?: string[];
  excludePlugins?: string[];
  tags?: string[];
  permissions?: string[];
}

export interface EventFilter {
  type?: string | RegExp;
  source?: string | string[];
  priority?: EventPriority | EventPriority[];
  metadata?: Record<string, any>;
  custom?: (event: EventData) => boolean;
}

export interface EventTransform {
  (event: EventData): EventData | null;
}

export interface EventMiddleware {
  (event: EventData, next: () => void): void | Promise<void>;
}

export interface IEventStream {
  filter(predicate: EventFilter): IEventStream;
  map<T>(mapper: (event: EventData) => T): IEventStream;
  debounce(delay: number): IEventStream;
  throttle(delay: number): IEventStream;
  take(count: number): IEventStream;
  takeWhile(predicate: (event: EventData) => boolean): IEventStream;
  subscribe(handler: EventHandler): string;
  close(): void;
}

export interface SubscriptionInfo {
  id: string;
  pluginId: string;
  pattern: string;
  options: SubscriptionOptions;
  createdAt: Date;
  lastTriggered?: Date;
  eventCount: number;
}

export interface EventMetrics {
  totalEvents: number;
  eventsPerSecond: number;
  averageLatency: number;
  subscriptionsCount: number;
  failedEvents: number;
  retriedEvents: number;
  deadLetterCount: number;
}

/*
PSEUDOCODE IMPLEMENTATION ALGORITHMS:

1. EVENT REGISTRATION ALGORITHM:
   function subscribe(event_pattern, handler, options):
     subscription = create_subscription(event_pattern, handler, options)
     validate_permissions(current_plugin, event_pattern)
     add_to_subscription_registry(subscription)
     return subscription.id

2. EVENT EMISSION ALGORITHM:
   function emit(event_type, data, options):
     event = create_event(event_type, data, options)
     validate_event(event)
     matching_subscriptions = find_matching_subscriptions(event_type)
     for subscription in matching_subscriptions:
       if passes_filter(event, subscription.filter):
         enqueue_event(event, subscription)
     process_event_queue()

3. MESSAGE ROUTING ALGORITHM:
   function route_message(source, target, message):
     validate_permissions(source, target)
     if target_available(target):
       create_secure_channel(source, target)
       encrypt_message(message)
       deliver_message(target, message)
     else:
       queue_message_for_retry(message, target)

4. PRIORITY PROCESSING ALGORITHM:
   function process_event_queue():
     while queue_not_empty():
       event = dequeue_highest_priority_event()
       try:
         execute_event_handlers(event)
       catch error:
         handle_event_failure(event, error)

5. CIRCUIT BREAKER ALGORITHM:
   function monitor_subscriber_health():
     for subscription in active_subscriptions:
       if failure_rate(subscription) > threshold:
         open_circuit(subscription)
       elif recovery_time_elapsed(subscription):
         half_open_circuit(subscription)
*/