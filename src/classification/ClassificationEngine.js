/**
 * YOLO-PRO Issue Classification Engine
 * ML-based issue categorization and labeling system
 * Implements SPARC Phase 4: Refinement with TDD methodology
 */

const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');

class ClassificationEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      confidenceThreshold: config.confidenceThreshold || 0.7,
      batchSize: config.batchSize || 50,
      modelCacheSize: config.modelCacheSize || 10,
      featureCacheTTL: config.featureCacheTTL || 3600000, // 1 hour
      retrainThreshold: config.retrainThreshold || 100, // feedback samples
      maxTrainingTime: config.maxTrainingTime || 300000, // 5 minutes
      ...config
    };

    this.featureExtractor = new TextFeatureExtractor(config.featureConfig);
    this.modelManager = new MLModelManager(config.modelConfig);
    this.predictionProcessor = new PredictionProcessor(config.processingConfig);
    this.learningManager = new LearningManager(config.learningConfig);
    this.performanceMonitor = new PerformanceMonitor(config.monitoringConfig);

    this.featureCache = new Map();
    this.predictionCache = new Map();
    this.feedbackQueue = [];
    
    this.metrics = {
      classificationsPerformed: 0,
      averageConfidence: 0,
      accuracyScore: 0,
      feedbackReceived: 0,
      modelsRetrained: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this._initializeDefaultModels();
  }

  /**
   * Classify single issue with comprehensive analysis
   */
  async classifyIssue(content, metadata = {}, options = {}) {
    try {
      const startTime = Date.now();
      
      // Input validation
      if (!content || typeof content !== 'object') {
        throw new ClassificationError('Issue content is required');
      }

      if (!content.title && !content.body) {
        throw new ClassificationError('Issue title or body is required');
      }

      // Generate content hash for caching
      const contentHash = this._generateContentHash(content, metadata);
      
      // Check prediction cache
      if (options.useCache !== false) {
        const cachedPrediction = this.predictionCache.get(contentHash);
        if (cachedPrediction && Date.now() - cachedPrediction.timestamp < this.config.featureCacheTTL) {
          this.metrics.cacheHits++;
          
          return {
            ...cachedPrediction.result,
            fromCache: true,
            cacheAge: Date.now() - cachedPrediction.timestamp
          };
        }
      }

      this.metrics.cacheMisses++;

      // Feature extraction
      const features = await this._extractFeatures(content, metadata, options);

      // Get active model
      const model = await this.modelManager.getActiveModel();
      if (!model) {
        throw new ClassificationError('No active classification model available');
      }

      // Perform prediction
      const predictions = await this._performPrediction(model, features, options);

      // Post-process predictions
      const processedPredictions = await this.predictionProcessor.process(
        predictions,
        features,
        metadata,
        { confidenceThreshold: this.config.confidenceThreshold }
      );

      // Generate reasoning explanations
      const reasoning = await this._generateReasoning(
        processedPredictions,
        features,
        content
      );

      const result = {
        issueId: metadata.issueId,
        predictions: processedPredictions.map(pred => ({
          label: pred.label,
          confidence: pred.confidence,
          category: pred.category,
          reasoning: reasoning[pred.label] || [],
          metadata: {
            modelVersion: model.version,
            featureImportance: pred.featureImportance
          }
        })),
        overallConfidence: this._calculateOverallConfidence(processedPredictions),
        modelVersion: model.version,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        features: options.includeFeatures ? features : undefined
      };

      // Update metrics
      this.metrics.classificationsPerformed++;
      this.metrics.averageConfidence = 
        (this.metrics.averageConfidence + result.overallConfidence) / 2;

      // Cache result
      if (options.useCache !== false) {
        this._cacheResult(contentHash, result);
      }

      // Emit event
      this.emit('classification:completed', {
        issueId: metadata.issueId,
        predictions: result.predictions.length,
        confidence: result.overallConfidence,
        processingTime: result.processingTime
      });

      return result;

    } catch (error) {
      this.emit('classification:error', {
        error: error.message,
        issueId: metadata?.issueId,
        timestamp: Date.now()
      });

      if (error instanceof ClassificationError) {
        throw error;
      }

      throw new ClassificationError(`Classification failed: ${error.message}`);
    }
  }

  /**
   * Batch classify multiple issues with optimized processing
   */
  async batchClassifyIssues(issues, options = {}) {
    try {
      const {
        concurrency = 10,
        continueOnError = true,
        timeout = 60000
      } = options;

      if (!Array.isArray(issues) || issues.length === 0) {
        throw new ClassificationError('Issues array is required');
      }

      const startTime = Date.now();
      const results = {
        successful: [],
        failed: [],
        summary: {
          total: issues.length,
          processed: 0,
          averageConfidence: 0,
          processingTime: 0
        }
      };

      // Batch feature extraction for efficiency
      const allFeatures = await this._batchExtractFeatures(issues, options);

      // Get active model
      const model = await this.modelManager.getActiveModel();
      if (!model) {
        throw new ClassificationError('No active classification model available');
      }

      // Batch prediction
      const batchPredictions = await this._batchPerformPrediction(
        model,
        allFeatures,
        options
      );

      // Process results in batches
      const batches = this._createBatches(issues, concurrency);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchStartIndex = batchIndex * concurrency;

        const batchPromises = batch.map(async (issue, index) => {
          try {
            const globalIndex = batchStartIndex + index;
            const features = allFeatures[globalIndex];
            const predictions = batchPredictions[globalIndex];

            const result = await this._processBatchResult(
              issue,
              features,
              predictions,
              model,
              options
            );

            return { success: true, issue, result };

          } catch (error) {
            if (continueOnError) {
              return { success: false, issue, error: error.message };
            }
            throw error;
          }
        });

        const batchResults = await Promise.race([
          Promise.all(batchPromises),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Batch timeout')), timeout)
          )
        ]);

        batchResults.forEach(result => {
          results.summary.processed++;

          if (result.success) {
            results.successful.push(result);
            results.summary.averageConfidence += result.result.overallConfidence;
          } else {
            results.failed.push(result);
          }
        });
      }

      // Finalize summary
      results.summary.averageConfidence /= results.successful.length || 1;
      results.summary.processingTime = Date.now() - startTime;

      return {
        success: results.failed.length === 0,
        results
      };

    } catch (error) {
      throw new ClassificationError(`Batch classification failed: ${error.message}`);
    }
  }

  /**
   * Train model with new training data
   */
  async trainModel(trainingDataSet, options = {}) {
    try {
      const startTime = Date.now();

      if (!trainingDataSet || !trainingDataSet.samples) {
        throw new ClassificationError('Training dataset is required');
      }

      // Validate training data
      const validation = this._validateTrainingData(trainingDataSet);
      if (!validation.valid) {
        throw new ClassificationError('Invalid training data', validation.errors);
      }

      // Prepare training data
      const preparedData = await this._prepareTrainingData(trainingDataSet, options);

      // Create new model version
      const newModelId = `model_${Date.now()}_${uuidv4().substring(0, 8)}`;

      // Train model
      const trainingResult = await this.learningManager.trainModel({
        modelId: newModelId,
        trainingData: preparedData,
        hyperparameters: options.hyperparameters,
        validationSplit: options.validationSplit || 0.2,
        timeout: this.config.maxTrainingTime
      });

      if (!trainingResult.success) {
        throw new ClassificationError('Model training failed', trainingResult.error);
      }

      // Validate new model performance
      const performanceResult = await this._validateModelPerformance(
        trainingResult.model,
        preparedData.testSet
      );

      // Deploy model if performance is acceptable
      const currentAccuracy = await this.performanceMonitor.getCurrentAccuracy();
      
      if (performanceResult.accuracy > currentAccuracy || options.forceDeployment) {
        await this.modelManager.deployModel(trainingResult.model);
        
        this.emit('model:deployed', {
          modelId: newModelId,
          previousAccuracy: currentAccuracy,
          newAccuracy: performanceResult.accuracy,
          improvement: performanceResult.accuracy - currentAccuracy
        });
      }

      this.metrics.modelsRetrained++;

      const result = {
        success: true,
        modelId: newModelId,
        trainingTime: Date.now() - startTime,
        performance: performanceResult,
        deployed: performanceResult.accuracy > currentAccuracy,
        trainingMetrics: trainingResult.metrics
      };

      this.emit('model:trained', result);

      return result;

    } catch (error) {
      this.emit('model:training_error', {
        error: error.message,
        timestamp: Date.now()
      });

      if (error instanceof ClassificationError) {
        throw error;
      }

      throw new ClassificationError(`Model training failed: ${error.message}`);
    }
  }

  /**
   * Update model with user feedback
   */
  async updateModelWithFeedback(feedback, options = {}) {
    try {
      if (!feedback || typeof feedback !== 'object') {
        throw new ClassificationError('Feedback object is required');
      }

      // Validate feedback
      const validation = this._validateFeedback(feedback);
      if (!validation.valid) {
        throw new ClassificationError('Invalid feedback', validation.errors);
      }

      // Add to feedback queue
      this.feedbackQueue.push({
        ...feedback,
        timestamp: Date.now(),
        processed: false
      });

      this.metrics.feedbackReceived++;

      // Process feedback immediately for incremental learning
      if (options.immediateUpdate) {
        await this._processIncrementalFeedback(feedback);
      }

      // Check if retraining is needed
      if (this.feedbackQueue.length >= this.config.retrainThreshold) {
        await this._triggerModelRetraining();
      }

      // Update performance metrics
      await this.performanceMonitor.updateWithFeedback(feedback);

      this.emit('feedback:received', {
        issueId: feedback.issueId,
        feedbackType: feedback.type,
        queueSize: this.feedbackQueue.length
      });

      return {
        success: true,
        feedbackId: uuidv4(),
        queueSize: this.feedbackQueue.length,
        retrainingTriggered: this.feedbackQueue.length >= this.config.retrainThreshold
      };

    } catch (error) {
      if (error instanceof ClassificationError) {
        throw error;
      }

      throw new ClassificationError(`Feedback update failed: ${error.message}`);
    }
  }

  /**
   * Get current model performance metrics
   */
  async getModelPerformance() {
    try {
      const performance = await this.performanceMonitor.getPerformanceMetrics();
      const model = await this.modelManager.getActiveModel();

      return {
        modelVersion: model?.version || 'unknown',
        accuracy: performance.accuracy,
        precision: performance.precision,
        recall: performance.recall,
        f1Score: performance.f1Score,
        confidenceDistribution: performance.confidenceDistribution,
        labelPerformance: performance.byLabel,
        trainingDate: model?.trainingDate,
        sampleCount: performance.sampleCount,
        lastUpdated: performance.lastUpdated
      };

    } catch (error) {
      throw new ClassificationError(`Failed to get performance metrics: ${error.message}`);
    }
  }

  /**
   * Get classification engine metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      featureCacheSize: this.featureCache.size,
      predictionCacheSize: this.predictionCache.size,
      feedbackQueueSize: this.feedbackQueue.length,
      modelManager: this.modelManager.getStats(),
      performanceMonitor: this.performanceMonitor.getStats()
    };
  }

  // Private methods

  _initializeDefaultModels() {
    this.defaultCategories = {
      type: ['bug', 'feature', 'enhancement', 'documentation'],
      priority: ['critical', 'high', 'medium', 'low'],
      area: ['api', 'cli', 'security', 'performance', 'testing'],
      complexity: ['simple', 'moderate', 'complex']
    };

    this.labelPatterns = {
      bug: ['bug', 'error', 'issue', 'problem', 'fix', 'broken'],
      feature: ['feature', 'implement', 'add', 'new', 'functionality'],
      enhancement: ['enhance', 'improve', 'optimize', 'better', 'upgrade'],
      critical: ['critical', 'urgent', 'blocking', 'severe', 'security'],
      high: ['important', 'high', 'priority', 'asap'],
      api: ['api', 'endpoint', 'service', 'request', 'response'],
      performance: ['slow', 'performance', 'speed', 'optimization', 'memory']
    };
  }

  async _extractFeatures(content, metadata, options) {
    const contentHash = this._generateContentHash(content, metadata);
    
    // Check feature cache
    if (this.featureCache.has(contentHash)) {
      const cached = this.featureCache.get(contentHash);
      if (Date.now() - cached.timestamp < this.config.featureCacheTTL) {
        return cached.features;
      }
    }

    // Extract features
    const features = await this.featureExtractor.extract({
      title: content.title || '',
      body: content.body || '',
      metadata: metadata
    });

    // Cache features
    this.featureCache.set(contentHash, {
      features,
      timestamp: Date.now()
    });

    return features;
  }

  async _batchExtractFeatures(issues, options) {
    const features = [];
    
    for (const issue of issues) {
      const issueFeatures = await this._extractFeatures(
        issue.content,
        issue.metadata,
        options
      );
      features.push(issueFeatures);
    }
    
    return features;
  }

  async _performPrediction(model, features, options) {
    return await model.predict(features, {
      confidenceThreshold: this.config.confidenceThreshold,
      maxPredictions: options.maxPredictions || 5
    });
  }

  async _batchPerformPrediction(model, featuresArray, options) {
    const predictions = [];
    
    for (const features of featuresArray) {
      const prediction = await this._performPrediction(model, features, options);
      predictions.push(prediction);
    }
    
    return predictions;
  }

  async _processBatchResult(issue, features, predictions, model, options) {
    const processedPredictions = await this.predictionProcessor.process(
      predictions,
      features,
      issue.metadata,
      { confidenceThreshold: this.config.confidenceThreshold }
    );

    const reasoning = await this._generateReasoning(
      processedPredictions,
      features,
      issue.content
    );

    return {
      issueId: issue.metadata?.issueId,
      predictions: processedPredictions.map(pred => ({
        label: pred.label,
        confidence: pred.confidence,
        category: pred.category,
        reasoning: reasoning[pred.label] || []
      })),
      overallConfidence: this._calculateOverallConfidence(processedPredictions),
      modelVersion: model.version,
      timestamp: new Date().toISOString()
    };
  }

  async _generateReasoning(predictions, features, content) {
    const reasoning = {};

    for (const prediction of predictions) {
      const reasons = [];

      // Keyword-based reasoning
      const keywordMatches = this._findKeywordMatches(
        prediction.label,
        content.title + ' ' + content.body
      );
      
      if (keywordMatches.length > 0) {
        reasons.push(`Keywords found: ${keywordMatches.join(', ')}`);
      }

      // Feature importance reasoning
      if (prediction.featureImportance) {
        const topFeatures = Object.entries(prediction.featureImportance)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([feature, importance]) => `${feature} (${(importance * 100).toFixed(1)}%)`);
        
        reasons.push(`Key features: ${topFeatures.join(', ')}`);
      }

      reasoning[prediction.label] = reasons;
    }

    return reasoning;
  }

  _findKeywordMatches(label, text) {
    const patterns = this.labelPatterns[label] || [];
    const matches = [];
    const lowerText = text.toLowerCase();

    for (const pattern of patterns) {
      if (lowerText.includes(pattern.toLowerCase())) {
        matches.push(pattern);
      }
    }

    return matches;
  }

  _calculateOverallConfidence(predictions) {
    if (predictions.length === 0) return 0;
    
    const totalConfidence = predictions.reduce((sum, pred) => sum + pred.confidence, 0);
    return totalConfidence / predictions.length;
  }

  _generateContentHash(content, metadata) {
    const hashInput = JSON.stringify({
      title: content.title,
      body: content.body,
      metadata: metadata
    });
    
    // Simple hash function (replace with proper crypto hash in production)
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  _cacheResult(contentHash, result) {
    // Implement LRU cache eviction
    if (this.predictionCache.size >= 1000) { // Max cache size
      const firstKey = this.predictionCache.keys().next().value;
      this.predictionCache.delete(firstKey);
    }

    this.predictionCache.set(contentHash, {
      result,
      timestamp: Date.now()
    });
  }

  _validateTrainingData(trainingDataSet) {
    const errors = [];

    if (!Array.isArray(trainingDataSet.samples)) {
      errors.push('Training samples must be an array');
    }

    if (!Array.isArray(trainingDataSet.labels)) {
      errors.push('Training labels must be an array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  _validateFeedback(feedback) {
    const errors = [];

    if (!feedback.issueId) {
      errors.push('Issue ID is required');
    }

    if (!feedback.actualLabels) {
      errors.push('Actual labels are required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async _prepareTrainingData(trainingDataSet, options) {
    // Implement training data preparation
    return {
      trainSet: trainingDataSet.samples.slice(0, Math.floor(trainingDataSet.samples.length * 0.7)),
      validationSet: trainingDataSet.samples.slice(Math.floor(trainingDataSet.samples.length * 0.7), Math.floor(trainingDataSet.samples.length * 0.85)),
      testSet: trainingDataSet.samples.slice(Math.floor(trainingDataSet.samples.length * 0.85))
    };
  }

  async _validateModelPerformance(model, testSet) {
    // Implement model performance validation
    return {
      accuracy: 0.85,
      precision: 0.83,
      recall: 0.87,
      f1Score: 0.85
    };
  }

  async _processIncrementalFeedback(feedback) {
    // Implement incremental learning
    const model = await this.modelManager.getActiveModel();
    if (model && model.supportsIncrementalLearning) {
      await model.updateWithFeedback(feedback);
    }
  }

  async _triggerModelRetraining() {
    // Implement automatic model retraining
    const trainingData = this.feedbackQueue.filter(f => !f.processed);
    
    if (trainingData.length >= this.config.retrainThreshold) {
      this.emit('model:retraining_triggered', {
        sampleCount: trainingData.length,
        timestamp: Date.now()
      });
      
      // Mark as processed
      trainingData.forEach(feedback => feedback.processed = true);
    }
  }

  _createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}

// Error classes
class ClassificationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

// Placeholder classes
class TextFeatureExtractor {
  constructor(config) {
    this.config = config;
  }

  async extract(content) {
    return {
      textFeatures: ['word1', 'word2', 'word3'],
      length: (content.title + content.body).length,
      wordCount: (content.title + content.body).split(' ').length
    };
  }
}

class MLModelManager {
  constructor(config) {
    this.config = config;
    this.activeModel = null;
  }

  async getActiveModel() {
    return this.activeModel || {
      version: '1.0.0',
      predict: async (features) => [
        { label: 'bug', confidence: 0.8, category: 'type' },
        { label: 'high', confidence: 0.7, category: 'priority' }
      ],
      supportsIncrementalLearning: true
    };
  }

  async deployModel(model) {
    this.activeModel = model;
  }

  getStats() {
    return { activeModel: !!this.activeModel };
  }
}

class PredictionProcessor {
  constructor(config) {
    this.config = config;
  }

  async process(predictions, features, metadata, options) {
    return predictions.filter(pred => pred.confidence >= options.confidenceThreshold);
  }
}

class LearningManager {
  constructor(config) {
    this.config = config;
  }

  async trainModel(options) {
    return {
      success: true,
      model: { version: '2.0.0' },
      metrics: { accuracy: 0.9 }
    };
  }
}

class PerformanceMonitor {
  constructor(config) {
    this.config = config;
  }

  async getPerformanceMetrics() {
    return {
      accuracy: 0.85,
      precision: 0.83,
      recall: 0.87,
      f1Score: 0.85
    };
  }

  async getCurrentAccuracy() {
    return 0.85;
  }

  async updateWithFeedback(feedback) {
    // Update performance metrics
  }

  getStats() {
    return { metricsCollected: true };
  }
}

module.exports = {
  ClassificationEngine,
  ClassificationError
};