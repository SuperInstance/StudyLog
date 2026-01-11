"""
Working Memory Module
=====================

Short-term, capacity-limited memory based on cognitive science.
- Miller's "7±2" rule, refined to "4±1" by Cowan
- Extended to 20 items for practical AI utility
- Time-based decay with configurable half-life
- Priority-based eviction (LRU + importance)
"""

import time
from typing import List, Dict, Any, Optional, Callable
from collections import OrderedDict
from dataclasses import dataclass

from .core import (
    MemoryItem,
    MemoryTier,
    MemoryType,
    create_memory_item,
)


@dataclass
class WorkingMemoryItem:
    """
    Item in working memory with decay tracking.

    Attributes:
        key: Unique identifier
        content: The content being stored
        importance: Priority score (0-1)
        timestamp: Creation time
        access_count: Number of accesses
        boost: Temporary importance boost
    """
    key: str
    content: Any
    importance: float
    timestamp: float
    access_count: int = 0
    boost: float = 0.0

    @property
    def effective_importance(self) -> float:
        """Get importance including boost."""
        return min(1.0, self.importance + self.boost)

    @property
    def age(self) -> float:
        """Age in seconds."""
        return time.time() - self.timestamp


class WorkingMemory:
    """
    Working memory with limited capacity and priority-based eviction.

    Features:
    - Default capacity: 20 items (configurable)
    - Time-based decay: 30 minutes half-life (default)
    - Priority-based eviction (LRU + importance)
    - Importance boosting on access
    - Callback support for eviction events

    Neuroscience basis:
    - Miller's "7±2" rule (1956) - working memory capacity
    - Cowan's "4±1" refinement (2001)
    - Time-based decay theories
    """

    def __init__(
        self,
        capacity: int = 20,
        decay_half_life: float = 1800.0,  # 30 minutes
        importance_threshold: float = 0.3,
        on_evict: Optional[Callable[[str, Any], None]] = None,
    ):
        """
        Initialize working memory.

        Args:
            capacity: Maximum number of items (default: 20)
            decay_half_life: Half-life for importance decay (seconds)
            importance_threshold: Minimum importance to prevent eviction
            on_evict: Callback when item is evicted
        """
        if capacity <= 0:
            raise ValueError("Capacity must be positive")
        if decay_half_life <= 0:
            raise ValueError("Decay half-life must be positive")

        self.capacity = capacity
        self.decay_half_life = decay_half_life
        self.importance_threshold = importance_threshold
        self.on_evict = on_evict

        self._items: OrderedDict[str, WorkingMemoryItem] = OrderedDict()

    def add(
        self,
        key: str,
        content: Any,
        importance: float = 0.5,
        tags: Optional[List[str]] = None,
    ) -> bool:
        """
        Add item to working memory.

        Args:
            key: Unique identifier
            content: Content to store
            importance: Initial importance (0-1)
            tags: Optional tags

        Returns:
            True if added, False if evicted
        """
        if not key:
            raise ValueError("Key cannot be empty")

        # Update existing item
        if key in self._items:
            item = self._items[key]
            item.content = content
            item.importance = importance
            item.timestamp = time.time()
            self._items.move_to_end(key)
            return True

        # Check capacity
        if len(self._items) >= self.capacity:
            if not self._evict():
                return False

        # Add new item
        self._items[key] = WorkingMemoryItem(
            key=key,
            content=content,
            importance=importance,
            timestamp=time.time(),
        )
        return True

    def get(self, key: str, boost: float = 0.05) -> Optional[Any]:
        """
        Retrieve item and boost its importance.

        Args:
            key: Item identifier
            boost: Amount to boost importance (default: 0.05)

        Returns:
            Item content or None
        """
        if key not in self._items:
            return None

        item = self._items[key]
        item.access_count += 1
        item.boost = min(1.0, item.boost + boost)
        item.timestamp = time.time()
        self._items.move_to_end(key)

        return item.content

    def remove(self, key: str) -> bool:
        """Remove item from working memory."""
        if key in self._items:
            del self._items[key]
            return True
        return False

    def update(self, key: str, content: Any = None, importance: float = None) -> bool:
        """Update item attributes."""
        if key not in self._items:
            return False

        item = self._items[key]
        if content is not None:
            item.content = content
        if importance is not None:
            item.importance = importance
        item.timestamp = time.time()
        return True

    def clear(self):
        """Clear all items."""
        self._items.clear()

    def items(self) -> Dict[str, Any]:
        """Get all items as dict."""
        return {k: v.content for k, v in self._items.items()}

    def keys(self) -> List[str]:
        """Get all keys."""
        return list(self._items.keys())

    def values(self) -> List[Any]:
        """Get all values."""
        return [item.content for item in self._items.values()]

    def cleanup_decayed(self, threshold_hours: float = 1.0) -> int:
        """
        Remove items decayed beyond threshold.

        Args:
            threshold_hours: Age threshold in hours

        Returns:
            Number of items removed
        """
        cutoff_time = time.time() - (threshold_hours * 3600)
        to_remove = [k for k, v in self._items.items() if v.timestamp < cutoff_time]

        for key in to_remove:
            self.remove(key)

        return len(to_remove)

    def get_statistics(self) -> Dict[str, Any]:
        """Get working memory statistics."""
        if not self._items:
            return {
                "total_items": 0,
                "active_items": 0,
                "capacity_utilization": 0.0,
                "average_importance": 0.0,
                "total_accesses": 0,
                "oldest_age_seconds": 0.0,
            }

        items_list = list(self._items.values())
        total_accesses = sum(item.access_count for item in items_list)
        avg_importance = sum(item.effective_importance for item in items_list) / len(items_list)
        oldest_age = time.time() - min(item.timestamp for item in items_list)

        return {
            "total_items": len(self._items),
            "active_items": len(self._items),
            "capacity_utilization": len(self._items) / self.capacity,
            "average_importance": avg_importance,
            "total_accesses": total_accesses,
            "oldest_age_seconds": oldest_age,
            "capacity": self.capacity,
        }

    def get_priority_order(self) -> List[tuple[str, float]]:
        """
        Get items ordered by eviction priority (lowest first).

        Returns:
            List of (key, priority_score) tuples
        """
        priorities = []
        for key, item in self._items.items():
            score = self._calculate_priority(item)
            priorities.append((key, score))

        priorities.sort(key=lambda x: x[1])
        return priorities

    def _evict(self) -> bool:
        """
        Evict lowest priority item.

        Returns:
            True if eviction succeeded
        """
        if not self._items:
            return False

        # Apply decay to all items first
        self._decay()

        # Find lowest priority item
        priorities = self.get_priority_order()

        for key, score in priorities:
            if score < self.importance_threshold:
                content = self._items[key].content
                if self.on_evict:
                    self.on_evict(key, content)
                del self._items[key]
                return True

        # All items above threshold - evict lowest anyway
        key, _ = priorities[0]
        content = self._items[key].content
        if self.on_evict:
            self.on_evict(key, content)
        del self._items[key]
        return True

    def _calculate_priority(self, item: WorkingMemoryItem) -> float:
        """Calculate priority score for eviction (lower = evicted first)."""
        # Time decay
        age = time.time() - item.timestamp
        decay_factor = 0.5 ** (age / self.decay_half_life)

        # Effective importance = importance * decay
        effective = item.effective_importance * decay_factor

        # Priority score (lower = more likely to evict)
        return effective

    def _decay(self):
        """Apply time-based decay to all items."""
        current_time = time.time()

        for item in self._items.values():
            age = current_time - item.timestamp
            decay_factor = 0.5 ** (age / self.decay_half_life)
            item.importance *= decay_factor
            item.boost = 0.0  # Reset boost on decay
            item.timestamp = current_time

    def __len__(self) -> int:
        return len(self._items)

    def __contains__(self, key: str) -> bool:
        return key in self._items

    def __repr__(self) -> str:
        return f"WorkingMemory(capacity={self.capacity}, items={len(self._items)})"

    def to_dict(self) -> Dict[str, Any]:
        """Export to dictionary for serialization."""
        return {
            "capacity": self.capacity,
            "decay_half_life": self.decay_half_life,
            "importance_threshold": self.importance_threshold,
            "items": [
                {
                    "key": item.key,
                    "content": str(item.content)[:100],  # Truncate for export
                    "importance": item.importance,
                    "timestamp": item.timestamp,
                    "access_count": item.access_count,
                    "age": item.age,
                }
                for item in self._items.values()
            ],
            "statistics": self.get_statistics(),
        }


