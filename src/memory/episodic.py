"""
Episodic Memory Module
======================

Autobiographical memory for specific events and experiences.
Based on Tulving's episodic memory theory - memory for personal
experiences with temporal, spatial, and emotional context.

StudyLoG.AI extensions:
- Learning events with topic tracking
- Excitement level monitoring for gamification
- Achievement unlock events
- Spaced repetition scheduling
"""

import time
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict
import numpy as np

from .core import (
    MemoryItem,
    MemoryTier,
    MemoryType,
    ImportanceLevel,
    LearningSession,
)


@dataclass
class LearningEvent:
    """
    A learning event in episodic memory.

    Attributes:
        event_id: Unique identifier
        content: Description of what happened
        timestamp: When it occurred
        emotional_valence: Emotional charge (-1 to 1)
        excitement: Learning excitement (0-1), StudyLoG specific
        importance: Importance score (0-10)
        topic: What topic was being learned
        context: Additional context (location, participants, etc.)
        access_count: How often retrieved
        last_accessed: Last retrieval time
        consolidated: Whether consolidated to semantic memory
    """
    event_id: str
    content: str
    timestamp: float
    emotional_valence: float = 0.0
    excitement: float = 0.0
    importance: float = 5.0
    topic: str = ""
    context: Dict[str, Any] = field(default_factory=dict)
    access_count: int = 0
    last_accessed: float = 0.0
    consolidated: bool = False

    def __post_init__(self):
        if self.last_accessed == 0.0:
            self.last_accessed = self.timestamp

    @property
    def age_hours(self) -> float:
        """Age in hours."""
        return (time.time() - self.timestamp) / 3600

    @property
    def age_days(self) -> float:
        """Age in days."""
        return (time.time() - self.timestamp) / 86400

    @property
    def is_recent(self, hours: float = 24.0) -> bool:
        """Check if event is recent."""
        return self.age_hours < hours

    def to_dict(self) -> Dict[str, Any]:
        """Export to dictionary."""
        return {
            "event_id": self.event_id,
            "content": self.content,
            "timestamp": self.timestamp,
            "datetime": datetime.fromtimestamp(self.timestamp).isoformat(),
            "emotional_valence": self.emotional_valence,
            "excitement": self.excitement,
            "importance": self.importance,
            "topic": self.topic,
            "context": self.context,
            "access_count": self.access_count,
            "consolidated": self.consolidated,
            "age_hours": self.age_hours,
            "age_days": self.age_days,
        }


