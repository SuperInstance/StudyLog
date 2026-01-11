/**
 * StudyLoG.AI - Character System Example
 *
 * Demonstrates how to use the AI character system.
 */

import {
  AICharacter,
  CharacterFactory,
  ScenarioType,
  DecisionSource,
} from './src/index';

async function main() {
  console.log('=== StudyLoG.AI Character System Demo ===\n');

  // Create characters
  const ada = CharacterFactory.createAda();
  const alan = CharacterFactory.createAlan();
  const grace = CharacterFactory.createGrace();

  // Display character information
  console.log('--- Available Characters ---');
  console.log(ada.getDescription());
  console.log('\n' + '-'.repeat(50) + '\n');
  console.log(alan.getDescription());
  console.log('\n' + '-'.repeat(50) + '\n');
  console.log(grace.getDescription());

  // Simulate student interactions
  const student = {
    id: 'student_123',
    name: 'Alex',
    skillLevel: 0.5,
    frustrationLevel: 0.3,
    recentFailures: 0,
    recentSuccesses: 2,
  };

  // Example 1: Ada teaches a concept
  console.log('\n--- Example 1: Ada Explains Neural Networks ---');
  const adaLesson = await ada.teachConcept('neural networks', student);
  console.log(`Ada says: "${adaLesson}"`);

  // Example 2: Alan explains algorithms
  console.log('\n--- Example 2: Alan Explains Sorting ---');
  const alanLesson = await alan.teachConcept('sorting algorithms', student);
  console.log(`Alan says: "${alanLesson}"`);

  // Example 3: Grace provides a hint
  console.log('\n--- Example 3: Grace Provides a Hint ---');
  const hint = grace.provideHint('backpropagation', 0.33, student);
  console.log(`Grace says: "${hint}"`);

  // Example 4: Celebrate success
  console.log('\n--- Example 4: Celebration ---');
  const celebration = ada.celebrateSuccess('Alex', 'Building Your First Neural Network');
  console.log(`Ada says: "${celebration}"`);

  // Show character relationships
  console.log('\n--- Character Relationships ---');
  const adaRelationship = ada.getRelationship('student_123');
  if (adaRelationship) {
    console.log(`Ada's relationship with Alex:`);
    console.log(`  Interactions: ${adaRelationship.interactionCount}`);
    console.log(`  Trust Level: ${adaRelationship.trustLevel.toFixed(2)}`);
    console.log(`  Concepts Taught: ${adaRelationship.conceptsTaught.join(', ')}`);
  }

  // Show memory statistics
  console.log('\n--- Ada\'s Memory Stats ---');
  const adaStats = ada.memory.getStats();
  console.log(`Total Memories: ${adaStats.totalMemories}`);
  console.log(`By Type:`);
  console.log(`  Working: ${adaStats.byType.working}`);
  console.log(`  Episodic: ${adaStats.byType.episodic}`);
  console.log(`  Semantic: ${adaStats.byType.semantic}`);
  console.log(`Emotional Balance: ${adaStats.emotionalBalance.toFixed(2)}`);

  // Show character mood
  console.log('\n--- Character Moods ---');
  console.log(`Ada's Mood: ${ada.getMood().toFixed(2)}`);
  console.log(`Alan's Mood: ${alan.getMood().toFixed(2)}`);
  console.log(`Grace's Mood: ${grace.getMood().toFixed(2)}`);

  // Generate narrative
  console.log('\n--- Ada\'s Experience Narrative ---');
  const narrative = ada.memory.generateNarrative();
  console.log(`Coherence Score: ${narrative.coherenceScore.toFixed(2)}`);
  console.log(`Key Themes: ${narrative.keyThemes.join(', ')}`);
  console.log(`Narrative: ${narrative.narrative.substring(0, 200)}...`);

  // Show progression
  console.log('\n--- Character Progression ---');
  console.log('Stage 1 Characters:');
  for (const char of CharacterFactory.getCharactersForStage(1)) {
    console.log(`  - ${char.name} (${char.title})`);
  }
  console.log('\nStage 2 Characters:');
  for (const char of CharacterFactory.getCharactersForStage(2)) {
    console.log(`  - ${char.name} (${char.title})`);
  }
  console.log('\nStage 3 Characters:');
  for (const char of CharacterFactory.getCharactersForStage(3)) {
    console.log(`  - ${char.name} (${char.title})`);
  }

  console.log('\n=== Demo Complete ===');
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main };
