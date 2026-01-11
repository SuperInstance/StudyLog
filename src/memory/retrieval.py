"""
Memory Retrieval Module
=======================

Multi-modal search across all memory tiers.
Provides flexible search capabilities including semantic,
temporal, spatial, and contextual retrieval.

StudyLoG.AI extensions:
- Learning-focused retrieval modes
- Recommendation engine
- Quiz question generation
- Learning path suggestions
"""

import time
from typing import List, Dict, Any, Optional, Union, Callable, Set
from dataclasses import dataclass
from enum import Enum
import numpy as np

from .core import MemoryTier, MemoryType, RetrievalResult
from .working import WorkingMemory
from .episodic import EpisodicMemory, LearningEvent
from .semantic import SemanticMemory
from .procedural import ProceduralMemory, Skill


class RetrievalMode(Enum):
    """Memory retrieval modes."""
    SEMANTIC = "semantic"          # Similarity-based search
    TEMPORAL = "temporal"          # Time range queries
    CONTEXTUAL = "contextual"      # Key-value context match
    ASSOCIATIVE = "associative"    # Graph traversal
    HYBRID = "hybrid"              # Combine multiple modes
    LEARNING = "learning"          # StudyLoG: learning-focused
    RECOMMENDATION = "recommendation"  # StudyLoG: recommendations
    QUIZ = "quiz"                  # StudyLoG: quiz generation


class RetrievalStrategy(Enum):
    """How to combine results from multiple tiers."""
    BEST_MATCH = "best_match"      # Highest score across tiers
    TIER_PRIORITY = "tier_priority"  # Prefer certain tiers
    ALL_RESULTS = "all_results"    # Return all, tier-tagged


@dataclass
class QuizQuestion:
    """
    Generated quiz question from memory.

    Attributes:
        question: The question text
        options: Multiple choice options
        correct_answer: Correct option index
        explanation: Why this is correct
        difficulty: Estimated difficulty (0-1)
        source_tier: Where the knowledge came from
        source_id: Origin memory ID
    """
    question: str
    options: List[str]
    correct_answer: int
    explanation: str
    difficulty: float
    source_tier: MemoryTier
    source_id: str

    def to_dict(self) -> Dict[str, Any]:
        """Export for serialization."""
        return {
            "question": self.question,
            "options": self.options,
            "correct_answer": self.correct_answer,
            "explanation": self.explanation,
            "difficulty": self.difficulty,
            "source_tier": self.source_tier.value,
        }


@dataclass
class LearningRecommendation:
    """
    Recommended next learning item.

    Attributes:
        item_name: What to learn
        reason: Why this is recommended
        priority: Recommendation priority (0-1)
        estimated_time_minutes: How long it might take
        prerequisites: Required knowledge
        tier: Which memory tier this comes from
    """
    item_name: str
    reason: str
    priority: float
    estimated_time_minutes: float
    prerequisites: List[str]
    tier: MemoryTier

    def to_dict(self) -> Dict[str, Any]:
        """Export for serialization."""
        return {
            "item_name": self.item_name,
            "reason": self.reason,
            "priority": self.priority,
            "estimated_time_minutes": self.estimated_time_minutes,
            "prerequisites": self.prerequisites,
            "tier": self.tier.value,
        }


