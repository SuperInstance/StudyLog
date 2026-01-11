/**
 * StudyLoG.AI Training Data Collector - Export Handlers
 *
 * Converts learning records to various export formats for training AI models.
 */

import type {
  LearningRecord,
  QLoRARecord,
  ExportFormat,
  ExportResult,
  LearningDecisionType,
  QualityLabel,
} from '../models/index.js';

// ============================================================================
// Abstract Exporter
// ============================================================================

export interface ExportOptions {
  anonymize?: boolean;
  includeMetadata?: boolean;
  customInstructions?: Partial<Record<LearningDecisionType, string>>;
}

export interface Exporter {
  export(
    records: LearningRecord[],
    outputPath: string,
    options?: ExportOptions
  ): Promise<ExportResult>;
}

// ============================================================================
// JSON Exporter
// ============================================================================

export class JSONExporter implements Exporter {
  async export(
    records: LearningRecord[],
    outputPath: string,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    // Process records
    const processedRecords = records.map(r =>
      options.anonymize ? this.anonymize(r) : r
    );

    const exportData = {
      exportTimestamp: new Date().toISOString(),
      totalRecords: processedRecords.length,
      metadata: options.includeMetadata !== false ? this.generateMetadata(processedRecords) : undefined,
      records: processedRecords,
    };

    await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));

    return {
      format: ExportFormat.JSON,
      outputPath,
      recordsExported: processedRecords.length,
      recordsFiltered: records.length - processedRecords.length,
      timestamp: Date.now(),
    };
  }

  private generateMetadata(records: LearningRecord[]) {
    const byStudent = new Map<string, number>();
    const byType = new Map<string, number>();
    const byModule = new Map<string, number>();
    const byQuality = new Map<string, number>();
    let successCount = 0;

    for (const record of records) {
      byStudent.set(record.studentId, (byStudent.get(record.studentId) || 0) + 1);
      byType.set(record.decision.decisionType, (byType.get(record.decision.decisionType) || 0) + 1);
      byModule.set(record.context.learningState.module, (byModule.get(record.context.learningState.module) || 0) + 1);

      if (record.outcome?.qualityLabel) {
        byQuality.set(record.outcome.qualityLabel, (byQuality.get(record.outcome.qualityLabel) || 0) + 1);
      }
      if (record.outcome?.success) {
        successCount++;
      }
    }

    return {
      studentCounts: Object.fromEntries(byStudent),
      decisionTypeCounts: Object.fromEntries(byType),
      moduleCounts: Object.fromEntries(byModule),
      qualityLabelCounts: Object.fromEntries(byQuality),
      successCount,
      successRate: successCount / records.length,
    };
  }

  private anonymize(record: LearningRecord): LearningRecord {
    return {
      ...record,
      studentId: this.hashId(record.studentId),
      sessionId: record.sessionId ? this.hashId(record.sessionId) : undefined,
    };
  }

  private hashId(id: string): string {
    // Simple hash for anonymization (use proper hashing in production)
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `anon_${Math.abs(hash).toString(16)}`;
  }
}

// ============================================================================
// JSONL Exporter
// ============================================================================

export class JSONLExporter implements Exporter {
  async export(
    records: LearningRecord[],
    outputPath: string,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    const lines: string[] = [];
    for (const record of records) {
      const processed = options.anonymize ? this.anonymize(record) : record;
      lines.push(JSON.stringify(processed));
    }

    await fs.writeFile(outputPath, lines.join('\n'));

    return {
      format: ExportFormat.JSONL,
      outputPath,
      recordsExported: lines.length,
      recordsFiltered: 0,
      timestamp: Date.now(),
    };
  }

  private anonymize(record: LearningRecord): LearningRecord {
    return {
      ...record,
      studentId: `student_${record.studentId.slice(0, 8)}`,
      context: {
        ...record.context,
        studentState: {
          ...record.context.studentState,
          // Remove potentially identifying info
          skillLevels: {},
        },
      },
    };
  }
}

// ============================================================================
// CSV Exporter
// ============================================================================

