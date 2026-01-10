/**
 * StudyLoG.AI - Cognitive Mill Module
 *
 * Teaches computing through the lens of industrial revolution:
 * Water wheels → Steam engines → Telegraph → Computers → Neural networks
 */

export const COGNITIVE_MILL_ID = 'cognitive-mill';

// Learning stages
export interface CognitiveMillStage {
  id: string;
  name: string;
  description: string;
  concepts: string[];
  godotScene: string;
  prerequisites: string[];
}

export const STAGES: CognitiveMillStage[] = [
  {
    id: 'cm-1-waterwheel',
    name: 'Water Wheel',
    description: 'Learn about mechanical advantage and energy transfer',
    concepts: ['gear-ratios', 'energy-transfer', 'mechanical-advantage'],
    godotScene: 'res://modules/cognitive_mill/stages/waterwheel.tscn',
    prerequisites: [],
  },
  {
    id: 'cm-2-steam',
    name: 'Steam Engine',
    description: 'Understand thermodynamics and feedback loops',
    concepts: ['feedback-loops', 'pressure', 'automation'],
    godotScene: 'res://modules/cognitive_mill/stages/steam.tscn',
    prerequisites: ['cm-1-waterwheel'],
  },
  {
    id: 'cm-3-telegraph',
    name: 'Telegraph',
    description: 'Discover binary signaling and communication protocols',
    concepts: ['binary-encoding', 'protocols', 'error-detection'],
    godotScene: 'res://modules/cognitive_mill/stages/telegraph.tscn',
    prerequisites: ['cm-2-steam'],
  },
  {
    id: 'cm-4-computer',
    name: 'Computer',
    description: 'Build logic gates and understand algorithms',
    concepts: ['logic-gates', 'algorithms', 'memory'],
    godotScene: 'res://modules/cognitive_mill/stages/computer.tscn',
    prerequisites: ['cm-3-telegraph'],
  },
  {
    id: 'cm-5-neural',
    name: 'Neural Network',
    description: 'Train simple neural networks and observe learning',
    concepts: ['neural-basics', 'weights', 'training'],
    godotScene: 'res://modules/cognitive_mill/stages/neural.tscn',
    prerequisites: ['cm-4-computer'],
  },
];

// Module configuration
export const COGNITIVE_MILL_CONFIG = {
  id: COGNITIVE_MILL_ID,
  name: 'Cognitive Mill',
  description: 'From water wheels to neural networks',
  icon: '⚙️',
  color: '#8B4513',
  stages: STAGES,
  estimatedHours: 20,
};
