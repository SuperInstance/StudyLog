# state_machine.gd
# State Machine Pattern for StudyLoG.AI
# Implements a hierarchical state machine for AI agents and game entities
#
# Usage:
#   extends StateMachine
#   func _ready():
#       add_state("idle")
#       add_state("walking")
#       add_state("running")
#       add_state("jumping", "airborne")  # parent state
#       set_initial_state("idle")
#
#   func _state_logic(delta):
#       match state:
#           "walking":
#               move(delta, walk_speed)
#           "running":
#               move(delta, run_speed)

class_name StateMachine
extends Node

## Signals
signal state_changed(previous_state: String, new_state: String)
signal state_entered(state: String)
signal state_exited(state: String)

## Exported Variables
@export_category("State Machine")
@export var debug_mode: bool = false
@export var auto_start: bool = true
@export var initial_state: String = ""

## Private Variables
var _states: Dictionary = {}  # state_name -> {parent, enter, exit, update}
var _current_state: String = ""
var _previous_state: String = ""
var _state_data: Dictionary = {}  # Per-state data storage
var _transition_queue: Array = []  # Queued transitions
var _is_transitioning: bool = false

## Built-in Methods

func _ready() -> void:
    if auto_start and initial_state != "":
        set_initial_state(initial_state)

func _process(delta: float) -> void:
    if _current_state == "":
        return

    # Process queued transitions
    _process_transition_queue()

    # Call state update
    var state_info = _states.get(_current_state)
    if state_info and state_info.has("update"):
        if state_info.update is Callable:
            state_info.update.call(delta)

    # Call state logic (can be overridden)
    _state_logic(delta)

## Public Methods

# Add a state to the state machine
func add_state(
    state_name: String,
    parent_state: String = "",
    enter_fn: Callable = Callable(),
    exit_fn: Callable = Callable(),
    update_fn: Callable = Callable()
) -> void:
    _states[state_name] = {
        "parent": parent_state,
        "enter": enter_fn,
        "exit": exit_fn,
        "update": update_fn
    }

    if not _state_data.has(state_name):
        _state_data[state_name] = {}

    if debug_mode:
        print("StateMachine: Added state '%s'" % state_name)

# Remove a state from the state machine
func remove_state(state_name: String) -> void:
    if _current_state == state_name:
        push_error("Cannot remove current state")
        return

    _states.erase(state_name)
    _state_data.erase(state_name)

    if debug_mode:
        print("StateMachine: Removed state '%s'" % state_name)

# Set the initial state and start the state machine
func set_initial_state(state_name: String) -> void:
    if not _states.has(state_name):
        push_error("State not found: %s" % state_name)
        return

    initial_state = state_name
    _change_state(state_name)

# Transition to a new state
func transition_to(state_name: String, data: Dictionary = {}) -> void:
    if not _states.has(state_name):
        push_error("State not found: %s" % state_name)
        return

    if state_name == _current_state:
        return

    # Queue the transition
    _transition_queue.append({"state": state_name, "data": data})

# Queue a transition for the next frame
func queue_transition(state_name: String, data: Dictionary = {}) -> void:
    _transition_queue.append({"state": state_name, "data": data})

# Check if a transition is valid (state exists and not current)
func can_transition_to(state_name: String) -> bool:
    return _states.has(state_name) and state_name != _current_state

# Get the current state name
func get_current_state() -> String:
    return _current_state

# Get the previous state name
func get_previous_state() -> String:
    return _previous_state

# Check if currently in a specific state (or its children)
func is_in_state(state_name: String) -> bool:
    if _current_state == state_name:
        return true

    # Check if current state is a child of the specified state
    var current_info = _states.get(_current_state)
    while current_info and current_info.parent != "":
        if current_info.parent == state_name:
            return true
        current_info = _states.get(current_info.parent)

    return false

# Get data stored for a state
func get_state_data(state_name: String = "", key: String = "") -> Variant:
    var target_state = state_name if state_name != "" else _current_state
    if target_state == "":
        return null

    var data = _state_data.get(target_state, {})
    if key != "":
        return data.get(key)
    return data

