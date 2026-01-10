# TheiaBridge.gd
# Communication bridge between Theia IDE and Godot Engine
# Part of StudyLoG.AI Godot Integration

extends Node

## Signals
signal message_received(message: Dictionary)
signal connected()
signal disconnected()

## Constants
const DEFAULT_PORT = 9876
const MAX_RECONNECT_ATTEMPTS = 5

## Exported Variables
@export var port: int = DEFAULT_PORT
@export var auto_reconnect: bool = true
@export var debug_mode: bool = false

## Private Variables
var _websocket: WebSocketPeer = WebSocketPeer.new()
var _server: TCPServer = TCPServer.new()
var _connected_peers: Array = []
var _reconnect_attempts: int = 0
var _agent_registry: Dictionary = {}
var _next_agent_id: int = 0

## Built-in Methods

func _ready() -> void:
    print("TheiaBridge: Initializing...")
    _start_server()

func _process(_delta: float) -> void:
    _poll_server()
    _process_websockets()

func _exit_tree() -> void:
    _cleanup()

## Public Methods

# Send a message to all connected Theia clients
func send_json(message: Dictionary) -> void:
    var json_string = JSON.stringify(message)
    if debug_mode:
        print("TheiaBridge sending: ", json_string)

    for peer_id in _connected_peers:
        _send_to_peer(peer_id, json_string)

# Send message to specific peer
func send_to_peer(peer_id: int, message: Dictionary) -> void:
    var json_string = JSON.stringify(message)
    _send_to_peer(peer_id, json_string)

# Send scene tree structure
func send_scene_tree() -> void:
    var tree_data = _get_scene_tree_structure(get_tree().current_scene)
    send_json({
        "type": "scene_tree",
        "data": tree_data
    })

# Spawn an agent in the scene
func spawn_agent(agent_type: String, position: Vector3, config: Dictionary = {}) -> String:
    var agent_id = "agent_%04d" % _next_agent_id
    _next_agent_id += 1

    # Create agent node
    var agent_node = Node3D.new()
    agent_node.name = agent_id

    # Add visual representation
    var mesh = _create_agent_mesh(agent_type)
    agent_node.add_child(mesh)

    # Add position
    agent_node.position = position

    # Add to scene and registry
    get_tree().current_scene.add_child(agent_node)
    _agent_registry[agent_id] = {
        "node": agent_node,
        "type": agent_type,
        "config": config,
        "created": Time.get_unix_time_from_system()
    }

    # Notify Theia
    send_json({
        "type": "agent_spawned",
        "agent_id": agent_id,
        "agent_type": agent_type,
        "position": {"x": position.x, "y": position.y, "z": position.z}
    })

    return agent_id

# Remove an agent from the scene
func despawn_agent(agent_id: String) -> void:
    if not _agent_registry.has(agent_id):
        push_error("Agent not found: " + agent_id)
        return

    var agent_data = _agent_registry[agent_id]
    var agent_node = agent_data.node

    agent_node.queue_free()
    _agent_registry.erase(agent_id)

    send_json({
        "type": "agent_despawned",
        "agent_id": agent_id
    })

# Get current state of an agent
func get_agent_state(agent_id: String) -> Dictionary:
    if not _agent_registry.has(agent_id):
        return {"error": "Agent not found"}

    var agent_data = _agent_registry[agent_id]
    var agent_node = agent_data.node

    return {
        "agent_id": agent_id,
        "type": agent_data.type,
        "position": {
            "x": agent_node.position.x,
            "y": agent_node.position.y,
            "z": agent_node.position.z
        },
        "rotation": {
            "x": agent_node.rotation.x,
            "y": agent_node.rotation.y,
            "z": agent_node.rotation.z
        }
    }

# Update agent configuration
func set_agent_behavior(agent_id: String, behavior: String, params: Dictionary = {}) -> void:
    if not _agent_registry.has(agent_id):
        return

    _agent_registry[agent_id].config["behavior"] = behavior
    _agent_registry[agent_id].config["params"] = params

    send_json({
        "type": "agent_behavior_changed",
        "agent_id": agent_id,
        "behavior": behavior,
        "params": params
    })

## Private Methods

func _start_server() -> void:
    var err = _server.listen(port, "127.0.0.1")
    if err == OK:
        print("TheiaBridge: Server listening on port %d" % port)
    else:
        push_error("TheiaBridge: Failed to start server on port %d" % port)

func _poll_server() -> void:
    if _server.is_connection_available():
        var peer: WebSocketPeer = _server.take_connection()
        var peer_id = peer.get_instance_id()

        if peer.poll() == OK:
            _connected_peers.append(peer_id)
            print("TheiaBridge: Client connected: %d" % peer_id)
            connected.emit()

