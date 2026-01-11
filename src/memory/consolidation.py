"""
Memory Consolidation Module
============================

Transfers memories from short-term to long-term storage.
Based on systems consolidation theory - memories are gradually
transferred from hippocampus to neocortex during sleep/rest.

StudyLoG.AI extensions:
- Learning session consolidation
- Pattern extraction for concept formation
- Achievement unlock triggers
- Spaced repetition scheduling
"""

import time
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass
from enum import Enum
import numpy as np

from .core import MemoryTier, ConsolidationTask, MemoryItem
from .working import WorkingMemory
from .episodic import EpisodicMemory, LearningEvent
from .semantic import SemanticMemory


class ConsolidationStatus(Enum):
    """Status of consolidation process."""
    PENDING = "pending"
    CONSOLIDATING = "consolidating"
    COMPLETE = "complete"
    FAILED = "failed"


class ConsolidationTrigger(Enum):
    """What triggered consolidation."""
    TIME_BASED = "time_based"           # Periodic consolidation
    IMPORTANCE = "importance"            # High importance threshold
    SURPRISE = "surprise"                # Novelty detection (KL divergence)
    SLEEP = "sleep"                      # Sleep simulation
    MANUAL = "manual"                    # Explicit request


@dataclass
class ConsolidationResult:
    """
    Result of a consolidation operation.

    Attributes:
        success: Whether consolidation succeeded
        trigger: What triggered consolidation
        items_consolidated: Number of items consolidated
        concepts_created: Number of new concepts created
        patterns_extracted: Number of patterns found
        achievements_unlocked: Any achievements unlocked
        timestamp: When consolidation occurred
    """
    success: bool
    trigger: ConsolidationTrigger
    items_consolidated: int = 0
    concepts_created: int = 0
    patterns_extracted: int = 0
    achievements_unlocked: List[str] = None
    timestamp: float = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()
        if self.achievements_unlocked is None:
            self.achievements_unlocked = []


