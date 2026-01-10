# ProgressNode.gd
# Tracks and visualizes learning progress in StudyLoG.AI
# Displays progress rings, XP bars, and unlock indicators
#
# Usage:
#   var progress = ProgressNode.new()
#   add_child(progress)
#   progress.set_total_stages(5)
#   progress.advance_to_stage(2)
#   progress.add_xp(100)

class_name ProgressNode
extends Node3D

## Signals
signal stage_changed(old_stage: int, new_stage: int)
signal xp_gained(amount: int, total: int)
signal level_up(new_level: int)
signal milestone_reached(milestone_id: String)
signal stage_unlocked(stage: int)

## Exported Variables
@export_category("Progress Configuration")
@export var total_stages: int = 4
@export var current_stage: int = 0
@export var xp_per_stage: int = 1000
@export var starting_xp: int = 0

@export_category("Visualization")
@export var show_progress_ring: bool = true
@export var show_xp_bar: bool = true
@export var show_stage_indicators: bool = true
@export var ring_radius: float = 1.0
@export var ring_thickness: float = 0.1
@export var bar_width: float = 1.5
@export var bar_height: float = 0.15

@export_category("Stage Thresholds")
@export var stage_unlock_thresholds: PackedInt32Array = PackedInt32Array([0, 500, 1500, 3000, 5000])

@export_category("Persistence")
@export var persistence_key: String = "progress"
@export var auto_save: bool = true

## Private Variables
var _current_xp: int = 0
var _total_xp: int = 0
var _current_level: int = 1
var _milestones: Dictionary = {}  # milestone_id -> {xp_required, completed}
var _unlocked_features: PackedStringArray = PackedStringArray()

# Visualization nodes
var _progress_ring: MeshInstance3D = null
var _xp_bar: MeshInstance3D = null
var _stage_indicators: Array[MeshInstance3D] = []
var _level_label: Label3D = null
var _xp_label: Label3D = null

## Built-in Methods

func _ready() -> void:
    _current_xp = starting_xp
    _create_visualization()
    _update_display()
    _load_progress()

func _exit_tree() -> void:
    if auto_save:
        _save_progress()

## Public Methods - Stage Management

# Set the total number of stages
func set_total_stages(count: int) -> void:
    total_stages = max(1, count)
    _update_stage_thresholds()
    _create_visualization()

# Set the current stage
func set_stage(stage: int) -> void:
    var old_stage = current_stage
    current_stage = clamp(stage, 0, total_stages - 1)

    if old_stage != current_stage:
        stage_changed.emit(old_stage, current_stage)
        _update_display()

        if auto_save:
            _save_progress()

# Advance to the next stage
func advance_to_stage(stage: int) -> bool:
    if stage < 0 or stage >= total_stages:
        return false

    if stage > current_stage:
        var old = current_stage
        current_stage = stage
        stage_changed.emit(old, current_stage)
        stage_unlocked.emit(stage)
        _update_display()

        if auto_save:
            _save_progress()

        return true
    return false

# Advance one stage
func next_stage() -> bool:
    return advance_to_stage(current_stage + 1)

# Go back one stage
func previous_stage() -> bool:
    if current_stage > 0:
        set_stage(current_stage - 1)
        return true
    return false

# Get the current stage
func get_current_stage() -> int:
    return current_stage

# Get the next stage
func get_next_stage() -> int:
    return min(current_stage + 1, total_stages - 1)

# Check if a stage is unlocked
func is_stage_unlocked(stage: int) -> bool:
    return stage <= current_stage

## Public Methods - XP Management

# Add XP
func add_xp(amount: int) -> void:
    _current_xp += amount
    _total_xp += amount

    xp_gained.emit(amount, _current_xp)

    # Check for level up
    var new_level = _calculate_level()
    if new_level > _current_level:
        var levels_gained = new_level - _current_level
        _current_level = new_level
        level_up.emit(_current_level)

    # Check for stage progression
    _check_stage_progression()

    # Check milestones
    _check_milestones()

    _update_display()

    if auto_save:
        _save_progress()

# Set current XP
func set_xp(amount: int) -> void:
    _current_xp = max(0, amount)
    _update_display()

# Get current XP
func get_xp() -> int:
    return _current_xp

# Get total XP earned
func get_total_xp() -> int:
    return _total_xp

# Get XP needed for next stage
func get_xp_for_next_stage() -> int:
    if current_stage >= total_stages - 1:
        return _current_xp  # Already at max

    var threshold = stage_unlock_thresholds[current_stage + 1] if current_stage + 1 < stage_unlock_thresholds.size() else (current_stage + 1) * xp_per_stage
    return max(0, threshold - _current_xp)

# Get XP progress toward next stage (0.0 to 1.0)
func get_stage_progress() -> float:
    var current_threshold = stage_unlock_thresholds[current_stage] if current_stage < stage_unlock_thresholds.size() else current_stage * xp_per_stage
    var next_threshold = stage_unlock_thresholds[current_stage + 1] if current_stage + 1 < stage_unlock_thresholds.size() else (current_stage + 1) * xp_per_stage

    if current_stage >= total_stages - 1:
        return 1.0

    var range = next_threshold - current_threshold
    if range <= 0:
        return 1.0

    return float(_current_xp - current_threshold) / float(range)

