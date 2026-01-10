# AIAttentionNode.gd
# Visualizes neural network attention patterns as a 3D heatmap
# Part of StudyLoG.AI Cognitive Mill stage
#
# Usage:
#   var attention_node = AIAttentionNode.new()
#   add_child(attention_node)
#   attention_node.set_attention_matrix(matrix_data)
#   attention_node.set_token_labels(tokens)

class_name AIAttentionNode
extends MeshInstance3D

## Signals
signal attention_updated(attention_data: Dictionary)
signal token_hovered(token_index: int)
signal connection_selected(from_token: int, to_token: int, weight: float)

## Exported Variables
@export_category("Attention Visualization")
@export var max_tokens: int = 128
@export var connection_threshold: float = 0.1
@export var max_connections: int = 1000

@export_category("Appearance")
@export var token_size: float = 0.1
@export var token_spacing: float = 0.5
@export var min_line_width: float = 0.01
@export var max_line_width: float = 0.1

@export_category("Animation")
@export var animation_speed: float = 1.0
@export var pulse_enabled: bool = true
@export var flow_animation: bool = true

@export_category("Color Scheme")
@export var color_scheme: String = "viridis"  # viridis, plasma, inferno, coolwarm
@export var custom_low_color: Color = Color(0.2, 0.2, 0.8)
@export var custom_high_color: Color = Color(0.9, 0.1, 0.1)

## Private Variables
var _attention_matrix: PackedFloat32Array = PackedFloat32Array()
var _token_labels: PackedStringArray = []
var _token_nodes: Array[MeshInstance3D] = []
var _connection_lines: Array[MeshInstance3D] = []
var _connection_data: Array[Dictionary] = []
var _hovered_token: int = -1
var _selected_connection: Dictionary = {}
var _animation_time: float = 0.0
var _material: ShaderMaterial = null
var _line_material: ShaderMaterial = null

## Built-in Methods

func _ready() -> void:
    _create_materials()
    _create_token_nodes()
    _update_mesh()

func _process(delta: float) -> void:
    if pulse_enabled or flow_animation:
        _animation_time += delta * animation_speed
        _update_animation()

## Public Methods - Data Input

# Set the attention matrix (flattened 2D array)
func set_attention_matrix(matrix: PackedFloat32Array, rows: int, cols: int) -> void:
    _attention_matrix = matrix
    max_tokens = max(rows, cols)
    _update_connections()
    attention_updated.emit({
        "matrix_size": matrix.size(),
        "rows": rows,
        "cols": cols
    })

# Set attention matrix from 2D array
func set_attention_matrix_2d(matrix: Array[Array]) -> void:
    var flat := PackedFloat32Array()
    var rows := matrix.size()
    var cols := matrix[0].size() if rows > 0 else 0

    for row in matrix:
        for value in row:
            flat.append(float(value))

    set_attention_matrix(flat, rows, cols)

# Set token labels for display
func set_token_labels(labels: PackedStringArray) -> void:
    _token_labels = labels
    _update_token_labels()

# Set a single attention value
func set_attention(from_token: int, to_token: int, weight: float) -> void:
    if from_token >= _token_nodes.size() or to_token >= _token_nodes.size():
        return

    var index = from_token * _token_nodes.size() + to_token
    if index < _attention_matrix.size():
        _attention_matrix[index] = weight

    _update_single_connection(from_token, to_token, weight)

# Clear all attention data
func clear_attention() -> void:
    _attention_matrix.clear()
    _connection_data.clear()
    _clear_connections()

## Public Methods - Appearance

# Set the color scheme
func set_color_scheme(scheme: String) -> void:
    color_scheme = scheme
    _update_material_colors()

# Set custom colors
func set_custom_colors(low: Color, high: Color) -> void:
    custom_low_color = low
    custom_high_color = high
    color_scheme = "custom"
    _update_material_colors()

# Get color for a weight value
func get_color_for_weight(weight: float) -> Color:
    weight = clamp(weight, 0.0, 1.0)

    match color_scheme:
        "viridis":
            return _viridis_color(weight)
        "plasma":
            return _plasma_color(weight)
        "inferno":
            return _inferno_color(weight)
        "coolwarm":
            return _coolwarm_color(weight)
        "custom":
            return custom_low_color.lerp(custom_high_color, weight)
        _:
            return _viridis_color(weight)

## Public Methods - Interaction

# Get the token at a specific position
func get_token_at_position(position: Vector3, max_distance: float = 0.2) -> int:
    for i in range(_token_nodes.size()):
        var node = _token_nodes[i]
        var distance = node.global_position.distance_to(position)
        if distance < max_distance:
            return i
    return -1

# Highlight a specific token
func highlight_token(token_index: int, highlight: bool = true) -> void:
    if token_index >= 0 and token_index < _token_nodes.size():
        var node = _token_nodes[token_index]
        if node.mesh is SphereMesh:
            var sphere = node.mesh as SphereMesh
            sphere.radius = token_size * (1.5 if highlight else 1.0)