class MemoryConsolidation:
    """
    Memory consolidation pipeline for StudyLoG.AI.

    Features:
    - Priority-based consolidation (importance, emotional valence)
    - Surprise-based triggering (KL divergence)
    - Pattern extraction from repeated events
    - Sleep/rest-based consolidation cycles
    - Achievement unlock detection

    Neuroscience basis:
    - Systems consolidation theory
    - Sleep-dependent memory consolidation
    - Synaptic consolidation during waking
    """

    def __init__(
        self,
        working_memory: WorkingMemory,
        episodic_memory: EpisodicMemory,
        semantic_memory: SemanticMemory,
        consolidation_threshold: float = 0.7,
        batch_size: int = 10,
        consolidation_interval_hours: float = 24.0,
    ):
        """
        Initialize consolidation pipeline.

        Args:
            working_memory: Working memory instance
            episodic_memory: Episodic memory instance
            semantic_memory: Semantic memory instance
            consolidation_threshold: Importance threshold
            batch_size: Items per batch
            consolidation_interval_hours: Hours between auto-consolidation
        """
        self.working_memory = working_memory
        self.episodic_memory = episodic_memory
        self.semantic_memory = semantic_memory
        self.consolidation_threshold = consolidation_threshold
        self.batch_size = batch_size
        self.consolidation_interval_hours = consolidation_interval_hours

        self._queue: List[ConsolidationTask] = []
        self._consolidation_count = 0
        self._last_consolidation = time.time()

        # Callbacks for events
        self.on_consolidate: Optional[Callable[[ConsolidationResult], None]] = None
        self.on_achievement_unlock: Optional[Callable[[str, Dict], None]] = None

    def add_to_queue(
        self,
        source_tier: MemoryTier,
        target_tier: MemoryTier,
        item_id: str,
        priority: float,
    ):
        """Add item to consolidation queue."""
        task = ConsolidationTask(
            source_tier=source_tier,
            target_tier=target_tier,
            item_id=item_id,
            priority=priority,
        )
        self._queue.append(task)

    def add_working_to_queue(self, key: str, priority: float = 0.8):
        """Add working memory item to consolidation queue."""
        self.add_to_queue(
            source_tier=MemoryTier.WORKING,
            target_tier=MemoryTier.EPISODIC,
            item_id=key,
            priority=priority,
        )

    def prioritize_queue(self):
        """Sort queue by priority (highest first)."""
        self._queue.sort(key=lambda t: t.priority, reverse=True)

    def consolidate_next_batch(
        self,
        trigger: ConsolidationTrigger = ConsolidationTrigger.MANUAL,
    ) -> ConsolidationResult:
        """
        Consolidate next batch of items.

        Args:
            trigger: What triggered this consolidation

        Returns:
            ConsolidationResult with details
        """
        self.prioritize_queue()

        batch = self._queue[:self.batch_size]
        if not batch:
            return ConsolidationResult(success=False, trigger=trigger)

        result = ConsolidationResult(
            success=True,
            trigger=trigger,
            items_consolidated=0,
            concepts_created=0,
            patterns_extracted=0,
        )

        for task in batch:
            if task.priority >= self.consolidation_threshold:
                if self._consolidate(task):
                    result.items_consolidated += 1
                    task.status = "complete"
                else:
                    task.status = "failed"

        # Remove completed tasks
        self._queue = [t for t in self._queue if t.status == "pending"]

        # Extract patterns from episodic memory
        patterns = self._extract_patterns()
        result.patterns_extracted = len(patterns)

        # Create concepts from patterns
        for pattern in patterns:
            if self._create_concept_from_pattern(pattern):
                result.concepts_created += 1

        # Update stats
        self._consolidation_count += result.items_consolidated
        self._last_consolidation = time.time()

        # Check for achievements
        result.achievements_unlocked = self._check_achievements()

        # Trigger callback
        if self.on_consolidate:
            self.on_consolidate(result)

        return result

    def consolidate(
        self,
        trigger: ConsolidationTrigger = ConsolidationTrigger.MANUAL,
        batch_size: Optional[int] = None,
    ) -> ConsolidationResult:
        """
        Run consolidation with optional batch size override.

        Args:
            trigger: What triggered consolidation
            batch_size: Override default batch size

        Returns:
            ConsolidationResult
        """
        if batch_size:
            original_batch = self.batch_size
            self.batch_size = batch_size
            result = self.consolidate_next_batch(trigger)
            self.batch_size = original_batch
            return result

        return self.consolidate_next_batch(trigger)

    def should_consolidate(self) -> tuple[bool, str]:
        """
        Check if consolidation should be triggered.

        Returns:
            (should_consolidate, reason) tuple
        """
        # Time threshold
        hours_since = (time.time() - self._last_consolidation) / 3600
        if hours_since >= self.consolidation_interval_hours:
            return True, f"Time threshold: {hours_since:.1f}h since last"

        # Queue size threshold
        if len(self._queue) >= self.batch_size:
            return True, f"Queue threshold: {len(self._queue)} items pending"

        return False, "Thresholds not met"

    def trigger_consolidation_by_surprise(
        self,
        current_observation: np.ndarray,
        expected_observation: np.ndarray,
        threshold: float = 0.5,
    ) -> float:
        """
        Trigger consolidation based on surprise (novelty detection).

        Uses KL divergence to measure surprise.

        Args:
            current_observation: What was observed
            expected_observation: What was expected
            threshold: Surprise threshold

        Returns:
            Surprise score
        """
        surprise = self._calculate_kl_divergence(
            current_observation,
            expected_observation,
        )

        if surprise > threshold:
            # Queue high-importance working memory items
            for key in list(self.working_memory.keys())[:5]:
                self.add_working_to_queue(key, priority=surprise)

            # Auto-consolidate
            self.consolidate(trigger=ConsolidationTrigger.SURPRISE)

        return surprise

    def simulate_sleep_consolidation(
        self,
        duration_hours: float = 8.0,
    ) -> ConsolidationResult:
        """
        Simulate sleep-based memory consolidation.

        During sleep, memories are replayed and consolidated.
        More hours = more consolidation cycles.

        Args:
            duration_hours: Sleep duration

        Returns:
            ConsolidationResult
        """
        # 2 consolidation batches per hour of sleep
        batches = int(duration_hours * 2)
        total_items = 0
        total_concepts = 0
        total_patterns = 0
        all_achievements = []

        for _ in range(batches):
            # Queue working memory items
            for key in list(self.working_memory.keys())[:3]:
                self.add_working_to_queue(key, priority=0.8)

            # Consolidate batch
            result = self.consolidate(trigger=ConsolidationTrigger.SLEEP)
            total_items += result.items_consolidated
            total_concepts += result.concepts_created
            total_patterns += result.patterns_extracted
            all_achievements.extend(result.achievements_unlocked or [])

        return ConsolidationResult(
            success=True,
            trigger=ConsolidationTrigger.SLEEP,
            items_consolidated=total_items,
            concepts_created=total_concepts,
            patterns_extracted=total_patterns,
            achievements_unlocked=all_achievements,
        )

    def schedule_review(
        self,
        topic: str,
        current_mastery: float,
        target_mastery: float = 0.9,
    ) -> Optional[float]:
        """
        Schedule when a topic should be reviewed based on forgetting curve.

        Args:
            topic: Topic to schedule
            current_mastery: Current mastery level (0-1)
            target_mastery: Minimum mastery to maintain

        Returns:
            Hours until review (or None if no review needed)
        """
        if current_mastery >= target_mastery:
            # Forgetting curve: R(t) = R0 * e^(-t/S)
            # Solve for t when R(t) = target_mastery
            # t = -S * ln(target / R0)
            # Where S (strength) is proportional to mastery

            memory_strength = current_mastery * 168  # Max ~1 week
            hours_until = -memory_strength * np.log(target_mastery / current_mastery)

            return max(1.0, hours_until)

        return None  # Already below target - review now

    def _consolidate(self, task: ConsolidationTask) -> bool:
        """Consolidate a single task."""
        try:
            if task.source_tier == MemoryTier.WORKING:
                if task.target_tier == MemoryTier.EPISODIC:
                    return self._consolidate_working_to_episodic(task)
            elif task.source_tier == MemoryTier.EPISODIC:
                if task.target_tier == MemoryTier.SEMANTIC:
                    return self._consolidate_episodic_to_semantic(task)
            return False
        except Exception:
            return False

    def _consolidate_working_to_episodic(self, task: ConsolidationTask) -> bool:
        """Consolidate from working to episodic memory."""
        content = self.working_memory.get(task.item_id)
        if content is None:
            return False

        # Create episodic event
        event_id = self.episodic_memory.add(
            content=str(content),
            importance=task.priority * 10,
            topic=task.item_id.split(":")[0] if ":" in task.item_id else "",
            context={"source": "working_memory"},
        )

        # Remove from working memory
        self.working_memory.remove(task.item_id)

        return event_id is not None

    def _consolidate_episodic_to_semantic(self, task: ConsolidationTask) -> bool:
        """Consolidate from episodic to semantic memory."""
        event = self.episodic_memory.get(task.item_id)
        if not event:
            return False

        # Extract concept name from event
        words = event.content.split()
        concept_name = words[0] if words else event.content[:20]

        # Check if concept already exists
        if concept_name in self.semantic_memory:
            return True

        # Create concept
        success = self.semantic_memory.add_concept(
            name=concept_name,
            attributes={
                "episodic_source": task.item_id,
                "importance": event.importance,
                "emotional_valence": event.emotional_valence,
                "excitement": getattr(event, "excitement", 0.0),
            },
        )

        if success:
            self.episodic_memory.mark_consolidated(task.item_id)

        return success

    def _extract_patterns(self, min_cluster_size: int = 3) -> List[Dict[str, Any]]:
        """Extract patterns from unconsolidated episodic memories."""
        unconsolidated = self.episodic_memory.get_unconsolidated_events()

        if len(unconsolidated) < min_cluster_size:
            return []

        # Simple clustering by topic similarity
        clusters = self._cluster_by_topic(unconsolidated)

        patterns = []
        for cluster in clusters:
            if len(cluster) >= min_cluster_size:
                pattern = self._extract_pattern_from_cluster(cluster)
                if pattern:
                    patterns.append(pattern)

        return patterns

    def _cluster_by_topic(self, events: List[LearningEvent]) -> List[List[LearningEvent]]:
        """Cluster events by topic."""
        topic_clusters: Dict[str, List[LearningEvent]] = {}

        for event in events:
            topic = event.topic or "general"
            if topic not in topic_clusters:
                topic_clusters[topic] = []
            topic_clusters[topic].append(event)

        return list(topic_clusters.values())

    def _extract_pattern_from_cluster(self, cluster: List[LearningEvent]) -> Optional[Dict[str, Any]]:
        """Extract pattern from a cluster of similar events."""
        if not cluster:
            return None

        # Get common topic
        topic = cluster[0].topic if cluster[0].topic else "pattern"

        # Calculate aggregate stats
        avg_excitement = sum(e.excitement for e in cluster) / len(cluster)
        avg_importance = sum(e.importance for e in cluster) / len(cluster)

        # Extract common words
        from collections import Counter
        word_counter = Counter()
        for event in cluster:
            words = event.content.lower().split()
            for word in words:
                if len(word) > 3:
                    word_counter[word] += 1

        common_words = [w for w, c in word_counter.most_common(5)]

        return {
            "topic": topic,
            "event_count": len(cluster),
            "avg_excitement": avg_excitement,
            "avg_importance": avg_importance,
            "common_words": common_words,
            "event_ids": [e.event_id for e in cluster],
        }

    def _create_concept_from_pattern(self, pattern: Dict[str, Any]) -> bool:
        """Create a semantic concept from a pattern."""
        concept_name = f"pattern_{pattern['topic']}"

        if concept_name in self.semantic_memory:
            return False

        return self.semantic_memory.add_concept(
            name=concept_name,
            attributes={
                "type": "extracted_pattern",
                "event_count": pattern["event_count"],
                "avg_excitement": pattern["avg_excitement"],
                "common_words": pattern["common_words"],
            },
            confidence=min(1.0, pattern["avg_importance"] / 10),
        )

    def _calculate_kl_divergence(
        self,
        p: np.ndarray,
        q: np.ndarray,
    ) -> float:
        """Calculate KL divergence between two distributions."""
        epsilon = 1e-10
        p = p + epsilon
        q = q + epsilon

        # Normalize
        p = p / np.sum(p)
        q = q / np.sum(q)

        # KL divergence
        kl = np.sum(p * np.log(p / q))

        return float(kl)

    def _check_achievements(self) -> List[str]:
        """Check for and return any unlocked achievements."""
        achievements = []

        # Example achievements
        if self._consolidation_count >= 10:
            achievements.append("first_consolidations")

        if self._consolidation_count >= 100:
            achievements.append("memory_master")

        # Trigger callback
        for achievement in achievements:
            if self.on_achievement_unlock:
                self.on_achievement_unlock(achievement, {
                    "consolidation_count": self._consolidation_count,
                })

        return achievements

    def get_queue_size(self) -> int:
        """Get current queue size."""
        return len(self._queue)

    def get_consolidation_stats(self) -> Dict[str, Any]:
        """Get consolidation statistics."""
        status_counts = {"pending": 0, "consolidating": 0, "complete": 0, "failed": 0}
        for task in self._queue:
            status_counts[task.status] = status_counts.get(task.status, 0) + 1

        return {
            "queue_size": len(self._queue),
            "status_distribution": status_counts,
            "total_consolidated": self._consolidation_count,
            "last_consolidation": self._last_consolidation,
            "hours_since_consolidation": (time.time() - self._last_consolidation) / 3600,
        }

    def clear_queue(self):
        """Clear consolidation queue."""
        self._queue.clear()

    def __repr__(self) -> str:
        return f"MemoryConsolidation(queue={len(self._queue)}, consolidated={self._consolidation_count})"


def create_consolidation_pipeline(
    working_memory: WorkingMemory,
    episodic_memory: EpisodicMemory,
    semantic_memory: SemanticMemory,
    consolidation_threshold: float = 0.7,
    batch_size: int = 10,
    consolidation_interval_hours: float = 24.0,
) -> MemoryConsolidation:
    """Factory function to create consolidation pipeline."""
    return MemoryConsolidation(
        working_memory=working_memory,
        episodic_memory=episodic_memory,
        semantic_memory=semantic_memory,
        consolidation_threshold=consolidation_threshold,
        batch_size=batch_size,
        consolidation_interval_hours=consolidation_interval_hours,
    )