def create_working_memory(
    capacity: int = 20,
    decay_half_life: float = 1800.0,
    importance_threshold: float = 0.3,
    on_evict: Optional[Callable[[str, Any], None]] = None,
) -> WorkingMemory:
    """
    Factory function to create working memory.

    Args:
        capacity: Maximum number of items
        decay_half_life: Half-life for importance decay
        importance_threshold: Minimum importance to prevent eviction
        on_evict: Eviction callback

    Returns:
        Configured WorkingMemory instance
    """
    return WorkingMemory(
        capacity=capacity,
        decay_half_life=decay_half_life,
        importance_threshold=importance_threshold,
        on_evict=on_evict,
    )


class WorkingMemoryWithMetadata(WorkingMemory):
    """
    Extended working memory that stores full MemoryItem objects.
    Used for integration with consolidation pipeline.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._memory_items: Dict[str, MemoryItem] = {}

    def add_memory(self, memory: MemoryItem) -> bool:
        """Add a MemoryItem directly."""
        success = self.add(memory.id, memory, memory.importance / 10.0)
        if success:
            self._memory_items[memory.id] = memory
        return success

    def get_memory(self, memory_id: str) -> Optional[MemoryItem]:
        """Get MemoryItem by ID."""
        return self._memory_items.get(memory_id)

    def get_all_memories(self) -> List[MemoryItem]:
        """Get all stored MemoryItems."""
        return list(self._memory_items.values())
