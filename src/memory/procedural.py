"""
Procedural Memory Module
========================

Skills and know-how with practice-based improvement.
Based on procedural memory theory - memory for skills and habits.

StudyLoG.AI extensions:
- Gamified skill trees for visualization
- Spaced repetition scheduling
- Learning path generation
- Achievement unlock system
- Collaborative skill sharing
"""

import time
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import numpy as np

from .core import MasteryLevel, SkillMemory


class StudyLoGMasteryLevel(Enum):
    """Mastery levels for StudyLoG.AI gamification."""
    BEGINNER = 1
    LEARNER = 2
    PRACTITIONER = 3
    ADEPT = 4
    EXPERT = 5
    MASTER = 6
    GRANDMASTER = 7  # StudyLoG extension

    @classmethod
    def from_score(cls, score: float) -> "StudyLoGMasteryLevel":
        """Get level from mastery score (0-1)."""
        if score >= 0.95:
            return cls.GRANDMASTER
        elif score >= 0.85:
            return cls.MASTER
        elif score >= 0.70:
            return cls.EXPERT
        elif score >= 0.50:
            return cls.ADEPT
        elif score >= 0.30:
            return cls.PRACTITIONER
        elif score >= 0.10:
            return cls.LEARNER
        else:
            return cls.BEGINNER

    def get_color(self) -> str:
        """Get display color for level."""
        colors = {
            self.BEGINNER: "#808080",      # Gray
            self.LEARNER: "#87CEEB",       # Sky Blue
            self.PRACTITIONER: "#90EE90",  # Light Green
            self.ADEPT: "#FFD700",         # Gold
            self.EXPERT: "#FF8C00",        # Dark Orange
            self.MASTER: "#FF4500",        # Red-Orange
            self.GRANDMASTER: "#9400D3",   # Purple
        }
        return colors.get(self, "#808080")

    def get_icon(self) -> str:
        """Get icon for level."""
        icons = {
            self.BEGINNER: "",
            self.LEARNER: "",
            self.PRACTITIONER: "",
            self.ADEPT: "",
            self.EXPERT: "",
            self.MASTER: "",
            self.GRANDMASTER: "",
        }
        return icons.get(self, "")