# Highlight connections from/to a token
func highlight_token_connections(token_index: int, highlight: bool = true) -> void:
    for i in range(_connection_lines.size()):
        var data = _connection_data[i]
        if data.from == token_index or data.to == token_index:
            var line = _connection_lines[i]
            line.visible = highlight or data.weight >= connection_threshold

# Select a specific connection
func select_connection(from_token: int, to_token: int) -> void:
    _clear_connection_selection()

    for i in range(_connection_data.size()):
        var data = _connection_data[i]
        if data.from == from_token and data.to == to_token:
            _selected_connection = data
            _highlight_connection_line(i, true)
            connection_selected.emit(from_token, to_token, data.weight)
            break

## Public Methods - Animation

# Enable or disable pulse animation
func set_pulse_enabled(enabled: bool) -> void:
    pulse_enabled = enabled

# Enable or disable flow animation
func set_flow_animation(enabled: bool) -> void:
    flow_animation = enabled

# Set animation speed
func set_animation_speed(speed: float) -> void:
    animation_speed = speed

## Public Methods - Query

# Get attention weight between two tokens
func get_attention(from_token: int, to_token: int) -> float:
    var size = _token_nodes.size()
    if size == 0:
        return 0.0

    var index = from_token * size + to_token
    if index >= 0 and index < _attention_matrix.size():
        return _attention_matrix[index]
    return 0.0

# Get all connections from a token
func get_connections_from(token_index: int) -> Array[Dictionary]:
    var connections: Array[Dictionary] = []
    for data in _connection_data:
        if data.from == token_index:
            connections.append(data)
    return connections

# Get all connections to a token
func get_connections_to(token_index: int) -> Array[Dictionary]:
    var connections: Array[Dictionary] = []
    for data in _connection_data:
        if data.to == token_index:
            connections.append(data)
    return connections

# Get statistics
func get_statistics() -> Dictionary:
    var total_weight := 0.0
    var max_weight := 0.0
    var active_connections := 0

    for data in _connection_data:
        total_weight += data.weight
        if data.weight > max_weight:
            max_weight = data.weight
        if data.weight >= connection_threshold:
            active_connections += 1

    return {
        "total_connections": _connection_data.size(),
        "active_connections": active_connections,
        "total_weight": total_weight,
        "max_weight": max_weight,
        "average_weight": total_weight / _connection_data.size() if _connection_data.size() > 0 else 0.0
    }

## Private Methods

func _create_materials() -> void:
    # Token material
    _material = ShaderMaterial.new()
    _material.shader = load("res://addons/studylog/shaders/attention_token.gdshader") as Shader
    _material.set_shader_parameter("pulse_enabled", pulse_enabled)

    # Connection line material
    _line_material = ShaderMaterial.new()
    _line_material.shader = load("res://addons/studylog/shaders/attention_line.gdshader") as Shader
    _line_material.set_shader_parameter("flow_enabled", flow_animation)

    _update_material_colors()

func _create_token_nodes() -> void:
    _clear_token_nodes()

    var sqrt_tokens = ceil(sqrt(float(max_tokens)))

    for i in range(max_tokens):
        var row = i / sqrt_tokens
        var col = i % sqrt_tokens

        var token = MeshInstance3D.new()
        var sphere = SphereMesh.new()
        sphere.radius = token_size
        sphere.height = token_size * 2.0
        token.mesh = sphere

        token.position = Vector3(col * token_spacing, 0, row * token_spacing)
        token.material_override = _material

        add_child(token)
        _token_nodes.append(token)

func _update_connections() -> void:
    _clear_connections()

    var size = _token_nodes.size()
    if size == 0:
        return

    for from_idx in range(size):
        for to_idx in range(size):
            var weight = get_attention(from_idx, to_idx)
            if weight >= connection_threshold:
                _create_connection(from_idx, to_idx, weight)

func _create_connection(from_token: int, to_token: int, weight: float) -> void:
    if _connection_data.size() >= max_connections:
        return

    var from_node = _token_nodes[from_token]
    var to_node = _token_nodes[to_token]

    var line = MeshInstance3D.new()
    var line_mesh = ImmediateMesh.new()
    line.mesh = line_mesh
    line.material_override = _line_material

    add_child(line)
    _connection_lines.append(line)

    _connection_data.append({
        "from": from_token,
        "to": to_token,
        "weight": weight,
        "line": line
    })

    _update_connection_line(_connection_lines.size() - 1)

func _update_single_connection(from_token: int, to_token: int, weight: float) -> void:
    for i in range(_connection_data.size()):
        var data = _connection_data[i]
        if data.from == from_token and data.to == to_token:
            data.weight = weight
            _update_connection_line(i)
            break

