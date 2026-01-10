# GamificationTriggerNode.gd
# Unlocks achievements and rewards based on player actions
# Part of StudyLoG.AI gamification system
#
# Usage:
#   var trigger = GamificationTriggerNode.new()
#   trigger.achievement_id = "first_neural_net"
#   trigger.condition_type = "milestone"
#   trigger.condition_value = 100  # XP threshold
#   add_child(trigger)

class_name GamificationTriggerNode
extends Node

## Signals
signal achievement_unlocked(achievement_id: String, title: String, rarity: String)
signal reward_granted(reward_id: String, reward_data: Dictionary)
signal xp_bonus_awarded(amount: int)

## Enums
enum ConditionType {
    MILESTONE,       # Reach a specific XP/level threshold
    DISCOVERY,       # Discover/interact with something
    MASTERY,         # Complete a task within criteria
    SOCIAL,          # Social interaction (share, rate, etc.)
    CUSTOM           # Custom condition
}

enum Rarity {
    COMMON,
    RARE,
    EPIC,
    LEGENDARY
}

## Exported Variables
@export_category("Achievement")
@export var achievement_id: String = ""
@export var achievement_title: String = ""
@export var achievement_description: String = ""
@export var condition_type: ConditionType = ConditionType.MILESTONE
@export var condition_value: Variant = 0  # Can be int, float, or String
@export var rarity: Rarity = Rarity.COMMON
@export var hidden: bool = false

@export_category("Rewards")
@export var xp_reward: int = 0
@export var unlock_features: Array[String] = []
@export var custom_rewards: Dictionary = {}

@export_category("Requirements")
@export var required_prerequisites: Array[String] = []  # Other achievements required
@export var required_stage: String = ""
@export var required_level: int = 0

@export_category("Behavior")
@export var auto_check: bool = true
@export var check_interval: float = 1.0
@export var one_time: bool = true

## Private Variables
var _unlocked: bool = false
var _check_timer: Timer = null
var _progress_system: ProgressNode = null
var _notification_display: Control = null
var _progress: float = 0.0  # 0.0 to 1.0 for progress tracking

## Built-in Methods

func _ready() -> void:
    # Find progress system
    _progress_system = get_node_or_null("/root/ProgressNode")

    # Create check timer
    if auto_check:
        _check_timer = Timer.new()
        _check_timer.wait_time = check_interval
        _check_timer.timeout.connect(_check_condition)
        add_child(_check_timer)
        _check_timer.start()

    # Listen for relevant events
    _connect_events()

func _exit_tree() -> void:
    _disconnect_events()

## Public Methods

# Manually check if condition is met
func check_condition() -> bool:
    if _unlocked and one_time:
        return false

    if not _check_prerequisites():
        return false

    var met = false

    match condition_type:
        ConditionType.MILESTONE:
            met = _check_milestone()
        ConditionType.DISCOVERY:
            met = _check_discovery()
        ConditionType.MASTERY:
            met = _check_mastery()
        ConditionType.SOCIAL:
            met = _check_social()
        ConditionType.CUSTOM:
            met = _check_custom()

    if met:
        _unlock_achievement()

    return met

# Set progress toward achievement (0.0 to 1.0)
func set_progress(value: float) -> void:
    _progress = clamp(value, 0.0, 1.0)
    progress_changed.emit(achievement_id, _progress)

# Get current progress
func get_progress() -> float:
    return _progress

# Add progress increment
func add_progress(amount: float) -> void:
    set_progress(_progress + amount)

# Manually unlock the achievement
func unlock() -> void:
    if not _unlocked:
        _unlock_achievement()

# Reset achievement (allows re-locking)
func reset() -> void:
    _unlocked = false
    _progress = 0.0

# Check if achievement is unlocked
func is_unlocked() -> bool:
    return _unlocked

# Get achievement data
func get_data() -> Dictionary:
    return {
        "id": achievement_id,
        "title": achievement_title,
        "description": achievement_description,
        "type": ConditionType.keys()[condition_type],
        "condition_value": condition_value,
        "rarity": Rarity.keys()[rarity],
        "hidden": hidden,
        "unlocked": _unlocked,
        "progress": _progress,
        "xp_reward": xp_reward,
        "unlock_features": unlock_features
    }

signal progress_changed(achievement_id: String, progress: float)

## Public Methods - Configuration

# Set achievement ID
func set_achievement_id(id: String) -> void:
    achievement_id = id