@dataclass
class Skill:
    """
    A procedural skill with mastery tracking.

    Attributes:
        name: Unique skill name
        category: Skill category (for grouping)
        mastery_level: Current mastery (0-1)
        practice_count: Total practice sessions
        success_count: Successful practices
        last_practiced: Last practice timestamp
        creation_time: When skill was created
        attributes: Additional metadata
        performance_history: Recent performance scores
        prerequisites: Required skills
        synergies: Skills that boost this one
        streak_days: Consecutive days practiced
        total_practice_minutes: Total time spent
    """
    name: str
    category: str = "general"
    mastery_level: float = 0.0
    practice_count: int = 0
    success_count: int = 0
    last_practiced: float = field(default_factory=time.time)
    creation_time: float = field(default_factory=time.time)
    attributes: Dict[str, Any] = field(default_factory=dict)
    performance_history: List[float] = field(default_factory=list)
    prerequisites: Set[str] = field(default_factory=set)
    synergies: Dict[str, float] = field(default_factory=dict)
    streak_days: int = 0
    total_practice_minutes: float = 0.0

    @property
    def success_rate(self) -> float:
        """Calculate success rate."""
        if self.practice_count == 0:
            return 0.0
        return self.success_count / self.practice_count

    @property
    def mastery_tier(self) -> StudyLoGMasteryLevel:
        """Get mastery tier enum."""
        return StudyLoGMasteryLevel.from_score(self.mastery_level)

    @property
    def mastery_name(self) -> str:
        """Get mastery tier name."""
        return self.mastery_tier.name

    @property
    def days_since_practice(self) -> float:
        """Days since last practice."""
        return (time.time() - self.last_practiced) / 86400

    def is_forgotten(self, threshold: float = 0.3) -> bool:
        """Check if skill has decayed below threshold."""
        return self.get_decayed_mastery() < threshold

    def get_decayed_mastery(self, daily_decay: float = 0.03) -> float:
        """
        Get mastery with decay applied.

        Args:
            daily_decay: Daily decay rate (default 3%)

        Returns:
            Decayed mastery level
        """
        decay = (1 - daily_decay) ** self.days_since_practice
        return self.mastery_level * decay

    def practices_until_next_tier(self, practice_threshold: int = 10) -> int:
        """Estimate practices needed for next mastery tier."""
        current_tier = self.mastery_tier
        next_tier_value = min(7, current_tier.value + 1)

        # Target mastery for next tier
        tier_thresholds = {i: (i - 1) / 7 for i in range(1, 8)}
        target_mastery = tier_thresholds.get(next_tier_value, 1.0)

        if self.mastery_level >= target_mastery:
            return 0

        # Estimate using logarithmic learning curve
        remaining = target_mastery - self.get_decayed_mastery()
        k = 0.1  # Learning rate
        practices = int(-np.log(1 - remaining) / k)

        # Adjust by current level
        required = practices - self.practice_count
        return max(1, required)

    def get_forgetting_curve(self, days: int = 30) -> List[tuple[int, float]]:
        """
        Simulate forgetting curve.

        Args:
            days: Days to simulate

        Returns:
            List of (day, mastery) tuples
        """
        curve = []
        daily_decay = 0.03

        for day in range(days + 1):
            decay = (1 - daily_decay) ** day
            curve.append((day, self.mastery_level * decay))

        return curve

    def get_review_schedule(
        self,
        target_mastery: float = 0.9,
        daily_decay: float = 0.03,
    ) -> List[tuple[int, float]]:
        """
        Calculate when to review to maintain target mastery.

        Args:
            target_mastery: Minimum desired mastery
            daily_decay: Daily decay rate

        Returns:
            List of (days_from_now, predicted_mastery) tuples
        """
        curve = []
        current = self.get_decayed_mastery(daily_decay)

        for day in range(1, 31):
            decay = (1 - daily_decay) ** day
            predicted = self.mastery_level * decay

            if predicted < target_mastery:
                curve.append((day, predicted))

            if predicted < target_mastery * 0.8:
                break

        return curve

    def to_dict(self) -> Dict[str, Any]:
        """Export to dictionary."""
        return {
            "name": self.name,
            "category": self.category,
            "mastery_level": self.mastery_level,
            "mastery_tier": self.mastery_name,
            "tier_color": self.mastery_tier.get_color(),
            "practice_count": self.practice_count,
            "success_rate": self.success_rate,
            "days_since_practice": self.days_since_practice,
            "streak_days": self.streak_days,
            "total_practice_minutes": self.total_practice_minutes,
            "prerequisites": list(self.prerequisites),
            "synergies": self.synergies,
            "is_forgotten": self.is_forgotten(),
            "practices_until_next_tier": self.practices_until_next_tier(),
        }


