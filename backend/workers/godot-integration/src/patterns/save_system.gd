# save_system.gd
# Save/Load System with JSON Serialization for StudyLoG.AI
# Provides a robust save system with autosave, multiple slots, and encryption
#
# Usage:
#   extends Node
#   func _ready():
#       SaveSystem.initialize("user://saves/")
#       SaveSystem.autosave_enabled = true
#
#   func save_game():
#       SaveSystem.save_slot(0, {"level": 5, "xp": 1000})

class_name SaveSystem
extends Node

## Constants
const SAVE_VERSION: int = 1
const METADATA_FILE: String = "metadata.json"
const MAX_SAVE_SLOTS: int = 10

## Signals
signal save_completed(slot: int, success: bool)
signal load_completed(slot: int, data: Dictionary, success: bool)
signal autosave_triggered(slot: int)

## Exported Variables
@export_category("Save System")
@export var autosave_enabled: bool = true
@export var autosave_interval: float = 300.0  # 5 minutes
@export var slot_count: int = 5
@export var encryption_enabled: bool = false
@export var encryption_key: String = "studylog_default_key"

## Private Variables
static var _instance: SaveSystem = null
var _save_directory: String = "user://saves/"
var _autosave_timer: Timer = null
var _metadata: Dictionary = {}
var _pending_save: Dictionary = {}
var _is_saving: bool = false

## Built-in Methods

func _init() -> void:
    if _instance != null:
        push_error("SaveSystem already exists. Use SaveSystem.instance() instead.")
        return
    _instance = self

func _ready() -> void:
    # Keep SaveSystem across scene changes
    process_mode = Node.PROCESS_MODE_ALWAYS

    # Create save directory
    _ensure_save_directory()

    # Load metadata
    _load_metadata()

    # Setup autosave timer
    if autosave_enabled:
        _setup_autosave()

func _exit_tree() -> void:
    # Save metadata on exit
    _save_metadata()

## Public Methods - Singleton

# Initialize the save system
static func initialize(save_dir: String = "user://saves/") -> SaveSystem:
    var instance = instance()
    instance._save_directory = save_dir
    instance._ensure_save_directory()
    instance._load_metadata()
    return instance

# Get the singleton instance
static func instance() -> SaveSystem:
    if _instance == null:
        _instance = SaveSystem.new()
    return _instance

## Public Methods - Save/Load

# Save data to a specific slot
func save_slot(slot: int, data: Dictionary, description: String = "") -> void:
    if slot < 0 or slot >= slot_count:
        push_error("Invalid save slot: %d" % slot)
        save_completed.emit(slot, false)
        return

    if _is_saving:
        # Queue the save for later
        _pending_save[slot] = {"data": data, "description": description}
        return

    _is_saving = true

    var save_data = {
        "version": SAVE_VERSION,
        "timestamp": Time.get_datetime_string_from_system(),
        "unix_timestamp": Time.get_unix_time_from_system(),
        "description": description,
        "data": data
    }

    # Add scene info
    if get_tree().current_scene:
        save_data["scene"] = get_tree().current_scene.scene_file_path

    var file_path = _get_slot_path(slot)
    var json_string = JSON.stringify(save_data)

    # Encrypt if enabled
    if encryption_enabled:
        json_string = _encrypt(json_string)

    var file = FileAccess.open(file_path, FileAccess.WRITE)
    if file:
        file.store_string(json_string)
        file.close()

        # Update metadata
        _metadata[str(slot)] = {
            "timestamp": save_data["timestamp"],
            "unix_timestamp": save_data["unix_timestamp"],
            "description": description,
            "scene": save_data.get("scene", "")
        }
        _save_metadata()

        if autosave_enabled:
            save_completed.emit(slot, true)

        print("SaveSystem: Saved to slot %d" % slot)
    else:
        push_error("SaveSystem: Failed to open file for writing: %s" % file_path)
        save_completed.emit(slot, false)

    _is_saving = false

    # Process pending save
    if not _pending_save.is_empty():
        var pending = _pending_save
        _pending_save.clear()
        for slot_key in pending.keys():
            save_slot(int(slot_key), pending[slot_key].data, pending[slot_key].description)

