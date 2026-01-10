# GDScript Pattern Library

This directory contains reusable GDScript patterns for StudyLoG.AI Godot projects.

## Patterns

### state_machine.gd
Hierarchical state machine for AI agents and game entities.

**Features:**
- Hierarchical states with parent-child relationships
- State enter/exit/update callbacks
- Transition validation
- State data storage
- Debug mode

**Usage:**
```gdscript
extends StateMachine

func _ready():
    add_state("idle")
    add_state("walking")
    add_state("running")
    set_initial_state("idle")

func _state_logic(delta):
    match state:
        "walking":
            move(delta, walk_speed)
        "running":
            move(delta, run_speed)
```

### event_bus.gd
Global event system for cross-node communication.

**Features:**
- Event registration and emission
- Signal-based and callback-based subscriptions
- Event history for debugging
- Core StudyLoG.AI events pre-defined

**Usage:**
```gdscript
# Emit an event
EventBus.emit("player_health_changed", {"health": 75})

# Subscribe to events
EventBus.player_died.connect(_on_player_died)

# Custom events
EventBus.register_event("custom_event")
EventBus.subscribe("custom_event", _on_custom_event)
```

### save_system.gd
Robust save system with autosave and encryption.

**Features:**
- Multiple save slots
- Autosave with configurable interval
- JSON serialization
- Optional encryption
- Scene state persistence

**Usage:**
```gdscript
# Initialize
SaveSystem.initialize("user://saves/")
SaveSystem.autosave_enabled = true

# Save data
SaveSystem.save_slot(0, {
    "level": 5,
    "xp": 1000,
    "player_position": player.global_position
})

# Load data
var data = SaveSystem.load_slot(0)
```

### tutorial_progress.gd
Tutorial progression tracker with persistence.

**Features:**
- Step-by-step tutorial tracking
- Completion detection
- Skippable tutorials
- Progress persistence
- Tutorial manager for multiple tutorials

**Usage:**
```gdscript
var tutorial = TutorialProgress.new("basics_movement")
tutorial.step_reached.connect(_on_step_reached)
tutorial.start_tutorial()

func _on_step_reached(step_id: String):
    show_tooltip(tutorial.get_current_step())
```

## Integration

Add these patterns to your Godot project by copying them to `res://addons/studylog/patterns/`.

To make them available globally, add to your project's `project.godot`:

```ini
[autoload]
StateMachine="*res://addons/studylog/patterns/state_machine.gd"
EventBus="*res://addons/studylog/patterns/event_bus.gd"
SaveSystem="*res://addons/studylog/patterns/save_system.gd"
TutorialProgress="*res://addons/studylog/patterns/tutorial_progress.gd"
```
