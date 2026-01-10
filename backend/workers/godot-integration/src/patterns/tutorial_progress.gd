# tutorial_progress.gd
# Tutorial Progression Tracker for StudyLoG.AI
# Tracks tutorial progress with persistence and completion detection
#
# Usage:
#   extends Node
#   var tutorial_tracker: TutorialProgress
#
#   func _ready():
#       tutorial_tracker = TutorialProgress.new("cognitive_mill_basics")
#       tutorial_tracker.step_reached.connect(_on_step_reached)
#       tutorial_tracker.start_tutorial()
#
#   func _on_step_reached(step_id: String):
#       show_tooltip(tutorial_tracker.get_current_step())

class_name TutorialProgress
extends Resource

## Constants
const PROGRESS_VERSION: int = 1
const DEFAULT_STORAGE_PATH: String = "user://tutorials/"

## Signals
signal tutorial_started(tutorial_id: String)
signal tutorial_completed(tutorial_id: String)
signal step_reached(step_id: String, step_index: int)
signal step_completed(step_id: String, step_index: int)
signal tutorial_skipped(tutorial_id: String)

## Exported Variables
@export_category("Tutorial")
@export var tutorial_id: String = ""
@export var tutorial_name: String = ""
@export var total_steps: int = 0
@export var required_steps: int = -1  # -1 means all steps required
@export var allow_skip: bool = true
@export var save_automatically: bool = true

## Private Variables
var _current_step_index: int = 0
var _completed_steps: PackedStringArray = []
var _skipped_steps: PackedStringArray = []
var _step_data: Dictionary = {}
var _started_at: int = 0
var _last_activity: int = 0
var _is_active: bool = false
var _is_completed: bool = false

## Tutorial Step Definition
class TutorialStep:
    extends Resource

    @export var id: String = ""
    @export var title: String = ""
    @export var description: String = ""
    @export var highlight_node_path: NodePath = ""
    @export var action_prompt: String = ""
    @export var completion_trigger: String = ""  # Event name or condition
    @export var hint_text: String = ""
    @export var hint_delay: float = 5.0
    @export var optional: bool = false

    func _init(
        p_id: String = "",
        p_title: String = "",
        p_description: String = "",
        p_action_prompt: String = ""
    ):
        id = p_id
        title = p_title
        description = p_description
        action_prompt = p_action_prompt

## Built-in Methods

func _init(p_tutorial_id: String = ""):
    tutorial_id = p_tutorial_id
    _load_progress()

## Public Methods - Tutorial Lifecycle

# Start the tutorial
func start_tutorial() -> void:
    if _is_active:
        push_warning("Tutorial already active: %s" % tutorial_id)
        return

    _is_active = true
    _started_at = Time.get_unix_time_from_system()
    _last_activity = _started_at
    _current_step_index = 0

    tutorial_started.emit(tutorial_id)
    print("TutorialProgress: Started tutorial '%s'" % tutorial_id)

    # Reach first step
    if total_steps > 0:
        _reach_step(0)

# Complete the current step
func complete_step(step_id: String = "") -> void:
    if not _is_active:
        return

    var target_id = step_id if step_id != "" else get_current_step_id()
    var step_index = _get_step_index(target_id)

    if step_index < 0:
        push_warning("Unknown step: %s" % target_id)
        return

    if _completed_steps.has(target_id):
        return  # Already completed

    _completed_steps.append(target_id)
    _last_activity = Time.get_unix_time_from_system()

    step_completed.emit(target_id, step_index)
    print("TutorialProgress: Completed step '%s'" % target_id)

    # Save progress
    if save_automatically:
        _save_progress()

    # Check if tutorial is complete
    if _check_completion():
        complete_tutorial()
    else:
        # Move to next step
        _advance_to_next_step()

# Skip the current step
func skip_step() -> void:
    if not _is_active:
        return

    if not allow_skip:
        push_warning("Skipping not allowed for this tutorial")
        return

    var current_id = get_current_step_id()
    _skipped_steps.append(current_id)

    print("TutorialProgress: Skipped step '%s'" % current_id)
    _advance_to_next_step()

# Complete the entire tutorial
func complete_tutorial() -> void:
    if not _is_active:
        return

    _is_active = false
    _is_completed = true

    tutorial_completed.emit(tutorial_id)
    print("TutorialProgress: Completed tutorial '%s'" % tutorial_id)

    # Save final state
    if save_automatically:
        _save_progress()

# Skip the entire tutorial
func skip_tutorial() -> void:
    if not allow_skip:
        push_warning("Skipping not allowed for this tutorial")
        return

    _is_active = false
    _is_completed = false  # Not really completed, just skipped

    tutorial_skipped.emit(tutorial_id)
    print("TutorialProgress: Skipped tutorial '%s'" % tutorial_id)