class ProceduralMemory:
    """
    Procedural memory for skills and know-how.

    Features:
    - Skill mastery levels (7 tiers: Beginner to Grandmaster)
    - Practice-based improvement with diminishing returns
    - Success rate tracking
    - Performance history
    - Skill prerequisites and synergies
    - Forgetting curve simulation
    - Spaced repetition scheduling
    - Practice streak tracking

    Neuroscience basis:
    - Procedural memory theory (skill memory)
    - Spaced repetition effect
    - Power law of practice
    """

    def __init__(
        self,
        practice_threshold: int = 10,
        mastery_decay: bool = True,
        daily_decay_rate: float = 0.03,
    ):
        """
        Initialize procedural memory.

        Args:
            practice_threshold: Practices for tier advancement
            mastery_decay: Whether mastery decays without practice
            daily_decay_rate: Daily decay rate (default 3%)
        """
        self.practice_threshold = practice_threshold
        self.mastery_decay = mastery_decay
        self.daily_decay_rate = daily_decay_rate

        self._skills: Dict[str, Skill] = {}
        self._synergies: Dict[str, Dict[str, float]] = defaultdict(dict)
        self._categories: Dict[str, Set[str]] = defaultdict(set)

    def add_skill(
        self,
        name: str,
        category: str = "general",
        attributes: Optional[Dict[str, Any]] = None,
        prerequisites: Optional[List[str]] = None,
    ) -> bool:
        """
        Add a new skill.

        Args:
            name: Unique skill name
            category: Category for grouping
            attributes: Optional metadata
            prerequisites: Required skills

        Returns:
            True if added successfully
        """
        if not name:
            raise ValueError("Skill name cannot be empty")
        if name in self._skills:
            return False

        skill = Skill(
            name=name,
            category=category,
            attributes=attributes or {},
            prerequisites=set(prerequisites or []),
        )

        self._skills[name] = skill
        self._categories[category].add(name)

        return True

    def practice(
        self,
        name: str,
        success: bool = True,
        performance: Optional[float] = None,
        minutes: float = 30.0,
    ) -> tuple[bool, float, Optional[StudyLoGMasteryLevel]]:
        """
        Practice a skill and potentially improve mastery.

        Args:
            name: Skill name
            success: Whether practice was successful
            performance: Optional performance score (0-1)
            minutes: Time spent practicing

        Returns:
            (success, new_mastery, tier_upgraded) tuple
        """
        skill = self._skills.get(name)
        if not skill:
            return False, 0.0, None

        old_tier = skill.mastery_tier

        # Update practice stats
        skill.practice_count += 1
        skill.total_practice_minutes += minutes

        if success:
            skill.success_count += 1

        if performance is not None:
            skill.performance_history.append(performance)
            # Keep only last 20
            if len(skill.performance_history) > 20:
                skill.performance_history = skill.performance_history[-20:]

        # Calculate mastery improvement
        # Logarithmic learning curve with diminishing returns
        base_improvement = 0.1 / (1 + 0.1 * skill.practice_count)

        # Quality multiplier
        quality = performance if performance is not None else (0.9 if success else 0.3)
        improvement = base_improvement * quality

        # Time bonus (up to 2 hours)
        time_bonus = min(minutes / 120.0, 0.05)

        # Synergy bonus from related skills
        synergy_bonus = 0.0
        for other_skill, bonus in self._synergies.get(name, {}).items():
            other = self._skills.get(other_skill)
            if other and other.mastery_tier.value >= 4:  # Adept or higher
                synergy_bonus += bonus

        # Apply improvement
        skill.mastery_level = min(1.0, skill.mastery_level + improvement + time_bonus + synergy_bonus)
        skill.last_practiced = time.time()

        # Update streak (simplified - would need daily tracking in production)
        if skill.days_since_practice < 1.5:
            skill.streak_days += 1
        else:
            skill.streak_days = 1

        new_tier = skill.mastery_tier
        tier_upgraded = None
        if new_tier != old_tier:
            tier_upgraded = new_tier

        return True, skill.mastery_level, tier_upgraded

    def get_skill(self, name: str) -> Optional[Skill]:
        """Retrieve skill by name."""
        return self._skills.get(name)

    def get_mastery(self, name: str) -> float:
        """Get current mastery (with decay if enabled)."""
        skill = self._skills.get(name)
        if not skill:
            return 0.0

        if self.mastery_decay:
            return skill.get_decayed_mastery(self.daily_decay_rate)
        return skill.mastery_level

    def can_perform(self, name: str, threshold: float = 0.5) -> bool:
        """Check if skill can be performed at threshold."""
        mastery = self.get_mastery(name)

        # Check mastery threshold
        if mastery < threshold:
            return False

        # Check prerequisites
        skill = self._skills.get(name)
        if not skill:
            return False

        for prereq in skill.prerequisites:
            if self.get_mastery(prereq) < 0.5:  # Prereqs must be at least Adept
                return False

        return True

    def add_synergy(self, skill1: str, skill2: str, boost: float = 0.05):
        """Add synergy between two skills."""
        if skill1 in self._skills and skill2 in self._skills:
            self._synergies[skill1][skill2] = boost
            self._synergies[skill2][skill1] = boost

    def get_skills_by_category(self, category: str) -> List[Skill]:
        """Get all skills in a category."""
        return [self._skills[name] for name in self._categories.get(category, set())]

    def get_top_skills(self, limit: int = 10) -> List[Skill]:
        """Get skills sorted by mastery level."""
        skills = list(self._skills.values())
        skills.sort(key=lambda s: (s.mastery_level, s.practice_count), reverse=True)
        return skills[:limit]

    def get_neglected_skills(self, days: int = 7) -> List[Skill]:
        """Get skills not practiced recently."""
        cutoff_time = time.time() - (days * 86400)
        neglected = [
            skill for skill in self._skills.values()
            if skill.last_practiced < cutoff_time
        ]
        neglected.sort(key=lambda s: s.last_practiced)
        return neglected

    def get_forgotten_skills(self, threshold: float = 0.3) -> List[Skill]:
        """Get skills that have decayed below threshold."""
        return [
            skill for skill in self._skills.values()
            if skill.is_forgotten(threshold)
        ]

    def get_practice_schedule(
        self,
        target_mastery: float = 0.9,
        skill_name: Optional[str] = None,
    ) -> Dict[str, int]:
        """
        Estimate practices needed to reach target mastery.

        Args:
            target_mastery: Desired mastery level
            skill_name: Specific skill or all if None

        Returns:
            Dict mapping skill name -> practices needed
        """
        if skill_name:
            skills = {skill_name: self._skills.get(skill_name)}
        else:
            skills = self._skills

        schedule = {}
        for name, skill in skills.items():
            if skill is None:
                continue

            current = self.get_mastery(name)
            if current >= target_mastery:
                schedule[name] = 0
            else:
                schedule[name] = skill.practices_until_next_tier()

        return schedule

    def get_skill_tree(self) -> Dict[str, Dict[str, Any]]:
        """
        Generate skill tree structure for visualization.

        Returns:
            Dict with skills as nodes and prerequisites as edges
        """
        tree = {}

        for name, skill in self._skills.items():
            tree[name] = {
                "name": skill.name,
                "category": skill.category,
                "mastery": skill.mastery_level,
                "tier": skill.mastery_name,
                "color": skill.mastery_tier.get_color(),
                "prerequisites": list(skill.prerequisites),
                "unlocked": all(
                    self.get_mastery(p) >= 0.5 for p in skill.prerequisites
                ),
            }

        return tree

    def get_learning_path(self, target_skill: str) -> List[str]:
        """
        Generate ordered learning path for a target skill.

        Returns:
            List of skill names in recommended order
        """
        if target_skill not in self._skills:
            return []

        path = []
        visited = set()

        def add_prereqs(skill_name: str):
            if skill_name in visited:
                return
            visited.add(skill_name)

            skill = self._skills.get(skill_name)
            if not skill:
                return

            for prereq in skill.prerequisites:
                add_prereqs(prereq)

            path.append(skill_name)

        add_prereqs(target_skill)
        return path

    def get_statistics(self) -> Dict[str, Any]:
        """Get procedural memory statistics."""
        total_practice = sum(s.practice_count for s in self._skills.values())
        total_success = sum(s.success_count for s in self._skills.values())
        total_minutes = sum(s.total_practice_minutes for s in self._skills.values())

        tier_counts = {tier.name: 0 for tier in StudyLoGMasteryLevel}
        for skill in self._skills.values():
            tier_counts[skill.mastery_name] += 1

        return {
            "total_skills": len(self._skills),
            "total_practice": total_practice,
            "total_success": total_success,
            "overall_success_rate": total_success / total_practice if total_practice > 0 else 0,
            "total_practice_hours": total_minutes / 60,
            "mastery_distribution": tier_counts,
            "grandmaster_skills": tier_counts["GRANDMASTER"],
            "master_skills": tier_counts["MASTER"],
            "expert_skills": tier_counts["EXPERT"],
            "categories": {
                cat: len(skills) for cat, skills in self._categories.items()
            },
        }

    def __len__(self) -> int:
        return len(self._skills)

    def __contains__(self, name: str) -> bool:
        return name in self._skills

    def __repr__(self) -> str:
        return f"ProceduralMemory(skills={len(self._skills)})"


def create_procedural_memory(
    practice_threshold: int = 10,
    mastery_decay: bool = True,
    daily_decay_rate: float = 0.03,
) -> ProceduralMemory:
    """Factory function to create procedural memory."""
    return ProceduralMemory(
        practice_threshold=practice_threshold,
        mastery_decay=mastery_decay,
        daily_decay_rate=daily_decay_rate,
    )