# Load data from a specific slot
func load_slot(slot: int) -> Dictionary:
    if slot < 0 or slot >= slot_count:
        push_error("Invalid save slot: %d" % slot)
        load_completed.emit(slot, {}, false)
        return {}

    var file_path = _get_slot_path(slot)
    var file = FileAccess.open(file_path, FileAccess.READ)

    if not file:
        push_error("SaveSystem: No save found in slot %d" % slot)
        load_completed.emit(slot, {}, false)
        return {}

    var json_string = file.get_as_text()
    file.close()

    # Decrypt if enabled
    if encryption_enabled:
        json_string = _decrypt(json_string)

    var json = JSON.new()
    var error = json.parse(json_string)

    if error != OK:
        push_error("SaveSystem: Failed to parse save file")
        load_completed.emit(slot, {}, false)
        return {}

    var save_data = json.data

    # Verify version
    if save_data.get("version") != SAVE_VERSION:
        push_warning("SaveSystem: Save version mismatch. Attempting to load anyway...")

    # Load scene if specified
    if save_data.has("scene") and save_data.scene != "":
        get_tree().change_scene_to_file(save_data.scene)

    load_completed.emit(slot, save_data.get("data", {}), true)
    print("SaveSystem: Loaded from slot %d" % slot)

    return save_data.get("data", {})

# Delete a save slot
func delete_slot(slot: int) -> void:
    if slot < 0 or slot >= slot_count:
        push_error("Invalid save slot: %d" % slot)
        return

    var file_path = _get_slot_path(slot)
    if FileAccess.file_exists(file_path):
        DirAccess.remove_absolute(file_path)
        _metadata.erase(str(slot))
        _save_metadata()
        print("SaveSystem: Deleted slot %d" % slot)

# Check if a slot has a save
func has_save(slot: int) -> bool:
    if slot < 0 or slot >= slot_count:
        return false
    return FileAccess.file_exists(_get_slot_path(slot))

# Get metadata for all slots
func get_slot_metadata() -> Dictionary:
    return _metadata.duplicate()

# Get metadata for a specific slot
func get_slot_info(slot: int) -> Dictionary:
    return _metadata.get(str(slot), {})

# Get the most recently used slot
func get_latest_slot() -> int:
    var latest_slot = -1
    var latest_time = 0.0

    for slot in range(slot_count):
        var info = _metadata.get(str(slot), {})
        if info.has("unix_timestamp"):
            if info.unix_timestamp > latest_time:
                latest_time = info.unix_timestamp
                latest_slot = slot

    return latest_slot

# Autosave to the last used slot
func autosave() -> void:
    var slot = get_latest_slot()
    if slot < 0:
        slot = 0

    autosave_triggered.emit(slot)

    # Collect data from current scene
    var data = _collect_save_data()
    save_slot(slot, data, "Autosave")

## Public Methods - Quick Access

# Quick save (saves to slot 0 or last used slot)
func quick_save() -> void:
    var slot = get_latest_slot()
    if slot < 0:
        slot = 0

    var data = _collect_save_data()
    save_slot(slot, data, "Quick Save")

# Quick load (loads from slot 0 or last used slot)
func quick_load() -> void:
    var slot = get_latest_slot()
    if slot < 0:
        slot = 0

    load_slot(slot)

## Public Methods - Configuration

# Set autosave interval in seconds
func set_autosave_interval(seconds: float) -> void:
    autosave_interval = seconds
    if _autosave_timer:
        _autosave_timer.wait_time = seconds

# Enable or disable autosave
func set_autosave_enabled(enabled: bool) -> void:
    autosave_enabled = enabled
    if enabled:
        _setup_autosave()
    elif _autosave_timer:
        _autosave_timer.stop()

# Set the save directory
func set_save_directory(path: String) -> void:
    _save_directory = path
    _ensure_save_directory()

