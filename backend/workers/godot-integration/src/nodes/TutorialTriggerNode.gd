# TutorialTriggerNode.gd
# Activates tutorials based on player actions and conditions
# Part of StudyLoG.AI progressive disclosure system
#
# Usage:
#   var trigger = TutorialTriggerNode.new()
#   trigger.tutorial_id = "basics_movement"
#   trigger.trigger_condition = "player_entered_area"
#   add_child(trigger)

class_name TutorialTriggerNode
extends Area3D

## Signals
signal tutorial_triggered(tutorial_id: String)
signal tutorial_completed(tutorial_id: String)
signal trigger_activated(trigger_data: Dictionary)

## Exported Variables
@export_category("Tutorial Configuration")
@export var tutorial_id: String = ""
@export var trigger_condition: String = "body_entered"  # body_entered, interact, custom_event, proximity
@export var trigger_once: bool = true
@export var delay_seconds: float = 0.0

@export_category("Requirements")
@export var required_level: int = 0
@export var required_stage: String = ""
@export var required_items: Array[String] = []
@export var excluded_tutorials: Array[String] = []  # Tutorials that must NOT be completed

@export_category("Proximity Trigger")
@export var proximity_distance: float = 3.0
@export var target_node_path: NodePath = NodePath()

@export_category("UI")
@export var prompt_text: String = ""
@export var prompt_duration: float = 3.0
@export var show_prompt_indicator: bool = true

@export_category("Auto-Start")
@export var auto_start: bool = false
@export var check_on_ready: bool = false

## Private Variables
var _triggered: bool = false
var _target_node: Node3D = null
var _player_in_area: bool = false
var _prompt_label: Label3D = null
var _indicator: MeshInstance3D = null
var _delay_timer: Timer = null
var _tutorial_system: Node = null

## Built-in Methods

func _ready() -> void:
    # Find tutorial system
    _tutorial_system = get_node_or_null("/root/TutorialManager")
    if not _tutorial_system:
        _tutorial_system = get_node_or_null("/root/TutorialProgress")

    # Setup collision for area detection
    if trigger_condition == "body_entered":
        var collision = CollisionShape3D.new()
        var shape = SphereShape3D.new()
        shape.radius = proximity_distance
        collision.shape = shape
        add_child(collision)

        body_entered.connect(_on_body_entered)
        body_exited.connect(_on_body_exited)

    # Setup target node for proximity
    if not target_node_path.is_empty():
        _target_node = get_node(target_node_path) as Node3D

    # Create visual indicator
    if show_prompt_indicator:
        _create_indicator()

    # Create prompt label
    if prompt_text != "":
        _create_prompt_label()

    # Setup delay timer
    if delay_seconds > 0:
        _delay_timer = Timer.new()
        _delay_timer.wait_time = delay_seconds
        _delay_timer.one_shot = true
        _delay_timer.timeout.connect(_on_delay_timeout)
        add_child(_delay_timer)

    # Auto-start check
    if auto_start and check_on_ready:
        call_deferred("check_trigger")

func _process(delta: float) -> void:
    if trigger_condition == "proximity" and _target_node:
        var distance = global_position.distance_to(_target_node.global_position)
        if distance <= proximity_distance and not _player_in_area:
            _player_in_area = true
            _show_indicator()
            if auto_start:
                check_trigger()
        elif distance > proximity_distance and _player_in_area:
            _player_in_area = false
            _hide_indicator()

func _input(event: InputEvent) -> void:
    if trigger_condition == "interact" and _player_in_area:
        if event is InputEventKey and event.pressed:
            if event.keycode == KEY_E or event.keycode == KEY_SPACE:
                check_trigger()

## Public Methods

# Check if trigger conditions are met and activate tutorial
func check_trigger() -> void:
    if _triggered and trigger_once:
        return

    if not _check_requirements():
        return

    if not _check_exclusions():
        return

    if delay_seconds > 0:
        _delay_timer.start()
    else:
        _activate_tutorial()

# Manually trigger the tutorial
func force_trigger() -> void:
    _triggered = false  # Reset to allow manual trigger
    check_trigger()

# Reset the trigger (allows re-triggering)
func reset_trigger() -> void:
    _triggered = false

# Set the tutorial ID
func set_tutorial_id(id: String) -> void:
    tutorial_id = id

# Set trigger condition
func set_trigger_condition(condition: String) -> void:
    trigger_condition = condition

# Set prompt text
func set_prompt_text(text: String) -> void:
    prompt_text = text
    if _prompt_label:
        _prompt_label.text = text

# Check if requirements are met
func _check_requirements() -> bool:
    # Check level requirement
    if _tutorial_system and _tutorial_system.has_method("get_level"):
        var player_level = _tutorial_system.call("get_level")
        if player_level < required_level:
            return false

    # Check stage requirement
    if required_stage != "":
        if _tutorial_system and _tutorial_system.has_method("get_current_stage"):
            var current_stage = _tutorial_system.call("get_current_stage")
            if current_stage != required_stage:
                return false

    # Check item requirements
    if required_items.size() > 0:
        if not _has_required_items():
            return false

    # Check if tutorial already completed
    if trigger_once and _is_tutorial_completed():
        return false

    return true