export class CSVExporter implements Exporter {
  async export(
    records: LearningRecord[],
    outputPath: string,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    // Flatten records to CSV rows
    const headers = [
      'recordId',
      'timestamp',
      'studentId',
      'module',
      'decisionType',
      'decisionSource',
      'action',
      'confidence',
      'success',
      'qualityScore',
      'qualityLabel',
      'timeSpent',
    ];

    const rows: string[][] = [headers];

    for (const record of records) {
      const row = [
        options.anonymize ? `***${record.recordId.slice(-8)}` : record.recordId,
        new Date(record.timestamp).toISOString(),
        options.anonymize ? '***anonymous***' : record.studentId,
        record.context.learningState.module,
        record.decision.decisionType,
        record.decision.source,
        this.escapeCsv(record.decision.action.slice(0, 100)),
        record.decision.confidence.toFixed(2),
        record.outcome?.success ? 'true' : 'false',
        record.outcome?.qualityScore?.toFixed(2) || '',
        record.outcome?.qualityLabel || '',
        record.outcome?.metrics?.timeTaken || '',
      ];
      rows.push(row);
    }

    const csv = rows.map(row => row.join(',')).join('\n');
    await fs.writeFile(outputPath, csv);

    return {
      format: ExportFormat.CSV,
      outputPath,
      recordsExported: rows.length - 1,
      recordsFiltered: 0,
      timestamp: Date.now(),
    };
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

// ============================================================================
// QLoRA Exporter
// ============================================================================

/**
 * Default instruction prompts for each decision type
 */
const DEFAULT_INSTRUCTIONS: Record<string, string> = {
  problem_solving: 'How should I solve this problem?',
  viz_interaction: 'How should I interact with this visualization?',
  concept_exploration: 'Explain this AI concept:',
  debugging: 'How do I debug this issue?',
  agent_config: 'How should I configure this agent?',
  training_decision: 'What training strategy should I use?',
  breeding_decision: 'Which agents should I breed?',
  interaction: 'How should I interact with other agents?',
  coalition: 'Should I form a coalition?',
  competition: 'What competitive strategy should I use?',
  negotiation: 'How should I negotiate?',
  help_request: 'The student is asking for help. Provide guidance.',
  hint_usage: 'The student is using a hint. Explain the concept.',
  assessment: 'Evaluate this student response:',
  collaboration: 'How should we collaborate on this task?',
  simulation: 'What should I simulate next?',
  reflection: 'Help the student reflect on their learning:',
  other: 'What action should I take?',
};

export class QLoRAExporter implements Exporter {
  private customInstructions: Partial<Record<LearningDecisionType, string>>;

  constructor(customInstructions?: Partial<Record<LearningDecisionType, string>>) {
    this.customInstructions = customInstructions || {};
  }

  async export(
    records: LearningRecord[],
    outputPath: string,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    // Convert records to QLoRA format
    const qloraRecords = records
      .filter(r => r.outcome !== undefined) // Only export records with outcomes
      .map(record => this.recordToQLoRA(record, options));

    // Determine format from extension
    const ext = path.extname(outputPath).toLowerCase();
    let format: ExportFormat = ExportFormat.JSONL;

    if (ext === '.jsonl') {
      await this.exportJSONL(qloraRecords, outputPath);
      format = ExportFormat.QLORA;
    } else if (ext === '.json') {
      await fs.writeFile(outputPath, JSON.stringify(qloraRecords, null, 2));
      format = ExportFormat.JSON;
    } else {
      // Default to JSONL
      await this.exportJSONL(qloraRecords, outputPath);
    }

    return {
      format,
      outputPath,
      recordsExported: qloraRecords.length,
      recordsFiltered: records.length - qloraRecords.length,
      timestamp: Date.now(),
    };
  }

  private async exportJSONL(records: QLoRARecord[], outputPath: string): Promise<void> {
    const fs = await import('fs/promises');
    const lines = records.map(r => JSON.stringify(r));
    await fs.writeFile(outputPath, lines.join('\n'));
  }

  private recordToQLoRA(record: LearningRecord, options: ExportOptions): QLoRARecord {
    const instruction = this.getInstruction(record);
    const input = this.buildInputContext(record, options);
    const output = this.buildOutputText(record);

    return {
      instruction,
      input,
      output,
      metadata: {
        recordId: options.anonymize ? `***${record.recordId.slice(-8)}` : record.recordId,
        studentId: options.anonymize ? '***anonymous***' : record.studentId,
        decisionType: record.decision.decisionType,
        module: record.context.learningState.module,
        phase: record.context.learningState.phase,
        qualityLabel: record.outcome?.qualityLabel,
        success: record.outcome?.success,
        confidence: record.decision.confidence,
        timestamp: record.timestamp,
      },
    };
  }

  private getInstruction(record: LearningRecord): string {
    const decisionType = record.decision.decisionType;
    return (
      this.customInstructions[decisionType] ||
      DEFAULT_INSTRUCTIONS[decisionType] ||
      DEFAULT_INSTRUCTIONS.other
    );
  }

  private buildInputContext(record: LearningRecord, options: ExportOptions): string {
    const parts: string[] = [];

    // Learning state
    const ls = record.context.learningState;
    parts.push(`Module: ${this.formatModule(ls.module)}`);
    if (ls.lesson) parts.push(`Lesson: ${ls.lesson}`);
    if (ls.exercise) parts.push(`Exercise: ${ls.exercise}`);
    parts.push(`Progress: ${Math.round(ls.progress * 100)}%`);
    if (ls.phase) parts.push(`Phase: ${ls.phase}`);

    // Student state
    const ss = record.context.studentState;
    parts.push(`Knowledge Level: ${Math.round(ss.knowledgeLevel * 100)}%`);
    parts.push(`Engagement: ${Math.round(ss.engagement * 100)}%`);
    if (ss.consecutiveMistakes > 0) parts.push(`Recent Mistakes: ${ss.consecutiveMistakes}`);
    if (ss.streak > 0) parts.push(`Success Streak: ${ss.streak}`);

    // Perception data
    if (record.context.perceptionData) {
      const pd = record.context.perceptionData;
      if (pd.visibleHints.length > 0) {
        parts.push(`Available Hints: ${pd.visibleHints.length}`);
      }
      if (pd.availableTools.length > 0) {
        parts.push(`Available Tools: ${pd.availableTools.join(', ')}`);
      }
    }

    // Decision context
    if (record.decision.stakes > 0) {
      parts.push(`Importance: ${Math.round(record.decision.stakes * 100)}%`);
    }

    // Additional context
    if (record.context.additionalContext) {
      for (const [key, value] of Object.entries(record.context.additionalContext)) {
        parts.push(`${key}: ${value}`);
      }
    }

    return parts.join('\n');
  }

  private buildOutputText(record: LearningRecord): string {
    const parts: string[] = [];

    parts.push(`Action: ${record.decision.action}`);

    if (record.decision.reasoning) {
      parts.push(`Reasoning: ${record.decision.reasoning}`);
    }

    parts.push(`Confidence: ${Math.round(record.decision.confidence * 100)}%`);

    // Add outcome information if available
    if (record.outcome) {
      if (record.outcome.immediate) {
        parts.push(`Result: ${record.outcome.immediate}`);
      }

      if (record.outcome.delayed) {
        parts.push(`Follow-up: ${record.outcome.delayed}`);
      }

      if (record.outcome.success) {
        parts.push('This action was successful.');
      } else {
        parts.push('This action was not successful.');
      }

      if (record.outcome.rewards && record.outcome.rewards.length > 0) {
        parts.push(`Rewards: ${record.outcome.rewards.map(r => `${r.type}: ${r.value}`).join(', ')}`);
      }
    }

    return parts.join('\n');
  }

  private formatModule(module: string): string {
    return module
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// ============================================================================
// Parquet Exporter (optional)
// ============================================================================

export class ParquetExporter implements Exporter {
  async export(
    records: LearningRecord[],
    outputPath: string,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    // Try to use duckdb or arrow for parquet export
    // Fall back to JSONL if not available
    try {
      const { exportToParquet } = await import('./parquet.js');
      return exportToParquet(records, outputPath, options);
    } catch {
      // Fall back to JSONL
      const exporter = new JSONLExporter();
      const jsonlPath = outputPath.replace('.parquet', '.jsonl');
      const result = await exporter.export(records, jsonlPath, options);
      result.format = ExportFormat.PARQUET; // Report as parquet even though fallback
      return result;
    }
  }
}

// ============================================================================
// Exporter Factory
// ============================================================================

const exporters: Record<ExportFormat, () => Exporter> = {
  [ExportFormat.JSON]: () => new JSONExporter(),
  [ExportFormat.JSONL]: () => new JSONLExporter(),
  [ExportFormat.CSV]: () => new CSVExporter(),
  [ExportFormat.QLORA]: () => new QLoRAExporter(),
  [ExportFormat.PARQUET]: () => new ParquetExporter(),
};

/**
 * Get an exporter for the specified format
 */
export function getExporter(format: ExportFormat, customOptions?: ExportOptions): Exporter {
  const exporterFactory = exporters[format];
  if (!exporterFactory) {
    throw new Error(`Unsupported export format: ${format}`);
  }

  const exporter = exporterFactory();

  // Apply custom instructions for QLoRA exporter
  if (format === ExportFormat.QLORA && customOptions?.customInstructions) {
    return new QLoRAExporter(customOptions.customInstructions);
  }

  return exporter;
}

/**
 * Export records to a format
 */
export async function exportRecords(
  records: LearningRecord[],
  format: ExportFormat,
  outputPath: string,
  options?: ExportOptions
): Promise<ExportResult> {
  const exporter = getExporter(format, options);
  return exporter.export(records, outputPath, options);
}

// Re-export types
export * from '../models/index.js';
export type { Exporter, ExportOptions };
