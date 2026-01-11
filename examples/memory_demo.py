#!/usr/bin/env python3
"""
StudyLoG.AI Memory System Demo
===============================

Demonstrates the hierarchical memory system adapted from SuperInstance research.

Features shown:
- Working memory (short-term cognitive workspace)
- Episodic memory (learning events with excitement tracking)
- Semantic memory (concepts with prerequisites)
- Procedural memory (skills with mastery progression)
- Memory consolidation (automatic transfer between tiers)
- Spaced repetition scheduling
- Skill tree visualization
- Gamification (achievements, XP, levels)
"""

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from memory import create_studylog_memory


def print_section(title: str):
    """Print a section header."""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def main():
    """Run the memory system demonstration."""

    print_section("StudyLoG.AI Memory System Demo")
    print("\nInitializing memory system for learner 'student_123'...")

    # Create memory system
    memory = create_studylog_memory(
        learner_id="student_123",
        storage_path="/tmp/studylog_memory_save.json",
    )

    print(f"Memory system initialized: {memory}")
    print(f"Learner level: {memory.profile.level}")
    print(f"Learner XP: {memory.profile.xp}")

    # === Working Memory ===
    print_section("1. Working Memory (Short-term)")

    memory.working.add("task1", "Learn about neural networks", importance=0.8)
    memory.working.add("task2", "Practice Python basics", importance=0.6)
    memory.working.add("task3", "Complete ML tutorial", importance=0.9)

    print(f"Added 3 tasks to working memory")
    print(f"Current items: {len(memory.working)}")
    print(f"Capacity: {memory.working.capacity}")

    retrieved = memory.working.get("task1")
    print(f"Retrieved 'task1': {retrieved}")

    # === Learning Session ===
    print_section("2. Learning Session & Episodic Memory")

    session_id = memory.start_learning_session("deep_learning")
    print(f"Started session: {session_id}")

    # Record learning events
    memory.record_learning(
        content="Learned about perceptrons and activation functions",
        excitement=0.6,
        topic="neural_networks",
        context={"difficulty": "medium"},
    )

    memory.record_learning(
        content="Understood backpropagation algorithm!",
        excitement=0.9,  # High excitement!
        topic="deep_learning",
        context={"breakthrough": True},
    )

    memory.record_learning(
        content="Built my first neural network from scratch",
        excitement=0.8,
        topic="practical_ml",
        context={"project": "nn_from_scratch"},
    )

    print(f"Recorded 3 learning events")
    print(f"Learner XP: {memory.profile.xp}")
    print(f"Learner level: {memory.profile.level}")

    # End session
    session_summary = memory.end_learning_session()
    print(f"\nSession ended:")
    print(f"  Duration: {session_summary['duration_minutes']:.1f} minutes")
    print(f"  Events: {session_summary['events_count']}")
    print(f"  Avg excitement: {session_summary['average_excitement']:.2f}")

    # === Skills ===
    print_section("3. Procedural Memory (Skills)")

    # Add skills
    memory.add_skill("python", category="programming", prerequisites=[])
    memory.add_skill("numpy", category="programming", prerequisites=["python"])
    memory.add_skill("pytorch", category="deep_learning", prerequisites=["python", "numpy"])
    memory.add_skill("tensorflow", category="deep_learning", prerequisites=["python", "numpy"])

    print(f"Added 4 skills")

    # Practice python (already know it)
    for i in range(20):
        result = memory.practice_skill("python", success=True, minutes=15)
        if i % 5 == 0:
            print(f"  Practiced python: mastery={result['mastery']:.2f}, tier={result['mastery_tier']}")

    # Practice pytorch (learning it)
    print(f"\nLearning pytorch...")
    for i in range(15):
        result = memory.practice_skill("pytorch", success=i > 3, minutes=30)
        if i % 5 == 0:
            print(f"  Practiced pytorch: mastery={result['mastery']:.2f}, tier={result['mastery_tier']}")

    # Get skill info
    skill_info = memory.get_skill("python")
    print(f"\nPython skill info:")
    print(f"  Mastery: {skill_info['mastery_level']:.2f}")
    print(f"  Tier: {skill_info['mastery_tier']}")
    print(f"  Practices: {skill_info['practice_count']}")
    print(f"  Success rate: {skill_info['success_rate']:.1%}")

    # === Concepts ===
    print_section("4. Semantic Memory (Concepts)")

    memory.add_concept(
        "neural_network",
        attributes={"type": "architecture", "complexity": "high"},
        prerequisites=["perceptron", "activation_function"],
    )

    memory.add_concept(
        "perceptron",
        attributes={"type": "basic_unit", "complexity": "low"},
        prerequisites=[],
    )

    memory.add_concept(
        "backpropagation",
        attributes={"type": "algorithm", "complexity": "high"},
        prerequisites=["neural_network", "gradient_descent"],
    )

    memory.add_concept(
        "transformer",
        attributes={"type": "architecture", "complexity": "very_high"},
        prerequisites=["attention_mechanism", "neural_network"],
    )

    print(f"Added 4 concepts with prerequisite relationships")

    # Get accessible concepts
    accessible = memory.get_accessible_concepts()
    print(f"Accessible concepts (prerequisites met): {accessible}")

    # === Consolidation ===
    print_section("5. Memory Consolidation")

    # Add items to consolidation queue
    for key in list(memory.working.keys()):
        memory.consolidation.add_working_to_queue(key)

    print(f"Queued {memory.consolidation.get_queue_size()} items")

    # Run consolidation
    result = memory.consolidation.consolidate()
    print(f"\nConsolidation result:")
    print(f"  Success: {result.success}")
    print(f"  Items consolidated: {result.items_consolidated}")
    print(f"  Patterns extracted: {result.patterns_extracted}")
    print(f"  Concepts created: {result.concepts_created}")

    # === Spaced Repetition ===
    print_section("6. Spaced Repetition Scheduling")

    review_schedule = memory.get_review_schedule()
    print(f"Items due for review: {len(review_schedule)}")
    for item in review_schedule[:3]:
        print(f"  - [{item['type']}] {item['name']}: {item['reason']}")

    # === Recommendations ===
    print_section("7. Learning Recommendations")

    recommendations = memory.get_recommendations()
    print(f"Personalized recommendations: {len(recommendations)}")
    for rec in recommendations[:3]:
        print(f"  - {rec['item_name']}: {rec['reason']}")
        print(f"    Priority: {rec['priority']:.2f}, Est. time: {rec['estimated_time_minutes']} min")

    # === Quiz Generation ===
    print_section("8. Quiz Generation")

    # Add some concepts with definitions for quiz
    memory.semantic.add_concept(
        "gradient_descent",
        attributes={"definition": "An optimization algorithm that iteratively adjusts parameters to minimize a loss function"},
    )

    quiz = memory.generate_quiz(topic="gradient", count=3)
    print(f"Generated {len(quiz)} quiz questions:")
    for i, q in enumerate(quiz, 1):
        print(f"\n  Q{i}: {q['question']}")
        for j, opt in enumerate(q['options']):
            print(f"    {j+1}. {opt}")

    # === Skill Tree ===
    print_section("9. Skill Tree Visualization")

    skill_tree = memory.get_skill_tree()
    print(f"Skill tree for Godot visualization:")
    print(f"  Nodes: {len(skill_tree['nodes'])}")
    print(f"  Learner level: {skill_tree['learner_level']}")
    print(f"\n  Sample nodes:")
    for node in skill_tree['nodes'][:3]:
        print(f"    - {node['name']}: mastery={node['mastery']:.2f}, status={node['status']}")

    # === Statistics ===
    print_section("10. System Statistics")

    stats = memory.get_stats()
    print(f"Learner stats:")
    print(f"  Level: {stats['learner']['level']}")
    print(f"  XP: {stats['learner']['xp']}")
    print(f"  Study hours: {stats['learner']['total_study_hours']:.1f}")
    print(f"  Achievements: {stats['learner']['achievements_unlocked']}")

    print(f"\nWorking memory:")
    print(f"  Items: {stats['working']['total_items']}")
    print(f"  Capacity utilization: {stats['working']['capacity_utilization']:.1%}")

    print(f"\nEpisodic memory:")
    print(f"  Events: {stats['episodic']['total_events']}")
    print(f"  Avg excitement: {stats['episodic']['average_excitement']:.2f}")

    print(f"\nSemantic memory:")
    print(f"  Concepts: {stats['semantic']['total_concepts']}")

    print(f"\nProcedural memory:")
    print(f"  Skills: {stats['procedural']['total_skills']}")
    print(f"  Total practice: {stats['procedural']['total_practice']}")
    print(f"  Expert+ skills: {stats['procedural']['expert_skills'] + stats['procedural']['master_skills']}")

    # === Persistence ===
    print_section("11. Persistence")

    saved = memory.save()
    print(f"Memory saved: {saved}")

    # === Achievement Check ===
    print_section("12. Achievements")

    achievements = memory.get_achievements()
    print(f"Available achievements: {len(achievements)}")
    for ach in achievements:
        status = "UNLOCKED" if ach['unlocked'] else "locked"
        print(f"  [{status}] {ach['name']}: {ach['description']} (+{ach['reward_xp']} XP)")

    print("\n" + "=" * 60)
    print("  Demo Complete!")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
