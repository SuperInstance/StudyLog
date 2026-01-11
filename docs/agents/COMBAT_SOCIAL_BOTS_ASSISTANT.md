# Combat & Social Bots Assistant Agent

**Agent Type:** Decision Automation & Social Interaction System
**Based on:** SuperInstance DMLog Research (combat_bots.py, social_bots.py, mechanical_bot.py)
**For Product:** DMLoG.AI (Primary), StudyLoG.AI (Adaptation)
**Version:** 1.0.0
**Last Updated:** 2026-01-10

---

## Table of Contents

1. [Agent Overview](#agent-overview)
2. [Combat Bot System](#combat-bot-system)
3. [Social Bot System](#social-bot-system)
4. [Agent Architecture](#agent-architecture)
5. [API Specification](#api-specification)
6. [Code Examples](#code-examples)
7. [DMLog Integration](#dmlog-integration)
8. [StudyLoG.AI Adaptation](#studylogai-adaptation)

---

## Agent Overview

The Combat & Social Bots Assistant is a dual-mode AI agent system that handles:

### Core Capabilities

| Capability | Combat Mode | Social Mode |
|------------|-------------|-------------|
| **Decision Making** | Tactical combat choices | Dialogue and interaction |
| **Coordination** | Party combat tactics | Group social dynamics |
| **Resource Management** | HP, spells, equipment | Reputation, influence |
| **Learning** | Combat pattern recognition | Relationship building |
| **Escalation** | Life/death routing | Social consequence routing |

### Agent Purpose

```
┌─────────────────────────────────────────────────────────────────┐
│                    Combat & Social Bots Assistant              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  COMBAT MODE                        SOCIAL MODE                  │
│  ├─ Tactical Decisions              ├─ Dialogue Generation       │
│  ├─ Position Calculation            ├─ Relationship Tracking     │
│  ├─ Action Selection                ├─ Persuasion/Intimidation    │
│  ├─ Party Coordination              ├─ Party Dynamics            │
│  └─ Resource Optimization           └─ Influence Management      │
│                                                                   │
│  SHARED SYSTEMS                                                   │
│  ├─ Escalation Engine (Bot/Brain/Human)                          │
│  ├─ Personality System (Big Five Model)                          │
│  ├─ Memory System (6-tier hierarchy)                             │
│  └─ Outcome Tracker (reward signals)                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Dual-Mode Architecture**: Seamless switching between combat and social contexts
2. **Personality-Driven**: All decisions filtered through Big Five personality traits
3. **Cost-Optimized**: Escalation engine routes to appropriate intelligence level
4. **Memory-Aware**: Past experiences influence current decisions
5. **Party-Coordinated**: Multi-bot coordination for complex scenarios

---

## Combat Bot System

### Decision Matrix Architecture

The combat bot uses a weighted decision matrix for action selection:

```python
@dataclass
class CombatDecisionMatrix:
    """Weight matrix for combat decisions"""

    # Survival weights (0.0-1.0)
    self_preservation: float = 0.7      # Avoid death
    ally_preservation: float = 0.5      # Protect allies

    # Offensive weights
    aggression: float = 0.5             # Attack priority
    target_priority: float = 0.6        # Focus vs. spread damage

    # Tactical weights
    positioning: float = 0.5            # Movement importance
    resource_management: float = 0.6    # Spell/slot conservation

    # Party coordination weights
    party_synergy: float = 0.4          # Combo opportunities
    support_priority: float = 0.5       # Heals/buffs first?

    def calculate_action_score(
        self,
        action: CombatAction,
        context: CombatContext
    ) -> float:
        """Calculate weighted score for an action"""
        score = 0.0

        # Survival check
        if context.hp_ratio < 0.3:
            if action.is_defensive:
                score += self.self_preservation * 2.0
            elif action.is_healing:
                score += self.self_preservation * 2.5

        # Ally in danger
        if context.ally_hp_ratio_min < 0.3:
            if action.is_ally_support:
                score += self.ally_preservation * 1.5

        # Target selection
        if action.target_is_spellcaster:
            score += self.target_priority * 0.3
        if action.target_is_low_hp:
            score += self.target_priority * 0.2

        # Positioning
        if action.movement_to_flank:
            score += self.positioning * 0.4

        # Resource conservation
        if context.remaining_spell_slots < 2:
            if action.uses_spell_slot:
                score -= self.resource_management * 0.5

        return score
```

### Tactical Positioning System

```python
@dataclass
class TacticalPosition:
    """3D tactical positioning for combat"""

    x: float
    y: float
    z: float

    # Position qualities
    is_flanking: bool = False
    is_covered: bool = False
    is_elevated: bool = False
    is_choking_point: bool = False

    # Threat assessment
    threat_zone_count: int = 0       # Enemies in range
    ally_support_count: int = 0      # Allies in range
    escape_routes: int = 1           # Available exits

    def calculate_position_value(
        self,
        combat_role: CombatRole,
        personality: Personality
    ) -> float:
        """Calculate how good this position is for the character"""

        value = 0.0

        # Role-based preferences
        if combat_role == CombatRole.TANK:
            # Tanks want to be in threat zones, covered
            value += self.threat_zone_count * 0.3
            value += 1.0 if self.is_covered else 0
            value += 0.5 if self.is_choking_point else 0

        elif combat_role == CombatRole.STRIKER:
            # Strikers want flanking, elevation
            value += 1.0 if self.is_flanking else 0
            value += 0.5 if self.is_elevated else 0
            value -= self.threat_zone_count * 0.2

        elif combat_role == CombatRole.SUPPORT:
            # Supports want ally coverage, safety
            value += self.ally_support_count * 0.4
            value += 1.0 if self.is_covered else 0
            value -= self.threat_zone_count * 0.3

        # Personality modifiers
        if combat_role == CombatRole.STRIKER:
            if personality.extraversion > 0.7:
                # Bold strikers take more risks
                value += self.threat_zone_count * 0.2
            elif personality.neuroticism > 0.7:
                # Cautious strikers avoid danger
                value -= self.threat_zone_count * 0.4

        return value
```

### Resource Management System

```python
class CombatResourceManager:
    """Manage combat resources (HP, spells, items)"""

    def __init__(self, character: 'CombatCharacter'):
        self.character = character
        self.max_hp = character.max_hp
        self.current_hp = character.current_hp

        # Spell slots by level
        self.spell_slots: Dict[int, int] = character.spell_slots
        self.used_slots: Dict[int, int] = {k: 0 for k in self.spell_slots}

        # Consumables
        self.potions: int = character.potions
        self Scrolls: int = character.scrolls

    def should_use_spell_slot(
        self,
        spell_level: int,
        stakes: float,
        personality: Personality
    ) -> bool:
        """Decide if a spell slot should be used"""

        available = self.spell_slots.get(spell_level, 0)
        used = self.used_slots.get(spell_level, 0)

        # Critical: always use if life at stake
        if stakes > 0.9 and self.hp_ratio < 0.3:
            return True

        # Conservative characters save high-level slots
        if spell_level >= 3:
            if personality.conscientiousness > 0.7:
                # Save for emergencies
                if (available - used) <= 1:
                    return False

        # High-level slots for high-stakes situations
        if spell_level >= 3 and stakes < 0.5:
            return False

        return True

    def recommend_action_level(
        self,
        context: CombatContext
    ) -> int:
        """Recommend spell/action level based on situation"""

        hp_ratio = self.current_hp / self.max_hp

        # Critical health: use best healing
        if hp_ratio < 0.2:
            return 3  # Highest level

        # Low health: use significant resources
        if hp_ratio < 0.4:
            return 2

        # Multiple enemies: use AoE
        if context.enemy_count >= 3:
            return 2

        # Routine: conserve
        return 1

    @property
    def hp_ratio(self) -> float:
        return self.current_hp / self.max_hp if self.max_hp > 0 else 0
```

### Party Coordination System

```python
class CombatPartyCoordinator:
    """Coordinate combat actions across multiple bots"""

    def __init__(self):
        self.members: List[CombatCharacter] = []
        self.formation: PartyFormation = PartyFormation.ADAPTIVE

    def add_member(self, character: CombatCharacter):
        """Add a party member"""
        self.members.append(character)

    def plan_round_actions(
        self,
        combat_context: CombatContext
    ) -> Dict[str, CombatAction]:
        """Plan coordinated actions for the entire party"""

        actions = {}

        # Identify threats
        primary_target = self._identify_primary_target(combat_context)
        secondary_targets = self._identify_secondary_targets(combat_context)

        # Plan by role
        for member in self.members:
            if member.role == CombatRole.TANK:
                actions[member.id] = self._plan_tank_action(
                    member, primary_target, combat_context
                )

            elif member.role == CombatRole.STRIKER:
                actions[member.id] = self._plan_striker_action(
                    member, primary_target, secondary_targets, combat_context
                )

            elif member.role == CombatRole.CONTROLLER:
                actions[member.id] = self._plan_controller_action(
                    member, combat_context
                )

            elif member.role == CombatRole.SUPPORT:
                actions[member.id] = self._plan_support_action(
                    member, combat_context
                )

        return actions

    def _plan_tank_action(
        self,
        tank: CombatCharacter,
        primary_target: Enemy,
        context: CombatContext
    ) -> CombatAction:
        """Plan tank actions - engage and protect"""

        # If someone is in danger, protect them
        endangered_ally = self._find_endangered_ally(context)
        if endangered_ally:
            return CombatAction(
                type=ActionType.PROTECT,
                target=endangered_ally,
                priority=ActionPriority.CRITICAL
            )

        # Otherwise, engage primary target
        return CombatAction(
            type=ActionType.ATTACK,
            target=primary_target,
            priority=ActionPriority.HIGH
        )

    def _plan_striker_action(
        self,
        striker: CombatCharacter,
        primary_target: Enemy,
        secondary_targets: List[Enemy],
        context: CombatContext
    ) -> CombatAction:
        """Plan striker actions - damage and position"""

        # Look for flanking opportunities
        flank_target = self._find_flank_opportunity(striker, context)
        if flank_target:
            return CombatAction(
                type=ActionType.ATTACK,
                target=flank_target,
                position=self._calculate_flank_position(striker, flank_target),
                priority=ActionPriority.HIGH
            )

        # Attack primary target
        return CombatAction(
            type=ActionType.ATTACK,
            target=primary_target,
            priority=ActionPriority.HIGH
        )

    def _plan_support_action(
        self,
        support: CombatCharacter,
        context: CombatContext
    ) -> CombatAction:
        """Plan support actions - heal and buff"""

        # Check if anyone needs healing
        injured = self._find_most_injured_ally(context, threshold=0.7)
        if injured:
            return CombatAction(
                type=ActionType.HEAL,
                target=injured,
                priority=ActionPriority.CRITICAL if injured.hp_ratio < 0.3 else ActionPriority.MEDIUM
            )

        # Check for buff opportunities
        if self._should_buff(context):
            return CombatAction(
                type=ActionType.BUFF,
                target=self._find_best_buff_target(context),
                priority=ActionPriority.LOW
            )

        # Cantrip attack
        return CombatAction(
            type=ActionType.CANTRIP,
            target=context.primary_target,
            priority=ActionPriority.LOW
        )
```

---

## Social Bot System

### Dialogue Generation System

```python
class SocialDialogueGenerator:
    """Generate context-aware dialogue for social interactions"""

    def __init__(self, personality: Personality):
        self.personality = personality
        self.templates = self._load_dialogue_templates()

    def generate_response(
        self,
        input_message: str,
        context: SocialContext,
        intent: SocialIntent
    ) -> DialogueResponse:
        """Generate a personality-driven response"""

        # Analyze input
        sentiment = self._analyze_sentiment(input_message)
        topics = self._extract_topics(input_message)

        # Select response strategy based on personality
        strategy = self._select_response_strategy(intent, sentiment)

        # Generate response
        response = self._build_response(
            strategy=strategy,
            topics=topics,
            context=context,
            intent=intent
        )

        # Adjust based on personality
        response = self._personality_adjust(response)

        return response

    def _select_response_strategy(
        self,
        intent: SocialIntent,
        sentiment: float
    ) -> ResponseStrategy:
        """Select how to respond based on personality and context"""

        # High extraversion: more verbose, enthusiastic
        if self.personality.extraversion > 0.7:
            if intent == SocialIntent.GREETING:
                return ResponseStrategy.ENTHUSIASTIC
            elif intent == SocialIntent.FAREWELL:
                return ResponseStrategy.FRIENDLY

        # High agreeableness: more accommodating
        if self.personality.agreeableness > 0.7:
            if sentiment < 0:
                return ResponseStrategy.EMPATHETIC
            elif intent == SocialIntent.REQUEST:
                return ResponseStrategy.HELPFUL

        # High openness: more creative, curious
        if self.personality.openness > 0.7:
            if intent == SocialIntent.INQUIRY:
                return ResponseStrategy.EXPLORATORY

        # High conscientiousness: more structured
        if self.personality.conscientiousness > 0.7:
            return ResponseStrategy.STRUCTURED

        # Default: balanced
        return ResponseStrategy.BALANCED

    def _build_response(
        self,
        strategy: ResponseStrategy,
        topics: List[str],
        context: SocialContext,
        intent: SocialIntent
    ) -> DialogueResponse:
        """Build response based on strategy"""

        templates = self.templates[strategy]

        # Select template
        template = random.choice(templates)

        # Fill in placeholders
        response_text = template.format(
            speaker_name=context.speaker_name,
            listener_name=context.listener_name,
            topic=topics[0] if topics else "that",
            location=context.location,
            time_of_day=context.time_of_day
        )

        return DialogueResponse(
            text=response_text,
            strategy=strategy,
            confidence=0.8,
            topics=topics
        )
```

### Relationship Management System

```python
@dataclass
class Relationship:
    """Track relationship between characters"""

    character_a_id: str
    character_b_id: str

    # Relationship metrics
    trust_level: float = 0.5          # 0 = distrusts, 1 = trusts
    affection: float = 0.5            # 0 = dislikes, 1 = likes
    respect: float = 0.5              # 0 = no respect, 1 = high respect
    familiarity: float = 0.0          # 0 = stranger, 1 = knows well

    # Interaction history
    positive_interactions: int = 0
    negative_interactions: int = 0
    total_interactions: int = 0

    # Shared experiences
    shared_memories: List[str] = field(default_factory=list)
    debts: List[str] = field(default_factory=list)      # Owed favors
    favors: List[str] = field(default_factory=list)     # Owed to

    def update_from_interaction(
        self,
        interaction_type: SocialInteractionType,
        outcome: SocialOutcome,
        magnitude: float = 0.1
    ):
        """Update relationship based on interaction"""

        self.total_interactions += 1

        if outcome == SocialOutcome.POSITIVE:
            self.positive_interactions += 1
            self.affection = min(1.0, self.affection + magnitude)
            self.trust_level = min(1.0, self.trust_level + magnitude * 0.5)

            # Respect grows from competence
            if interaction_type in [SocialInteractionType.COMBAT_ASSIST,
                                     SocialInteractionType.TEACHING]:
                self.respect = min(1.0, self.respect + magnitude * 0.3)

        elif outcome == SocialOutcome.NEGATIVE:
            self.negative_interactions += 1
            self.affection = max(0.0, self.affection - magnitude)
            self.trust_level = max(0.0, self.trust_level - magnitude * 0.7)

            # Betrayal hurts respect more
            if interaction_type == SocialInteractionType.BETRAYAL:
                self.respect = max(0.0, self.respect - magnitude * 2.0)

        # Familiarity grows with all interactions
        self.familiarity = min(1.0, self.familiarity + 0.05)

    def calculate_influence(self, personality: Personality) -> float:
        """Calculate how much influence this relationship has"""

        base_influence = (self.trust_level + self.respect) / 2

        # Personality affects influence susceptibility
        if personality.agreeableness > 0.7:
            base_influence *= 1.3

        if personality.openness > 0.7:
            base_influence *= 1.1

        # Familiarity amplifies influence
        base_influence *= (1 + self.familiarity * 0.5)

        return min(1.0, base_influence)

    @property
    def relationship_score(self) -> float:
        """Overall relationship score"""
        return (self.trust_level * 0.4 +
                self.affection * 0.3 +
                self.respect * 0.2 +
                self.familiarity * 0.1)

    @property
    def relationship_type(self) -> str:
        """Categorize the relationship"""
        score = self.relationship_score

        if score < 0.2:
            return "Hostile"
        elif score < 0.4:
            return "Unfriendly"
        elif score < 0.6:
            return "Neutral"
        elif score < 0.8:
            return "Friendly"
        else:
            return "Close"
```

### Persuasion & Intimidation System

```python
class SocialInfluenceSystem:
    """Handle persuasion, intimidation, and deception checks"""

    def __init__(self, character: 'SocialCharacter'):
        self.character = character
        self.personality = character.personality
        self.stats = character.stats

    def calculate_persuasion_bonus(
        self,
        target: 'SocialCharacter',
        context: SocialContext
    ) -> float:
        """Calculate persuasion bonus"""

        bonus = 0.0

        # Base charisma modifier
        charisma_mod = (self.stats.charisma - 10) / 2
        bonus += charisma_mod * 0.1

        # Personality match helps
        personality_compatibility = self._calculate_personality_compatibility(
            self.personality, target.personality
        )
        bonus += personality_compatibility * 0.2

        # Existing relationship matters
        relationship = self.character.get_relationship(target.id)
        if relationship:
            bonus += relationship.trust_level * 0.3
            bonus += relationship.affection * 0.2

        # Desperation helps/hurts
        if context.stakes > 0.8:
            if self.personality.neuroticism > 0.6:
                # Desperation shows
                bonus -= 0.2
            elif self.personality.extraversion > 0.7:
                # Charismatic under pressure
                bonus += 0.1

        # Arguments matter
        if context.arguments_provided > 0:
            bonus += context.arguments_provided * 0.1

        return max(-0.5, min(0.5, bonus))

    def calculate_intimidation_bonus(
        self,
        target: 'SocialCharacter',
        context: SocialContext
    ) -> float:
        """Calculate intimidation bonus"""

        bonus = 0.0

        # Size/strength advantage
        if self.character.size > target.size:
            bonus += 0.2
        elif self.character.size < target.size:
            bonus -= 0.2

        # Visible threat helps
        if self.character.is_armed and not target.is_armed:
            bonus += 0.3

        # Reputation helps
        if self.character.reputation.intimidation > 0.5:
            bonus += self.character.reputation.intimidation * 0.2

        # Personality affects delivery
        if self.personality.agreeableness < 0.3:
            # Low agreeableness = better at intimidation
            bonus += 0.2

        if self.personality.neuroticism > 0.6:
            # Nervousness shows weakness
            bonus -= 0.2

        # Target personality affects reception
        if target.personality.neuroticism > 0.7:
            # Neurotic targets more susceptible
            bonus += 0.2

        if target.personality.conscientiousness > 0.7:
            # Conscientious targets harder to intimidate
            bonus -= 0.1

        return max(-0.5, min(0.5, bonus))

    def attempt_persuasion(
        self,
        target: 'SocialCharacter',
        request: str,
        context: SocialContext
    ) -> SocialInfluenceResult:
        """Attempt to persuade the target"""

        # Calculate DC based on request difficulty
        base_dc = 0.5
        if context.stakes > 0.7:
            base_dc += 0.2  # Harder to persuade for big asks
        if request involves risk:
            base_dc += 0.1

        # Calculate bonus
        bonus = self.calculate_persuasion_bonus(target, context)

        # Roll with advantage/disadvantage
        roll = random.random()

        # Check for advantage (good arguments, good relationship)
        if context.arguments_provided >= 2:
            roll = max(roll, random.random())

        # Check for disadvantage (bad relationship, bad mood)
        relationship = self.character.get_relationship(target.id)
        if relationship and relationship.affection < 0.3:
            roll = min(roll, random.random())

        success = (roll + bonus) >= base_dc

        return SocialInfluenceResult(
            success=success,
            roll=roll,
            dc=base_dc,
            bonus=bonus,
            target_mood=target.current_mood,
            relationship_change=self._calculate_relationship_change(
                success, context.stakes
            )
        )
```

### Party Dynamics System

```python
class PartyDynamicsManager:
    """Manage social dynamics within a party"""

    def __init__(self):
        self.members: List['SocialCharacter'] = []
        self.group_morale: float = 0.5
        self.group_cohesion: float = 0.5
        self.active_conflicts: List[Conflict] = []

    def calculate_party_cohesion(self) -> float:
        """Calculate how well the party works together"""

        if len(self.members) < 2:
            return 1.0

        total_compatibility = 0.0
        pair_count = 0

        for i, member_a in enumerate(self.members):
            for member_b in self.members[i+1:]:
                relationship = member_a.get_relationship(member_b.id)
                if relationship:
                    total_compatibility += relationship.relationship_score
                else:
                    total_compatibility += 0.5  # Neutral baseline
                pair_count += 1

        base_cohesion = total_compatibility / pair_count if pair_count > 0 else 0.5

        # Active conflicts reduce cohesion
        conflict_penalty = len(self.active_conflicts) * 0.15
        cohesion = base_cohesion - conflict_penalty

        # Shared experiences boost cohesion
        shared_experience_bonus = len(self._get_shared_experiences()) * 0.02

        return max(0.0, min(1.0, cohesion + shared_experience_bonus))

    def detect_potential_conflicts(self) -> List[Conflict]:
        """Detect potential conflicts in the party"""

        conflicts = []

        for i, member_a in enumerate(self.members):
            for member_b in self.members[i+1:]:
                relationship = member_a.get_relationship(member_b.id)
                if not relationship:
                    continue

                # Low affection + low trust = potential conflict
                if relationship.affection < 0.3 and relationship.trust_level < 0.3:
                    conflicts.append(Conflict(
                        type=ConflictType.PERSONAL,
                        parties=[member_a.id, member_b.id],
                        severity=ConflictSeverity.LOW,
                        description=f"Tension between {member_a.name} and {member_b.name}"
                    ))

                # Check for competing goals
                if self._has_competing_goals(member_a, member_b):
                    conflicts.append(Conflict(
                        type=ConflictType.GOAL,
                        parties=[member_a.id, member_b.id],
                        severity=ConflictSeverity.MEDIUM,
                        description=f"Competing goals between {member_a.name} and {member_b.name}"
                    ))

                # Check for value clashes
                if self._has_value_clash(member_a, member_b):
                    conflicts.append(Conflict(
                        type=ConflictType.VALUE,
                        parties=[member_a.id, member_b.id],
                        severity=ConflictSeverity.HIGH,
                        description=f"Value clash between {member_a.name} and {member_b.name}"
                    ))

        return conflicts

    def resolve_conflict(
        self,
        conflict: Conflict,
        method: ConflictResolutionMethod,
        mediator: Optional['SocialCharacter'] = None
    ) -> ConflictResolutionResult:
        """Attempt to resolve a conflict"""

        parties = [self.get_member(p) for p in conflict.parties]
        party_a, party_b = parties[0], parties[1]

        if method == ConflictResolutionMethod.COMPROMISE:
            # Both give a little
            change = 0.1
            party_a.get_relationship(party_b.id).affection += change
            party_b.get_relationship(party_a.id).affection += change

            return ConflictResolutionResult(
                resolved=True,
                method=method,
                relationship_change=change,
                description=f"Both parties compromised"
            )

        elif method == ConflictResolutionMethod.MEDIATION:
            if mediator:
                # Mediator's charisma and relationships matter
                bonus = mediator.stats.charisma / 20
                relationship_a = mediator.get_relationship(party_a.id)
                relationship_b = mediator.get_relationship(party_b.id)

                mediator_bonus = 0
                if relationship_a:
                    mediator_bonus += relationship_a.respect * 0.2
                if relationship_b:
                    mediator_bonus += relationship_b.respect * 0.2

                success = (bonus + mediator_bonus) > 0.4

                if success:
                    change = 0.15
                    party_a.get_relationship(party_b.id).affection += change
                    party_b.get_relationship(party_a.id).affection += change

                    return ConflictResolutionResult(
                        resolved=True,
                        method=method,
                        relationship_change=change,
                        description=f"Mediated by {mediator.name}"
                    )

        elif method == ConflictResolutionMethod.FORCED:
            # One side dominates - one gains respect, other loses affection
            # (Not ideal but realistic)
            pass

        return ConflictResolutionResult(
            resolved=False,
            method=method,
            relationship_change=0.0,
            description="Resolution failed"
        )
```

---

## Agent Architecture

### Bot Personality Integration

```python
class CombatSocialBot:
    """Unified bot with combat and social capabilities"""

    def __init__(
        self,
        bot_id: str,
        name: str,
        personality: Personality,
        combat_role: Optional[CombatRole] = None,
        social_role: Optional[SocialRole] = None
    ):
        self.bot_id = bot_id
        self.name = name
        self.personality = personality

        # Combat systems
        self.combat_role = combat_role
        self.combat_matrix = self._create_combat_matrix()
        self.combat_resources: Optional[CombatResourceManager] = None

        # Social systems
        self.social_role = social_role
        self.dialogue_generator = SocialDialogueGenerator(personality)
        self.relationships: Dict[str, Relationship] = {}

        # Core systems
        self.memory = HierarchicalMemory(bot_id)
        self.escalation = EscalationEngine()
        self.outcome_tracker = OutcomeTracker()

        # State
        self.current_mode = BotMode.SOCIAL  # Start in social mode
        self.current_mood = self._calculate_initial_mood()

    def _create_combat_matrix(self) -> CombatDecisionMatrix:
        """Create personality-based combat decision matrix"""

        base_matrix = CombatDecisionMatrix()

        # Personality affects combat preferences
        if self.personality.agreeableness > 0.7:
            base_matrix.ally_preservation = 0.7  # Protect friends
        elif self.personality.agreeableness < 0.3:
            base_matrix.ally_preservation = 0.3  # Self-focused

        if self.personality.neuroticism > 0.7:
            base_matrix.self_preservation = 0.9  # Very cautious
            base_matrix.aggression = 0.2
        elif self.personality.neuroticism < 0.3:
            base_matrix.self_preservation = 0.4  # Bold
            base_matrix.aggression = 0.8

        if self.personality.conscientiousness > 0.7:
            base_matrix.resource_management = 0.8  # Conservative
            base_matrix.party_synergy = 0.6  # Planned tactics
        else:
            base_matrix.resource_management = 0.4  # Spend freely
            base_matrix.party_synergy = 0.3  # Improvise

        if self.personality.extraversion > 0.7:
            base_matrix.party_synergy = 0.7  # Team player
        elif self.personality.extraversion < 0.3:
            base_matrix.party_synergy = 0.3  # Solo focused

        return base_matrix

    def _calculate_initial_mood(self) -> Mood:
        """Calculate initial mood based on personality"""

        base_mood = Mood.NEUTRAL

        if self.personality.extraversion > 0.7:
            base_mood = Mood.CHEERFUL
        elif self.personality.neuroticism > 0.6:
            base_mood = Mood.ANXIOUS

        return base_mood

    async def make_combat_decision(
        self,
        context: CombatContext
    ) -> CombatAction:
        """Make a combat decision using escalation"""

        # Build escalation context
        escalation_context = DecisionContext(
            character_id=self.bot_id,
            situation_type="combat_action",
            situation_description=self._describe_combat_situation(context),
            stakes=self._calculate_combat_stakes(context),
            urgency_ms=5000,  # Combat decisions needed quickly
            similar_decisions_count=self._count_similar_combat(context)
        )

        # Route decision
        decision = await self.escalation.route_decision(escalation_context)

        # Execute based on source
        if decision.source == DecisionSource.BOT:
            return self._bot_combat_decision(context)
        elif decision.source == DecisionSource.BRAIN:
            return await self._brain_combat_decision(context, decision)
        else:
            return await self._human_combat_decision(context, decision)

    async def make_social_response(
        self,
        input_message: str,
        context: SocialContext
    ) -> DialogueResponse:
        """Make a social response using escalation"""

        # Analyze input
        intent = self._classify_social_intent(input_message)
        sentiment = self._analyze_sentiment(input_message)

        # Build escalation context
        escalation_context = DecisionContext(
            character_id=self.bot_id,
            situation_type=f"social_{intent.value}",
            situation_description=f"{intent.value}: {input_message}",
            stakes=self._calculate_social_stakes(context, intent),
            urgency_ms=3000,
            similar_decisions_count=self._count_similar_social(input_message, intent)
        )

        # Route decision
        decision = await self.escalation.route_decision(escalation_context)

        # Generate response
        if decision.source == DecisionSource.BOT:
            return self._bot_social_response(input_message, context, intent)
        elif decision.source == DecisionSource.BRAIN:
            return await self._brain_social_response(input_message, context, intent, decision)
        else:
            return await self._human_social_response(input_message, context, intent, decision)

    def switch_mode(self, new_mode: BotMode):
        """Switch between combat and social mode"""
        old_mode = self.current_mode
        self.current_mode = new_mode

        # Store mode switch in memory
        self.memory.store_episodic(
            content=f"Switched from {old_mode.value} to {new_mode.value}",
            importance=5.0,
            emotional_valence=0.0
        )

        # Adjust personality expression based on mode
        if new_mode == BotMode.COMBAT:
            # In combat, emphasize useful traits
            pass
        else:
            # In social mode, normal personality expression
            pass
```

### Escalation Engine Usage

```python
class BotEscalationConfig:
    """Escalation configuration for combat/social bots"""

    # Combat escalation thresholds
    combat_bot_threshold = 0.6      # Lower for faster combat
    combat_brain_threshold = 0.4
    combat_high_stakes = 0.7        # HP < 30%
    combat_critical_stakes = 0.9    # HP < 10% or TPk possible

    # Social escalation thresholds
    social_bot_threshold = 0.7      # Higher for nuanced social
    social_brain_threshold = 0.5
    social_high_stakes = 0.7        # Important relationship
    social_critical_stakes = 0.95    # Life-changing decision

    @classmethod
    def get_thresholds_for_mode(cls, mode: BotMode) -> EscalationThresholds:
        """Get escalation thresholds for a mode"""

        if mode == BotMode.COMBAT:
            return EscalationThresholds(
                bot_min_confidence=cls.combat_bot_threshold,
                brain_min_confidence=cls.combat_brain_threshold,
                high_stakes_threshold=cls.combat_high_stakes,
                critical_stakes_threshold=cls.combat_critical_stakes,
                hp_critical_threshold=0.3,
                novelty_threshold=0.6
            )
        else:
            return EscalationThresholds(
                bot_min_confidence=cls.social_bot_threshold,
                brain_min_confidence=cls.social_brain_threshold,
                high_stakes_threshold=cls.social_high_stakes,
                critical_stakes_threshold=cls.social_critical_stakes,
                hp_critical_threshold=0.3,
                novelty_threshold=0.6
            )
```

### Memory-Based Decisions

```python
class MemoryAwareDecision:
    """Decisions informed by past experiences"""

    def __init__(self, bot: CombatSocialBot):
        self.bot = bot

    async def make_informed_combat_decision(
        self,
        context: CombatContext
    ) -> CombatAction:
        """Make combat decision using memory"""

        # Retrieve relevant combat memories
        enemy_type = context.primary_enemy.type
        memories = await self.bot.memory.retrieve(
            query=f"combat against {enemy_type}",
            top_k=5
        )

        # Extract lessons from past fights
        effective_actions = self._extract_effective_actions(memories)
        failed_actions = self._extract_failed_actions(memories)

        # Bias decision based on experience
        if effective_actions:
            # Prefer what worked before
            return self._select_from_effective(effective_actions, context)
        else:
            # No experience - use standard decision
            return await self.bot.make_combat_decision(context)

    async def make_informed_social_response(
        self,
        target_id: str,
        input_message: str,
        context: SocialContext
    ) -> DialogueResponse:
        """Make social response using memory"""

        # Get relationship
        relationship = self.bot.get_relationship(target_id)

        # Retrieve past interactions with this character
        memories = await self.bot.memory.retrieve(
            query=f"interaction with {target_id}",
            top_k=5
        )

        # Extract patterns
        conversation_style = self._extract_conversation_style(memories)
        topics_discussed = self._extract_topics(memories)

        # Adjust response based on relationship and history
        base_response = await self.bot.make_social_response(input_message, context)

        # Modify based on relationship
        if relationship:
            if relationship.affection > 0.7:
                # Warm, friendly
                base_response.tone = Tone.WARM
            elif relationship.affection < 0.3:
                # Cold, distant
                base_response.tone = Tone.COLD

        return base_response

    def _extract_effective_actions(
        self,
        memories: List[Memory]
    ) -> List[CombatAction]:
        """Extract actions that worked in past fights"""

        effective = []

        for memory in memories:
            if memory.metadata.get("combat_success"):
                action = memory.metadata.get("action_taken")
                if action:
                    effective.append(CombatAction.from_dict(action))

        return effective

    def _extract_failed_actions(
        self,
        memories: List[Memory]
    ) -> List[CombatAction]:
        """Extract actions that failed in past fights"""

        failed = []

        for memory in memories:
            if memory.metadata.get("combat_failure"):
                action = memory.metadata.get("action_taken")
                if action:
                    failed.append(CombatAction.from_dict(action))

        return failed
```

---

## API Specification

### Combat Decision Methods

```typescript
interface CombatAction {
  type: ActionType;
  target: Target;
  position?: Position;
  resources?: ResourceCost;
  priority: ActionPriority;
  reasoning?: string;
}

enum ActionType {
  ATTACK = "attack",
  DEFEND = "defend",
  HEAL = "heal",
  BUFF = "buff",
  DEBUFF = "debuff",
  MOVE = "move",
  WAIT = "wait",
  FLEE = "flee"
}

interface CombatContext {
  // Bot state
  botId: string;
  hpRatio: number;
  position: Position;
  availableResources: ResourcePool;

  // Party state
  party: PartyState;
  allyHpRatios: Record<string, number>;

  // Enemy state
  enemies: Enemy[];
  enemyCount: number;
  primaryEnemy: Enemy;

  // Environment
  terrain: Terrain;
  lighting: Lighting;
  cover: Cover[];

  // Metadata
  roundNumber: number;
  stakes: number;
}

class CombatBotAPI {
  /**
   * Get recommended combat action
   */
  async getCombatAction(context: CombatContext): Promise<CombatAction>;

  /**
   * Get multiple action options with scores
   */
  async getCombatOptions(
    context: CombatContext,
    count: number
  ): Promise<ActionScore[]>;

  /**
   * Get optimal position
   */
  async getOptimalPosition(
    context: CombatContext,
    mobility: number
  ): Promise<Position>;

  /**
   * Plan party round actions
   */
  async planPartyRound(
    context: CombatContext
  ): Promise<Record<string, CombatAction>>;

  /**
   * Assess combat threat
   */
  async assessThreat(
    enemy: Enemy,
    context: CombatContext
  ): Promise<ThreatAssessment>;

  /**
   * Record combat outcome for learning
   */
  async recordCombatOutcome(
    action: CombatAction,
    outcome: CombatOutcome
  ): Promise<void>;
}
```

### Social Interaction Methods

```typescript
interface DialogueResponse {
  text: string;
  tone: Tone;
  topics: string[];
  confidence: number;
  suggestedActions?: SocialAction[];
}

enum SocialIntent {
  GREETING = "greeting",
  FAREWELL = "farewell",
  REQUEST = "request",
  OFFER = "offer",
  INQUIRY = "inquiry",
  COMPLIMENT = "compliment",
  INSULT = "insult",
  PERSUADE = "persuade",
  INTIMIDATE = "intimidate",
  DECEIVE = "deceive"
}

interface SocialContext {
  // Participants
  speakerId: string;
  listenerId: string;
  listenerPersonality: Personality;

  // Relationship
  relationship?: Relationship;

  // Environment
  location: string;
  privacy: PrivacyLevel;
  witnesses?: string[];

  // Situation
  stakes: number;
  mood: Mood;
  ongoingTopics: string[];
}

class SocialBotAPI {
  /**
   * Generate dialogue response
   */
  async generateResponse(
    inputMessage: string,
    context: SocialContext
  ): Promise<DialogueResponse>;

  /**
   * Attempt persuasion
   */
  async attemptPersuasion(
    request: string,
    targetId: string,
    context: SocialContext
  ): Promise<SocialInfluenceResult>;

  /**
   * Attempt intimidation
   */
  async attemptIntimidation(
    demand: string,
    targetId: string,
    context: SocialContext
  ): Promise<SocialInfluenceResult>;

  /**
   * Get relationship status
   */
  getRelationship(targetId: string): Relationship | null;

  /**
   * Update relationship from interaction
   */
  updateRelationship(
    targetId: string,
    interactionType: SocialInteractionType,
    outcome: SocialOutcome
  ): void;

  /**
   * Detect party conflicts
   */
  async detectConflicts(party: string[]): Promise<Conflict[]>;

  /**
   * Get party cohesion score
   */
  getPartyCohesion(party: string[]): number;
}
```

### Bot State Management

```typescript
interface BotState {
  // Identity
  id: string;
  name: string;
  personality: Personality;

  // Mode
  currentMode: BotMode;
  currentMood: Mood;

  // Combat state
  combatRole?: CombatRole;
  combatStats?: CombatStats;
  combatResources?: CombatResources;

  // Social state
  socialRole?: SocialRole;
  socialStats?: SocialStats;
  relationships?: Record<string, Relationship>;

  // Memory stats
  memoryStats: MemoryStats;

  // Learning
  decisionsMade: number;
  successRate: number;
  adaptationLevel: number;
}

class BotStateAPI {
  /**
   * Get current bot state
   */
  getState(): BotState;

  /**
   * Switch between combat and social mode
   */
  switchMode(newMode: BotMode): void;

  /**
   * Update bot mood
   */
  updateMood(newMood: Mood): void;

  /**
   * Reset combat resources
   */
  resetCombatResources(): void;

  /**
   * Get memory statistics
   */
  getMemoryStats(): MemoryStats;

  /**
   * Import/export bot state
   */
  exportState(): string;
  importState(data: string): void;

  /**
   * Clone bot personality
   */
  clonePersonality(): Personality;
}
```

---

## Code Examples

### Combat Bot Implementation

```python
from typing import List, Dict, Optional
from dataclasses import dataclass
from enum import Enum

class CombatRole(Enum):
    TANK = "tank"           # Front line, damage absorption
    STRIKER = "striker"     # High damage, mobility
    CONTROLLER = "controller"  # AoE, debuffs, battlefield control
    SUPPORT = "support"     # Healing, buffs

@dataclass
class CombatCharacter:
    id: str
    name: str
    role: CombatRole
    personality: Personality
    max_hp: int
    current_hp: int
    armor_class: int
    speed: int

    # Resources
    spell_slots: Dict[int, int]
    used_slots: Dict[int, int]
    potions: int

    # Capabilities
    melee_attack_bonus: int
    ranged_attack_bonus: int
    spell_save_dc: int

    def __post_init__(self):
        from combat_bots import CombatResourceManager
        self.resource_manager = CombatResourceManager(self)
        self.combat_matrix = self._create_combat_matrix()

    def _create_combat_matrix(self) -> CombatDecisionMatrix:
        """Create personality-weighted decision matrix"""
        matrix = CombatDecisionMatrix()

        # Personality affects weights
        matrix.self_preservation = 0.5 + (self.personality.neuroticism * 0.4)
        matrix.ally_preservation = 0.3 + (self.personality.agreeableness * 0.4)
        matrix.aggression = 0.5 - (self.personality.agreeableness * 0.3)
        matrix.positioning = 0.3 + (self.personality.openness * 0.4)
        matrix.party_synergy = 0.3 + (self.personality.extraversion * 0.4)

        return matrix

    async def decide_combat_action(
        self,
        context: 'CombatContext'
    ) -> 'CombatAction':
        """Main decision method for combat"""

        # Check for critical situations first
        if self.current_hp / self.max_hp < 0.2:
            return self._emergency_action(context)

        # Evaluate possible actions
        possible_actions = self._get_possible_actions(context)
        scored_actions = []

        for action in possible_actions:
            score = self.combat_matrix.calculate_action_score(action, context)
            scored_actions.append((action, score))

        # Sort by score and return best
        scored_actions.sort(key=lambda x: x[1], reverse=True)
        return scored_actions[0][0] if scored_actions else self._wait_action()

    def _get_possible_actions(
        self,
        context: 'CombatContext'
    ) -> List['CombatAction']:
        """Get all possible actions in current situation"""
        actions = []

        # Attack actions
        for enemy in context.enemies_in_range:
            actions.append(CombatAction(
                type=ActionType.ATTACK,
                target=enemy,
                is_melee=enemy.in_melee_range(self)
            ))

        # Spell actions (if slots available)
        for level, available in self.resource_manager.spell_slots.items():
            used = self.resource_manager.used_slots.get(level, 0)
            if available > used:
                actions.extend(self._get_spell_actions(level, context))

        # Movement
        if context.can_move:
            actions.append(CombatAction(
                type=ActionType.MOVE,
                target=self._find_optimal_position(context)
            ))

        # Defense
        actions.append(CombatAction(
            type=ActionType.DEFEND,
            target=self
        ))

        return actions

    def _emergency_action(self, context: 'CombatContext') -> 'CombatAction':
        """Get action for emergency (low HP) situations"""

        # Use potion if available
        if self.resource_manager.potions > 0:
            return CombatAction(
                type=ActionType.HEAL,
                target=self,
                resource_cost=ResourceCost(potions=1)
            )

        # Cast best healing spell
        for level in sorted(self.resource_manager.spell_slots.keys(), reverse=True):
            available = self.resource_manager.spell_slots[level]
            used = self.resource_manager.used_slots.get(level, 0)
            if available > used:
                return CombatAction(
                    type=ActionType.HEAL,
                    target=self,
                    spell_level=level,
                    resource_cost=ResourceCost(spell_slots={level: 1})
                )

        # Retreat if no healing available
        return CombatAction(
            type=ActionType.MOVE,
            target=self._find_retreat_position(context)
        )


# Usage example
async def combat_example():
    """Example of combat bot in action"""

    # Create party
    fighter = CombatCharacter(
        id="fighter_1",
        name="Theron",
        role=CombatRole.TANK,
        personality=Personality(
            openness=0.4,
            conscientiousness=0.8,
            extraversion=0.7,
            agreeableness=0.6,
            neuroticism=0.3
        ),
        max_hp=45,
        current_hp=45,
        armor_class=18,
        speed=30,
        spell_slots={},
        used_slots={},
        potions=2,
        melee_attack_bonus=7,
        ranged_attack_bonus=3,
        spell_save_dc=0
    )

    wizard = CombatCharacter(
        id="wizard_1",
        name="Lyra",
        role=CombatRole.CONTROLLER,
        personality=Personality(
            openness=0.9,
            conscientiousness=0.8,
            extraversion=0.3,
            agreeableness=0.5,
            neuroticism=0.4
        ),
        max_hp=24,
        current_hp=24,
        armor_class=13,
        speed=30,
        spell_slots={1: 4, 2: 3, 3: 2},
        used_slots={},
        potions=1,
        melee_attack_bonus=0,
        ranged_attack_bonus=0,
        spell_save_dc=15
    )

    cleric = CombatCharacter(
        id="cleric_1",
        name="Seraphina",
        role=CombatRole.SUPPORT,
        personality=Personality(
            openness=0.6,
            conscientiousness=0.9,
            extraversion=0.5,
            agreeableness=0.8,
            neuroticism=0.3
        ),
        max_hp=32,
        current_hp=32,
        armor_class=16,
        speed=30,
        spell_slots={1: 4, 2: 3},
        used_slots={},
        potions=3,
        melee_attack_bonus=3,
        ranged_attack_bonus=0,
        spell_save_dc=14
    )

    # Create coordinator
    coordinator = CombatPartyCoordinator()
    coordinator.add_member(fighter)
    coordinator.add_member(wizard)
    coordinator.add_member(cleric)

    # Simulate combat round
    combat_context = CombatContext(
        enemies=[
            Enemy(id="goblin_1", type="goblin", hp=7, max_hp=7),
            Enemy(id="goblin_2", type="goblin", hp=7, max_hp=7),
            Enemy(id="goblin_3", type="goblin", hp=7, max_hp=7),
            Enemy(id="hobgoblin_1", type="hobgoblin", hp=18, max_hp=18)
        ],
        round_number=1,
        stakes=0.6
    )

    # Get party actions
    party_actions = coordinator.plan_round_actions(combat_context)

    # Execute actions
    for character_id, action in party_actions.items():
        print(f"{character_id}: {action.type} -> {action.target}")
```

### Social Bot Scenarios

```python
from typing import Optional
from dataclasses import dataclass
from enum import Enum

class SocialIntent(Enum):
    GREETING = "greeting"
    FAREWELL = "farewell"
    REQUEST = "request"
    OFFER = "offer"
    INQUIRY = "inquiry"
    PERSUADE = "persuade"
    INTIMIDATE = "intimidate"
    COMPLIMENT = "compliment"
    INSULT = "insult"

@dataclass
class SocialCharacter:
    id: str
    name: str
    personality: Personality
    charisma: int

    # Social stats
    reputation_influence: float = 0.5
    reputation_intimidation: float = 0.5

    def __post_init__(self):
        from social_bots import SocialDialogueGenerator
        self.dialogue = SocialDialogueGenerator(self.personality)
        self.relationships: Dict[str, Relationship] = {}
        self.current_mood = Mood.NEUTRAL

    async def respond_to(
        self,
        input_message: str,
        speaker: 'SocialCharacter',
        context: 'SocialContext'
    ) -> 'DialogueResponse':
        """Generate response to another character"""

        # Get or create relationship
        relationship = self.get_relationship(speaker.id)
        if not relationship:
            relationship = Relationship(
                character_a_id=self.id,
                character_b_id=speaker.id,
                trust_level=0.5,
                affection=0.5
            )
            self.relationships[speaker.id] = relationship

        # Classify intent
        intent = self._classify_intent(input_message)

        # Generate response
        response = await self.dialogue.generate_response(
            input_message=input_message,
            context=SocialContext(
                speaker_id=speaker.id,
                listener_id=self.id,
                relationship=relationship,
                location=context.location,
                stakes=context.stakes
            ),
            intent=intent
        )

        # Update relationship based on interaction tone
        self._update_relationship_from_interaction(
            relationship, intent, response
        )

        return response

    async def attempt_persuasion(
        self,
        target: 'SocialCharacter',
        request: str,
        arguments: List[str],
        context: 'SocialContext'
    ) -> 'SocialInfluenceResult':
        """Attempt to persuade another character"""

        from social_bots import SocialInfluenceSystem
        influence = SocialInfluenceSystem(self)

        # Build context
        persuasion_context = SocialContext(
            speaker_id=self.id,
            listener_id=target.id,
            relationship=self.get_relationship(target.id),
            location=context.location,
            stakes=context.stakes,
            arguments_provided=len(arguments)
        )

        # Attempt persuasion
        result = influence.attempt_persuasion(
            target=target,
            request=request,
            context=persuasion_context
        )

        # Record in memory
        if result.success:
            self._store_memory(
                f"Successfully persuaded {target.name} to {request}",
                importance=7.0,
                emotional_valence=0.7
            )
        else:
            self._store_memory(
                f"Failed to persuade {target.name} to {request}",
                importance=5.0,
                emotional_valence=-0.3
            )

        return result

    def get_relationship(self, target_id: str) -> Optional[Relationship]:
        """Get relationship with another character"""
        return self.relationships.get(target_id)

    def _classify_intent(self, message: str) -> SocialIntent:
        """Classify the intent of a message"""

        message_lower = message.lower()

        # Greeting patterns
        if any(word in message_lower for word in ["hello", "hi", "greetings", "hey"]):
            return SocialIntent.GREETING

        # Farewell patterns
        if any(word in message_lower for word in ["goodbye", "farewell", "bye", "leave"]):
            return SocialIntent.FAREWELL

        # Request patterns
        if any(word in message_lower for word in ["please", "could you", "would you", "help"]):
            return SocialIntent.REQUEST

        # Inquiry patterns
        if any(word in message_lower for word in ["what", "how", "why", "when", "where", "who"]):
            return SocialIntent.INQUIRY

        # Compliment patterns
        if any(word in message_lower for word in ["good", "great", "beautiful", "impressed"]):
            return SocialIntent.COMPLIMENT

        # Insult patterns
        if any(word in message_lower for word in ["stupid", "fool", "weak", "pathetic"]):
            return SocialIntent.INSULT

        # Default to inquiry
        return SocialIntent.INQUIRY


# Usage examples
async def social_examples():
    """Examples of social bot interactions"""

    # Create characters
    merchant = SocialCharacter(
        id="merchant_1",
        name="Grimwald",
        personality=Personality(
            openness=0.4,
            conscientiousness=0.7,
            extraversion=0.5,
            agreeableness=0.3,  # Hard negotiator
            neuroticism=0.4
        ),
        charisma=12,
        reputation_intimidation=0.3,
        reputation_influence=0.6
    )

    player = SocialCharacter(
        id="player_1",
        name="Aria",
        personality=Personality(
            openness=0.7,
            conscientiousness=0.5,
            extraversion=0.8,
            agreeableness=0.6,
            neuroticism=0.3
        ),
        charisma=14,
        reputation_intimidation=0.2,
        reputation_influence=0.4
    )

    # Example 1: Greeting and trade request
    print("=== Example 1: Trading Interaction ===")

    context = SocialContext(
        location="market",
        stakes=0.3,
        privacy=PrivacyLevel.PUBLIC
    )

    # Player approaches merchant
    greeting = await merchant.respond_to(
        "Hello Grimwald, what wares do you have today?",
        player,
        context
    )
    print(f"Merchant: {greeting.text}")

    # Player makes request
    persuasion_result = await player.attempt_persuasion(
        target=merchant,
        request="lower the price on that healing potion",
        arguments=["I'm a regular customer", "I helped defend the town"],
        context=context
    )

    if persuasion_result.success:
        print(f"Persuasion succeeded! (Roll: {persuasion_result.roll:.2f} vs DC: {persuasion_result.dc:.2f})")
    else:
        print(f"Persuasion failed. (Roll: {persuasion_result.roll:.2f} vs DC: {persuasion_result.dc:.2f})")

    # Example 2: Conflict resolution
    print("\n=== Example 2: Party Conflict ===")

    from social_bots import PartyDynamicsManager, Conflict

    # Create party members with conflicting personalities
    leader = SocialCharacter(
        id="leader_1",
        name="Valerius",
        personality=Personality(
            openness=0.3,
            conscientiousness=0.9,
            extraversion=0.6,
            agreeableness=0.4,
            neuroticism=0.5
        ),
        charisma=14
    )

    free_spirit = SocialCharacter(
        id="rogue_1",
        name="Zara",
        personality=Personality(
            openness=0.9,
            conscientiousness=0.2,
            extraversion=0.8,
            agreeableness=0.6,
            neuroticism=0.4
        ),
        charisma=16
    )

    # Set up tense relationship
    leader.relationships[free_spirit.id] = Relationship(
        character_a_id=leader.id,
        character_b_id=free_spirit.id,
        trust_level=0.3,
        affection=0.3,
        respect=0.4,
        familiarity=0.7
    )

    free_spirit.relationships[leader.id] = Relationship(
        character_a_id=free_spirit.id,
        character_b_id=leader.id,
        trust_level=0.4,
        affection=0.4,
        respect=0.2,
        familiarity=0.7
    )

    # Create party and check dynamics
    party_manager = PartyDynamicsManager()
    party_manager.members = [leader, free_spirit, player]

    cohesion = party_manager.calculate_party_cohesion()
    print(f"Party cohesion: {cohesion:.2f}")

    conflicts = party_manager.detect_potential_conflicts()
    for conflict in conflicts:
        print(f"Conflict detected: {conflict.description}")
```

### Coordination Patterns

```python
from typing import List, Callable, Awaitable
from dataclasses import dataclass
from enum import Enum

class CoordinationPattern(Enum):
    SEQUENTIAL = "sequential"       # Actions in order
    SIMULTANEOUS = "simultaneous"   # Actions at same time
    CONDITIONAL = "conditional"     # Actions based on conditions
    REACTIVE = "reactive"           # Respond to enemy actions

@dataclass
class CoordinatedAction:
    """An action that may depend on other actions"""
    bot_id: str
    action: CombatAction
    depends_on: List[str] = None    # IDs of bots whose actions this depends on
    condition: Callable[[], bool] = None  # Condition that must be true
    priority: int = 0

class BotCoordinator:
    """Coordinate actions across multiple combat/social bots"""

    def __init__(self):
        self.bots: Dict[str, CombatSocialBot] = {}
        self.coordinator_agent: Optional[AgentCoordinator] = None

    def register_bot(self, bot: CombatSocialBot):
        """Register a bot for coordination"""
        self.bots[bot.bot_id] = bot

    async def coordinate_combat_round(
        self,
        context: CombatContext,
        pattern: CoordinationPattern = CoordinationPattern.SEQUENTIAL
    ) -> Dict[str, CombatAction]:
        """Coordinate a combat round using specified pattern"""

        if pattern == CoordinationPattern.SEQUENTIAL:
            return await self._coordinate_sequential(context)
        elif pattern == CoordinationPattern.SIMULTANEOUS:
            return await self._coordinate_simultaneous(context)
        elif pattern == CoordinationPattern.CONDITIONAL:
            return await self._coordinate_conditional(context)
        elif pattern == CoordinationPattern.REACTIVE:
            return await self._coordinate_reactive(context)

    async def _coordinate_sequential(
        self,
        context: CombatContext
    ) -> Dict[str, CombatAction]:
        """Coordinate actions sequentially - each bot acts after the previous"""

        actions = {}
        updated_context = context

        # Order by initiative (simplified: by role priority)
        ordered_bots = self._get_initiative_order(context)

        for bot_id in ordered_bots:
            bot = self.bots[bot_id]
            action = await bot.make_combat_decision(updated_context)
            actions[bot_id] = action

            # Update context for next bot
            updated_context = self._simulate_action(action, updated_context)

        return actions

    async def _coordinate_simultaneous(
        self,
        context: CombatContext
    ) -> Dict[str, CombatAction]:
        """Coordinate actions simultaneously - all bots decide at once"""

        actions = {}

        # All bots decide based on same context
        tasks = []
        for bot_id, bot in self.bots.items():
            tasks.append(bot.make_combat_decision(context))

        results = await asyncio.gather(*tasks)

        for bot_id, action in zip(self.bots.keys(), results):
            actions[bot_id] = action

        return actions

    async def _coordinate_conditional(
        self,
        context: CombatContext
    ) -> Dict[str, CombatAction]:
        """Coordinate actions with dependencies"""

        actions = {}
        completed = set()

        # Sort by dependency depth
        coordinated_actions = self._build_dependency_graph(context)

        for coordinated_action in coordinated_actions:
            # Check if dependencies are met
            if coordinated_action.depends_on:
                if not all(dep in completed for dep in coordinated_action.depends_on):
                    continue  # Skip for now, will retry

            # Check condition
            if coordinated_action.condition and not coordinated_action.condition():
                continue  # Condition not met

            # Execute action
            bot = self.bots[coordinated_action.bot_id]
            action = await bot.make_combat_decision(context)
            actions[coordinated_action.bot_id] = action
            completed.add(coordinated_action.bot_id)

        return actions

    async def _coordinate_reactive(
        self,
        context: CombatContext
    ) -> Dict[str, CombatAction]:
        """Coordinate actions reactively - respond to enemy actions"""

        actions = {}

        # First, get initial planned actions
        planned_actions = await self._coordinate_simultaneous(context)

        # Then, adjust based on what enemies might do
        for bot_id, action in planned_actions.items():
            bot = self.bots[bot_id]

            # Check if this action counters expected enemy response
            if self._is_counters_expected(action, context):
                actions[bot_id] = action
            else:
                # Re-decide with enemy response in mind
                reactive_context = self._predict_enemy_response(context, action)
                actions[bot_id] = await bot.make_combat_decision(reactive_context)

        return actions

    def _get_initiative_order(
        self,
        context: CombatContext
    ) -> List[str]:
        """Get initiative order for sequential actions"""

        bot_scores = []

        for bot_id, bot in self.bots.items():
            # Base score: dexterity
            score = bot.stats.dexterity

            # Role modifier
            if bot.combat_role == CombatRole.TANK:
                score += 5  # Tanks go first to engage
            elif bot.combat_role == CombatRole.CONTROLLER:
                score += 2  # Controllers want to act early
            elif bot.combat_role == CombatRole.SUPPORT:
                score -= 2  # Supports often react
            elif bot.combat_role == CombatRole.STRIKER:
                score += 0  # Strikers in middle

            # Personality modifier
            if bot.personality.extraversion > 0.7:
                score += 2  # Bold characters act sooner

            bot_scores.append((bot_id, score))

        # Sort by score (descending)
        bot_scores.sort(key=lambda x: x[1], reverse=True)

        return [bot_id for bot_id, _ in bot_scores]

    def _build_dependency_graph(
        self,
        context: CombatContext
    ) -> List[CoordinatedAction]:
        """Build dependency graph for conditional coordination"""

        coordinated = []

        for bot_id, bot in self.bots.items():
            # Tanks go first, no dependencies
            if bot.combat_role == CombatRole.TANK:
                coordinated.append(CoordinatedAction(
                    bot_id=bot_id,
                    action=CombatAction(type=ActionType.ATTACK),  # Placeholder
                    priority=0
                ))

            # Support depends on someone needing help
            elif bot.combat_role == CombatRole.SUPPORT:
                coordinated.append(CoordinatedAction(
                    bot_id=bot_id,
                    action=CombatAction(type=ActionType.HEAL),  # Placeholder
                    depends_on=[self._find_tank_id()],
                    condition=lambda: self._someone_needs_healing(context),
                    priority=1
                ))

            # Strikers want to flank (depend on tank positioning)
            elif bot.combat_role == CombatRole.STRIKER:
                coordinated.append(CoordinatedAction(
                    bot_id=bot_id,
                    action=CombatAction(type=ActionType.ATTACK),  # Placeholder
                    depends_on=[self._find_tank_id()],
                    priority=2
                ))

        # Sort by priority
        coordinated.sort(key=lambda x: x.priority)
        return coordinated


# Usage example
async def coordination_example():
    """Example of coordinated party combat"""

    # Create coordinator
    coordinator = BotCoordinator()

    # Create party
    party = create_test_party()  # fighter, wizard, cleric, rogue

    # Register with coordinator
    for member in party:
        coordinator.register_bot(member)

    # Create combat context
    context = create_combat_context()

    # Coordinate using different patterns
    print("=== Sequential Coordination ===")
    sequential_actions = await coordinator.coordinate_combat_round(
        context, CoordinationPattern.SEQUENTIAL
    )
    for bot_id, action in sequential_actions.items():
        print(f"{bot_id}: {action.type} -> {action.target}")

    print("\n=== Simultaneous Coordination ===")
    simultaneous_actions = await coordinator.coordinate_combat_round(
        context, CoordinationPattern.SIMULTANEOUS
    )
    for bot_id, action in simultaneous_actions.items():
        print(f"{bot_id}: {action.type} -> {action.target}")

    print("\n=== Conditional Coordination ===")
    conditional_actions = await coordinator.coordinate_combat_round(
        context, CoordinationPattern.CONDITIONAL
    )
    for bot_id, action in conditional_actions.items():
        print(f"{bot_id}: {action.type} -> {action.target}")
```

---

## DMLog Integration

### Connection to combat_bots.py

```python
# DMLog combat_bots.py integration pattern
# Based on: https://github.com/SuperInstance/DMLog/backend/combat_bots.py

class DMLogCombatBotAdapter:
    """Adapter to connect with DMLog's combat_bots.py system"""

    def __init__(self, dmlog_character):
        self.character = dmlog_character
        self.bot = self._create_bot_from_character()

    def _create_bot_from_character(self) -> CombatSocialBot:
        """Create a CombatSocialBot from DMLog character"""

        # Extract personality from DMLog character
        personality = Personality(
            openness=self.character.personality.get("openness", 0.5),
            conscientiousness=self.character.personality.get("conscientiousness", 0.5),
            extraversion=self.character.personality.get("extraversion", 0.5),
            agreeableness=self.character.personality.get("agreeableness", 0.5),
            neuroticism=self.character.personality.get("neuroticism", 0.5)
        )

        # Determine combat role from D&D class
        combat_role = self._map_class_to_role(self.character.character_class)

        # Create bot
        bot = CombatSocialBot(
            bot_id=self.character.character_id,
            name=self.character.name,
            personality=personality,
            combat_role=combat_role
        )

        # Import combat stats
        bot.combat_resources = CombatResourceManager(
            max_hp=self.character.stats.hp.max,
            current_hp=self.character.stats.hp.current,
            spell_slots=self.character.spell_slots,
            potions=self.character.inventory.get("potions", 0)
        )

        return bot

    def _map_class_to_role(self, dnd_class: str) -> CombatRole:
        """Map D&D class to combat role"""

        role_map = {
            "Fighter": CombatRole.TANK,
            "Paladin": CombatRole.TANK,
            "Barbarian": CombatRole.TANK,
            "Rogue": CombatRole.STRIKER,
            "Ranger": CombatRole.STRIKER,
            "Monk": CombatRole.STRIKER,
            "Wizard": CombatRole.CONTROLLER,
            "Sorcerer": CombatRole.CONTROLLER,
            "Warlock": CombatRole.CONTROLLER,
            "Cleric": CombatRole.SUPPORT,
            "Druid": CombatRole.SUPPORT,
            "Bard": CombatRole.SUPPORT,
        }

        return role_map.get(dnd_class, CombatRole.STRIKER)

    async def get_combat_action(
        self,
        game_state: 'GameState'
    ) -> 'CombatAction':
        """Get combat action using DMLog game state"""

        # Convert DMLog state to our context
        context = self._convert_game_state(game_state)

        # Get action from bot
        action = await self.bot.make_combat_decision(context)

        # Convert back to DMLog format
        return self._convert_action_to_dmlog(action)

    def _convert_game_state(
        self,
        game_state: 'GameState'
    ) -> CombatContext:
        """Convert DMLog GameState to CombatContext"""

        return CombatContext(
            bot_id=self.character.character_id,
            hp_ratio=self.character.stats.hp.current / self.character.stats.hp.max,
            position=Position(
                x=game_state.combat.position[self.character.character_id].x,
                y=game_state.combat.position[self.character.character_id].y,
                z=0
            ),
            enemies=[
                Enemy(
                    id=e_id,
                    type=enemy.type,
                    hp=enemy.stats.hp.current,
                    max_hp=enemy.stats.hp.max
                )
                for e_id, enemy in game_state.combat.enemies.items()
            ],
            party={
                m_id: self._get_member_context(m_id, game_state)
                for m_id in game_state.party.member_ids
            }
        )
```

### Social_bots.py Integration

```python
# DMLog social_bots.py integration pattern
# Based on: https://github.com/SuperInstance/DMLog/backend/social_bots.py

class DMLogSocialBotAdapter:
    """Adapter to connect with DMLog's social_bots.py system"""

    def __init__(self, dmlog_character):
        self.character = dmlog_character
        self.bot = self._create_bot_from_character()

    def _create_bot_from_character(self) -> CombatSocialBot:
        """Create a CombatSocialBot from DMLog character"""

        personality = Personality(
            openness=self.character.personality.openness,
            conscientiousness=self.character.personality.conscientiousness,
            extraversion=self.character.personality.extraversion,
            agreeableness=self.character.personality.agreeableness,
            neuroticism=self.character.personality.neuroticism
        )

        bot = CombatSocialBot(
            bot_id=self.character.character_id,
            name=self.character.name,
            personality=personality
        )

        # Import NPC relationships
        for npc_id, npc_memory in self.character.npc_memories.items():
            relationship = Relationship(
                character_a_id=self.character.character_id,
                character_b_id=npc_id,
                trust_level=npc_memory.trust_level / 100.0,
                affection=npc_memory.affection / 100.0 if hasattr(npc_memory, 'affection') else 0.5,
                respect=npc_memory.respect / 100.0 if hasattr(npc_memory, 'respect') else 0.5,
                familiarity=npc_memory.familiarity / 100.0 if hasattr(npc_memory, 'familiarity') else 0.0
            )
            bot.relationships[npc_id] = relationship

        return bot

    async def handle_dialogue(
        self,
        input_text: str,
        speaker_id: str,
        game_state: 'GameState'
    ) -> 'DialogueResponse':
        """Handle dialogue input using DMLog game state"""

        # Get speaker
        speaker = game_state.get_character(speaker_id)

        # Build social context
        context = SocialContext(
            speaker_id=speaker_id,
            listener_id=self.character.character_id,
            relationship=self.bot.get_relationship(speaker_id),
            location=game_state.current_location.name,
            stakes=self._calculate_social_stakes(game_state),
            privacy=self._determine_privacy(game_state)
        )

        # Generate response
        response = await self.bot.make_social_response(
            input_text, context
        )

        # Store interaction in DMLog memory
        self.character.memory.store_episodic(
            content=f"Dialogue with {speaker.name}: '{input_text}' -> '{response.text}'",
            importance=5.0,
            participants=[speaker_id],
            location=game_state.current_location.name
        )

        return response

    def _calculate_social_stakes(self, game_state: 'GameState') -> float:
        """Calculate stakes of social interaction"""

        stakes = 0.3  # Base stakes

        # Important NPCs increase stakes
        speaker_id = game_state.dialogue.speaker_id
        if speaker_id in game_state.npcs:
            npc = game_state.npcs[speaker_id]
            if npc.importance == "major":
                stakes += 0.3
            elif npc.importance == "critical":
                stakes += 0.5

        # Quest-related dialogue increases stakes
        if game_state.dialogue.is_quest_related:
            stakes += 0.2

        return min(1.0, stakes)
```

### Mechanical_bot Coordination

```python
# DMLog mechanical_bot.py coordination pattern
# Based on: https://github.com/SuperInstance/DMLog/backend/mechanical_bot.py

class MechanicalBotCoordinator:
    """Coordinate mechanical_bot.py with combat/social bots"""

    def __init__(self, dmlog_session):
        self.session = dmlog_session
        self.combat_adapter: Dict[str, DMLogCombatBotAdapter] = {}
        self.social_adapter: Dict[str, DMLogSocialBotAdapter] = {}
        self.mechanical_bot = MechanicalBot()

    def register_character(self, character):
        """Register a character for bot control"""

        # Create combat adapter
        combat_adapter = DMLogCombatBotAdapter(character)
        self.combat_adapter[character.character_id] = combat_adapter

        # Create social adapter
        social_adapter = DMLogSocialBotAdapter(character)
        self.social_adapter[character.character_id] = social_adapter

        # Register with mechanical bot
        self.mechanical_bot.register_character(
            character.character_id,
            {
                "combat": combat_adapter,
                "social": social_adapter
            }
        )

    async def process_turn(
        self,
        character_id: str,
        game_state: 'GameState'
    ) -> 'TurnAction':
        """Process a turn using the appropriate bot system"""

        # Determine mode
        if game_state.in_combat:
            # Use combat bot
            adapter = self.combat_adapter[character_id]
            action = await adapter.get_combat_action(game_state)

            return TurnAction(
                type="combat",
                character_id=character_id,
                action_data=action.to_dict()
            )

        elif game_state.in_dialogue:
            # Use social bot
            adapter = self.social_adapter[character_id]

            # Get last input
            input_text = game_state.dialogue.last_input

            response = await adapter.handle_dialogue(
                input_text,
                game_state.dialogue.speaker_id,
                game_state
            )

            return TurnAction(
                type="dialogue",
                character_id=character_id,
                action_data=response.to_dict()
            )

        else:
            # Use mechanical bot for exploration/investigation
            return await self.mechanical_bot.process_turn(
                character_id,
                game_state
            )
```

---

## StudyLoG.AI Adaptation

### Educational Group Projects

The Combat & Social Bots can be adapted for educational group project scenarios:

```python
class StudyLogGroupProjectBot(CombatSocialBot):
    """Bot adapted for educational group project collaboration"""

    def __init__(
        self,
        bot_id: str,
        name: str,
        personality: Personality,
        learning_role: LearningRole
    ):
        # Adapt combat role to learning role
        combat_role = self._map_learning_to_combat(learning_role)

        super().__init__(
            bot_id=bot_id,
            name=name,
            personality=personality,
            combat_role=combat_role
        )

        self.learning_role = learning_role
        self.subject_expertise: Dict[str, float] = {}

    def _map_learning_to_combat(
        self,
        learning_role: LearningRole
    ) -> CombatRole:
        """Map learning roles to combat roles for behavior patterns"""

        role_map = {
            LearningRole.LEADER: CombatRole.TANK,        # Takes charge
            LearningRole.RESEARCHER: CombatRole.CONTROLLER,  # Information
            LearningRole.BUILDER: CombatRole.STRIKER,    # Implementation
            LearningRole.TESTER: CombatRole.SUPPORT,     # Quality assurance
            LearningRole.PRESENTER: CombatRole.SUPPORT,  # Communication
        }

        return role_map.get(learning_role, CombatRole.STRIKER)

    async def decide_project_action(
        self,
        project_context: ProjectContext
    ) -> ProjectAction:
        """Decide on project action using combat decision patterns"""

        # Adapt combat context to project context
        combat_context = self._convert_to_combat_context(project_context)

        # Use combat decision system
        combat_action = await self.make_combat_decision(combat_context)

        # Convert back to project action
        return self._convert_to_project_action(combat_action, project_context)

    async def handle_discussion(
        self,
        input_message: str,
        discussion_context: DiscussionContext
    ) -> DiscussionResponse:
        """Handle group discussion using social bot patterns"""

        # Adapt social context
        social_context = SocialContext(
            speaker_id=discussion_context.speaker_id,
            listener_id=self.bot_id,
            relationship=self.get_relationship(discussion_context.speaker_id),
            location=discussion_context.location,
            stakes=discussion_context.stakes,
            privacy=PrivacyLevel.PRIVATE
        )

        # Use social response system
        dialogue_response = await self.make_social_response(
            input_message, social_context
        )

        # Add learning-specific elements
        return DiscussionResponse(
            text=dialogue_response.text,
            tone=dialogue_response.tone,
            suggested_actions=self._generate_learning_actions(
                input_message, discussion_context
            )
        )


class LearningRole(Enum):
    LEADER = "leader"           # Coordinates team
    RESEARCHER = "researcher"   # Investigates topics
    BUILDER = "builder"         # Implements solutions
    TESTER = "tester"           # Validates work
    PRESENTER = "presenter"     # Communicates results


# Example: Group project simulation
async def group_project_simulation():
    """Simulate a group project with learning bots"""

    # Create project team
    leader = StudyLogGroupProjectBot(
        bot_id="leader_1",
        name="Alex",
        personality=Personality(
            openness=0.6,
            conscientiousness=0.8,
            extraversion=0.7,
            agreeableness=0.6,
            neuroticism=0.3
        ),
        learning_role=LearningRole.LEADER
    )

    researcher = StudyLogGroupProjectBot(
        bot_id="researcher_1",
        name="Sam",
        personality=Personality(
            openness=0.9,
            conscientiousness=0.7,
            extraversion=0.4,
            agreeableness=0.7,
            neuroticism=0.4
        ),
        learning_role=LearningRole.RESEARCHER
    )

    builder = StudyLogGroupProjectBot(
        bot_id="builder_1",
        name="Jordan",
        personality=Personality(
            openness=0.5,
            conscientiousness=0.6,
            extraversion=0.5,
            agreeableness=0.5,
            neuroticism=0.5
        ),
        learning_role=LearningRole.BUILDER
    )

    # Set up project context
    project_context = ProjectContext(
        topic="Build a neural network from scratch",
        deadline_hours=48,
        current_progress=0.3,
        team_members=[leader, researcher, builder]
    )

    # Simulate team coordination
    print("=== Project Team Coordination ===")

    # Leader assigns tasks
    leader_action = await leader.decide_project_action(project_context)
    print(f"Leader ({leader.name}): {leader_action.description}")

    # Researcher investigates
    research_action = await researcher.decide_project_action(project_context)
    print(f"Researcher ({researcher.name}): {research_action.description}")

    # Builder implements
    build_action = await builder.decide_project_action(project_context)
    print(f"Builder ({builder.name}): {build_action.description}")
```

### Collaborative Learning Bots

```python
class CollaborativeLearningBot(CombatSocialBot):
    """Bot for collaborative learning scenarios"""

    def __init__(
        self,
        bot_id: str,
        name: str,
        personality: Personality,
        tutor_specialty: str
    ):
        super().__init__(
            bot_id=bot_id,
            name=name,
            personality=personality
        )

        self.tutor_specialty = tutor_specialty
        self.students_taught: Dict[str, StudentMemory] = {}

    async def teach_concept(
        self,
        concept: str,
        student_id: str,
        teaching_context: TeachingContext
    ) -> TeachingResponse:
        """Teach a concept using collaborative approach"""

        # Get student memory
        student = self.get_student_memory(student_id)

        # Calculate teaching stakes
        stakes = self._calculate_teaching_stakes(concept, student, teaching_context)

        # Build escalation context
        escalation_context = DecisionContext(
            character_id=self.bot_id,
            situation_type="teaching",
            situation_description=f"Teach {concept} to {student.name}",
            stakes=stakes,
            urgency_ms=teaching_context.time_available_ms,
            similar_decisions_count=len(student.concepts_learned)
        )

        # Route teaching approach
        decision = await self.escalation.route_decision(escalation_context)

        # Generate lesson based on decision source
        if decision.source == DecisionSource.BOT:
            lesson = self._bot_teaching_lesson(concept, student, teaching_context)
        elif decision.source == DecisionSource.BRAIN:
            lesson = await self._brain_teaching_lesson(concept, student, teaching_context)
        else:
            lesson = await self._human_teaching_lesson(concept, student, teaching_context)

        # Store teaching memory
        self.memory.store_episodic(
            content=f"Taught {concept} to {student.name}",
            importance=6.0,
            participants=[student_id],
            emotional_valence=0.5 if lesson.success else -0.2
        )

        return lesson

    async def facilitate_discussion(
        self,
        topic: str,
        participants: List[str],
        discussion_context: DiscussionContext
    ) -> DiscussionFacilitation:
        """Facilitate a group discussion"""

        facilitation = DiscussionFacilitation(topic=topic)

        # Check relationships between participants
        relationships = self._analyze_group_dynamics(participants)

        # Identify potential conflicts
        conflicts = self._predict_discussion_conflicts(relationships)

        # Plan facilitation approach
        if conflicts:
            facilitation.approach = FacilitationApproach.MEDIATE
        else:
            facilitation.approach = FacilitationApproach.GUIDE

        # Generate opening prompts
        facilitation.opening_prompt = self._generate_discussion_prompt(
            topic, relationships, discussion_context
        )

        # Plan follow-up questions
        facilitation.follow_ups = self._generate_follow_ups(topic)

        return facilitation

    def _analyze_group_dynamics(
        self,
        participant_ids: List[str]
    ) -> Dict[str, Dict[str, Relationship]]:
        """Analyze relationships between all participants"""

        dynamics = {}

        for i, pid_a in enumerate(participant_ids):
            dynamics[pid_a] = {}
            for pid_b in participant_ids:
                if pid_a != pid_b:
                    rel = self.get_relationship(pid_b)
                    dynamics[pid_a][pid_b] = rel

        return dynamics


class DiscussionFacilitation:
    """Result of discussion facilitation planning"""

    topic: str
    approach: FacilitationApproach
    opening_prompt: str
    follow_ups: List[str]
    conflict_resolution_plan: Optional[str] = None


class FacilitationApproach(Enum):
    GUIDE = "guide"           # Guide natural conversation
    STRUCTURE = "structure"   # Provide structured discussion
    MEDIATE = "mediate"       # Actively mediate conflicts
    DEMONSTRATE = "demonstrate"  # Show how to discuss
```

---

## Summary

The Combat & Social Bots Assistant provides a comprehensive framework for:

1. **Combat Decision Automation** - Personality-driven tactical choices with party coordination
2. **Social Interaction Management** - Dynamic dialogue with relationship tracking
3. **Multi-Bot Coordination** - Coordinated actions across multiple agents
4. **Escalation Engine Integration** - Cost-optimized decision routing
5. **Memory-Based Learning** - Experience-informed decisions
6. **DMLog Integration** - Direct compatibility with DMLog systems
7. **StudyLoG.AI Adaptation** - Educational collaboration scenarios

### Key Files Referenced

- `/docs/SUPERINSTANCE_DMLOG_NOTES.md` - DMLog research findings
- `/docs/SUPERINSTANCE_CHARACTER_NOTES.md` - Character system patterns
- `/docs/SUPERINSTANCE_ESCALATION_NOTES.md` - Escalation engine patterns
- `/docs/SUPERINSTANCE_COORDINATOR_NOTES.md` - Agent coordination patterns

### Implementation Status

- [ ] Core combat decision system
- [ ] Social dialogue generation
- [ ] Relationship management
- [ ] Party coordination
- [ ] DMLog adapters
- [ ] StudyLoG.AI learning bots
- [ ] Godot visualization integration

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-10
**Status:** Ready for Implementation