# Restart the tutorial
func restart_tutorial() -> void:
    _is_active = false
    _is_completed = false
    _current_step_index = 0
    _completed_steps.clear()
    _skipped_steps.clear()
    _step_data.clear()

    start_tutorial()

## Public Methods - Step Management

# Add a step to the tutorial
func add_step(step: TutorialStep) -> void:
    _step_data[step.id] = step
    total_steps = _step_data.size()

# Create and add a step inline
func add_step_inline(
    id: String,
    title: String,
    description: String,
    action_prompt: String = "",
    optional: bool = false
) -> TutorialStep:
    var step = TutorialStep.new(id, title, description, action_prompt)
    step.optional = optional
    add_step(step)
    return step

# Get a step by ID
func get_step(step_id: String) -> TutorialStep:
    return _step_data.get(step_id)

# Get the current step
func get_current_step() -> TutorialStep:
    if _current_step_index < 0 or _current_step_index >= total_steps:
        return null
    var step_keys = _step_data.keys()
    return _step_data.get(step_keys[_current_step_index])

# Get the current step ID
func get_current_step_id() -> String:
    var step = get_current_step()
    return step.id if step else ""

# Go to a specific step
func go_to_step(step_id: String) -> void:
    var step_index = _get_step_index(step_id)
    if step_index >= 0:
        _reach_step(step_index)

# Go to the next step
func next_step() -> void:
    if _current_step_index < total_steps - 1:
        _reach_step(_current_step_index + 1)

# Go to the previous step
func previous_step() -> void:
    if _current_step_index > 0:
        _reach_step(_current_step_index - 1)

## Public Methods - Query State

# Check if tutorial is active
func is_active() -> bool:
    return _is_active

# Check if tutorial is completed
func is_completed() -> bool:
    return _is_completed

# Check if a specific step is completed
func is_step_completed(step_id: String) -> bool:
    return _completed_steps.has(step_id)

# Check if a specific step was skipped
func is_step_skipped(step_id: String) -> bool:
    return _skipped_steps.has(step_id)

# Get completion percentage
func get_completion_percentage() -> float:
    if total_steps == 0:
        return 0.0

    var required = required_steps if required_steps > 0 else total_steps
    return float(_completed_steps.size()) / float(required) * 100.0

# Get progress summary
func get_progress_summary() -> Dictionary:
    return {
        "tutorial_id": tutorial_id,
        "tutorial_name": tutorial_name,
        "is_active": _is_active,
        "is_completed": _is_completed,
        "current_step": get_current_step_id(),
        "current_step_index": _current_step_index,
        "completed_steps": _completed_steps.size(),
        "total_steps": total_steps,
        "completion_percentage": get_completion_percentage(),
        "started_at": _started_at,
        "last_activity": _last_activity,
        "time_spent": _last_activity - _started_at if _started_at > 0 else 0
    }

# Get all completed steps
func get_completed_steps() -> PackedStringArray:
    return _completed_steps.duplicate()

# Get all skipped steps
func get_skipped_steps() -> PackedStringArray:
    return _skipped_steps.duplicate()

## Public Methods - Persistence

# Save progress to disk
func save_progress() -> void:
    _save_progress()

# Load progress from disk
func load_progress() -> void:
    _load_progress()

# Clear saved progress
func clear_saved_progress() -> void:
    var file_path = _get_save_path()
    if FileAccess.file_exists(file_path):
        DirAccess.remove_absolute(file_path)
        print("TutorialProgress: Cleared saved progress for '%s'" % tutorial_id)

## Private Methods

func _reach_step(step_index: int) -> void:
    if step_index < 0 or step_index >= total_steps:
        return

    var previous_index = _current_step_index
    _current_step_index = step_index
    _last_activity = Time.get_unix_time_from_system()

    var step = get_current_step()
    if step:
        step_reached.emit(step.id, step_index)
        print("TutorialProgress: Reached step '%s' (index %d)" % [step.id, step_index])

func _advance_to_next_step() -> void:
    # Find next uncompleted step
    var step_keys = _step_data.keys()

    for i in range(_current_step_index + 1, total_steps):
        var step_id = step_keys[i]
        var step = _step_data[step_id]
        if step.optional or not _completed_steps.has(step_id):
            _reach_step(i)
            return

    # No more uncompleted steps
    if _check_completion():
        complete_tutorial()

func _check_completion() -> bool:
    var required = required_steps if required_steps > 0 else total_steps
    return _completed_steps.size() >= required

func _get_step_index(step_id: String) -> int:
    var step_keys = _step_data.keys()
    return step_keys.find(step_id)