# Set achievement info
func set_achievement_info(title: String, description: String) -> void:
    achievement_title = title
    achievement_description = description

# Set condition
func set_condition(type: ConditionType, value: Variant = 0) -> void:
    condition_type = type
    condition_value = value

# Set rarity
func set_rarity(new_rarity: Rarity) -> void:
    rarity = new_rarity

# Set rewards
func set_rewards(xp: int, features: Array[String] = []) -> void:
    xp_reward = xp
    unlock_features = features

## Private Methods - Condition Checking

func _check_prerequisites() -> bool:
    # Check required achievements
    if required_prerequisites.size() > 0:
        for prereq in required_prerequisites:
            if not _is_achievement_unlocked(prereq):
                return false

    # Check required stage
    if required_stage != "":
        if _progress_system and _progress_system.has_method("get_current_stage"):
            var current = _progress_system.call("get_current_stage")
            if current != required_stage:
                return false

    # Check required level
    if required_level > 0:
        if _progress_system and _progress_system.has_method("get_level"):
            var level = _progress_system.call("get_level")
            if level < required_level:
                return false

    return true

func _check_milestone() -> bool:
    if not _progress_system:
        return false

    var current_xp = 0
    if _progress_system.has_method("get_xp"):
        current_xp = _progress_system.call("get_xp")

    var threshold = int(condition_value)
    _progress = float(current_xp) / float(threshold)

    return current_xp >= threshold

func _check_discovery() -> bool:
    # Discovery achievements are typically triggered manually
    # This checks if the discovery condition_value has been "found"
    return false

func _check_mastery() -> bool:
    # Mastery would check completion time, accuracy, etc.
    return false

func _check_social() -> bool:
    # Social achievements check for shares, ratings, etc.
    return false

func _check_custom() -> bool:
    # Custom condition check - override or connect to signal
    return false

func _is_achievement_unlocked(id: String) -> bool:
    # Check against achievement system
    return false

## Private Methods - Unlock

func _unlock_achievement() -> void:
    _unlocked = true
    _progress = 1.0

    # Emit signals
    achievement_unlocked.emit(
        achievement_id,
        achievement_title,
        Rarity.keys()[rarity].to_lower()
    )

    # Grant rewards
    if xp_reward > 0:
        if _progress_system and _progress_system.has_method("add_xp"):
            _progress_system.call("add_xp", xp_reward)
        xp_bonus_awarded.emit(xp_reward)

    for feature in unlock_features:
        if _progress_system and _progress_system.has_method("unlock_feature"):
            _progress_system.call("unlock_feature", feature)

    # Grant custom rewards
    for reward_id in custom_rewards:
        reward_granted.emit(reward_id, custom_rewards[reward_id])

    # Show notification
    _show_unlock_notification()

    # Save progress
    _save_unlock_state()

    print("GamificationTrigger: Unlocked achievement '%s'" % achievement_id)

func _show_unlock_notification() -> void:
    # Create visual notification
    var notification = _create_notification_display()

    # Animate in
    var tween = create_tween()
    notification.modulate.a = 0.0
    notification.scale = Vector2(0.5, 0.5)
    tween.set_parallel(true)
    tween.tween_property(notification, "modulate:a", 1.0, 0.3)
    tween.tween_property(notification, "scale", Vector2.ONE, 0.3).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)

    # Auto-hide after delay
    await get_tree().create_timer(4.0).timeout
    tween = create_tween()
    tween.tween_property(notification, "modulate:a", 0.0, 0.3)
    tween.tween_callback(notification.queue_free)