func _check_exclusions() -> bool:
    for tutorial_id in excluded_tutorials:
        if _is_tutorial_completed(tutorial_id):
            return false  # An excluded tutorial was completed, don't trigger
    return true

func _is_tutorial_completed(id: String = "") -> bool:
    var check_id = id if id != "" else tutorial_id
    if check_id == "":
        return false

    if _tutorial_system and _tutorial_system.has_method("is_tutorial_completed"):
        return _tutorial_system.call("is_tutorial_completed", check_id)

    return false

func _has_required_items() -> bool:
    # This would integrate with an inventory system
    return true

## Public Methods - State Query

# Check if trigger has been activated
func is_triggered() -> bool:
    return _triggered

# Check if player is in trigger area
func is_player_in_area() -> bool:
    return _player_in_area

# Get trigger data
func get_trigger_data() -> Dictionary:
    return {
        "tutorial_id": tutorial_id,
        "trigger_condition": trigger_condition,
        "triggered": _triggered,
        "player_in_area": _player_in_area,
        "requirements_met": _check_requirements(),
        "position": global_position
    }

## Private Methods - Activation

func _activate_tutorial() -> void:
    _triggered = true

    # Emit signal
    tutorial_triggered.emit(tutorial_id)
    trigger_activated.emit(get_trigger_data())

    # Start the tutorial
    if _tutorial_system:
        if _tutorial_system.has_method("start_tutorial"):
            _tutorial_system.call("start_tutorial", tutorial_id)
        elif _tutorial_system.has_method("start"):
            _tutorial_system.call("start")

    # Show prompt
    if prompt_text != "":
        _show_prompt()

    # Hide indicator
    _hide_indicator()

    print("TutorialTrigger: Activated tutorial '%s'" % tutorial_id)

func _show_prompt() -> void:
    if _prompt_label:
        _prompt_label.visible = true

    # Auto-hide after duration
    if prompt_duration > 0:
        var hide_timer = Timer.new()
        hide_timer.wait_time = prompt_duration
        hide_timer.one_shot = true
        hide_timer.timeout.connect(func():
            if _prompt_label:
                _prompt_label.visible = false
            hide_timer.queue_free()
        )
        add_child(hide_timer)
        hide_timer.start()

## Private Methods - Visuals

func _create_indicator() -> void:
    _indicator = MeshInstance3D.new()

    # Create a translucent sphere as indicator
    var sphere = SphereMesh.new()
    sphere.radius = 0.2
    sphere.height = 0.4

    _indicator.mesh = sphere

    var material = StandardMaterial3D.new()
    material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
    material.albedo_color = Color(1, 1, 0.5, 0.5)
    material.render_priority = 1  # Draw on top
    _indicator.set_surface_override_material(0, material)

    _indicator.position = Vector3(0, 2, 0)
    add_child(_indicator)

    _indicator.visible = false

func _create_prompt_label() -> void:
    _prompt_label = Label3D.new()
    _prompt_label.text = prompt_text
    _prompt_label.pixel_size = 0.005
    _prompt_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
    _prompt_label.outline_size = 5
    _prompt_label.outline_color = Color.BLACK

    var material = _prompt_label.get_surface_override_material(0)
    if material is StandardMaterial3D:
        material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA

    _prompt_label.position = Vector3(0, 2.5, 0)
    add_child(_prompt_label)

    _prompt_label.visible = false

func _show_indicator() -> void:
    if _indicator:
        _indicator.visible = true

func _hide_indicator() -> void:
    if _indicator:
        _indicator.visible = false

## Private Methods - Callbacks

func _on_body_entered(body: Node3D) -> void:
    if body.is_in_group("player"):
        _player_in_area = true
        _show_indicator()

        if auto_start:
            check_trigger()

func _on_body_exited(body: Node3D) -> void:
    if body.is_in_group("player"):
        _player_in_area = false
        _hide_indicator()

func _on_delay_timeout() -> void:
    _activate_tutorial()


## Tutorial Manager Integration

# Static method to create a trigger from data
static func from_data(data: Dictionary) -> TutorialTriggerNode:
    var trigger = TutorialTriggerNode.new()

    if data.has("tutorial_id"):
        trigger.tutorial_id = data.tutorial_id
    if data.has("trigger_condition"):
        trigger.trigger_condition = data.trigger_condition
    if data.has("trigger_once"):
        trigger.trigger_once = data.trigger_once
    if data.has("delay_seconds"):
        trigger.delay_seconds = data.delay_seconds
    if data.has("required_level"):
        trigger.required_level = data.required_level
    if data.has("required_stage"):
        trigger.required_stage = data.required_stage
    if data.has("prompt_text"):
        trigger.prompt_text = data.prompt_text
    if data.has("proximity_distance"):
        trigger.proximity_distance = data.proximity_distance

    if data.has("position"):
        var pos_data = data.position
        trigger.global_position = Vector3(
            pos_data.get("x", 0),
            pos_data.get("y", 0),
            pos_data.get("z", 0)
        )

    return trigger
