"""
Semantic Memory Module
======================

General knowledge and concepts without temporal context.
Based on Tulving's semantic memory theory - general world knowledge,
concepts, and facts independent of personal experience.

StudyLoG.AI extensions:
- Learning concept hierarchies for skill trees
- Vector embeddings for similarity-based recommendations
- Fact verification for quiz/validation systems
- Concept prerequisite tracking for learning paths
"""

import time
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, field
from collections import defaultdict
import numpy as np

from .core import MemoryTier, MemoryType


@dataclass
class Concept:
    """
    A concept in semantic memory.

    Attributes:
        name: Unique concept name
        embedding: Vector representation (for similarity search)
        attributes: Key-value properties
        associations: Related concepts
        prerequisites: Required concepts to understand this one
        access_count: How often accessed
        creation_time: When concept was added
        last_accessed: Last access time
        confidence: How confident we are in this concept (0-1)
    """
    name: str
    embedding: Optional[np.ndarray] = None
    attributes: Dict[str, Any] = field(default_factory=dict)
    associations: Set[str] = field(default_factory=set)
    prerequisites: Set[str] = field(default_factory=set)
    access_count: int = 0
    creation_time: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)
    confidence: float = 1.0

    @property
    def age_days(self) -> float:
        """Age in days."""
        return (time.time() - self.creation_time) / 86400

    def is_accessible(self, known_concepts: Set[str]) -> bool:
        """Check if concept prerequisites are met."""
        return self.prerequisites.issubset(known_concepts)

    def to_dict(self) -> Dict[str, Any]:
        """Export to dictionary."""
        return {
            "name": self.name,
            "embedding_dim": self.embedding.shape[0] if self.embedding is not None else None,
            "attributes": self.attributes,
            "associations": list(self.associations),
            "prerequisites": list(self.prerequisites),
            "access_count": self.access_count,
            "confidence": self.confidence,
            "age_days": self.age_days,
        }


@dataclass
class SemanticFact:
    """
    A factual statement in semantic memory.

    Attributes:
        fact_id: Unique identifier
        statement: The factual statement
        confidence: How confident we are (0-1)
        source_ids: Source episodic memories
        verified: Whether fact has been verified
        access_count: Access frequency
        last_accessed: Last access time
    """
    fact_id: str
    statement: str
    confidence: float = 1.0
    source_ids: List[str] = field(default_factory=list)
    verified: bool = True
    access_count: int = 0
    last_accessed: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        """Export to dictionary."""
        return {
            "fact_id": self.fact_id,
            "statement": self.statement,
            "confidence": self.confidence,
            "source_count": len(self.source_ids),
            "verified": self.verified,
            "access_count": self.access_count,
        }