func _create_notification_display() -> Control:
    # Find or create canvas layer for UI
    var canvas = get_node_or_null("/root/NotificationCanvas")
    if not canvas:
        canvas = CanvasLayer.new()
        canvas.name = "NotificationCanvas"
        canvas.layer = 100  # Draw on top
        get_tree().root.add_child(canvas)

    # Create notification panel
    var panel = Panel.new()
    panel.size = Vector2(400, 100)
    panel.position = Vector2(
        (get_viewport().get_visible_rect().size.x - 400) / 2,
        50
    )

    # Style based on rarity
    var style_box = StyleBoxFlat.new()
    match rarity:
        Rarity.COMMON:
            style_box.bg_color = Color(0.3, 0.3, 0.3, 0.9)
        Rarity.RARE:
            style_box.bg_color = Color(0.2, 0.4, 0.8, 0.9)
        Rarity.EPIC:
            style_box.bg_color = Color(0.6, 0.2, 0.8, 0.9)
        Rarity.LEGENDARY:
            style_box.bg_color = Color(1.0, 0.7, 0.2, 0.9)

    style_box.corner_radius_top_left = 10
    style_box.corner_radius_top_right = 10
    style_box.corner_radius_bottom_left = 10
    style_box.corner_radius_bottom_right = 10
    panel.add_theme_stylebox_override("panel", style_box)

    canvas.add_child(panel)

    # Add title
    var title = Label.new()
    title.text = achievement_title
    title.add_theme_font_size_override("font_size", 24)
    title.add_theme_color_override("font_color", Color(1, 1, 1))
    title.position = Vector2(20, 15)
    panel.add_child(title)

    # Add rarity label
    var rarity_label = Label.new()
    rarity_label.text = Rarity.keys()[rarity].capitalize()
    rarity_label.add_theme_font_size_override("font_size", 14)
    rarity_label.add_theme_color_override("font_color", Color(0.8, 0.8, 0.8))
    rarity_label.position = Vector2(20, 45)
    panel.add_child(rarity_label)

    # Add description
    var desc = Label.new()
    desc.text = achievement_description
    desc.add_theme_font_size_override("font_size", 12)
    desc.add_theme_color_override("font_color", Color(0.9, 0.9, 0.9))
    desc.position = Vector2(20, 70)
    panel.add_child(desc)

    return panel

func _save_unlock_state() -> void:
    # Save to SaveSystem if available
    if has_node("/root/SaveSystem"):
        var save_system = get_node("/root/SaveSystem") as SaveSystem
        var key = "achievement_" + achievement_id
        save_system.set_state(key, {"unlocked": true, "timestamp": Time.get_unix_time_from_system()})

func _load_unlock_state() -> void:
    if has_node("/root/SaveSystem"):
        var save_system = get_node("/root/SaveSystem") as SaveSystem
        var key = "achievement_" + achievement_id
        var data = save_system.get_state(key)
        if data and data.get("unlocked", false):
            _unlocked = true

## Private Methods - Events

func _connect_events() -> void:
    # Connect to relevant global events
    if not EventBus:
        return

    match condition_type:
        ConditionType.MILESTONE:
            EventBus.xp_gained.connect(_on_xp_gained)
        ConditionType.DISCOVERY:
            # Listen for discovery events
            pass
        ConditionType.MASTERY:
            EventBus.exercise_completed.connect(_on_exercise_completed)
        ConditionType.SOCIAL:
            # Listen for social events
            pass

func _disconnect_events() -> void:
    if not EventBus:
        return

    if EventBus.xp_gained.is_connected(_on_xp_gained):
        EventBus.xp_gained.disconnect(_on_xp_gained)

func _on_xp_gained(amount: int, total: int) -> void:
    if condition_type == ConditionType.MILESTONE:
        var threshold = int(condition_value)
        if total >= threshold and not _unlocked:
            unlock()

func _on_exercise_completed(exercise_id: String, success: bool, xp: int) -> void:
    if condition_type == ConditionType.MASTERY:
        # Check if this exercise is the mastery target
        if condition_value is String and condition_value == exercise_id:
            unlock()


## Achievement Registry

# Central registry for all achievements
class_name AchievementRegistry
extends Node

static var _instance: AchievementRegistry = null
var _achievements: Dictionary = {}  # achievement_id -> definition

func _init() -> void:
    if _instance != null:
        return
    _instance = self

static func instance() -> AchievementRegistry:
    if _instance == null:
        _instance = AchievementRegistry.new()
    return _instance

# Register an achievement definition
func register_achievement(data: Dictionary) -> void:
    var id = data.get("id", "")
    if id == "":
        push_error("Achievement must have an ID")
        return

    _achievements[id] = data

# Get achievement definition
func get_achievement(id: String) -> Dictionary:
    return _achievements.get(id, {})

# Get all achievements
func get_all_achievements() -> Dictionary:
    return _achievements.duplicate()

# Get achievements by rarity
func get_by_rarity(target_rarity: Rarity) -> Array:
    var result: Array[Dictionary] = []
    for id in _achievements:
        var achievement = _achievements[id]
        if achievement.get("rarity", Rarity.COMMON) == target_rarity:
            result.append(achievement)
    return result

# Get achievements by stage
func get_by_stage(stage: String) -> Array[Dictionary]:
    var result: Array[Dictionary] = []
    for id in _achievements:
        var achievement = _achievements[id]
        if achievement.get("required_stage", "") == stage:
            result.append(achievement)
    return result
