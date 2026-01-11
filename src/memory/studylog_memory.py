"""
StudyLoG Memory System
======================

Main interface for the hierarchical memory system in StudyLoG.AI.
Integrates all memory tiers with StudyLoG-specific features.

Features:
- Four-tier memory architecture (Working, Episodic, Semantic, Procedural)
- Learning session tracking
- Gamified skill trees
- Achievement system
- Spaced repetition scheduling
- Collaborative learning
- Godot visualization support
"""

import time
import json
from typing import List, Dict, Any, Optional, Set, Callable
from dataclasses import dataclass, field
from pathlib import Path

from .core import (
    MemoryTier,
    MemoryType,
    MemoryItem,
    ImportanceLevel,
    MasteryLevel,
    LearningSession,
    SkillTreeNode,
)
from .working import WorkingMemory, create_working_memory
from .episodic import EpisodicMemory, LearningEvent, create_episodic_memory
from .semantic import SemanticMemory, Concept, create_semantic_memory
from .procedural import (
    ProceduralMemory,
    Skill,
    StudyLoGMasteryLevel,
    create_procedural_memory,
)
from .consolidation import MemoryConsolidation, create_consolidation_pipeline, ConsolidationTrigger
from .retrieval import MemoryRetrieval, RetrievalMode, create_retrieval_system


@dataclass
class Achievement:
    """An achievement that can be unlocked."""
    id: str
    name: str
    description: str
    requirement: str
    unlocked: bool = False
    unlocked_at: Optional[float] = None
    icon: Optional[str] = None
    reward_xp: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "requirement": self.requirement,
            "unlocked": self.unlocked,
            "unlocked_at": self.unlocked_at,
            "icon": self.icon,
            "reward_xp": self.reward_xp,
        }