class MemoryRetrieval:
    """
    Multi-modal memory retrieval system for StudyLoG.AI.

    Features:
    - Semantic similarity search
    - Temporal range queries
    - Context-based retrieval
    - Associative search (graph traversal)
    - Hybrid retrieval combining multiple modes
    - Quiz question generation
    - Learning recommendations

    Supports filtering by specific memory tiers.
    """

    def __init__(
        self,
        working_memory: WorkingMemory,
        episodic_memory: EpisodicMemory,
        semantic_memory: SemanticMemory,
        procedural_memory: ProceduralMemory,
        default_top_k: int = 10,
    ):
        """Initialize retrieval system."""
        self.working_memory = working_memory
        self.episodic_memory = episodic_memory
        self.semantic_memory = semantic_memory
        self.procedural_memory = procedural_memory
        self.default_top_k = default_top_k

    def search(
        self,
        query: Union[str, np.ndarray],
        mode: RetrievalMode = RetrievalMode.SEMANTIC,
        tier: Optional[MemoryTier] = None,
        top_k: Optional[int] = None,
        **kwargs,
    ) -> List[RetrievalResult]:
        """
        Search memories using specified mode.

        Args:
            query: Search query (text or embedding)
            mode: Retrieval mode
            tier: Specific tier to search (None = all)
            top_k: Maximum results
            **kwargs: Mode-specific parameters

        Returns:
            List of RetrievalResult sorted by score
        """
        if top_k is None:
            top_k = self.default_top_k

        results = []
        tiers = [tier] if tier else list(MemoryTier)

        for tier_name in tiers:
            if tier_name == MemoryTier.WORKING:
                results.extend(self._search_working(query, mode, top_k, **kwargs))
            elif tier_name == MemoryTier.EPISODIC:
                results.extend(self._search_episodic(query, mode, top_k, **kwargs))
            elif tier_name == MemoryTier.SEMANTIC:
                results.extend(self._search_semantic(query, mode, top_k, **kwargs))
            elif tier_name == MemoryTier.PROCEDURAL:
                results.extend(self._search_procedural(query, mode, top_k, **kwargs))

        results.sort(key=lambda r: r.score, reverse=True)
        return results[:top_k]

    def _search_working(
        self,
        query: Union[str, np.ndarray],
        mode: RetrievalMode,
        top_k: int,
        **kwargs,
    ) -> List[RetrievalResult]:
        """Search working memory."""
        results = []

        if isinstance(query, str):
            query_lower = query.lower()
            for key, content in self.working_memory.items().items():
                if query_lower in str(content).lower():
                    results.append(RetrievalResult(
                        content=content,
                        tier=MemoryTier.WORKING,
                        score=0.7,
                        memory_type=MemoryType.EVENT,
                        metadata={"key": key},
                    ))

        return results

    def _search_episodic(
        self,
        query: Union[str, np.ndarray],
        mode: RetrievalMode,
        top_k: int,
        **kwargs,
    ) -> List[RetrievalResult]:
        """Search episodic memory."""
        results = []

        if mode == RetrievalMode.TEMPORAL:
            events = self.episodic_memory.search_by_time(
                start_time=kwargs.get("start_time"),
                end_time=kwargs.get("end_time"),
                limit=top_k,
            )
            for event in events:
                results.append(RetrievalResult(
                    content=event.content,
                    tier=MemoryTier.EPISODIC,
                    score=event.importance / 10,
                    memory_type=MemoryType.EVENT,
                    timestamp=event.timestamp,
                    metadata={
                        "topic": event.topic,
                        "excitement": event.excitement,
                        "emotional_valence": event.emotional_valence,
                    },
                ))

        elif mode == RetrievalMode.CONTEXTUAL:
            events = self.episodic_memory.search_by_context(
                context_key=kwargs.get("context_key", ""),
                context_value=kwargs.get("context_value"),
                limit=top_k,
            )
            for event in events:
                results.append(RetrievalResult(
                    content=event.content,
                    tier=MemoryTier.EPISODIC,
                    score=event.importance / 10,
                    memory_type=MemoryType.EVENT,
                    timestamp=event.timestamp,
                    metadata={"topic": event.topic},
                ))

        elif isinstance(query, str):
            # Keyword search
            search_results = self.episodic_memory.search(query, limit=top_k)
            for event, score in search_results:
                results.append(RetrievalResult(
                    content=event.content,
                    tier=MemoryTier.EPISODIC,
                    score=score,
                    memory_type=MemoryType.EVENT,
                    timestamp=event.timestamp,
                    metadata={
                        "topic": event.topic,
                        "excitement": event.excitement,
                    },
                ))

        return results

    def _search_semantic(
        self,
        query: Union[str, np.ndarray],
        mode: RetrievalMode,
        top_k: int,
        **kwargs,
    ) -> List[RetrievalResult]:
        """Search semantic memory."""
        results = []

        if mode == RetrievalMode.SEMANTIC and isinstance(query, np.ndarray):
            # Vector similarity search
            search_results = self.semantic_memory.similarity_search(
                query=query,
                top_k=top_k,
                threshold=kwargs.get("threshold", 0.7),
            )
            for concept_name, score in search_results:
                concept = self.semantic_memory.get_concept(concept_name)
                if concept:
                    results.append(RetrievalResult(
                        content=concept_name,
                        tier=MemoryTier.SEMANTIC,
                        score=score,
                        memory_type=MemoryType.CONCEPT,
                        metadata={"attributes": concept.attributes},
                    ))

        elif isinstance(query, str):
            # Keyword search
            search_results = self.semantic_memory.keyword_search(query, top_k=top_k)
            for concept_name, score in search_results:
                results.append(RetrievalResult(
                    content=concept_name,
                    tier=MemoryTier.SEMANTIC,
                    score=score,
                    memory_type=MemoryType.CONCEPT,
                    metadata={},
                ))

        return results

    def _search_procedural(
        self,
        query: Union[str, np.ndarray],
        mode: RetrievalMode,
        top_k: int,
        **kwargs,
    ) -> List[RetrievalResult]:
        """Search procedural memory."""
        results = []

        if isinstance(query, str):
            query_lower = query.lower()
            for skill_name, skill in self.procedural_memory._skills.items():
                score = 0.0

                if query_lower in skill_name.lower():
                    score += 0.5

                if query_lower in skill.category.lower():
                    score += 0.3

                for key, value in skill.attributes.items():
                    if query_lower in key.lower() or query_lower in str(value).lower():
                        score += 0.2

                if score > 0:
                    results.append(RetrievalResult(
                        content=skill_name,
                        tier=MemoryTier.PROCEDURAL,
                        score=score + (skill.mastery_level * 0.2),
                        memory_type=MemoryType.SKILL,
                        metadata={
                            "mastery": skill.mastery_level,
                            "tier": skill.mastery_name,
                        },
                    ))

        results.sort(key=lambda r: r.score, reverse=True)
        return results[:top_k]

    def hybrid_search(
        self,
        query: str,
        weights: Optional[Dict[str, float]] = None,
        top_k: int = 10,
    ) -> List[RetrievalResult]:
        """
        Combine multiple retrieval modes.

        Args:
            query: Search query
            weights: Mode weights (default: balanced)
            top_k: Maximum results

        Returns:
            Combined and re-ranked results
        """
        if weights is None:
            weights = {
                "semantic": 0.4,
                "temporal": 0.2,
                "contextual": 0.2,
                "procedural": 0.2,
            }

        all_results = []

        # Semantic
        if weights.get("semantic", 0) > 0:
            results = self.search(query, RetrievalMode.SEMANTIC, top_k=top_k)
            for r in results:
                r.score *= weights["semantic"]
            all_results.extend(results)

        # Temporal (recent)
        if weights.get("temporal", 0) > 0:
            results = self.search(
                query,
                RetrievalMode.TEMPORAL,
                top_k=top_k,
                start_time=time.time() - 86400,
            )
            for r in results:
                r.score *= weights["temporal"]
            all_results.extend(results)

        # Procedural
        if weights.get("procedural", 0) > 0:
            results = self.search(
                query,
                RetrievalMode.SEMANTIC,
                tier=MemoryTier.PROCEDURAL,
                top_k=top_k,
            )
            for r in results:
                r.score *= weights["procedural"]
            all_results.extend(results)

        # Deduplicate and re-rank
        seen = {}
        for result in all_results:
            content_key = str(result.content)
            if content_key not in seen or result.score > seen[content_key].score:
                seen[content_key] = result

        combined = list(seen.values())
        combined.sort(key=lambda r: r.score, reverse=True)
        return combined[:top_k]

    def associative_search(
        self,
        seed: str,
        max_depth: int = 2,
        top_k: int = 10,
    ) -> List[RetrievalResult]:
        """
        Graph-based associative search.

        Args:
            seed: Starting concept
            max_depth: Maximum traversal depth
            top_k: Maximum results

        Returns:
            Associated items with depth-decayed scores
        """
        results = []
        visited = set()
        queue = [(seed, 0, MemoryTier.SEMANTIC)]  # (item, depth, tier)

        while queue and len(results) < top_k:
            current, depth, tier = queue.pop(0)

            if current in visited or depth > max_depth:
                continue

            visited.add(current)

            # Score decays with depth
            score = 1.0 - (depth * 0.3)
            if score > 0:
                results.append(RetrievalResult(
                    content=current,
                    tier=tier,
                    score=score,
                    memory_type=MemoryType.CONCEPT,
                    metadata={"depth": depth},
                ))

            # Add associations from semantic memory
            if tier == MemoryTier.SEMANTIC:
                concept = self.semantic_memory.get_concept(current)
                if concept:
                    for assoc in concept.associations:
                        if assoc not in visited:
                            queue.append((assoc, depth + 1, MemoryTier.SEMANTIC))

        results.sort(key=lambda r: r.score, reverse=True)
        return results[:top_k]

    def generate_quiz_questions(
        self,
        topic: Optional[str] = None,
        difficulty: Optional[float] = None,
        count: int = 5,
    ) -> List[QuizQuestion]:
        """
        Generate quiz questions from memory.

        Args:
            topic: Filter by topic (None = any)
            difficulty: Target difficulty (0-1)
            count: Number of questions

        Returns:
            List of QuizQuestion objects
        """
        questions = []

        # Get concepts/facts to quiz on
        if topic:
            search_results = self.semantic_memory.keyword_search(topic, top_k=10)
        else:
            # Get random concepts
            concepts = list(self.semantic_memory._concepts.keys())
            search_results = [(c, 0.8) for c in concepts[:10]]

        for concept_name, _ in search_results[:count * 2]:
            if len(questions) >= count:
                break

            concept = self.semantic_memory.get_concept(concept_name)
            if not concept:
                continue

            # Generate question from concept
            question = self._generate_question_from_concept(concept, difficulty)
            if question:
                questions.append(question)

        return questions[:count]

    def _generate_question_from_concept(
        self,
        concept,
        target_difficulty: Optional[float],
    ) -> Optional[QuizQuestion]:
        """Generate a quiz question from a concept."""
        # Simple fill-in-the-blank question
        attributes = concept.attributes

        if "definition" in attributes:
            definition = attributes["definition"]
            question = f"What concept is defined as: {definition}?"

            # Generate distractors from related concepts
            options = [concept.name]
            for assoc in list(concept.associations)[:3]:
                options.append(assoc)

            # Fill options if needed
            while len(options) < 4:
                options.append(f"Option {len(options) + 1}")

            import random
            random.shuffle(options)

            return QuizQuestion(
                question=question,
                options=options,
                correct_answer=options.index(concept.name),
                explanation=f"{concept.name} is defined as: {definition}",
                difficulty=0.5,
                source_tier=MemoryTier.SEMANTIC,
                source_id=concept.name,
            )

        return None

    def get_recommendations(
        self,
        known_concepts: Optional[Set[str]] = None,
        limit: int = 5,
    ) -> List[LearningRecommendation]:
        """
        Get personalized learning recommendations.

        Args:
            known_concepts: What the learner already knows
            limit: Maximum recommendations

        Returns:
            List of LearningRecommendation objects
        """
        if known_concepts is None:
            known_concepts = set()

        recommendations = []

        # Get accessible concepts from semantic memory
        next_concepts = self.semantic_memory.get_next_concepts(
            known_concepts,
            limit=limit * 2,
        )

        for concept_name, score in next_concepts[:limit]:
            concept = self.semantic_memory.get_concept(concept_name)
            if not concept:
                continue

            # Calculate missing prerequisites
            missing = list(concept.prerequisites - known_concepts)

            recommendations.append(LearningRecommendation(
                item_name=concept_name,
                reason=f"Builds on your knowledge of {', '.join(known_concepts & concept.prerequisites)}",
                priority=score,
                estimated_time_minutes=30.0,
                prerequisites=missing,
                tier=MemoryTier.SEMANTIC,
            ))

        # Add skill recommendations
        neglected = self.procedural_memory.get_neglected_skills(days=7)
        for skill in neglected[:limit]:
            recommendations.append(LearningRecommendation(
                item_name=skill.name,
                reason=f"Practice this skill (last practiced {int(skill.days_since_practice)} days ago)",
                priority=0.7,
                estimated_time_minutes=20.0,
                prerequisites=list(skill.prerequisites),
                tier=MemoryTier.PROCEDURAL,
            ))

        recommendations.sort(key=lambda r: r.priority, reverse=True)
        return recommendations[:limit]

    def get_retrieval_stats(self) -> Dict[str, Any]:
        """Get retrieval system statistics."""
        return {
            "default_top_k": self.default_top_k,
            "available_modes": [m.value for m in RetrievalMode],
            "available_strategies": [s.value for s in RetrievalStrategy],
        }


def create_retrieval_system(
    working_memory: WorkingMemory,
    episodic_memory: EpisodicMemory,
    semantic_memory: SemanticMemory,
    procedural_memory: ProceduralMemory,
    default_top_k: int = 10,
) -> MemoryRetrieval:
    """Factory function to create retrieval system."""
    return MemoryRetrieval(
        working_memory=working_memory,
        episodic_memory=episodic_memory,
        semantic_memory=semantic_memory,
        procedural_memory=procedural_memory,
        default_top_k=default_top_k,
    )