# Set data for a state
func set_state_data(value: Variant, state_name: String = "", key: String = "") -> void:
    var target_state = state_name if state_name != "" else _current_state
    if target_state == "":
        return

    if not _state_data.has(target_state):
        _state_data[target_state] = {}

    if key != "":
        _state_data[target_state][key] = value
    else:
        _state_data[target_state] = value

# Get all state names
func get_states() -> Array:
    return _states.keys()

# Check if a state exists
func has_state(state_name: String) -> bool:
    return _states.has(state_name)

# Get parent of a state
func get_state_parent(state_name: String) -> String:
    var state_info = _states.get(state_name)
    return state_info.parent if state_info else ""

# Get all children of a state
func get_state_children(parent_state: String) -> Array:
    var children: Array = []
    for state_name in _states.keys():
        var state_info = _states[state_name]
        if state_info.parent == parent_state:
            children.append(state_name)
    return children

## Virtual Methods (Override in subclasses)

# Called every frame for current state logic
func _state_logic(delta: float) -> void:
    pass

# Called when entering a state (before state's enter function)
func _on_state_entered(state: String) -> void:
    pass

# Called when exiting a state (after state's exit function)
func _on_state_exited(state: String) -> void:
    pass

# Called when checking if a transition is allowed
func _can_transition(from: String, to: String) -> bool:
    return true

## Private Methods

func _process_transition_queue() -> void:
    if _is_transitioning or _transition_queue.is_empty():
        return

    var transition = _transition_queue.pop_front()
    _change_state(transition.state, transition.data)

func _change_state(new_state: String, data: Dictionary = {}) -> void:
    if _current_state == new_state:
        return

    # Check if transition is allowed
    if not _can_transition(_current_state, new_state):
        if debug_mode:
            print("StateMachine: Transition from '%s' to '%s' not allowed" % [_current_state, new_state])
        return

    _is_transitioning = true
    var old_state = _current_state
    _previous_state = _current_state
    _current_state = new_state

    if debug_mode:
        print("StateMachine: %s -> %s" % [old_state, new_state])

    # Exit current state and all parent states
    _exit_state_chain(old_state)

    # Enter new state and all parent states
    _enter_state_chain(new_state, data)

    # Emit signals
    state_changed.emit(old_state, new_state)

    _is_transitioning = false

func _exit_state_chain(state: String) -> void:
    var current = state
    var exited: Array = []

    while current != "":
        if not exited.has(current):
            _exit_state(current)
            exited.append(current)
        current = _states.get(current, {}).get("parent", "")

func _enter_state_chain(state: String, data: Dictionary) -> void:
    # Build chain from root to target
    var chain: Array = []
    var current = state

    while current != "":
        chain.push_front(current)
        current = _states.get(current, {}).get("parent", "")

    # Enter each state in chain
    for state_name in chain:
        _enter_state(state_name, data)

func _exit_state(state: String) -> void:
    var state_info = _states.get(state)
    if not state_info:
        return

    # Call state's exit function
    if state_info.exit is Callable:
        state_info.exit.call()

    # Emit signal
    state_exited.emit(state)

    # Call virtual method
    _on_state_exited(state)

func _enter_state(state: String, data: Dictionary) -> void:
    var state_info = _states.get(state)
    if not state_info:
        return

    # Call state's enter function
    if state_info.enter is Callable:
        state_info.enter.call(data)

    # Emit signal
    state_entered.emit(state)

    # Call virtual method
    _on_state_entered(state)


## Utility State Classes

# Base class for individual states
class State:
    extends RefCounted

    var name: String
    var parent: State = null

    func _init(state_name: String, parent_state: State = null):
        name = state_name
        parent = parent_state

    virtual func enter(data: Dictionary = {}) -> void:
        pass

    virtual func exit() -> void:
        pass

    virtual func update(delta: float) -> void:
        pass

    virtual func can_transition_to(other_state: State) -> bool:
        return true