## Public Methods - Level Management

# Get current level
func get_level() -> int:
    return _current_level

# Calculate level from XP
func _calculate_level() -> int:
    return 1 + int(sqrt(float(_total_xp) / 100.0))

## Public Methods - Milestones

# Register a milestone
func register_milestone(id: String, xp_required: int) -> void:
    _milestones[id] = {
        "xp_required": xp_required,
        "completed": false
    }

# Check if milestone is completed
func is_milestone_completed(id: String) -> bool:
    if _milestones.has(id):
        return _milestones[id].completed
    return false

# Get milestone progress (0.0 to 1.0)
func get_milestone_progress(id: String) -> float:
    if not _milestones.has(id):
        return 0.0

    var milestone = _milestones[id]
    return clamp(float(_current_xp) / float(milestone.xp_required), 0.0, 1.0)

# Manually complete a milestone
func complete_milestone(id: String) -> void:
    if _milestones.has(id) and not _milestones[id].completed:
        _milestones[id].completed = true
        milestone_reached.emit(id)

## Public Methods - Features

# Unlock a feature
func unlock_feature(feature_id: String) -> void:
    if not _unlocked_features.has(feature_id):
        _unlocked_features.append(feature_id)
        if auto_save:
            _save_progress()

# Check if a feature is unlocked
func is_feature_unlocked(feature_id: String) -> bool:
    return _unlocked_features.has(feature_id)

# Get all unlocked features
func get_unlocked_features() -> PackedStringArray:
    return _unlocked_features.duplicate()

## Public Methods - Statistics

# Get completion percentage
func get_completion_percentage() -> float:
    return float(current_stage + 1) / float(total_stages) * 100.0

# Get progress summary
func get_summary() -> Dictionary:
    return {
        "stage": current_stage,
        "total_stages": total_stages,
        "level": _current_level,
        "xp": _current_xp,
        "total_xp": _total_xp,
        "stage_progress": get_stage_progress(),
        "completion_percentage": get_completion_percentage(),
        "unlocked_features": _unlocked_features.size(),
        "milestones_completed": _count_completed_milestones()
    }

## Public Methods - Persistence

# Save progress to storage
func save_progress() -> void:
    _save_progress()

# Load progress from storage
func load_progress() -> void:
    _load_progress()

# Reset all progress
func reset_progress() -> void:
    current_stage = 0
    _current_xp = 0
    _total_xp = 0
    _current_level = 1
    _unlocked_features.clear()

    for id in _milestones:
        _milestones[id].completed = false

    _update_display()
    _save_progress()

## Private Methods

func _create_visualization() -> void:
    _clear_visualization()

    if show_progress_ring:
        _create_progress_ring()

    if show_xp_bar:
        _create_xp_bar()

    if show_stage_indicators:
        _create_stage_indicators()

    _create_labels()

func _create_progress_ring() -> void:
    _progress_ring = MeshInstance3D.new()
    var donut = TorusMesh.new()
    donut.radius = ring_radius
    donut.inner_radius = ring_radius - ring_thickness
    donut.rings = 64
    donut.radial_segments = 64

    _progress_ring.mesh = donut
    add_child(_progress_ring)

    # Create partial ring shader material
    var material = ShaderMaterial.new()
    material.shader = load("res://addons/studylog/shaders/progress_ring.gdshader") as Shader
    _progress_ring.set_surface_override_material(0, material)

func _create_xp_bar() -> void:
    _xp_bar = MeshInstance3D.new()
    var bar = BoxMesh.new()
    bar.size = Vector3(bar_width, bar_height, 0.1)

    _xp_bar.mesh = bar
    _xp_bar.position = Vector3(0, -ring_radius - 0.3, 0)
    add_child(_xp_bar)

    var material = StandardMaterial3D.new()
    material.albedo_color = Color(0.2, 0.6, 1.0)
    _xp_bar.set_surface_override_material(0, material)

func _create_stage_indicators() -> void:
    var angle_step = TAU / float(total_stages)

    for i in range(total_stages):
        var indicator = MeshInstance3D.new()
        var sphere = SphereMesh.new()
        sphere.radius = 0.1
        sphere.height = 0.2

        indicator.mesh = sphere

        var angle = i * angle_step - PI / 2.0
        var distance = ring_radius + ring_thickness / 2.0 + 0.15
        indicator.position = Vector3(
            cos(angle) * distance,
            sin(angle) * distance,
            0
        )

        add_child(indicator)
        _stage_indicators.append(indicator)

func _create_labels() -> void:
    _level_label = Label3D.new()
    _level_label.text = "Lvl %d" % _current_level
    _level_label.position = Vector3(0, 0.3, 0)
    _level_label.pixel_size = 0.01
    add_child(_level_label)

    _xp_label = Label3D.new()
    _xp_label.text = "%d XP" % _current_xp
    _xp_label.position = Vector3(0, -ring_radius - 0.6, 0)
    _xp_label.pixel_size = 0.008
    add_child(_xp_label)

