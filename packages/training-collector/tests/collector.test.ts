/**
 * Tests for StudyLoG.AI Training Data Collector
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TrainingDataCollector,
  LearningModule,
  LearningDecisionType,
  DecisionSource,
  QualityLabel,
  ExportFormat,
  type LearningContext,
  type LearningDecision,
  type LearningOutcome,
  type StudentDataSettings,
  MemoryStorage,
} from '../src/index.js';

describe('TrainingDataCollector', () => {
  let collector: TrainingDataCollector;

  beforeEach(async () => {
    collector = new TrainingDataCollector();
    await collector.init({ type: 'memory' });
  });

  afterEach(async () => {
    await collector.close();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(collector).toBeDefined();
    });

    it('should allow re-initialization', async () => {
      await collector.init({ type: 'memory' });
      expect(collector).toBeDefined();
    });
  });

  describe('Session Management', () => {
    it('should start a new session', async () => {
      const sessionId = await collector.startSession({
        studentIds: ['student-1'],
        module: 'cognitive_mill',
        notes: 'Test session',
      });

      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^sess_/);
      expect(collector.getCurrentSessionId()).toBe(sessionId);
    });

    it('should use custom session ID when provided', async () => {
      const customId = 'my-custom-session';
      const sessionId = await collector.startSession({
        sessionId: customId,
        studentIds: ['student-1'],
      });

      expect(sessionId).toBe(customId);
    });

    it('should end the current session', async () => {
      await collector.startSession({
        studentIds: ['student-1'],
        notes: 'Test session',
      });

      const sessionInfo = await collector.endSession();

      expect(sessionInfo).toBeDefined();
      expect(sessionInfo?.totalDecisions).toBe(0);
      expect(collector.getCurrentSessionId()).toBeNull();
    });

    it('should return null when ending with no active session', async () => {
      const sessionInfo = await collector.endSession();
      expect(sessionInfo).toBeNull();
    });
  });

  describe('Student Settings', () => {
    it('should return default settings for new student', async () => {
      const settings = await collector.getStudentSettings('new-student');

      expect(settings.studentId).toBe('new-student');
      expect(settings.enabled).toBe(true);
      expect(settings.collectStudentDecisions).toBe(true);
      expect(settings.collectAITutorDecisions).toBe(true);
      expect(settings.collectRuleEngineDecisions).toBe(true);
      expect(settings.collectHumanTutorDecisions).toBe(true);
      expect(settings.retentionDays).toBe(90);
      expect(settings.trainingEligible).toBe(true);
      expect(settings.anonymizeForTraining).toBe(true);
    });

    it('should update student settings', async () => {
      const newSettings: StudentDataSettings = {
        studentId: 'student-1',
        enabled: true,
        collectStudentDecisions: true,
        collectAITutorDecisions: false,
        collectRuleEngineDecisions: true,
        collectHumanTutorDecisions: true,
        retentionDays: 30,
        trainingEligible: true,
        anonymizeForTraining: false,
      };

      await collector.updateStudentSettings(newSettings);

      const retrieved = await collector.getStudentSettings('student-1');
      expect(retrieved.collectAITutorDecisions).toBe(false);
      expect(retrieved.retentionDays).toBe(30);
      expect(retrieved.anonymizeForTraining).toBe(false);
    });
  });

  describe('Decision Logging', () => {
    it('should log a decision and return record ID', async () => {
      const context: LearningContext = {
        learningState: {
          module: LearningModule.COGNITIVE_MILL,
          progress: 0.5,
          lessonProgress: 0.3,
          objectives: ['Learn neural networks'],
          currentDifficulty: 0.5,
          timeSpentOnLesson: 600,
          timeSpentOnExercise: 300,
        },
        studentState: {
          knowledgeLevel: 0.5,
          engagement: 0.8,
          fatigue: 0.2,
          confidence: 0.7,
          consecutiveMistakes: 0,
          consecutiveSuccesses: 1,
          streak: 1,
          skillLevels: {},
        },
      };

      const decision: LearningDecision = {
        decisionType: LearningDecisionType.PROBLEM_SOLVING,
        action: 'Write code',
        reasoning: 'Applying lesson concepts',
        confidence: 0.8,
        source: DecisionSource.STUDENT,
        stakes: 0.5,
      };

      const recordId = await collector.logDecision({
        studentId: 'student-1',
        context,
        decision,
      });

      expect(recordId).toBeDefined();
      expect(recordId).toMatch(/^rec_/);
    });

    it('should not log decision when collection disabled for source', async () => {
      // Disable AI tutor collection
      await collector.updateStudentSettings({
        studentId: 'student-1',
        enabled: true,
        collectStudentDecisions: true,
        collectAITutorDecisions: false,
        collectRuleEngineDecisions: true,
        collectHumanTutorDecisions: true,
        retentionDays: 90,
        trainingEligible: true,
        anonymizeForTraining: true,
      });

      const context: LearningContext = {
        learningState: {
          module: LearningModule.COGNITIVE_MILL,
          progress: 0.5,
          lessonProgress: 0.3,
          objectives: [],
          currentDifficulty: 0.5,
          timeSpentOnLesson: 600,
          timeSpentOnExercise: 300,
        },
        studentState: {
          knowledgeLevel: 0.5,
          engagement: 0.8,
          fatigue: 0.2,
          confidence: 0.7,
          consecutiveMistakes: 0,
          consecutiveSuccesses: 1,
          streak: 1,
          skillLevels: {},
        },
      };

      const decision: LearningDecision = {
        decisionType: LearningDecisionType.HELP_REQUEST,
        action: 'Provide hint',
        reasoning: 'Student needs help',
        confidence: 0.9,
        source: DecisionSource.AI_TUTOR,
        stakes: 0.3,
      };

      const recordId = await collector.logDecision({
        studentId: 'student-1',
        context,
        decision,
      });

      // Should return null because AI tutor collection is disabled
      expect(recordId).toBeNull();
    });

    it('should use custom record ID from metadata', async () => {
      const customRecordId = 'my-custom-record-123';

      const recordId = await collector.logDecision({
        studentId: 'student-1',
        context: {
          learningState: {
            module: LearningModule.COGNITIVE_MILL,
            progress: 0.5,
            lessonProgress: 0.5,
            objectives: [],
            currentDifficulty: 0.5,
            timeSpentOnLesson: 600,
            timeSpentOnExercise: 300,
          },
          studentState: {
            knowledgeLevel: 0.5,
            engagement: 0.8,
            fatigue: 0.2,
            confidence: 0.7,
            consecutiveMistakes: 0,
            consecutiveSuccesses: 0,
            streak: 0,
            skillLevels: {},
          },
        },
        decision: {
          decisionType: LearningDecisionType.PROBLEM_SOLVING,
          action: 'Test action',
          reasoning: 'Test',
          confidence: 0.5,
          source: DecisionSource.STUDENT,
          stakes: 0.5,
          metadata: { recordId: customRecordId },
        },
      });

      expect(recordId).toBe(customRecordId);
    });
  });

  describe('Outcome Tracking', () => {
    it('should update outcome for a record', async () => {
      const recordId = await collector.logDecision({
        studentId: 'student-1',
        context: {
          learningState: {
            module: LearningModule.COGNITIVE_MILL,
            progress: 0.5,
            lessonProgress: 0.5,
            objectives: [],
            currentDifficulty: 0.5,
            timeSpentOnLesson: 600,
            timeSpentOnExercise: 300,
          },
          studentState: {
            knowledgeLevel: 0.5,
            engagement: 0.8,
            fatigue: 0.2,
            confidence: 0.7,
            consecutiveMistakes: 0,
            consecutiveSuccesses: 0,
            streak: 0,
            skillLevels: {},
          },
        },
        decision: {
          decisionType: LearningDecisionType.PROBLEM_SOLVING,
          action: 'Test action',
          reasoning: 'Test',
          confidence: 0.5,
          source: DecisionSource.STUDENT,
          stakes: 0.5,
        },
      });

      const outcome: LearningOutcome = {
        success: true,
        immediate: 'Worked correctly',
        qualityScore: 0.8,
        qualityLabel: QualityLabel.GOOD,
        metrics: {
          timeTaken: 30000,
          attempts: 1,
        },
      };

      await collector.updateOutcome({ recordId: recordId!, outcome });

      const record = await collector.getRecord(recordId!);
      expect(record?.outcome).toBeDefined();
      expect(record?.outcome?.success).toBe(true);
      expect(record?.outcome?.qualityScore).toBe(0.8);
    });

    it('should compute quality score if not provided', async () => {
      const recordId = await collector.logDecision({
        studentId: 'student-1',
        context: {
          learningState: {
            module: LearningModule.COGNITIVE_MILL,
            progress: 0.5,
            lessonProgress: 0.5,
            objectives: [],
            currentDifficulty: 0.5,
            timeSpentOnLesson: 600,
            timeSpentOnExercise: 300,
          },
          studentState: {
            knowledgeLevel: 0.5,
            engagement: 0.8,
            fatigue: 0.2,
            confidence: 0.7,
            consecutiveMistakes: 0,
            consecutiveSuccesses: 0,
            streak: 0,
            skillLevels: {},
          },
        },
        decision: {
          decisionType: LearningDecisionType.PROBLEM_SOLVING,
          action: 'Test action',
          reasoning: 'Test',
          confidence: 0.5,
          source: DecisionSource.STUDENT,
          stakes: 0.5,
        },
      });

      const outcome: LearningOutcome = {
        success: true,
        immediate: 'Worked correctly',
        metrics: {
          timeTaken: 25000,
          attempts: 1,
          hintsUsed: 0,
          codeQuality: 0.9,
          correctnessScore: 0.95,
        },
      };

      await collector.updateOutcome({ recordId: recordId!, outcome });

      const record = await collector.getRecord(recordId!);
      expect(record?.outcome?.qualityScore).toBeGreaterThan(0);
    });
  });

  describe('Quality Labels', () => {
    it('should update quality label', async () => {
      const recordId = await collector.logDecision({
        studentId: 'student-1',
        context: {
          learningState: {
            module: LearningModule.COGNITIVE_MILL,
            progress: 0.5,
            lessonProgress: 0.5,
            objectives: [],
            currentDifficulty: 0.5,
            timeSpentOnLesson: 600,
            timeSpentOnExercise: 300,
          },
          studentState: {
            knowledgeLevel: 0.5,
            engagement: 0.8,
            fatigue: 0.2,
            confidence: 0.7,
            consecutiveMistakes: 0,
            consecutiveSuccesses: 0,
            streak: 0,
            skillLevels: {},
          },
        },
        decision: {
          decisionType: LearningDecisionType.PROBLEM_SOLVING,
          action: 'Test action',
          reasoning: 'Test',
          confidence: 0.5,
          source: DecisionSource.STUDENT,
          stakes: 0.5,
        },
      });

      await collector.updateQualityLabel({
        recordId: recordId!,
        label: QualityLabel.TEACHING_MOMENT,
        notes: 'Excellent learning opportunity',
      });

      const record = await collector.getRecord(recordId!);
      expect(record?.qualityLabel).toBe(QualityLabel.TEACHING_MOMENT);
      expect(record?.reflectionNotes).toBe('Excellent learning opportunity');
    });
  });

  describe('Data Retrieval', () => {
    beforeEach(async () => {
      // Create sample data
      await collector.startSession({
        studentIds: ['student-1', 'student-2'],
        module: 'cognitive_mill',
      });

      for (let i = 0; i < 5; i++) {
        const recordId = await collector.logDecision({
          studentId: 'student-1',
          context: {
            learningState: {
              module: LearningModule.COGNITIVE_MILL,
              progress: i * 0.1,
              lessonProgress: i * 0.15,
              objectives: [],
              currentDifficulty: 0.5,
              timeSpentOnLesson: 600,
              timeSpentOnExercise: 300,
            },
            studentState: {
              knowledgeLevel: 0.5 + i * 0.05,
              engagement: 0.8,
              fatigue: 0.2,
              confidence: 0.7,
              consecutiveMistakes: 0,
              consecutiveSuccesses: i,
              streak: i,
              skillLevels: {},
            },
          },
          decision: {
            decisionType: LearningDecisionType.PROBLEM_SOLVING,
            action: `Action ${i}`,
            reasoning: `Reasoning ${i}`,
            confidence: 0.5 + i * 0.1,
            source: DecisionSource.STUDENT,
            stakes: 0.5,
          },
        });

        await collector.updateOutcome({
          recordId: recordId!,
          outcome: {
            success: i % 2 === 0,
            immediate: `Result ${i}`,
            qualityScore: 0.5 + i * 0.1,
            qualityLabel: i % 2 === 0 ? QualityLabel.GOOD : QualityLabel.ACCEPTABLE,
            metrics: {
              timeTaken: 30000,
              attempts: 1,
            },
          },
        });
      }
    });

    it('should get records for a student', async () => {
      const records = await collector.getRecords('student-1');

      expect(records.length).toBe(5);
      expect(records[0].studentId).toBe('student-1');
    });

    it('should respect limit option', async () => {
      const records = await collector.getRecords('student-1', { limit: 3 });

      expect(records.length).toBe(3);
    });

    it('should filter by decision type', async () => {
      const records = await collector.getRecords('student-1', {
        decisionTypes: [LearningDecisionType.PROBLEM_SOLVING],
      });

      expect(records.length).toBe(5);
    });

    it('should get a single record by ID', async () => {
      const records = await collector.getRecords('student-1', { limit: 1 });
      const record = await collector.getRecord(records[0].recordId);

      expect(record).toBeDefined();
      expect(record?.recordId).toBe(records[0].recordId);
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await collector.startSession({
        studentIds: ['student-stats'],
        module: 'cognitive_mill',
      });

      // Create mixed success/failure records
      for (let i = 0; i < 10; i++) {
        const recordId = await collector.logDecision({
          studentId: 'student-stats',
          context: {
            learningState: {
              module: LearningModule.COGNITIVE_MILL,
              progress: 0.5,
              lessonProgress: 0.5,
              objectives: [],
              currentDifficulty: 0.5,
              timeSpentOnLesson: 600,
              timeSpentOnExercise: 300,
            },
            studentState: {
              knowledgeLevel: 0.5,
              engagement: 0.8,
              fatigue: 0.2,
              confidence: 0.7,
              consecutiveMistakes: 0,
              consecutiveSuccesses: 0,
              streak: 0,
              skillLevels: {},
            },
          },
          decision: {
            decisionType: i < 5 ? LearningDecisionType.PROBLEM_SOLVING : LearningDecisionType.HELP_REQUEST,
            action: `Action ${i}`,
            reasoning: `Reasoning ${i}`,
            confidence: 0.7,
            source: DecisionSource.STUDENT,
            stakes: 0.5,
          },
        });

        await collector.updateOutcome({
          recordId: recordId!,
          outcome: {
            success: i < 7, // 7 success, 3 failure
            immediate: `Result ${i}`,
            qualityScore: 0.7,
            qualityLabel: QualityLabel.GOOD,
          },
        });
      }
    });

    it('should calculate statistics correctly', async () => {
      const stats = await collector.getStatistics('student-stats');

      expect(stats.totalRecords).toBe(10);
      expect(stats.successes).toBe(7);
      expect(stats.failures).toBe(3);
      expect(stats.successRate).toBeCloseTo(7 / 10, 1);
    });

    it('should count by decision type', async () => {
      const stats = await collector.getStatistics('student-stats');

      expect(stats.byType[LearningDecisionType.PROBLEM_SOLVING]).toBe(5);
      expect(stats.byType[LearningDecisionType.HELP_REQUEST]).toBe(5);
    });
  });

  describe('Data Management', () => {
    it('should delete a record', async () => {
      const recordId = await collector.logDecision({
        studentId: 'student-1',
        context: {
          learningState: {
            module: LearningModule.COGNITIVE_MILL,
            progress: 0.5,
            lessonProgress: 0.5,
            objectives: [],
            currentDifficulty: 0.5,
            timeSpentOnLesson: 600,
            timeSpentOnExercise: 300,
          },
          studentState: {
            knowledgeLevel: 0.5,
            engagement: 0.8,
            fatigue: 0.2,
            confidence: 0.7,
            consecutiveMistakes: 0,
            consecutiveSuccesses: 0,
            streak: 0,
            skillLevels: {},
          },
        },
        decision: {
          decisionType: LearningDecisionType.PROBLEM_SOLVING,
          action: 'Test action',
          reasoning: 'Test',
          confidence: 0.5,
          source: DecisionSource.STUDENT,
          stakes: 0.5,
        },
      });

      const deleted = await collector.deleteRecord(recordId!);
      expect(deleted).toBe(true);

      const record = await collector.getRecord(recordId!);
      expect(record).toBeNull();
    });
  });

  describe('Export', () => {
    beforeEach(async () => {
      await collector.startSession({
        studentIds: ['student-export'],
        module: 'cognitive_mill',
      });

      for (let i = 0; i < 3; i++) {
        const recordId = await collector.logDecision({
          studentId: 'student-export',
          context: {
            learningState: {
              module: LearningModule.COGNITIVE_MILL,
              progress: 0.5,
              lessonProgress: 0.5,
              objectives: [],
              currentDifficulty: 0.5,
              timeSpentOnLesson: 600,
              timeSpentOnExercise: 300,
            },
            studentState: {
              knowledgeLevel: 0.5,
              engagement: 0.8,
              fatigue: 0.2,
              confidence: 0.7,
              consecutiveMistakes: 0,
              consecutiveSuccesses: 0,
              streak: 0,
              skillLevels: {},
            },
          },
          decision: {
            decisionType: LearningDecisionType.PROBLEM_SOLVING,
            action: `Action ${i}`,
            reasoning: `Reasoning ${i}`,
            confidence: 0.8,
            source: DecisionSource.STUDENT,
            stakes: 0.5,
          },
        });

        await collector.updateOutcome({
          recordId: recordId!,
          outcome: {
            success: true,
            immediate: `Result ${i}`,
            qualityScore: 0.8,
            qualityLabel: QualityLabel.GOOD,
          },
        });
      }
    });

    it('should export to JSON', async () => {
      const result = await collector.exportJSON('student-export', '/tmp/test-export.json');

      expect(result.format).toBe(ExportFormat.JSON);
      expect(result.recordsExported).toBe(3);
    });

    it('should export to JSONL', async () => {
      const result = await collector.exportJSONL('student-export', '/tmp/test-export.jsonl');

      expect(result.format).toBe(ExportFormat.JSONL);
      expect(result.recordsExported).toBe(3);
    });

    it('should export to QLoRA format', async () => {
      const result = await collector.exportQLoRA('student-export', '/tmp/test-qlora.jsonl');

      expect(result.format).toBe(ExportFormat.QLORA);
      expect(result.recordsExported).toBe(3);
    });

    it('should export to CSV', async () => {
      const result = await collector.exportCSV('student-export', '/tmp/test-export.csv');

      expect(result.format).toBe(ExportFormat.CSV);
      expect(result.recordsExported).toBe(3);
    });
  });
});
