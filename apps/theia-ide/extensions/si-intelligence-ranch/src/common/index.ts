/**
 * StudyLoG.AI - Intelligence Ranch Module
 *
 * Teaches agent design through livestock and working dogs:
 * Shepherding → Dog training → Multi-dog coordination → Breeding → AI rancher
 */

export const INTELLIGENCE_RANCH_ID = 'intelligence-ranch';

export interface IntelligenceRanchStage {
  id: string;
  name: string;
  description: string;
  concepts: string[];
  godotScene: string;
  prerequisites: string[];
}

export const STAGES: IntelligenceRanchStage[] = [
  {
    id: 'ir-1-shepherd',
    name: 'Shepherd',
    description: 'Direct control with immediate feedback',
    concepts: ['direct-control', 'feedback', 'spatial-reasoning'],
    godotScene: 'res://modules/intelligence_ranch/stages/shepherd.tscn',
    prerequisites: [],
  },
  {
    id: 'ir-2-trainer',
    name: 'Dog Trainer',
    description: 'Delegate tasks through command protocols',
    concepts: ['command-protocols', 'delegation', 'training'],
    godotScene: 'res://modules/intelligence_ranch/stages/trainer.tscn',
    prerequisites: ['ir-1-shepherd'],
  },
  {
    id: 'ir-3-manager',
    name: 'Ranch Manager',
    description: 'Coordinate multiple dogs and herds',
    concepts: ['multi-agent', 'coordination', 'scheduling'],
    godotScene: 'res://modules/intelligence_ranch/stages/manager.tscn',
    prerequisites: ['ir-2-trainer'],
  },
  {
    id: 'ir-4-breeding',
    name: 'Breeding Program',
    description: 'Optimize traits through selective breeding',
    concepts: ['optimization', 'genetic-algorithms', 'fitness'],
    godotScene: 'res://modules/intelligence_ranch/stages/breeding.tscn',
    prerequisites: ['ir-3-manager'],
  },
  {
    id: 'ir-5-ai-rancher',
    name: 'AI Rancher',
    description: 'Design autonomous agent policies',
    concepts: ['policy-design', 'emergent-behavior', 'autonomy'],
    godotScene: 'res://modules/intelligence_ranch/stages/ai_rancher.tscn',
    prerequisites: ['ir-4-breeding'],
  },
];

export const INTELLIGENCE_RANCH_CONFIG = {
  id: INTELLIGENCE_RANCH_ID,
  name: 'Intelligence Ranch',
  description: 'Agent design through livestock management',
  icon: '🐕',
  color: '#228B22',
  stages: STAGES,
  estimatedHours: 30,
};