func _clear_visualization() -> void:
    if _progress_ring:
        _progress_ring.queue_free()
        _progress_ring = null

    if _xp_bar:
        _xp_bar.queue_free()
        _xp_bar = null

    for indicator in _stage_indicators:
        indicator.queue_free()
    _stage_indicators.clear()

    if _level_label:
        _level_label.queue_free()

    if _xp_label:
        _xp_label.queue_free()

func _update_display() -> void:
    if _progress_ring and _progress_ring.get_surface_override_material_count() > 0:
        var material = _progress_ring.get_surface_override_material(0)
        if material is ShaderMaterial:
            material.set_shader_parameter("progress", get_stage_progress())
            material.set_shader_parameter("color", _get_stage_color())

    if _xp_bar:
        var progress = get_stage_progress()
        _xp_bar.scale.x = progress
        _xp_bar.position.x = -(bar_width / 2.0) * (1.0 - progress)

    for i in range(_stage_indicators.size()):
        var indicator = _stage_indicators[i]
        var unlocked = i <= current_stage

        if indicator.mesh is SphereMesh:
            var sphere = indicator.mesh as SphereMesh
            sphere.radius = 0.15 if unlocked else 0.08
            sphere.height = 0.3 if unlocked else 0.16

        if indicator.get_surface_override_material_count() > 0:
            var material = indicator.get_surface_override_material(0)
            if material is StandardMaterial3D:
                material.albedo_color = _get_stage_color(i) if unlocked else Color(0.3, 0.3, 0.3)

    if _level_label:
        _level_label.text = "Lvl %d" % _current_level

    if _xp_label:
        var next_xp = get_xp_for_next_stage()
        _xp_label.text = "%d / %d XP" % [_current_xp, _current_xp + next_xp]

func _get_stage_color(stage: int = -1) -> Color:
    var s = stage if stage >= 0 else current_stage
    var t = float(s) / float(max(1, total_stages - 1))

    # StudyLoG.AI stage colors
    match s:
        0:  # Cognitive Mill
            return Color(0.2, 0.6, 1.0)  # Blue
        1:  # Intelligence Ranch
            return Color(0.2, 0.8, 0.4)  # Green
        2:  # Sitka Sound
            return Color(0.9, 0.5, 0.2)  # Orange
        3:  # Digital Twins
            return Color(0.7, 0.2, 0.8)  # Purple
        _:
            return Color(0.3 + t * 0.5, 0.7 - t * 0.3, 0.9 - t * 0.5)

func _update_stage_thresholds() -> void:
    if stage_unlock_thresholds.size() != total_stages:
        stage_unlock_thresholds.clear()
        for i in range(total_stages):
            stage_unlock_thresholds.append(i * xp_per_stage)

func _check_stage_progression() -> void:
    while current_stage < total_stages - 1:
        var threshold = stage_unlock_thresholds[current_stage + 1] if current_stage + 1 < stage_unlock_thresholds.size() else (current_stage + 1) * xp_per_stage
        if _current_xp >= threshold:
            next_stage()
        else:
            break

func _check_milestones() -> void:
    for id in _milestones:
        var milestone = _milestones[id]
        if not milestone.completed and _current_xp >= milestone.xp_required:
            milestone.completed = true
            milestone_reached.emit(id)

func _count_completed_milestones() -> int:
    var count = 0
    for id in _milestones:
        if _milestones[id].completed:
            count += 1
    return count

func _save_progress() -> void:
    var data = {
        "stage": current_stage,
        "xp": _current_xp,
        "total_xp": _total_xp,
        "level": _current_level,
        "unlocked_features": _unlocked_features,
        "milestones": {}
    }

    for id in _milestones:
        data.milestones[id] = _milestones[id].completed

    # Use SaveSystem if available
    if has_node("/root/SaveSystem"):
        var save_system = get_node("/root/SaveSystem") as SaveSystem
        save_system.set_state(persistence_key, data)
    else:
        # Fallback to direct file save
        var file = FileAccess.open("user://%s.json" % persistence_key, FileAccess.WRITE)
        if file:
            file.store_string(JSON.stringify(data))
            file.close()

func _load_progress() -> void:
    var data = null

    # Try SaveSystem first
    if has_node("/root/SaveSystem"):
        var save_system = get_node("/root/SaveSystem") as SaveSystem
        data = save_system.get_state(persistence_key)
    else:
        # Fallback to direct file load
        var file = FileAccess.open("user://%s.json" % persistence_key, FileAccess.READ)
        if file:
            var json_string = file.get_as_text()
            file.close()
            var json = JSON.new()
            if json.parse(json_string) == OK:
                data = json.data

    if data:
        current_stage = data.get("stage", 0)
        _current_xp = data.get("xp", 0)
        _total_xp = data.get("total_xp", 0)
        _current_level = data.get("level", 1)
        _unlocked_features = data.get("unlocked_features", PackedStringArray())

        var milestones = data.get("milestones", {})
        for id in milestones:
            if _milestones.has(id):
                _milestones[id].completed = milestones[id]

        _update_display()