func _update_connection_line(index: int) -> void:
    if index < 0 or index >= _connection_data.size():
        return

    var data = _connection_data[index]
    var line = _connection_lines[index]

    var from_node = _token_nodes[data.from]
    var to_node = _token_nodes[data.to]

    var color = get_color_for_weight(data.weight)
    var width = lerp(min_line_width, max_line_width, data.weight)

    # Update line geometry
    if line.mesh is ImmediateMesh:
        var mesh = line.mesh as ImmediateMesh
        mesh.clear_surfaces()
        mesh.surface_begin(Mesh.PRIMITIVE_LINES)

        var direction = (to_node.global_position - from_node.global_position).normalized()
        var right = direction.cross(Vector3.UP)
        if right.length() < 0.01:
            right = Vector3.RIGHT

        mesh.surface_add_vertex(from_node.global_position)
        mesh.surface_add_vertex(to_node.global_position)

        mesh.surface_end()

    line.visible = data.weight >= connection_threshold

func _highlight_connection_line(index: int, highlight: bool) -> void:
    if index < 0 or index >= _connection_lines.size():
        return

    var line = _connection_lines[index]
    var data = _connection_data[index]

    if highlight:
        var color = get_color_for_weight(data.weight)
        color = color.lerp(Color.WHITE, 0.5)
        _line_material.set_shader_parameter("albedo", color)
    else:
        _line_material.set_shader_parameter("albedo", get_color_for_weight(data.weight))

func _clear_connection_selection() -> void:
    for i in range(_connection_lines.size()):
        _highlight_connection_line(i, false)
    _selected_connection.clear()

func _clear_connections() -> void:
    for line in _connection_lines:
        line.queue_free()
    _connection_lines.clear()
    _connection_data.clear()

func _clear_token_nodes() -> void:
    for token in _token_nodes:
        token.queue_free()
    _token_nodes.clear()

func _update_token_labels() -> void:
    # In a full implementation, would create 3D text labels
    pass

func _update_material_colors() -> void:
    if _material:
        _material.set_shader_parameter("low_color", custom_low_color)
        _material.set_shader_parameter("high_color", custom_high_color)

func _update_animation() -> void:
    if _material:
        _material.set_shader_parameter("time", _animation_time)
        _material.set_shader_parameter("pulse_enabled", pulse_enabled)

    if _line_material:
        _line_material.set_shader_parameter("time", _animation_time)
        _line_material.set_shader_parameter("flow_enabled", flow_animation)

func _update_mesh() -> void:
    # Create base mesh if needed
    pass

## Color Scheme Functions

func _viridis_color(t: float) -> Color:
    # Approximate viridis colormap
    var colors := [
        Color(0.267, 0.005, 0.329),
        Color(0.282, 0.141, 0.458),
        Color(0.253, 0.265, 0.529),
        Color(0.206, 0.371, 0.553),
        Color(0.163, 0.471, 0.558),
        Color(0.127, 0.566, 0.550),
        Color(0.134, 0.658, 0.517),
        Color(0.266, 0.746, 0.440),
        Color(0.477, 0.821, 0.318),
        Color(0.741, 0.873, 0.150),
        Color(0.993, 0.906, 0.144)
    ]
    return _interpolate_colors(colors, t)

func _plasma_color(t: float) -> Color:
    var colors := [
        Color(0.050, 0.030, 0.528),
        Color(0.294, 0.012, 0.613),
        Color(0.495, 0.009, 0.641),
        Color(0.667, 0.114, 0.602),
        Color(0.816, 0.296, 0.509),
        Color(0.919, 0.491, 0.397),
        Color(0.980, 0.675, 0.278),
        Color(0.993, 0.846, 0.175)
    ]
    return _interpolate_colors(colors, t)

func _inferno_color(t: float) -> Color:
    var colors := [
        Color(0.001, 0.000, 0.014),
        Color(0.125, 0.031, 0.284),
        Color(0.327, 0.083, 0.447),
        Color(0.555, 0.144, 0.508),
        Color(0.768, 0.216, 0.508),
        Color(0.937, 0.321, 0.451),
        Color(0.995, 0.491, 0.352),
        Color(0.998, 0.703, 0.239),
        Color(0.988, 0.899, 0.125)
    ]
    return _interpolate_colors(colors, t)

func _coolwarm_color(t: float) -> Color:
    return Color(0.5 - t * 0.5, 0.0, 0.5 + t * 0.5).lerp(Color(1.0, 1.0, 0.0), t * 0.5)

func _interpolate_colors(colors: Array[Color], t: float) -> Color:
    t = clamp(t, 0.0, 1.0)
    var idx = t * (colors.size() - 1)
    var i = int(idx)
    var frac = idx - i

    if i >= colors.size() - 1:
        return colors[colors.size() - 1]

    return colors[i].lerp(colors[i + 1], frac)
