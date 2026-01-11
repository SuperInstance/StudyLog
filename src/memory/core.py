"""
Core Memory Types and Data Structures
=====================================

Foundational data structures for the hierarchical memory system.
Based on SuperInstance hierarchical-memory research.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import hashlib
import time


class MemoryTier(Enum):
    """Memory hierarchy tiers based on cognitive science."""
    WORKING = "working"        # Short-term, capacity-limited (STM)
    EPISODIC = "episodic"      # Events and experiences (LTM)
    SEMANTIC = "semantic"      # Concepts and knowledge (LTM)
    PROCEDURAL = "procedural"  # Skills and abilities (LTM)


class MemoryType(Enum):
    """Types of memory content."""
    FACT = "fact"                    # Declarative knowledge
    EVENT = "event"                  # Episodic experience
    CONCEPT = "concept"              # Abstract idea
    SKILL = "skill"                  # Procedural ability
    PATTERN = "pattern"              # Recognized pattern
    MISCONCEPTION = "misconception"  # Incorrect belief to correct


class ImportanceLevel(Enum):
    """Importance scoring for memory prioritization (1-10)."""
    FORGOTTEN = 1
    ROUTINE = 3
    NOTABLE = 5
    SIGNIFICANT = 7
    CRITICAL = 9
    CORE_IDENTITY = 10


@dataclass
class MemoryItem:
    """
    Base memory item with metadata.

    Attributes:
        id: Unique identifier (hash-based)
        content: The memory content
        memory_type: Type of memory content
        tier: Which memory tier this belongs to
        timestamp: Creation time
        importance: Priority score (1-10)
        emotional_valence: Emotional charge (-1 to 1)
        access_count: Number of times accessed
        last_accessed: Last access timestamp
        consolidated: Whether consolidated to higher tier
        tags: Searchable tags
        metadata: Additional context
    """
    id: str
    content: str
    memory_type: MemoryType
    tier: MemoryTier
    timestamp: float
    importance: float = 5.0
    emotional_valence: float = 0.0
    access_count: int = 0
    last_accessed: float = 0.0
    consolidated: bool = False
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if self.last_accessed == 0.0:
            self.last_accessed = self.timestamp

    @property
    def age_seconds(self) -> float:
        """Age of memory in seconds."""
        return time.time() - self.timestamp

    @property
    def age_hours(self) -> float:
        """Age of memory in hours."""
        return self.age_seconds / 3600

    @property
    def age_days(self) -> float:
        """Age of memory in days."""
        return self.age_seconds / 86400

    def calculate_priority(self, decay_half_life: float = 1800.0) -> float:
        """
        Calculate priority score for eviction/consolidation.

        Args:
            decay_half_life: Half-life for exponential decay

        Returns:
            Priority score (higher = more important)
        """
        # Time-based decay
        decay_factor = 0.5 ** (self.age_seconds / decay_half_life)
        decayed_importance = self.importance * decay_factor

        # Access frequency boost
        access_boost = min(self.access_count * 0.1, 2.0)

        # Emotional intensity boost (absolute value)
        emotion_boost = abs(self.emotional_valence) * 2.0

        return decayed_importance + access_boost + emotion_boost

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "id": self.id,
            "content": self.content,
            "memory_type": self.memory_type.value,
            "tier": self.tier.value,
            "timestamp": self.timestamp,
            "importance": self.importance,
            "emotional_valence": self.emotional_valence,
            "access_count": self.access_count,
            "last_accessed": self.last_accessed,
            "consolidated": self.consolidated,
            "tags": self.tags,
            "metadata": self.metadata,
            "age_seconds": self.age_seconds,
            "priority": self.calculate_priority(),
        }

    @staticmethod
    def generate_id(content: str, timestamp: Optional[float] = None) -> str:
        """Generate unique memory ID from content and timestamp."""
        if timestamp is None:
            timestamp = time.time()
        unique_str = f"{content}{timestamp}"
        return hashlib.md5(unique_str.encode()).hexdigest()[:16]


@dataclass
class SkillMemory(MemoryItem):
    """
    Specialized memory for procedural skills.

    Attributes:
        skill_name: Name of the skill
        mastery_level: Current mastery (0-1)
        practice_count: Number of practice sessions
        success_count: Successful practice sessions
        prerequisites: Required skills
        performance_history: Recent performance scores
    """
    skill_name: str = ""
    mastery_level: float = 0.0
    practice_count: int = 0
    success_count: int = 0
    prerequisites: List[str] = field(default_factory=list)
    performance_history: List[float] = field(default_factory=list)

    @property
    def success_rate(self) -> float:
        """Calculate success rate."""
        if self.practice_count == 0:
            return 0.0
        return self.success_count / self.practice_count

    @property
    def mastery_name(self) -> str:
        """Get mastery level name."""
        level = self.get_mastery_tier()
        return level.name

    def get_mastery_tier(self) -> "MasteryLevel":
        """Get MasteryLevel enum from mastery score."""
        if self.mastery_level >= 0.95:
            return MasteryLevel.MASTER
        elif self.mastery_level >= 0.85:
            return MasteryLevel.EXPERT
        elif self.mastery_level >= 0.70:
            return MasteryLevel.PROFICIENT
        elif self.mastery_level >= 0.50:
            return MasteryLevel.COMPETENT
        elif self.mastery_level >= 0.25:
            return MasteryLevel.APPRENTICE
        else:
            return MasteryLevel.NOVICE

    def calculate_forgetting_curve(self, days: int = 30) -> List[tuple[int, float]]:
        """
        Simulate forgetting curve over N days.

        Args:
            days: Number of days to simulate

        Returns:
            List of (day, mastery) tuples
        """
        curve = []
        daily_decay = 0.05  # 5% daily decay

        for day in range(days + 1):
            decay = (1 - daily_decay) ** day
            curve.append((day, self.mastery_level * decay))

        return curve


class MasteryLevel(Enum):
    """Skill mastery levels inspired by Dreyfus model."""
    NOVICE = 1      # 0-25%: Rule-based, rigid
    APPRENTICE = 2  # 25-50%: Context-aware, limited
    COMPETENT = 3   # 50-70%: Efficient, conscious
    PROFICIENT = 4  # 70-85%: Fluid, mostly unconscious
    EXPERT = 5      # 85-95%: Intuitive, adaptive
    MASTER = 6      # 95-100%: Innovative, transcendent


@dataclass
class ConsolidationTask:
    """
    Task for memory consolidation pipeline.

    Attributes:
        source_tier: Source memory tier
        target_tier: Target memory tier
        item_id: Memory item to consolidate
        priority: Consolidation priority (0-1)
        status: Current status
        timestamp: Task creation time
    """
    source_tier: MemoryTier
    target_tier: MemoryTier
    item_id: str
    priority: float
    status: str = "pending"  # pending, consolidating, complete, failed
    timestamp: float = field(default_factory=time.time)

    def __lt__(self, other):
        """Compare for priority queue (higher priority first)."""
        return self.priority > other.priority


@dataclass
class RetrievalResult:
    """
    Result from memory retrieval.

    Attributes:
        content: The retrieved content
        tier: Source memory tier
        score: Relevance/recall score
        memory_type: Type of memory
        timestamp: Original memory timestamp
        metadata: Additional context
    """
    content: Any
    tier: MemoryTier
    score: float
    memory_type: MemoryType
    timestamp: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "content": self.content,
            "tier": self.tier.value,
            "score": self.score,
            "memory_type": self.memory_type.value,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
        }


# StudyLoG.AI specific extensions


@dataclass
class LearningSession:
    """
    A learning session in StudyLoG.AI.

    Attributes:
        session_id: Unique identifier
        learner_id: Who is learning
        topic: What is being learned
        start_time: Session start
        end_time: Session end
        events: Learning events during session
        excitement_levels: Emotional tracking
        achievements: Unlocked achievements
    """
    session_id: str
    learner_id: str
    topic: str
    start_time: float
    end_time: Optional[float] = None
    events: List[str] = field(default_factory=list)
    excitement_levels: List[float] = field(default_factory=list)
    achievements: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def duration_minutes(self) -> float:
        """Session duration in minutes."""
        if self.end_time is None:
            return 0.0
        return (self.end_time - self.start_time) / 60

    @property
    def average_excitement(self) -> float:
        """Average excitement during session."""
        if not self.excitement_levels:
            return 0.0
        return sum(self.excitement_levels) / len(self.excitement_levels)


@dataclass
class SkillTreeNode:
    """
    Node in skill tree visualization.

    Attributes:
        skill_id: Unique identifier
        name: Display name
        mastery: Current mastery level
        prerequisites: Required skills
        children: Child skills
        position: Visualization position (x, y)
        unlocked: Whether skill is accessible
        status: Visual status (locked, available, in_progress, completed)
    """
    skill_id: str
    name: str
    mastery: float = 0.0
    prerequisites: List[str] = field(default_factory=list)
    children: List[str] = field(default_factory=list)
    position: tuple[float, float] = (0.0, 0.0)
    unlocked: bool = False
    status: str = "locked"

    def to_godot_dict(self) -> Dict[str, Any]:
        """Export format for Godot visualization."""
        return {
            "skill_id": self.skill_id,
            "name": self.name,
            "mastery": self.mastery,
            "mastery_level": MasteryLevel(
                min(6, int(self.mastery * 6) + 1)
            ).name,
            "prerequisites": self.prerequisites,
            "children": self.children,
            "position": {"x": self.position[0], "y": self.position[1]},
            "unlocked": self.unlocked,
            "status": self.status,
        }


def create_memory_item(
    content: str,
    memory_type: MemoryType,
    tier: MemoryTier,
    importance: float = 5.0,
    emotional_valence: float = 0.0,
    tags: Optional[List[str]] = None,
    **metadata
) -> MemoryItem:
    """
    Factory function to create a MemoryItem.

    Args:
        content: Memory content
        memory_type: Type of memory
        tier: Memory tier
        importance: Importance score (1-10)
        emotional_valence: Emotional charge (-1 to 1)
        tags: Searchable tags
        **metadata: Additional context

    Returns:
        New MemoryItem instance
    """
    timestamp = time.time()
    memory_id = MemoryItem.generate_id(content, timestamp)

    return MemoryItem(
        id=memory_id,
        content=content,
        memory_type=memory_type,
        tier=tier,
        timestamp=timestamp,
        importance=importance,
        emotional_valence=emotional_valence,
        tags=tags or [],
        metadata=metadata,
    )
