# event_bus.gd
# Event Bus Pattern for StudyLoG.AI
# Provides a global event system for cross-node communication
#
# Usage:
#   # In any node:
#   EventBus.emit_signal("player_health_changed", {"health": 75, "max": 100})
#   EventBus.player_died.connect(_on_player_died)
#   EventBus.register_event("custom_event")
#   EventBus.emit("custom_event", {"data": "value"})

class_name EventBus
extends Node

## Singleton instance
static var _instance: EventBus = null

## Event tracking
var _registered_events: Dictionary = {}  # event_name -> Array of listeners
var _event_history: Array = []  # Last N events for debugging
var _history_limit: int = 100

## Statistics
var _emit_count: int = 0
var _listener_count: int = 0

## Debug
var debug_mode: bool = false
var log_events: bool = false

## Built-in Methods

func _init() -> void:
    if _instance != null:
        push_error("EventBus already exists. Use EventBus.instance() instead.")
        return

    _instance = self
    _register_core_events()

func _ready() -> void:
    # Keep EventBus across scene changes
    process_mode = Node.PROCESS_MODE_ALWAYS

## Public Methods - Singleton

# Get the singleton instance
static func instance() -> EventBus:
    if _instance == null:
        _instance = EventBus.new()
    return _instance

# Ensure EventBus exists in the scene tree
static func ensure_in_scene(scene: Node) -> EventBus:
    var bus = instance()
    if bus.get_parent() == null:
        scene.add_child(bus)
        bus.name = "EventBus"
    return bus

## Public Methods - Event Registration

# Register a custom event
func register_event(event_name: String) -> void:
    if not _registered_events.has(event_name):
        _registered_events[event_name] = []
        if debug_mode:
            print("EventBus: Registered event '%s'" % event_name)

# Unregister an event (removes all listeners)
func unregister_event(event_name: String) -> void:
    if _registered_events.has(event_name):
        for listener in _registered_events[event_name]:
            if listener.signal is Signal:
                listener.signal.disconnect(listener.callback)
        _registered_events.erase(event_name)
        if debug_mode:
            print("EventBus: Unregistered event '%s'" % event_name)

# Check if an event is registered
func is_registered(event_name: String) -> bool:
    return _registered_events.has(event_name)

# Get all registered events
func get_registered_events() -> Array:
    return _registered_events.keys()

## Public Methods - Event Subscription

# Subscribe to an event with a callback
func subscribe(event_name: String, callback: Callable) -> void:
    register_event(event_name)
    _registered_events[event_name].append({
        "signal": null,
        "callback": callback
    })
    _listener_count += 1

    if debug_mode:
        print("EventBus: Subscribed to '%s'" % event_name)

# Unsubscribe from an event
func unsubscribe(event_name: String, callback: Callable) -> void:
    if not _registered_events.has(event_name):
        return

    var listeners = _registered_events[event_name]
    for i in range(listeners.size() - 1, -1, -1):
        if listeners[i].callback == callback:
            listeners.remove_at(i)
            _listener_count -= 1
            break

    if debug_mode:
        print("EventBus: Unsubscribed from '%s'" % event_name)

## Public Methods - Event Emission

# Emit an event with data
func emit(event_name: String, data: Dictionary = {}) -> void:
    if not _registered_events.has(event_name):
        if debug_mode:
            push_warning("EventBus: Emitting unregistered event '%s'" % event_name)
        return

    _emit_count += 1

    # Log event
    if log_events or debug_mode:
        var log_entry = {
            "event": event_name,
            "data": data,
            "timestamp": Time.get_unix_time_from_system()
        }
        _event_history.append(log_entry)
        if _event_history.size() > _history_limit:
            _event_history.pop_front()

    # Notify all listeners
    for listener in _registered_events[event_name]:
        if listener.callback.is_valid():
            listener.callback.call(data)

# Emit an event and wait for all callbacks to complete
func emit_and_wait(event_name: String, data: Dictionary = {}) -> void:
    emit(event_name, data)
    await get_tree().process_frame
    await get_tree().process_frame  # Wait a second frame to ensure processing

## Public Methods - Utility

# Clear all event listeners
func clear_all() -> void:
    for event_name in _registered_events.keys():
        unregister_event(event_name)
    _event_history.clear()
    _emit_count = 0
    _listener_count = 0

    if debug_mode:
        print("EventBus: Cleared all events")

# Get event statistics
func get_stats() -> Dictionary:
    return {
        "registered_events": _registered_events.size(),
        "total_emits": _emit_count,
        "total_listeners": _listener_count,
        "history_size": _event_history.size()
    }

# Get event history
func get_history() -> Array:
    return _event_history.duplicate()

# Get listener count for an event
func get_listener_count(event_name: String) -> int:
    if _registered_events.has(event_name):
        return _registered_events[event_name].size()
    return 0

# Enable debug mode
func set_debug(enabled: bool) -> void:
    debug_mode = enabled

# Enable event logging
func set_logging(enabled: bool) -> void:
    log_events = enabled

## Private Methods

func _register_core_events() -> void:
    # Core StudyLoG.AI events
    var core_events = [
        # Learning events
        "lesson_started",
        "lesson_completed",
        "exercise_started",
        "exercise_completed",
        "hint_requested",
        "hint_used",

        # Progression events
        "level_up",
        "xp_gained",
        "achievement_unlocked",
        "stage_unlocked",

        # Agent events
        "agent_spawned",
        "agent_despawned",
        "agent_state_changed",
        "agent_behavior_changed",

        # Scene events
        "scene_loaded",
        "scene_saved",
        "scene_transition_started",
        "scene_transition_completed",

        # Tutorial events
        "tutorial_started",
        "tutorial_step_completed",
        "tutorial_completed",
        "tutorial_skipped",

        # UI events
        "panel_opened",
        "panel_closed",
        "button_clicked",
        "slider_changed",

        # System events
        "save_created",
        "save_loaded",
        "settings_changed",
        "error_occurred"
    ]

    for event in core_events:
        register_event(event)


## Core Signal Definitions
## These are pre-defined signals for common StudyLoG.AI events

# Learning Events
signal lesson_started(lesson_id: String, title: String)
signal lesson_completed(lesson_id: String, score: float)
signal exercise_started(exercise_id: String)
signal exercise_completed(exercise_id: String, success: bool, xp: int)

# Progression Events
signal xp_gained(amount: int, total: int)
signal level_up(new_level: int)
signal achievement_unlocked(achievement_id: String, title: String)
signal stage_unlocked(stage: String)

# Agent Events
signal agent_spawned(agent_id: String, agent_type: String, position: Vector3)
signal agent_despawned(agent_id: String)
signal agent_state_changed(agent_id: String, old_state: String, new_state: String)

# Tutorial Events
signal tutorial_started(tutorial_id: String)
signal tutorial_step_completed(tutorial_id: String, step: int)
signal tutorial_completed(tutorial_id: String)

# System Events
signal error_occurred(error_code: String, message: String)
signal save_created(slot: int)
signal save_loaded(slot: int)


## Static convenience methods

# Connect to a core signal
static func connect(signal_name: String, callable: Callable, flags: int = 0) -> void:
    var bus = instance()
    if bus.has_signal(signal_name):
        bus.connect(signal_name, callable, flags)

# Emit a core signal
static func emit_signal(signal_name: String, args: Array = []) -> void:
    var bus = instance()
    if bus.has_signal(signal_name):
        bus.emit_signal(signal_name, args)
    else:
        bus.emit(signal_name, {"args": args})