func _get_save_path() -> String:
    return DEFAULT_STORAGE_PATH.path_join("%s.json" % tutorial_id)

func _save_progress() -> void:
    var data = {
        "version": PROGRESS_VERSION,
        "tutorial_id": tutorial_id,
        "tutorial_name": tutorial_name,
        "current_step_index": _current_step_index,
        "completed_steps": _completed_steps,
        "skipped_steps": _skipped_steps,
        "is_completed": _is_completed,
        "timestamp": Time.get_unix_time_from_system()
    }

    var dir = DirAccess.open(DEFAULT_STORAGE_PATH)
    if not dir:
        dir = DirAccess.open("user://")
        if dir:
            dir.make_dir("tutorials")

    var file = FileAccess.open(_get_save_path(), FileAccess.WRITE)
    if file:
        file.store_string(JSON.stringify(data))
        file.close()

func _load_progress() -> void:
    var file_path = _get_save_path()
    if not FileAccess.file_exists(file_path):
        return

    var file = FileAccess.open(file_path, FileAccess.READ)
    if not file:
        return

    var json_string = file.get_as_text()
    file.close()

    var json = JSON.new()
    if json.parse(json_string) != OK:
        return

    var data = json.data

    if data.get("version") != PROGRESS_VERSION:
        push_warning("Tutorial progress version mismatch")
        return

    if data.get("tutorial_id") != tutorial_id:
        return

    _current_step_index = data.get("current_step_index", 0)
    _completed_steps = data.get("completed_steps", [])
    _skipped_steps = data.get("skipped_steps", [])
    _is_completed = data.get("is_completed", false)

    print("TutorialProgress: Loaded progress for '%s'" % tutorial_id)


## Tutorial Manager (Autoload)

# Global tutorial manager for managing multiple tutorials
class_name TutorialManager
extends Node

static var _instance: TutorialManager = null

var _active_tutorials: Dictionary = {}  # tutorial_id -> TutorialProgress
var _tutorial_registry: Dictionary = {}  # tutorial_id -> definition

func _init() -> void:
    if _instance != null:
        return
    _instance = self

static func instance() -> TutorialManager:
    if _instance == null:
        _instance = TutorialManager.new()
    return _instance

# Register a tutorial definition
func register_tutorial(definition: Dictionary) -> void:
    var id = definition.get("id", "")
    if id == "":
        push_error("Tutorial definition must have an id")
        return

    _tutorial_registry[id] = definition
    print("TutorialManager: Registered tutorial '%s'" % id)

# Start a tutorial by ID
func start_tutorial(tutorial_id: String) -> TutorialProgress:
    if _active_tutorials.has(tutorial_id):
        var existing = _active_tutorials[tutorial_id]
        if existing.is_active():
            return existing
        existing.restart_tutorial()
        return existing

    var progress = TutorialProgress.new(tutorial_id)
    _active_tutorials[tutorial_id] = progress

    # Load tutorial definition
    if _tutorial_registry.has(tutorial_id):
        _apply_definition(progress, _tutorial_registry[tutorial_id])

    progress.start_tutorial()
    return progress

# Get a tutorial's progress
func get_tutorial_progress(tutorial_id: String) -> TutorialProgress:
    return _active_tutorials.get(tutorial_id)

# Check if a tutorial is completed
func is_tutorial_completed(tutorial_id: String) -> bool:
    var progress = _active_tutorials.get(tutorial_id)
    if progress:
        return progress.is_completed()

    # Try loading from disk
    progress = TutorialProgress.new(tutorial_id)
    return progress.is_completed()

# Get all completed tutorials
func get_completed_tutorials() -> PackedStringArray:
    var completed: PackedStringArray = []
    for tutorial_id in _tutorial_registry.keys():
        if is_tutorial_completed(tutorial_id):
            completed.append(tutorial_id)
    return completed

func _apply_definition(progress: TutorialProgress, definition: Dictionary) -> void:
    progress.tutorial_name = definition.get("name", "")
    progress.total_steps = definition.get("steps", []).size()
    progress.required_steps = definition.get("required_steps", -1)
    progress.allow_skip = definition.get("allow_skip", true)

    for step_def in definition.get("steps", []):
        var step = TutorialStep.new(
            step_def.get("id", ""),
            step_def.get("title", ""),
            step_def.get("description", ""),
            step_def.get("action_prompt", "")
        )
        step.highlight_node_path = NodePath(step_def.get("highlight_node", ""))
        step.completion_trigger = step_def.get("completion_trigger", "")
        step.hint_text = step_def.get("hint", "")
        step.hint_delay = step_def.get("hint_delay", 5.0)
        step.optional = step_def.get("optional", false)
        progress.add_step(step)