class SemanticMemory:
    """
    Semantic memory for general knowledge and concepts.

    Features:
    - Vector embeddings for similarity-based search
    - Concept hierarchies (parent-child relationships)
    - Prerequisite tracking for learning paths
    - Fact storage with confidence scores
    - Associative search through concept links
    - Access pattern tracking for recommendations

    Neuroscience basis:
    - Tulving's semantic memory framework (1972)
    - Conceptual knowledge networks
    """

    def __init__(
        self,
        embedding_dim: int = 384,
        enable_embeddings: bool = True,
    ):
        """
        Initialize semantic memory.

        Args:
            embedding_dim: Dimension of embedding vectors
            enable_embeddings: Whether to use vector embeddings
        """
        self.embedding_dim = embedding_dim
        self.enable_embeddings = enable_embeddings

        self._concepts: Dict[str, Concept] = {}
        self._facts: Dict[str, SemanticFact] = {}
        self._hierarchy: Dict[str, Set[str]] = defaultdict(set)  # parent -> children

    def add_concept(
        self,
        name: str,
        embedding: Optional[np.ndarray] = None,
        attributes: Optional[Dict[str, Any]] = None,
        parent: Optional[str] = None,
        prerequisites: Optional[List[str]] = None,
        confidence: float = 1.0,
    ) -> bool:
        """
        Add a concept to semantic memory.

        Args:
            name: Concept name (unique)
            embedding: Optional vector embedding
            attributes: Optional concept properties
            parent: Optional parent concept in hierarchy
            prerequisites: Required concepts
            confidence: Confidence in this concept

        Returns:
            True if added successfully
        """
        if not name:
            raise ValueError("Concept name cannot be empty")
        if name in self._concepts:
            return False

        # Generate embedding if not provided
        if embedding is None and self.enable_embeddings:
            embedding = np.random.randn(self.embedding_dim)
            embedding = embedding / np.linalg.norm(embedding)

        concept = Concept(
            name=name,
            embedding=embedding,
            attributes=attributes or {},
            prerequisites=set(prerequisites or []),
            confidence=confidence,
        )

        self._concepts[name] = concept

        # Add to hierarchy
        if parent and parent in self._concepts:
            self._hierarchy[parent].add(name)
            concept.associations.add(parent)
            self._concepts[parent].associations.add(name)

        return True

    def get_concept(self, name: str) -> Optional[Concept]:
        """Retrieve concept by name."""
        concept = self._concepts.get(name)
        if concept:
            concept.access_count += 1
            concept.last_accessed = time.time()
        return concept

    def update_concept(
        self,
        name: str,
        attributes: Optional[Dict[str, Any]] = None,
        embedding: Optional[np.ndarray] = None,
    ) -> bool:
        """Update existing concept."""
        concept = self._concepts.get(name)
        if not concept:
            return False

        if attributes:
            concept.attributes.update(attributes)

        if embedding is not None:
            concept.embedding = embedding

        return True

    def add_fact(
        self,
        statement: str,
        confidence: float = 1.0,
        source_ids: Optional[List[str]] = None,
        verified: bool = True,
    ) -> str:
        """
        Add a factual statement.

        Args:
            statement: The fact
            confidence: Confidence level (0-1)
            source_ids: Source memory IDs
            verified: Verification status

        Returns:
            Fact ID
        """
        import hashlib
        fact_id = hashlib.md5(statement.encode()).hexdigest()[:16]

        fact = SemanticFact(
            fact_id=fact_id,
            statement=statement,
            confidence=confidence,
            source_ids=source_ids or [],
            verified=verified,
        )

        self._facts[fact_id] = fact
        return fact_id

    def verify_fact(self, statement: str) -> tuple[bool, float]:
        """
        Check if fact is known and confidence level.

        Returns:
            (is_known, confidence) tuple
        """
        import hashlib
        fact_id = hashlib.md5(statement.encode()).hexdigest()[:16]

        fact = self._facts.get(fact_id)
        if not fact:
            return False, 0.0

        return True, fact.confidence

    def similarity_search(
        self,
        query: np.ndarray,
        top_k: int = 10,
        threshold: float = 0.7,
    ) -> List[tuple[str, float]]:
        """
        Find concepts similar to query embedding.

        Args:
            query: Query embedding vector
            top_k: Maximum results
            threshold: Minimum similarity

        Returns:
            List of (concept_name, similarity) tuples
        """
        if not self.enable_embeddings:
            return []

        # Normalize query
        query = query / np.linalg.norm(query)

        results = []
        for name, concept in self._concepts.items():
            if concept.embedding is not None:
                similarity = float(np.dot(query, concept.embedding))

                if similarity >= threshold:
                    results.append((name, similarity))
                    concept.access_count += 1
                    concept.last_accessed = time.time()

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    def keyword_search(
        self,
        query: str,
        top_k: int = 10,
    ) -> List[tuple[str, float]]:
        """
        Search concepts by keyword matching.

        Args:
            query: Search query
            top_k: Maximum results

        Returns:
            List of (concept_name, relevance_score) tuples
        """
        query_lower = query.lower()
        results = []

        for name, concept in self._concepts.items():
            score = 0.0

            # Match in name
            if query_lower in name.lower():
                score += 0.5

            # Match in attributes
            for key, value in concept.attributes.items():
                if query_lower in key.lower() or query_lower in str(value).lower():
                    score += 0.3

            # Match in associations
            for assoc in concept.associations:
                if query_lower in assoc.lower():
                    score += 0.2

            if score > 0:
                results.append((name, score))

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    def get_children(self, parent: str) -> List[str]:
        """Get child concepts in hierarchy."""
        return list(self._hierarchy.get(parent, set()))

    def get_associations(self, concept: str) -> Set[str]:
        """Get associated concepts."""
        c = self._concepts.get(concept)
        return c.associations if c else set()

    def get_path_to_root(self, concept: str) -> List[str]:
        """
        Get path from concept to root of hierarchy.

        Returns:
            List of concept names from leaf to root
        """
        path = [concept]
        visited = set()

        while concept and concept not in visited:
            visited.add(concept)

            # Find parent (concept that has this as child)
            for parent, children in self._hierarchy.items():
                if concept in children:
                    path.append(parent)
                    concept = parent
                    break
            else:
                break

        return path

    def get_accessible_concepts(
        self,
        known_concepts: Set[str],
    ) -> List[str]:
        """
        Get concepts whose prerequisites are met.

        Args:
            known_concepts: Set of already-known concepts

        Returns:
            List of accessible concept names
        """
        accessible = []
        for name, concept in self._concepts.items():
            if concept.is_accessible(known_concepts):
                accessible.append(name)
        return accessible

    def get_next_concepts(
        self,
        known_concepts: Set[str],
        limit: int = 5,
    ) -> List[tuple[str, float]]:
        """
        Get recommended next concepts to learn.

        Based on:
        - Prerequisite satisfaction
        - Child concepts of known concepts
        - High confidence/important concepts

        Returns:
            List of (concept_name, relevance_score) tuples
        """
        scores = {}

        for name, concept in self._concepts.items():
            if name in known_concepts:
                continue

            # Check prerequisites
            prereq_ratio = len(
                concept.prerequisites & known_concepts
            ) / max(len(concept.prerequisites), 1)

            if prereq_ratio == 0:
                continue

            # Base score from prerequisite satisfaction
            score = prereq_ratio * 0.5

            # Boost if child of known concept
            for known in known_concepts:
                if name in self._hierarchy.get(known, set()):
                    score += 0.3
                    break

            # Boost by confidence
            score += concept.confidence * 0.2

            scores[name] = score

        # Sort and return top
        sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return sorted_scores[:limit]

    def associative_search(
        self,
        seed: str,
        max_depth: int = 2,
        top_k: int = 10,
    ) -> List[tuple[str, float]]:
        """
        Breadth-first search through concept associations.

        Args:
            seed: Starting concept
            max_depth: Maximum depth to traverse
            top_k: Maximum results

        Returns:
            List of (concept_name, score) tuples
        """
        results = []
        visited = set()
        queue = [(seed, 0)]

        while queue and len(results) < top_k:
            current, depth = queue.pop(0)

            if current in visited or depth > max_depth:
                continue

            visited.add(current)

            concept = self._concepts.get(current)
            if concept:
                # Score decreases with depth
                score = 1.0 - (depth * 0.3)
                results.append((current, max(0.0, score)))

                # Add associations to queue
                for assoc in concept.associations:
                    if assoc not in visited:
                        queue.append((assoc, depth + 1))

        # Sort by score
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    def get_statistics(self) -> Dict[str, Any]:
        """Get semantic memory statistics."""
        total_accesses = sum(c.access_count for c in self._concepts.values())

        return {
            "total_concepts": len(self._concepts),
            "total_facts": len(self._facts),
            "with_embeddings": sum(
                1 for c in self._concepts.values()
                if c.embedding is not None
            ),
            "total_associations": sum(
                len(c.associations) for c in self._concepts.values()
            ) // 2,
            "hierarchy_edges": sum(len(children) for children in self._hierarchy.values()),
            "total_accesses": total_accesses,
            "avg_accesses": total_accesses / len(self._concepts) if self._concepts else 0,
            "embedding_dim": self.embedding_dim if self.enable_embeddings else 0,
        }

    def __len__(self) -> int:
        return len(self._concepts) + len(self._facts)

    def __contains__(self, name: str) -> bool:
        return name in self._concepts

    def __repr__(self) -> str:
        return f"SemanticMemory(concepts={len(self._concepts)}, facts={len(self._facts)})"

    def to_dict(self) -> Dict[str, Any]:
        """Export for serialization."""
        return {
            "statistics": self.get_statistics(),
            "sample_concepts": [c.to_dict() for c in list(self._concepts.values())[:5]],
        }


def create_semantic_memory(
    embedding_dim: int = 384,
    enable_embeddings: bool = True,
) -> SemanticMemory:
    """Factory function to create semantic memory."""
    return SemanticMemory(
        embedding_dim=embedding_dim,
        enable_embeddings=enable_embeddings,
    )