func _process_websockets() -> void:
    var peers_to_remove: Array = []

    for peer_id in _connected_peers:
        var ws = _get_peer(peer_id)
        if not ws:
            peers_to_remove.append(peer_id)
            continue

        ws.poll()

        var state = ws.get_ready_state()
        match state:
            WebSocketPeer.STATE_OPEN:
                _process_messages(ws, peer_id)
            WebSocketPeer.STATE_CLOSING:
                # Wait for close to complete
                pass
            WebSocketPeer.STATE_CLOSED:
                peers_to_remove.append(peer_id)

    # Clean up disconnected peers
    for peer_id in peers_to_remove:
        _connected_peers.erase(peer_id)
        print("TheiaBridge: Client disconnected: %d" % peer_id)
        disconnected.emit()

func _process_messages(ws: WebSocketPeer, peer_id: int) -> void:
    while ws.get_available_packet_count() > 0:
        var packet = ws.get_packet()
        var text = packet.get_string_from_utf8()

        if debug_mode:
            print("TheiaBridge received from %d: %s" % [peer_id, text])

        var json = JSON.new()
        var parse_result = json.parse(text)

        if parse_result == OK:
            _handle_message(json.data, peer_id)
        else:
            push_error("TheiaBridge: Invalid JSON received")

func _handle_message(message: Dictionary, peer_id: int) -> void:
    match message.get("type", ""):
        "ping":
            send_to_peer(peer_id, {"type": "pong"})
        "get_scene_tree":
            send_scene_tree()
        "spawn_agent":
            var pos = message.get("position", {"x": 0, "y": 0, "z": 0})
            var agent_pos = Vector3(pos.x, pos.y, pos.z)
            spawn_agent(
                message.get("agent_type", "default"),
                agent_pos,
                message.get("config", {})
            )
        "despawn_agent":
            despawn_agent(message.get("agent_id", ""))
        "get_agent_state":
            var state = get_agent_state(message.get("agent_id", ""))
            send_to_peer(peer_id, state)
        "set_agent_behavior":
            set_agent_behavior(
                message.get("agent_id", ""),
                message.get("behavior", ""),
                message.get("params", {})
            )
        "load_scene":
            _load_scene_request(message.get("path", ""), peer_id)
        _:
            message_received.emit(message)

func _send_to_peer(peer_id: int, data: String) -> void:
    var ws = _get_peer(peer_id)
    if ws and ws.get_ready_state() == WebSocketPeer.STATE_OPEN:
        ws.put_packet(data.to_utf8_buffer())

func _get_peer(peer_id: int) -> WebSocketPeer:
    # In a real implementation, maintain a map of peer_id -> WebSocketPeer
    # For now, return null as placeholder
    return null

func _cleanup() -> void:
    _server.stop()
    _connected_peers.clear()

func _get_scene_tree_structure(node: Node) -> Dictionary:
    var children: Array = []
    for child in node.get_children():
        children.append(_get_scene_tree_structure(child))

    return {
        "name": node.name,
        "type": node.get_class(),
        "children": children
    }

func _create_agent_mesh(agent_type: String) -> MeshInstance3D:
    var mesh_instance = MeshInstance3D.new()

    match agent_type:
        "boid", "default":
            mesh_instance.mesh = BoxMesh.new()
            mesh_instance.mesh.size = Vector3(0.5, 0.5, 0.5)
        "whale":
            mesh_instance.mesh = SphereMesh.new()
            mesh_instance.mesh.radius = 1.0
        "herring":
            mesh_instance.mesh = BoxMesh.new()
            mesh_instance.mesh.size = Vector3(0.3, 0.3, 0.8)
        _:
            mesh_instance.mesh = BoxMesh.new()

    return mesh_instance

func _load_scene_request(path: String, peer_id: int) -> void:
    if ResourceLoader.exists(path):
        get_tree().change_scene_to_file(path)
        send_to_peer(peer_id, {
            "type": "scene_loaded",
            "path": path,
            "success": true
        })
    else:
        send_to_peer(peer_id, {
            "type": "scene_loaded",
            "path": path,
            "success": false,
            "error": "Scene not found"
        })

## Utility Functions

# Broadcast agent positions to Theia (call this periodically)
func broadcast_agent_states() -> void:
    var states: Array = []
    for agent_id in _agent_registry.keys():
        states.append(get_agent_state(agent_id))

    send_json({
        "type": "agent_states_batch",
        "states": states,
        "timestamp": Time.get_unix_time_from_system()
    })

# Clear all agents from the scene
func clear_all_agents() -> void:
    var agent_ids = _agent_registry.keys()
    for agent_id in agent_ids:
        despawn_agent(agent_id)

    send_json({
        "type": "all_agents_cleared"
    })
