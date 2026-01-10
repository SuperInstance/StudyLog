/**
 * StudyLoG.AI - Sitka Sound Module
 *
 * Teaches game theory and economics through Alaskan fishing simulation:
 * Solo fishing → Fleet management → Markets → Ecosystems → AI agents
 */

export const SITKA_SOUND_ID = 'sitka-sound';

export interface SitkaSoundStage {
  id: string;
  name: string;
  description: string;
  concepts: string[];
  godotScene: string;
  prerequisites: string[];
}

export const STAGES: SitkaSoundStage[] = [
  {
    id: 'ss-1-fisher',
    name: 'Solo Fisher',
    description: 'Learn resource gathering and basic economics',
    concepts: ['resource-gathering', 'inventory-management'],
    godotScene: 'res://modules/sitka_sound/stages/solo_fisher.tscn',
    prerequisites: [],
  },
  {
    id: 'ss-2-captain',
    name: 'Fleet Captain',
    description: 'Coordinate multiple boats and optimize routes',
    concepts: ['coordination', 'communication', 'optimization'],
    godotScene: 'res://modules/sitka_sound/stages/fleet_captain.tscn',
    prerequisites: ['ss-1-fisher'],
  },
  {
    id: 'ss-3-trader',
    name: 'Market Trader',
    description: 'Understand supply, demand, and negotiation',
    concepts: ['market-dynamics', 'negotiation', 'pricing'],
    godotScene: 'res://modules/sitka_sound/stages/market_trader.tscn',
    prerequisites: ['ss-2-captain'],
  },
  {
    id: 'ss-4-ecosystem',
    name: 'Ecosystem Manager',
    description: 'Balance sustainability with profit',
    concepts: ['ecosystem-balance', 'sustainability', 'prediction'],
    godotScene: 'res://modules/sitka_sound/stages/ecosystem.tscn',
    prerequisites: ['ss-3-trader'],
  },
  {
    id: 'ss-5-ai',
    name: 'AI Advisor',
    description: 'Design agents that fish autonomously',
    concepts: ['agent-design', 'multi-agent', 'emergent-behavior'],
    godotScene: 'res://modules/sitka_sound/stages/ai_advisor.tscn',
    prerequisites: ['ss-4-ecosystem'],
  },
];

export const SITKA_SOUND_CONFIG = {
  id: SITKA_SOUND_ID,
  name: 'Sitka Sound',
  description: 'Game theory through Alaskan fishing',
  icon: '🐟',
  color: '#1E90FF',
  stages: STAGES,
  estimatedHours: 25,
};