@dataclass
class LearnerProfile:
    """Profile for a learner using StudyLoG.AI."""
    learner_id: str
    name: str
    xp: int = 0
    level: int = 1
    total_study_time_minutes: float = 0.0
    achievements: List[str] = field(default_factory=list)
    current_session_id: Optional[str] = None
    preferences: Dict[str, Any] = field(default_factory=dict)

    @property
    def xp_to_next_level(self) -> int:
        """XP needed for next level."""
        return self.level * 100

    @property
    def progress_percent(self) -> float:
        """Progress to next level (0-100)."""
        return (self.xp % 100) / 100.0

    def add_xp(self, amount: int) -> bool:
        """Add XP and check for level up."""
        self.xp += amount
        old_level = self.level
        self.level = 1 + (self.xp // 100)
        return self.level > old_level


class StudyLoGMemory:
    """
    Main memory system interface for StudyLoG.AI.

    Integrates:
    - Working Memory: Current learning context
    - Episodic Memory: Learning events with excitement tracking
    - Semantic Memory: Concepts and knowledge
    - Procedural Memory: Skills with mastery progression
    - Consolidation: Automatic memory transfer
    - Retrieval: Multi-modal search
    - Gamification: Achievements, levels, XP
    - Spaced Repetition: Smart review scheduling

    Example:
        memory = create_studylog_memory(learner_id="student_123")

        # Start a learning session
        memory.start_learning_session("neural_networks")

        # Record learning event
        memory.record_learning(
            content="Learned about backpropagation",
            excitement=0.8,
            topic="deep_learning",
        )

        # Practice a skill
        memory.practice_skill("pytorch", success=True)

        # End session
        memory.end_learning_session()

        # Get recommendations
        recommendations = memory.get_recommendations()
    """

    def __init__(
        self,
        learner_id: str,
        working_capacity: int = 20,
        episodic_capacity: int = 1000,
        semantic_embedding_dim: int = 384,
        consolidation_threshold: float = 0.7,
        storage_path: Optional[str] = None,
    ):
        """
        Initialize StudyLoG memory system.

        Args:
            learner_id: Unique learner identifier
            working_capacity: Working memory capacity
            episodic_capacity: Episodic memory capacity
            semantic_embedding_dim: Semantic embedding dimension
            consolidation_threshold: Importance threshold for consolidation
            storage_path: Path for persistent storage
        """
        self.learner_id = learner_id
        self.storage_path = storage_path

        # Initialize memory tiers
        self.working = create_working_memory(
            capacity=working_capacity,
            on_evict=self._on_working_evict,
        )
        self.episodic = create_episodic_memory(capacity=episodic_capacity)
        self.semantic = create_semantic_memory(embedding_dim=semantic_embedding_dim)
        self.procedural = create_procedural_memory()

        # Initialize supporting systems
        self.consolidation = create_consolidation_pipeline(
            working_memory=self.working,
            episodic_memory=self.episodic,
            semantic_memory=self.semantic,
            consolidation_threshold=consolidation_threshold,
        )
        self.consolidation.on_achievement_unlock = self._on_achievement_unlock

        self.retrieval = create_retrieval_system(
            working_memory=self.working,
            episodic_memory=self.episodic,
            semantic_memory=self.semantic,
            procedural_memory=self.procedural,
        )

        # Learner profile
        self.profile = LearnerProfile(learner_id=learner_id, name=learner_id)

        # Learning sessions
        self._sessions: Dict[str, LearningSession] = {}
        self._current_session: Optional[LearningSession] = None

        # Achievements
        self._achievements: Dict[str, Achievement] = {}
        self._register_default_achievements()

        # Callbacks
        self.on_level_up: Optional[Callable[[int], None]] = None
        self.on_achievement_unlocked: Optional[Callable[[Achievement], None]] = None
        self.on_tier_up: Optional[Callable[[str, StudyLoGMasteryLevel], None]] = None

    # === Learning Session Management ===

    def start_learning_session(self, topic: str) -> str:
        """
        Start a new learning session.

        Args:
            topic: Topic being studied

        Returns:
            Session ID
        """
        session_id = f"session_{int(time.time())}_{topic}"

        session = LearningSession(
            session_id=session_id,
            learner_id=self.learner_id,
            topic=topic,
            start_time=time.time(),
        )

        self._sessions[session_id] = session
        self._current_session = session
        self.profile.current_session_id = session_id

        return session_id

    def record_learning(
        self,
        content: str,
        excitement: float = 0.0,
        importance: Optional[float] = None,
        topic: str = "",
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Record a learning event.

        Args:
            content: What was learned
            excitement: Learning excitement (0-1)
            importance: Optional importance score
            topic: Topic being studied
            context: Additional context

        Returns:
            Event ID
        """
        # Add to working memory
        self.working.add(
            key=f"learning_{int(time.time())}",
            content=content,
            importance=(importance or 5.0) / 10.0,
        )

        # Add to episodic memory
        event_id = self.episodic.add(
            content=content,
            excitement=excitement,
            emotional_valence=excitement * 2 - 1.0,  # Convert to -1 to 1
            importance=importance,
            topic=topic,
            context=context or {},
        )

        # Track in session
        if self._current_session:
            self._current_session.events.append(event_id)
            self._current_session.excitement_levels.append(excitement)

        # Award XP for learning
        xp_gain = int(10 * (1 + excitement))
        if self.profile.add_xp(xp_gain):
            if self.on_level_up:
                self.on_level_up(self.profile.level)

        # Queue for consolidation
        self.consolidation.add_working_to_queue(
            f"learning_{int(time.time())}",
            priority=0.5 + (excitement * 0.3),
        )

        return event_id

    def end_learning_session(self) -> Optional[Dict[str, Any]]:
        """
        End current learning session.

        Returns:
            Session summary if session was active
        """
        if not self._current_session:
            return None

        self._current_session.end_time = time.time()
        session = self._current_session
        self._current_session = None
        self.profile.current_session_id = None

        # Update total study time
        self.profile.total_study_time_minutes += session.duration_minutes

        # Run consolidation after session
        self.consolidation.consolidate(trigger=ConsolidationTrigger.MANUAL)

        return {
            "session_id": session.session_id,
            "topic": session.topic,
            "duration_minutes": session.duration_minutes,
            "events_count": len(session.events),
            "average_excitement": session.average_excitement,
            "achievements": session.achievements,
        }

    # === Skill Management ===

    def add_skill(
        self,
        name: str,
        category: str = "general",
        prerequisites: Optional[List[str]] = None,
    ) -> bool:
        """Add a new skill to track."""
        return self.procedural.add_skill(
            name=name,
            category=category,
            prerequisites=prerequisites,
        )

    def practice_skill(
        self,
        name: str,
        success: bool = True,
        performance: Optional[float] = None,
        minutes: float = 30.0,
    ) -> Dict[str, Any]:
        """
        Practice a skill and track improvement.

        Returns:
            Practice result with mastery info
        """
        practiced, mastery, tier_up = self.procedural.practice(
            name=name,
            success=success,
            performance=performance,
            minutes=minutes,
        )

        if not practiced:
            return {"success": False, "error": "Skill not found"}

        skill = self.procedural.get_skill(name)

        # Award XP
        xp_gain = int(5 * (1 + mastery))
        leveled_up = self.profile.add_xp(xp_gain)

        result = {
            "success": True,
            "skill": name,
            "mastery": mastery,
            "mastery_tier": skill.mastery_name if skill else "unknown",
            "tier_upgraded": tier_up.name if tier_up else None,
            "xp_gained": xp_gain,
            "leveled_up": leveled_up,
            "new_level": self.profile.level if leveled_up else None,
        }

        # Handle tier up
        if tier_up and self.on_tier_up:
            self.on_tier_up(name, tier_up)

        return result

    def get_skill(self, name: str) -> Optional[Dict[str, Any]]:
        """Get skill information."""
        skill = self.procedural.get_skill(name)
        if not skill:
            return None
        return skill.to_dict()

    def get_skills(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all skills, optionally filtered by category."""
        if category:
            skills = self.procedural.get_skills_by_category(category)
        else:
            skills = list(self.procedural._skills.values())

        return [s.to_dict() for s in skills]

    # === Concept Management ===

    def add_concept(
        self,
        name: str,
        attributes: Optional[Dict[str, Any]] = None,
        prerequisites: Optional[List[str]] = None,
    ) -> bool:
        """Add a concept to semantic memory."""
        return self.semantic.add_concept(
            name=name,
            attributes=attributes,
            prerequisites=prerequisites,
        )

    def get_concept(self, name: str) -> Optional[Dict[str, Any]]:
        """Get concept information."""
        concept = self.semantic.get_concept(name)
        if not concept:
            return None
        return concept.to_dict()

    def get_accessible_concepts(self) -> List[str]:
        """Get concepts whose prerequisites are met."""
        known = set(self.semantic._concepts.keys())
        return self.semantic.get_accessible_concepts(known)

    # === Recommendations & Quiz ===

    def get_recommendations(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Get personalized learning recommendations."""
        known = set(self.semantic._concepts.keys())
        recommendations = self.retrieval.get_recommendations(known, limit)
        return [r.to_dict() for r in recommendations]

    def generate_quiz(
        self,
        topic: Optional[str] = None,
        count: int = 5,
    ) -> List[Dict[str, Any]]:
        """Generate quiz questions from memory."""
        questions = self.retrieval.generate_quiz_questions(
            topic=topic,
            count=count,
        )
        return [q.to_dict() for q in questions]

    # === Spaced Repetition ===

    def get_review_schedule(self) -> List[Dict[str, Any]]:
        """Get items due for review based on forgetting curves."""
        schedule = []

        # Check skills that need review
        for skill_name, skill in self.procedural._skills.items():
            if skill.is_forgotten(threshold=0.7):
                schedule.append({
                    "type": "skill",
                    "name": skill_name,
                    "reason": "Skill mastery has decayed",
                    "priority": skill.mastery_level,
                })

        # Check concepts that should be reviewed
        for concept_name, concept in self.semantic._concepts.items():
            review_hours = self.consolidation.schedule_review(
                topic=concept_name,
                current_mastery=concept.confidence,
            )
            if review_hours and review_hours < 24:
                schedule.append({
                    "type": "concept",
                    "name": concept_name,
                    "reason": "Due for review",
                    "priority": 1.0 - (review_hours / 24),
                })

        schedule.sort(key=lambda x: x["priority"], reverse=True)
        return schedule

    # === Achievement System ===

    def _register_default_achievements(self):
        """Register default achievements."""
        achievements = [
            Achievement(
                id="first_learning",
                name="First Steps",
                description="Complete your first learning session",
                requirement="Complete 1 learning session",
                reward_xp=50,
            ),
            Achievement(
                id="week_streak",
                name="Dedicated Learner",
                description="Study for 7 days in a row",
                requirement="7 day streak",
                reward_xp=200,
            ),
            Achievement(
                id="skill_master",
                name="Skill Master",
                description="Reach Master tier in any skill",
                requirement="Master tier (85%+)",
                reward_xp=500,
            ),
            Achievement(
                id="knowledge_seeker",
                name="Knowledge Seeker",
                description="Learn 100 concepts",
                requirement="100 concepts learned",
                reward_xp=300,
            ),
            Achievement(
                id="consolidator",
                name="Memory Consolidator",
                description="Consolidate 100 memories",
                requirement="100 consolidations",
                reward_xp=150,
            ),
        ]

        for achievement in achievements:
            self._achievements[achievement.id] = achievement

    def unlock_achievement(self, achievement_id: str) -> bool:
        """Unlock an achievement."""
        achievement = self._achievements.get(achievement_id)
        if not achievement or achievement.unlocked:
            return False

        achievement.unlocked = True
        achievement.unlocked_at = time.time()
        self.profile.achievements.append(achievement_id)

        # Award XP
        self.profile.add_xp(achievement.reward_xp)

        # Trigger callback
        if self.on_achievement_unlocked:
            self.on_achievement_unlocked(achievement)

        return True

    def get_achievements(self) -> List[Dict[str, Any]]:
        """Get all achievements."""
        return [a.to_dict() for a in self._achievements.values()]

    def _on_achievement_unlock(self, achievement_id: str, context: Dict[str, Any]):
        """Handle achievement unlock from consolidation."""
        self.unlock_achievement(achievement_id)

    def _on_working_evict(self, key: str, content: Any):
        """Handle working memory eviction - queue for consolidation."""
        self.consolidation.add_working_to_queue(key, priority=0.6)

    # === Skill Tree Visualization ===

    def get_skill_tree(self) -> Dict[str, Any]:
        """
        Generate skill tree for visualization.

        Returns:
            Dict with nodes and edges for Godot visualization
        """
        tree = self.procedural.get_skill_tree()

        # Add visualization data
        nodes = []
        for skill_id, skill_data in tree.items():
            # Calculate position (simple tree layout)
            depth = len(skill_data.get("prerequisites", []))
            siblings_at_depth = sum(
                1 for s in tree.values()
                if len(s.get("prerequisites", [])) == depth
            )

            node = SkillTreeNode(
                skill_id=skill_id,
                name=skill_data["name"],
                mastery=skill_data["mastery"],
                prerequisites=skill_data.get("prerequisites", []),
                children=[],
                position=(depth * 200, siblings_at_depth * 100),
                unlocked=skill_data.get("unlocked", True),
                status="completed" if skill_data["mastery"] >= 0.9 else
                       "in_progress" if skill_data["mastery"] > 0 else
                       "available" if skill_data.get("unlocked") else "locked",
            )
            nodes.append(node.to_godot_dict())

        return {
            "nodes": nodes,
            "learner_level": self.profile.level,
            "learner_xp": self.profile.xp,
        }

    # === Statistics ===

    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive memory system statistics."""
        return {
            "learner": {
                "id": self.profile.learner_id,
                "level": self.profile.level,
                "xp": self.profile.xp,
                "total_study_hours": self.profile.total_study_time_minutes / 60,
                "achievements_unlocked": len(self.profile.achievements),
            },
            "working": self.working.get_statistics(),
            "episodic": self.episodic.get_statistics(),
            "semantic": self.semantic.get_statistics(),
            "procedural": self.procedural.get_statistics(),
            "consolidation": self.consolidation.get_consolidation_stats(),
        }

    # === Persistence ===

    def save(self, path: Optional[str] = None) -> bool:
        """Save memory state to file."""
        save_path = path or self.storage_path
        if not save_path:
            return False

        try:
            data = {
                "learner_id": self.learner_id,
                "profile": {
                    "xp": self.profile.xp,
                    "level": self.profile.level,
                    "total_study_time_minutes": self.profile.total_study_time_minutes,
                    "achievements": self.profile.achievements,
                },
                "stats": self.get_stats(),
            }

            Path(save_path).parent.mkdir(parents=True, exist_ok=True)
            with open(save_path, "w") as f:
                json.dump(data, f, indent=2, default=str)

            return True
        except Exception:
            return False

    def load(self, path: Optional[str] = None) -> bool:
        """Load memory state from file."""
        load_path = path or self.storage_path
        if not load_path or not Path(load_path).exists():
            return False

        try:
            with open(load_path, "r") as f:
                data = json.load(f)

            self.profile.xp = data["profile"]["xp"]
            self.profile.level = data["profile"]["level"]
            self.profile.total_study_time_minutes = data["profile"]["total_study_time_minutes"]
            self.profile.achievements = data["profile"]["achievements"]

            return True
        except Exception:
            return False

    def __repr__(self) -> str:
        return f"StudyLoGMemory(learner={self.learner_id}, level={self.profile.level})"


def create_studylog_memory(
    learner_id: str,
    working_capacity: int = 20,
    episodic_capacity: int = 1000,
    semantic_embedding_dim: int = 384,
    consolidation_threshold: float = 0.7,
    storage_path: Optional[str] = None,
) -> StudyLoGMemory:
    """
    Factory function to create StudyLoG memory system.

    Args:
        learner_id: Unique learner identifier
        working_capacity: Working memory capacity
        episodic_capacity: Episodic memory capacity
        semantic_embedding_dim: Semantic embedding dimension
        consolidation_threshold: Importance threshold for consolidation
        storage_path: Path for persistent storage

    Returns:
        Configured StudyLoGMemory instance
    """
    return StudyLoGMemory(
        learner_id=learner_id,
        working_capacity=working_capacity,
        episodic_capacity=episodic_capacity,
        semantic_embedding_dim=semantic_embedding_dim,
        consolidation_threshold=consolidation_threshold,
        storage_path=storage_path,
    )
