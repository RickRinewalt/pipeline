/**
 * YOLO-PRO Classification Engine Test Suite
 * Comprehensive TDD tests for ML-based issue classification system
 * Implements SPARC Phase 4: Refinement testing methodology
 */

const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const { ClassificationEngine, ClassificationError } = require('../../src/classification/ClassificationEngine');

describe('ClassificationEngine', () => {
  let classificationEngine;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      confidenceThreshold: 0.7,
      batchSize: 50,
      modelCacheSize: 10,
      featureCacheTTL: 3600000,
      retrainThreshold: 100,
      maxTrainingTime: 300000,
      featureConfig: {},
      modelConfig: {},
      processingConfig: {},
      learningConfig: {},
      monitoringConfig: {}
    };

    classificationEngine = new ClassificationEngine(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Issue Classification', () => {
    test('should classify issue successfully with high confidence', async () => {
      const issueContent = {
        title: 'Application crashes on startup with database connection error',
        body: 'The application fails to start when connecting to the database. Error message: "Connection timeout". This is a critical issue affecting all users.'
      };

      const metadata = {
        issueId: 123,
        repository: 'test-repo',
        author: 'test-user'
      };

      const result = await classificationEngine.classifyIssue(issueContent, metadata);

      expect(result.issueId).toBe(123);
      expect(result.predictions).toHaveLength(2);
      expect(result.overallConfidence).toBeGreaterThan(0.5);
      expect(result.modelVersion).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
      
      // Check for expected labels based on content
      const labels = result.predictions.map(p => p.label);
      expect(labels).toContain('bug');
    });

    test('should handle missing content gracefully', async () => {
      await expect(classificationEngine.classifyIssue(null))
        .rejects.toThrow(ClassificationError);

      await expect(classificationEngine.classifyIssue({}))
        .rejects.toThrow(ClassificationError);
    });

    test('should use cache for repeated classifications', async () => {
      const issueContent = {
        title: 'Cache test issue',
        body: 'Testing caching functionality for repeated classifications'
      };

      const metadata = { issueId: 456 };

      // First call - cache miss
      const result1 = await classificationEngine.classifyIssue(issueContent, metadata);
      expect(result1.fromCache).toBeUndefined();

      // Second call - cache hit
      const result2 = await classificationEngine.classifyIssue(issueContent, metadata);
      expect(result2.fromCache).toBe(true);
      expect(result2.cacheAge).toBeGreaterThan(0);

      const metrics = classificationEngine.getMetrics();
      expect(metrics.cacheHits).toBeGreaterThan(0);
    });

    test('should provide reasoning for predictions', async () => {
      const issueContent = {
        title: 'Performance issue with slow API responses',
        body: 'API endpoints are responding slowly, taking over 5 seconds to return data. This is affecting user experience significantly.'
      };

      const result = await classificationEngine.classifyIssue(issueContent, {});

      expect(result.predictions.length).toBeGreaterThan(0);
      
      result.predictions.forEach(prediction => {
        expect(prediction.reasoning).toBeDefined();
        expect(Array.isArray(prediction.reasoning)).toBe(true);
      });
    });

    test('should emit classification:completed event', async () => {
      const issueContent = {
        title: 'Test issue for event emission',
        body: 'Testing event emission functionality'
      };

      const eventPromise = new Promise(resolve => {
        classificationEngine.once('classification:completed', resolve);
      });

      await classificationEngine.classifyIssue(issueContent, { issueId: 789 });

      const eventData = await eventPromise;
      expect(eventData.issueId).toBe(789);
      expect(eventData.predictions).toBeGreaterThan(0);
      expect(eventData.confidence).toBeDefined();
    });

    test('should filter predictions by confidence threshold', async () => {
      const issueContent = {
        title: 'Low confidence test',
        body: 'Testing confidence filtering'
      };

      // Mock low confidence predictions
      const mockPredict = jest.fn().mockResolvedValue([
        { label: 'bug', confidence: 0.9, category: 'type' },
        { label: 'low-priority', confidence: 0.3, category: 'priority' }, // Below threshold
        { label: 'high-priority', confidence: 0.8, category: 'priority' }
      ]);

      classificationEngine.modelManager.getActiveModel = jest.fn().mockResolvedValue({
        version: '1.0.0',
        predict: mockPredict
      });

      const result = await classificationEngine.classifyIssue(issueContent, {});

      // Should only include predictions above confidence threshold (0.7)
      expect(result.predictions).toHaveLength(2);
      result.predictions.forEach(pred => {
        expect(pred.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });
  });

  describe('Batch Classification', () => {
    test('should process batch of issues successfully', async () => {
      const issues = [
        {
          content: { title: 'Bug report 1', body: 'First bug description' },
          metadata: { issueId: 1001 }
        },
        {
          content: { title: 'Feature request 2', body: 'Second feature description' },
          metadata: { issueId: 1002 }
        },
        {
          content: { title: 'Enhancement 3', body: 'Third enhancement description' },
          metadata: { issueId: 1003 }
        }
      ];

      const result = await classificationEngine.batchClassifyIssues(issues, {
        concurrency: 2
      });

      expect(result.success).toBe(true);
      expect(result.results.successful).toHaveLength(3);
      expect(result.results.failed).toHaveLength(0);
      expect(result.results.summary.total).toBe(3);
      expect(result.results.summary.averageConfidence).toBeGreaterThan(0);
    });

    test('should handle partial failures in batch processing', async () => {
      const issues = [
        {
          content: { title: 'Valid issue', body: 'Valid description' },
          metadata: { issueId: 2001 }
        },
        {
          content: null, // Invalid content
          metadata: { issueId: 2002 }
        },
        {
          content: { title: 'Another valid issue', body: 'Another valid description' },
          metadata: { issueId: 2003 }
        }
      ];

      const result = await classificationEngine.batchClassifyIssues(issues, {
        continueOnError: true
      });

      expect(result.success).toBe(false);
      expect(result.results.successful).toHaveLength(2);
      expect(result.results.failed).toHaveLength(1);
    });

    test('should respect concurrency limits in batch processing', async () => {
      const issues = Array.from({ length: 10 }, (_, i) => ({
        content: { title: `Issue ${i + 1}`, body: `Description ${i + 1}` },
        metadata: { issueId: 3000 + i }
      }));

      const startTime = Date.now();

      const result = await classificationEngine.batchClassifyIssues(issues, {
        concurrency: 3
      });

      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.results.successful).toHaveLength(10);
      
      // Should be faster than sequential processing
      expect(endTime - startTime).toBeLessThan(issues.length * 200);
    });

    test('should handle batch timeout correctly', async () => {
      const issues = [
        {
          content: { title: 'Test issue', body: 'Test description' },
          metadata: { issueId: 4001 }
        }
      ];

      // Mock slow processing
      const originalClassify = classificationEngine.classifyIssue;
      classificationEngine.classifyIssue = jest.fn()
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 2000)));

      await expect(classificationEngine.batchClassifyIssues(issues, {
        timeout: 1000
      })).rejects.toThrow('timeout');

      // Restore original method
      classificationEngine.classifyIssue = originalClassify;
    });
  });

  describe('Model Training', () => {
    test('should train model with valid training data', async () => {
      const trainingDataSet = {
        samples: [
          { content: { title: 'Bug 1', body: 'Bug description' }, labels: ['bug'] },
          { content: { title: 'Feature 1', body: 'Feature description' }, labels: ['feature'] },
          { content: { title: 'Bug 2', body: 'Another bug' }, labels: ['bug', 'critical'] }
        ],
        labels: ['bug', 'feature', 'critical'],
        metadata: { version: '1.0', created: Date.now() }
      };

      const result = await classificationEngine.trainModel(trainingDataSet, {
        hyperparameters: { learningRate: 0.01 },
        validationSplit: 0.2
      });

      expect(result.success).toBe(true);
      expect(result.modelId).toBeDefined();
      expect(result.trainingTime).toBeGreaterThan(0);
      expect(result.performance).toBeDefined();
      expect(result.performance.accuracy).toBeGreaterThan(0);
    });

    test('should validate training data before training', async () => {
      const invalidTrainingData = {
        samples: 'not-an-array',
        labels: null
      };

      await expect(classificationEngine.trainModel(invalidTrainingData))
        .rejects.toThrow(ClassificationError);
    });

    test('should emit model:trained event on successful training', async () => {
      const trainingDataSet = {
        samples: [
          { content: { title: 'Test', body: 'Test' }, labels: ['test'] }
        ],
        labels: ['test'],
        metadata: {}
      };

      const eventPromise = new Promise(resolve => {
        classificationEngine.once('model:trained', resolve);
      });

      await classificationEngine.trainModel(trainingDataSet);

      const eventData = await eventPromise;
      expect(eventData.modelId).toBeDefined();
      expect(eventData.success).toBe(true);
    });

    test('should handle training failures gracefully', async () => {
      // Mock learning manager to fail
      classificationEngine.learningManager.trainModel = jest.fn()
        .mockResolvedValue({ success: false, error: 'Training failed' });

      const trainingDataSet = {
        samples: [{ content: { title: 'Test', body: 'Test' }, labels: ['test'] }],
        labels: ['test']
      };

      await expect(classificationEngine.trainModel(trainingDataSet))
        .rejects.toThrow('Model training failed');
    });
  });

  describe('Feedback Processing', () => {
    test('should process feedback successfully', async () => {
      const feedback = {
        issueId: 123,
        predictedLabels: ['bug', 'high'],
        actualLabels: ['bug', 'medium'],
        userFeedback: {
          correct: ['bug'],
          incorrect: ['high'],
          missing: ['medium'],
          confidence: 0.8
        }
      };

      const result = await classificationEngine.updateModelWithFeedback(feedback);

      expect(result.success).toBe(true);
      expect(result.feedbackId).toBeDefined();
      expect(result.queueSize).toBeGreaterThan(0);
    });

    test('should validate feedback structure', async () => {
      const invalidFeedback = {
        // Missing required fields
      };

      await expect(classificationEngine.updateModelWithFeedback(invalidFeedback))
        .rejects.toThrow(ClassificationError);
    });

    test('should emit feedback:received event', async () => {
      const feedback = {
        issueId: 456,
        predictedLabels: ['feature'],
        actualLabels: ['feature'],
        userFeedback: { correct: ['feature'] }
      };

      const eventPromise = new Promise(resolve => {
        classificationEngine.once('feedback:received', resolve);
      });

      await classificationEngine.updateModelWithFeedback(feedback);

      const eventData = await eventPromise;
      expect(eventData.issueId).toBe(456);
      expect(eventData.queueSize).toBeGreaterThan(0);
    });

    test('should trigger retraining when threshold is reached', async () => {
      // Set low threshold for testing
      classificationEngine.config.retrainThreshold = 2;

      const feedback1 = {
        issueId: 501,
        predictedLabels: ['bug'],
        actualLabels: ['feature'],
        userFeedback: { incorrect: ['bug'], correct: ['feature'] }
      };

      const feedback2 = {
        issueId: 502,
        predictedLabels: ['high'],
        actualLabels: ['low'],
        userFeedback: { incorrect: ['high'], correct: ['low'] }
      };

      await classificationEngine.updateModelWithFeedback(feedback1);
      const result = await classificationEngine.updateModelWithFeedback(feedback2);

      expect(result.retrainingTriggered).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    test('should provide model performance metrics', async () => {
      const performance = await classificationEngine.getModelPerformance();

      expect(performance.modelVersion).toBeDefined();
      expect(performance.accuracy).toBeGreaterThan(0);
      expect(performance.precision).toBeGreaterThan(0);
      expect(performance.recall).toBeGreaterThan(0);
      expect(performance.f1Score).toBeGreaterThan(0);
      expect(performance.confidenceDistribution).toBeDefined();
    });

    test('should track classification metrics correctly', async () => {
      const initialMetrics = classificationEngine.getMetrics();

      const issueContent = {
        title: 'Metrics test issue',
        body: 'Testing metrics tracking'
      };

      await classificationEngine.classifyIssue(issueContent, {});

      const updatedMetrics = classificationEngine.getMetrics();

      expect(updatedMetrics.classificationsPerformed)
        .toBe(initialMetrics.classificationsPerformed + 1);
      expect(updatedMetrics.averageConfidence).toBeGreaterThan(0);
    });

    test('should provide comprehensive engine metrics', () => {
      const metrics = classificationEngine.getMetrics();

      expect(metrics).toHaveProperty('classificationsPerformed');
      expect(metrics).toHaveProperty('averageConfidence');
      expect(metrics).toHaveProperty('accuracyScore');
      expect(metrics).toHaveProperty('feedbackReceived');
      expect(metrics).toHaveProperty('modelsRetrained');
      expect(metrics).toHaveProperty('cacheHits');
      expect(metrics).toHaveProperty('cacheMisses');
      expect(metrics).toHaveProperty('featureCacheSize');
      expect(metrics).toHaveProperty('predictionCacheSize');
    });
  });

  describe('Feature Extraction', () => {
    test('should extract features from issue content', async () => {
      const content = {
        title: 'Test feature extraction',
        body: 'This is a test for feature extraction functionality'
      };

      const metadata = { issueId: 999 };

      // Access private method for testing
      const features = await classificationEngine._extractFeatures(content, metadata, {});

      expect(features).toBeDefined();
      expect(features.textFeatures).toBeDefined();
      expect(features.length).toBeGreaterThan(0);
      expect(features.wordCount).toBeGreaterThan(0);
    });

    test('should cache extracted features', async () => {
      const content = {
        title: 'Cache test',
        body: 'Testing feature caching'
      };

      const metadata = { issueId: 888 };

      // First extraction - cache miss
      await classificationEngine._extractFeatures(content, metadata, {});
      
      // Second extraction - cache hit
      await classificationEngine._extractFeatures(content, metadata, {});

      expect(classificationEngine.featureCache.size).toBeGreaterThan(0);
    });
  });

  describe('Reasoning Generation', () => {
    test('should generate meaningful reasoning for predictions', async () => {
      const predictions = [
        { label: 'bug', confidence: 0.9, category: 'type' },
        { label: 'critical', confidence: 0.8, category: 'priority' }
      ];

      const features = { textFeatures: ['error', 'crash', 'critical'] };
      
      const content = {
        title: 'Critical bug: Application crashes on startup',
        body: 'The application shows an error and crashes immediately'
      };

      const reasoning = await classificationEngine._generateReasoning(
        predictions,
        features,
        content
      );

      expect(reasoning.bug).toBeDefined();
      expect(reasoning.critical).toBeDefined();
      expect(reasoning.bug.length).toBeGreaterThan(0);
    });

    test('should identify keyword matches in reasoning', () => {
      const matches = classificationEngine._findKeywordMatches(
        'bug',
        'This is a bug report with error messages'
      );

      expect(matches).toContain('bug');
      expect(matches).toContain('error');
    });
  });

  describe('Content Hash Generation', () => {
    test('should generate consistent hashes for same content', () => {
      const content = { title: 'Test', body: 'Test body' };
      const metadata = { issueId: 123 };

      const hash1 = classificationEngine._generateContentHash(content, metadata);
      const hash2 = classificationEngine._generateContentHash(content, metadata);

      expect(hash1).toBe(hash2);
    });

    test('should generate different hashes for different content', () => {
      const content1 = { title: 'Test 1', body: 'Body 1' };
      const content2 = { title: 'Test 2', body: 'Body 2' };
      const metadata = { issueId: 123 };

      const hash1 = classificationEngine._generateContentHash(content1, metadata);
      const hash2 = classificationEngine._generateContentHash(content2, metadata);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Error Handling', () => {
    test('should emit error events on classification failures', async () => {
      const errorPromise = new Promise(resolve => {
        classificationEngine.once('classification:error', resolve);
      });

      // Mock model manager to throw error
      classificationEngine.modelManager.getActiveModel = jest.fn()
        .mockRejectedValue(new Error('Model loading failed'));

      try {
        await classificationEngine.classifyIssue(
          { title: 'Test', body: 'Test' },
          { issueId: 777 }
        );
      } catch (error) {
        // Expected to throw
      }

      const errorEvent = await errorPromise;
      expect(errorEvent.error).toBe('Classification failed: Model loading failed');
      expect(errorEvent.issueId).toBe(777);
    });

    test('should handle model manager failures gracefully', async () => {
      classificationEngine.modelManager.getActiveModel = jest.fn()
        .mockResolvedValue(null);

      await expect(classificationEngine.classifyIssue(
        { title: 'Test', body: 'Test' },
        {}
      )).rejects.toThrow('No active classification model available');
    });
  });

  describe('Default Categories and Patterns', () => {
    test('should initialize default label categories', () => {
      expect(classificationEngine.defaultCategories.type).toContain('bug');
      expect(classificationEngine.defaultCategories.type).toContain('feature');
      expect(classificationEngine.defaultCategories.priority).toContain('critical');
      expect(classificationEngine.defaultCategories.priority).toContain('high');
    });

    test('should have predefined label patterns', () => {
      expect(classificationEngine.labelPatterns.bug).toContain('bug');
      expect(classificationEngine.labelPatterns.bug).toContain('error');
      expect(classificationEngine.labelPatterns.feature).toContain('feature');
      expect(classificationEngine.labelPatterns.feature).toContain('implement');
    });
  });

  describe('Training Data Validation', () => {
    test('should validate correct training data structure', () => {
      const validData = {
        samples: [
          { content: { title: 'Test', body: 'Test' }, labels: ['test'] }
        ],
        labels: ['test']
      };

      const result = classificationEngine._validateTrainingData(validData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should identify invalid training data structure', () => {
      const invalidData = {
        samples: 'not-array',
        labels: null
      };

      const result = classificationEngine._validateTrainingData(invalidData);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});