## Public Methods - Data Collection

# Collect save data from the current scene
# Override in scene scripts to provide custom data
func _collect_save_data() -> Dictionary:
    var data = {}

    # Collect from current scene if it implements get_save_data
    if get_tree().current_scene and get_tree().current_scene.has_method("get_save_data"):
        data = get_tree().current_scene.call("get_save_data")
    else:
        # Default: collect basic info
        data = {
            "scene": get_tree().current_scene.scene_file_path if get_tree().current_scene else "",
            "player": {},
            "world": {}
        }

    return data

# Apply loaded data to the current scene
# Override in scene scripts to handle custom data
func _apply_save_data(data: Dictionary) -> void:
    if get_tree().current_scene and get_tree().current_scene.has_method("load_save_data"):
        get_tree().current_scene.call("load_save_data", data)

## Private Methods

func _ensure_save_directory() -> void:
    var dir = DirAccess.open(_save_directory)
    if not dir:
        dir = DirAccess.open("user://")
        if dir:
            dir.make_dir(_save_directory.trim_prefix("user://"))

func _get_slot_path(slot: int) -> String:
    return _save_directory.path_join("save_%d.json" % slot)

func _save_metadata() -> void:
    var file_path = _save_directory.path_join(METADATA_FILE)
    var file = FileAccess.open(file_path, FileAccess.WRITE)
    if file:
        file.store_string(JSON.stringify(_metadata))
        file.close()

func _load_metadata() -> void:
    var file_path = _save_directory.path_join(METADATA_FILE)
    if not FileAccess.file_exists(file_path):
        return

    var file = FileAccess.open(file_path, FileAccess.READ)
    if file:
        var json_string = file.get_as_text()
        file.close()

        var json = JSON.new()
        if json.parse(json_string) == OK:
            _metadata = json.data

func _setup_autosave() -> void:
    if not _autosave_timer:
        _autosave_timer = Timer.new()
        _autosave_timer.timeout.connect(_on_autosave_timeout)
        add_child(_autosave_timer)

    _autosave_timer.wait_time = autosave_interval
    _autosave_timer.autostart = true
    _autosave_timer.start()

func _on_autosave_timeout() -> void:
    autosave()

func _encrypt(text: String) -> String:
    # Simple XOR encryption (replace with proper encryption in production)
    var key_bytes = encryption_key.to_utf8_buffer()
    var text_bytes = text.to_utf8_buffer()
    var encrypted = PackedByteArray()

    for i in range(text_bytes.size()):
        encrypted.append(text_bytes[i] ^ key_bytes[i % key_bytes.size()])

    return Marshalls.raw_to_base64(encrypted)

func _decrypt(text: String) -> String:
    var key_bytes = encryption_key.to_utf8_buffer()
    var encrypted = Marshalls.base64_to_raw(text)
    var decrypted = PackedByteArray()

    for i in range(encrypted.size()):
        decrypted.append(encrypted[i] ^ key_bytes[i % key_bytes.size()])

    return decrypted.get_string_from_utf8()


## Utility functions for common save data

# Serialize a Vector3
static func serialize_vector3(v: Vector3) -> Dictionary:
    return {"x": v.x, "y": v.y, "z": v.z}

# Deserialize a Vector3
static func deserialize_vector3(d: Dictionary) -> Vector3:
    return Vector3(d.get("x", 0), d.get("y", 0), d.get("z", 0))

# Serialize a Color
static func serialize_color(c: Color) -> Dictionary:
    return {"r": c.r, "g": c.g, "b": c.b, "a": c.a}

# Deserialize a Color
static func deserialize_color(d: Dictionary) -> Color:
    return Color(d.get("r", 1), d.get("g", 1), d.get("b", 1), d.get("a", 1))

# Serialize a Node path
static func serialize_node_path(node: Node) -> String:
    return node.get_path()

# Find a node by saved path
static func deserialize_node_path(path: String) -> Node:
    return get_node_or_null(path)
