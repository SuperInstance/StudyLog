"""
StudyLoG.AI Hierarchical Memory System
======================================

A biologically-inspired memory system for AI agents and learners,
adapted from SuperInstance hierarchical-memory research.

Memory Tiers:
- Working Memory: Short-term cognitive workspace (20 items, 30min decay)
- Episodic Memory: Learning events with emotional context
- Semantic Memory: Concepts and knowledge with vector embeddings
- Procedural Memory: Skills with mastery progression

StudyLoG.AI Enhancements:
- Gamified skill trees for learning paths
- Spaced repetition scheduling based on forgetting curves
- Collaborative learning with memory sharing
- Godot visualization integration
- Theia IDE code pattern memory
"""

from .core import (
    MemoryTier,
    MemoryType,
    MemoryItem,
    ImportanceLevel,
    MasteryLevel,
)

from .working import WorkingMemory, create_working_memory
from .episodic import EpisodicMemory, LearningEvent, create_episodic_memory
from .semantic import SemanticMemory, Concept, create_semantic_memory
from .procedural import (
    ProceduralMemory,
    Skill,
    MasteryLevel,
    create_procedural_memory,
)
from .consolidation import MemoryConsolidation, create_consolidation_pipeline
from .retrieval import MemoryRetrieval, RetrievalMode, create_retrieval_system
from .studylog_memory import StudyLoGMemory, create_studylog_memory

__version__ = "1.0.0-studylog"
__author__ = "SuperInstance.AI - StudyLoG Team"

__all__ = [
    # Main interface
    "StudyLoGMemory",
    "create_studylog_memory",
    # Core types
    "MemoryTier",
    "MemoryType",
    "MemoryItem",
    "ImportanceLevel",
    "MasteryLevel",
    # Memory tiers
    "WorkingMemory",
    "EpisodicMemory",
    "LearningEvent",
    "SemanticMemory",
    "Concept",
    "ProceduralMemory",
    "Skill",
    # Consolidation
    "MemoryConsolidation",
    # Retrieval
    "MemoryRetrieval",
    "RetrievalMode",
    # Factory functions
    "create_working_memory",
    "create_episodic_memory",
    "create_semantic_memory",
    "create_procedural_memory",
    "create_consolidation_pipeline",
    "create_retrieval_system",
]