class EpisodicMemory:
    """
    Episodic memory for storing and retrieving learning experiences.

    Features:
    - Time-stamped events with emotional tagging
    - Importance scoring based on emotion, novelty, and significance
    - Contextual retrieval (time, topic, emotion, location)
    - Excitement tracking for StudyLoG gamification
    - Decay based on importance and access frequency
    - Multi-indexing for fast queries

    Neuroscience basis:
    - Tulving's episodic memory theory (1972)
    - "What-where-when" memory framework
    """

    def __init__(
        self,
        capacity: int = 1000,
        decay_rate: float = 0.1,
        emotion_boost: float = 0.2,
    ):
        """
        Initialize episodic memory.

        Args:
            capacity: Maximum number of events
            decay_rate: Rate at which importance decays
            emotion_boost: Boost for emotionally charged events
        """
        self.capacity = capacity
        self.decay_rate = decay_rate
        self.emotion_boost = emotion_boost

        self._events: Dict[str, LearningEvent] = {}
        self._by_time: List[tuple[float, str]] = []
        self._by_topic: Dict[str, List[str]] = defaultdict(list)
        self._by_location: Dict[str, List[str]] = defaultdict(list)
        self._by_participants: Dict[str, List[str]] = defaultdict(list)

    def add(
        self,
        content: str,
        emotional_valence: float = 0.0,
        excitement: float = 0.0,
        importance: Optional[float] = None,
        topic: str = "",
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Add a learning event.

        Args:
            content: Event description
            emotional_valence: Emotional charge (-1 to 1)
            excitement: Learning excitement (0-1)
            importance: Optional manual importance (0-10)
            topic: Topic being learned
            context: Additional context

        Returns:
            Event ID
        """
        if not content:
            raise ValueError("Content cannot be empty")

        # Calculate importance if not provided
        if importance is None:
            importance = self._calculate_importance(emotional_valence, excitement, context)

        timestamp = time.time()
        event_id = self._generate_event_id(content, timestamp)

        event = LearningEvent(
            event_id=event_id,
            content=content,
            timestamp=timestamp,
            emotional_valence=emotional_valence,
            excitement=excitement,
            importance=importance,
            topic=topic,
            context=context or {},
        )

        self._events[event_id] = event
        self._by_time.append((timestamp, event_id))

        # Index by topic
        if topic:
            self._by_topic[topic].append(event_id)

        # Index by location
        location = context.get("location", "") if context else ""
        if location:
            self._by_location[location].append(event_id)

        # Index by participants
        participants = context.get("participants", []) if context else []
        for participant in participants:
            self._by_participants[participant].append(event_id)

        # Check capacity
        if len(self._events) > self.capacity:
            self._evict()

        return event_id

    def get(self, event_id: str) -> Optional[LearningEvent]:
        """Retrieve event by ID."""
        event = self._events.get(event_id)
        if event:
            event.access_count += 1
            event.last_accessed = time.time()
        return event

    def search_by_time(
        self,
        start_time: Optional[float] = None,
        end_time: Optional[float] = None,
        limit: int = 10,
    ) -> List[LearningEvent]:
        """
        Retrieve events from time range.

        Args:
            start_time: Start of range (default: 24h ago)
            end_time: End of range (default: now)
            limit: Maximum results

        Returns:
            List of events in chronological order
        """
        if start_time is None:
            start_time = time.time() - 86400
        if end_time is None:
            end_time = time.time()

        results = []
        for timestamp, event_id in sorted(self._by_time, reverse=True):
            if start_time <= timestamp <= end_time:
                event = self._events[event_id]
                results.append(event)
                if len(results) >= limit:
                    break

        return results

    def search_by_topic(self, topic: str, limit: int = 10) -> List[LearningEvent]:
        """Retrieve events by topic."""
        event_ids = self._by_topic.get(topic, [])
        results = [self._events[eid] for eid in event_ids[:limit]]
        results.sort(key=lambda e: e.importance, reverse=True)
        return results

    def search_by_emotion(
        self,
        min_valence: float = -1.0,
        max_valence: float = 1.0,
        limit: int = 10,
    ) -> List[LearningEvent]:
        """Retrieve events within emotional range."""
        results = [
            e for e in self._events.values()
            if min_valence <= e.emotional_valence <= max_valence
        ]
        results.sort(key=lambda e: abs(e.emotional_valence), reverse=True)
        return results[:limit]

    def search_by_excitement(
        self,
        min_excitement: float = 0.0,
        limit: int = 10,
    ) -> List[LearningEvent]:
        """Retrieve high-excitement learning events."""
        results = [
            e for e in self._events.values()
            if e.excitement >= min_excitement
        ]
        results.sort(key=lambda e: e.excitement, reverse=True)
        return results[:limit]

    def search_by_context(
        self,
        context_key: str,
        context_value: Any,
        limit: int = 10,
    ) -> List[LearningEvent]:
        """Retrieve events by context key-value."""
        results = [
            e for e in self._events.values()
            if e.context.get(context_key) == context_value
        ]
        results.sort(key=lambda e: e.importance, reverse=True)
        return results[:limit]

    def search(self, query: str, limit: int = 10) -> List[tuple[LearningEvent, float]]:
        """Keyword search across events."""
        query_lower = query.lower()
        results = []

        for event in self._events.values():
            content_lower = event.content.lower()
            if query_lower in content_lower:
                matches = content_lower.count(query_lower)
                relevance = (matches * 0.5) + (event.importance / 10.0)
                results.append((event, relevance))

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:limit]

    def get_recent_events(self, hours: float = 24.0, limit: int = 10) -> List[LearningEvent]:
        """Get most recent events."""
        cutoff = time.time() - (hours * 3600)
        return self.search_by_time(start_time=cutoff, limit=limit)

    def get_important_events(self, limit: int = 10) -> List[LearningEvent]:
        """Get most important events."""
        events = list(self._events.values())
        events.sort(key=lambda e: e.importance, reverse=True)
        return events[:limit]

    def get_emotional_summary(self) -> Dict[str, Any]:
        """Get summary of emotional content."""
        if not self._events:
            return {
                "total_events": 0,
                "average_valence": 0.0,
                "average_excitement": 0.0,
                "positive_count": 0,
                "negative_count": 0,
                "neutral_count": 0,
            }

        valences = [e.emotional_valence for e in self._events.values()]
        excitements = [e.excitement for e in self._events.values()]

        positive = sum(1 for v in valences if v > 0.3)
        negative = sum(1 for v in valences if v < -0.3)
        neutral = len(valences) - positive - negative

        return {
            "total_events": len(self._events),
            "average_valence": float(np.mean(valences)) if valences else 0.0,
            "average_excitement": float(np.mean(excitements)) if excitements else 0.0,
            "positive_count": positive,
            "negative_count": negative,
            "neutral_count": neutral,
        }

    def get_topic_history(self) -> Dict[str, int]:
        """Get frequency of events by topic."""
        counts = defaultdict(int)
        for event in self._events.values():
            if event.topic:
                counts[event.topic] += 1
        return dict(sorted(counts.items(), key=lambda x: x[1], reverse=True))

    def get_participant_network(self) -> Dict[str, Dict[str, int]]:
        """Get social network from co-participation."""
        network = defaultdict(lambda: defaultdict(int))

        for event in self._events.values():
            participants = event.context.get("participants", [])
            for i, p1 in enumerate(participants):
                for p2 in participants[i + 1:]:
                    network[p1][p2] += 1
                    network[p2][p1] += 1

        return {k: dict(v) for k, v in network.items()}

    def get_statistics(self) -> Dict[str, Any]:
        """Get episodic memory statistics."""
        emotional_summary = self.get_emotional_summary()

        return {
            "total_events": len(self._events),
            "capacity": self.capacity,
            "unique_topics": len(self._by_topic),
            "unique_locations": len(self._by_location),
            "unique_participants": len(self._by_participants),
            **emotional_summary,
        }

    def mark_consolidated(self, event_id: str) -> bool:
        """Mark event as consolidated to semantic memory."""
        if event_id in self._events:
            self._events[event_id].consolidated = True
            return True
        return False

    def get_unconsolidated_events(self, hours_threshold: float = 24.0) -> List[LearningEvent]:
        """Get events that haven't been consolidated."""
        cutoff = time.time() - (hours_threshold * 3600)
        return [
            e for e in self._events.values()
            if not e.consolidated and e.timestamp < cutoff
        ]

    def _calculate_importance(
        self,
        emotional_valence: float,
        excitement: float,
        context: Optional[Dict[str, Any]],
    ) -> float:
        """Calculate importance from various factors."""
        importance = 5.0  # Base importance

        # Emotional boost (positive or negative)
        emotion_magnitude = abs(emotional_valence)
        importance += emotion_magnitude * self.emotion_boost * 10

        # Excitement boost (StudyLoG specific)
        importance += excitement * 3.0

        # Context boost
        if context:
            if context.get("achievement", False):
                importance += 2.0
            if context.get("breakthrough", False):
                importance += 3.0
            if len(context) > 2:
                importance += 0.5

        return max(1.0, min(10.0, importance))

    def _evict(self):
        """Evict least important events."""
        if len(self._events) <= self.capacity:
            return

        def score(event):
            age = time.time() - event.timestamp
            age_penalty = age / 86400  # 1 day = 0.1 penalty
            return event.importance + (event.access_count * 0.05) - age_penalty

        sorted_events = sorted(self._events.items(), key=lambda x: score(x[1]))

        # Remove excess events
        excess = len(self._events) - self.capacity
        for event_id, _ in sorted_events[:excess]:
            self._remove_event(event_id)

    def _remove_event(self, event_id: str):
        """Remove event from all indexes."""
        if event_id not in self._events:
            return

        event = self._events[event_id]

        # Remove from time index
        self._by_time = [(t, eid) for t, eid in self._by_time if eid != event_id]

        # Remove from topic index
        if event.topic and event_id in self._by_topic.get(event.topic, []):
            self._by_topic[event.topic].remove(event_id)

        # Remove from location index
        location = event.context.get("location", "")
        if location and event_id in self._by_location.get(location, []):
            self._by_location[location].remove(event_id)

        # Remove from participants index
        for participant in event.context.get("participants", []):
            if event_id in self._by_participants.get(participant, []):
                self._by_participants[participant].remove(event_id)

        del self._events[event_id]

    def _generate_event_id(self, content: str, timestamp: float) -> str:
        """Generate unique event ID."""
        import hashlib
        unique_str = f"{content}{timestamp}"
        return hashlib.md5(unique_str.encode()).hexdigest()[:16]

    def __len__(self) -> int:
        return len(self._events)

    def __repr__(self) -> str:
        return f"EpisodicMemory(events={len(self._events)}, capacity={self.capacity})"

    def to_dict(self) -> Dict[str, Any]:
        """Export for serialization."""
        return {
            "capacity": self.capacity,
            "statistics": self.get_statistics(),
            "recent_events": [e.to_dict() for e in self.get_recent_events(limit=10)],
            "important_events": [e.to_dict() for e in self.get_important_events(limit=5)],
        }


def create_episodic_memory(
    capacity: int = 1000,
    decay_rate: float = 0.1,
    emotion_boost: float = 0.2,
) -> EpisodicMemory:
    """Factory function to create episodic memory."""
    return EpisodicMemory(
        capacity=capacity,
        decay_rate=decay_rate,
        emotion_boost=emotion_boost,
    )
