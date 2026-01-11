# DMLoG.AI - Godot 4.x Integration Design

## Overview

DMLoG.AI (Dungeon Master's Log) is the TTRPG-focused product in the SuperInstance.AI ecosystem. It uses Godot Engine 4.4+ as its visualization layer for battle maps, character tokens, spell effects, and dynamic environments. This document details the Godot integration design, building on shared StudyLoG patterns while optimizing for TTRPG-specific needs.

## Table of Contents

1. [Shared vs Product-Specific Components](#shared-vs-product-specific-components)
2. [Battle Map System](#battle-map-system)
3. [Character Visualization](#character-visualization)
4. [Effect Visualization](#effect-visualization)
5. [Theia Integration](#theia-integration)
6. [Implementation](#implementation)
7. [Code Examples](#code-examples)
8. [RPC Protocol](#rpc-protocol)
9. [Scene Templates](#scene-templates)
10. [Shader Library](#shader-library)

---

## Shared vs Product-Specific Components

### Shared Components (Reused from StudyLoG)

The following components from StudyLoG.AI are directly reusable for DMLoG.AI:

| Component | StudyLoG Use | DMLoG Use | Notes |
|-----------|--------------|-----------|-------|
| **TheiaBridge** | AI model communication | Battle map state sync | Same WebSocket protocol |
| **moon-interval** | Animation sequences | Spell animations, cutscenes | Perfect match |
| **Orchestrator** | Visual scripting | Encounter logic, triggers | Non-coder friendly |
| **DialogueQuest** | Tutorial system | NPC dialogue, quests | Direct reuse |
| **Scene Builder** | Level design | Battle map construction | Same tool |
| **Godot Jolt** | Physics simulation | Projectile physics, collision | Integrated in 4.4+ |
| **Character SDK** | AI tutors | AI-driven NPCs | Shared base classes |

### DMLoG-Specific Components

These components are new or significantly modified for TTRPG:

| Component | Purpose | Why Different |
|-----------|---------|---------------|
| **BattleMapSystem** | Grid-based tactical maps | TTRPG-specific (5ft squares) |
| **TokenManager** | Character/monster tokens | Turn-based positioning |
| **FogOfWar** | Dynamic visibility | Player knowledge management |
| **EffectVFX** | Spell/ability visual effects | Fireballs, healing, conditions |
| **InitiativeTracker** | Turn order visualization | Combat timing |
| **ConditionSystem** | Status effect display | Poisoned, stunned, etc. |
| **DiceRoller3D** | 3D dice visualization | TTRPG core mechanic |
| **CharacterSheet3D** | 3D character model viewer | Miniature display |

### Component Architecture

```
DMLoG.AI Godot Project
|
+-- addons/
|   +-- scene_builder/        [SHARED] Level design
|   +-- moon-interval/        [SHARED] Animations
|   +-- orchestrator/         [SHARED] Visual scripting
|   +-- dialogue_quest/       [SHARED] Dialogue system
|   |
|   +-- dmlog_battle_map/    [NEW] Grid battle maps
|   +-- dmlog_tokens/         [NEW] Token system
|   +-- dmlog_fog_of_war/     [NEW] Visibility system
|   +-- dmlog_effects/        [NEW] Spell VFX library
|   +-- dmlog_initiative/     [NEW] Turn tracking
|   +-- dmlog_conditions/     [NEW] Status effects
|   +-- dmlog_dice_3d/        [NEW] 3D dice roller
|
+-- scenes/
|   +-- battle_map/           [NEW] Battle map templates
|   |   +-- dungeon.tscn
|   |   +-- wilderness.tscn
|   |   +-- interior.tscn
|   |
|   +-- characters/           [NEW] Character visualization
|   |   +-- token_2d.tscn
|   |   +-- miniature_3d.tscn
|   |   +-- character_viewer.tscn
|   |
|   +-- effects/              [NEW] VFX scenes
|   |   +-- fireball.tscn
|   |   +-- healing.tscn
|   |   +-- teleport.tscn
|   |
|   +-- ui/
|   +-- initiative_tracker.tscn
|   +-- condition_panel.tscn
|   +-- dice_roller.tscn
|
+-- scripts/
|   +-- dmlog/
|   |   +-- battle_map.gd
|   |   +-- token.gd
|   |   +-- fog_of_war.gd
|   |   +-- effect_manager.gd
|   |   +-- initiative.gd
|   |   +-- condition_display.gd
|   |
|   +-- shared/
|   |   +-- theia_bridge.gd    [SHARED] WebSocket communication
|   |   +-- interval_runner.gd [SHARED] Animation helper
|
+-- shaders/
|   +-- effects/
|   |   +-- fireball.gdshader
|   |   +-- magic_circle.gdshader
|   |   +-- teleport.gdshader
|   |   +-- fog_of_war.gdshader
|
+-- TheiaBridge.gd           [SHARED] Main bridge
```

---

## Battle Map System

### Overview

The Battle Map System provides a grid-based tactical display optimized for TTRPG combat (typically 5-foot squares in D&D 5e). It supports multiple terrain types, dynamic lighting, fog of war, and token management.

### Core Classes

#### BattleMap.gd

```gdscript
class_name BattleMap
extends Node3D

## Battle Map System for DMLoG.AI
## Supports grid-based tactical combat with fog of war and dynamic lighting

signal token_added(token: Token)
signal token_removed(token_id: String)
signal token_moved(token_id: String, from: Vector2i, to: Vector2i)
signal grid_clicked(cell: Vector2i)
signal fog_updated(visible_cells: Array[Vector2i])

## Exported configuration
@export_group("Grid Settings")
@export var grid_size: Vector2i = Vector2i(20, 20)  # 100x100 ft standard
@export var cell_size: float = 5.0  # 5 feet per cell (D&D 5e)
@export var grid_color: Color = Color(0.3, 0.3, 0.3, 0.5)
@export var show_grid: bool = true

@export_group("Terrain")
@export var terrain_mesh: MeshInstance3D
@export var height_map_texture: Texture2D
@export var terrain_material: StandardMaterial3D

@export_group("Lighting")
@export var ambient_light_color: Color = Color(0.2, 0.2, 0.25, 1.0)
@export var darkness_color: Color = Color(0.05, 0.05, 0.1, 1.0)

## Private state
var _grid: Dictionary = {}  # Vector2i -> CellData
var _tokens: Dictionary = {}  # String -> Token
var _fog_of_war: FogOfWar
var _ground_plane: MeshInstance3D
var _grid_lines: Node3D
var _active_token: Token = null

## Cell data structure
class CellData:
    var position: Vector2i
    var height: float = 0.0
    var terrain_type: TerrainType = TerrainType.FLOOR
    var is_difficult: bool = false
    var is_obstacle: bool = false
    var cover_type: CoverType = CoverType.NONE
    var lighting_level: float = 1.0
    var is_visible: bool = true

    enum TerrainType { FLOOR, WALL, WATER, LAVA, PIT, STAIRS }
    enum CoverType { NONE, HALF, THREE_QUARTERS, FULL }

func _ready() -> void:
    _initialize_grid()
    _create_ground_plane()
    _create_grid_lines()
    _initialize_fog_of_war()
    _setup_lighting()

func _initialize_grid() -> void:
    _grid.clear()
    for x in grid_size.x:
        for y in grid_size.y:
            var cell := CellData.new()
            cell.position = Vector2i(x, y)
            _grid[Vector2i(x, y)] = cell

func _create_ground_plane() -> void:
    _ground_plane = MeshInstance3D.new()
    var plane := PlaneMesh.new()
    plane.size = Vector2(grid_size.x * cell_size, grid_size.y * cell_size)

    terrain_material = StandardMaterial3D.new()
    terrain_material.albedo_color = Color(0.4, 0.35, 0.3)
    terrain_material.roughness = 0.8
    plane.material = terrain_material

    _ground_plane.mesh = plane
    _ground_plane.position = Vector3(
        grid_size.x * cell_size / 2.0,
        0,
        grid_size.y * cell_size / 2.0
    )
    add_child(_ground_plane)

func _create_grid_lines() -> void:
    _grid_lines = Node3D.new()
    _grid_lines.name = "GridLines"

    var mesh_data := ArrayMesh.new()
    var surface_index := 0

    for use_z in [false, true]:
        var st := SurfaceTool.new()
        st.begin(Mesh.PRIMITIVE_LINES)

        var primary_count: int = grid_size.x if use_z else grid_size.y
        var secondary_count: int = grid_size.y if use_z else grid_size.x
        var primary_axis: int = 2 if use_z else 0  # Z or X
        var secondary_axis: int = 0 if use_z else 2  # X or Z

        for i in primary_count + 1:
            for j in secondary_count:
                var v1 := Vector3()
                var v2 := Vector3()

                v1[primary_axis] = i * cell_size
                v1[secondary_axis] = j * cell_size
                v1.y = 0.01

                v2[primary_axis] = i * cell_size
                v2[secondary_axis] = (j + 1) * cell_size
                v2.y = 0.01

                st.add_vertex(v1)
                st.add_vertex(v2)

        st.generate_normals()
        st.commit(mesh_data, surface_index)
        surface_index += 1

    var grid_instance := MeshInstance3D.new()
    grid_instance.mesh = mesh_data

    var grid_mat := StandardMaterial3D.new()
    grid_mat.albedo_color = grid_color
    grid_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
    grid_mat.no_depth_test = true
    grid_instance.material_override = grid_mat

    _grid_lines.add_child(grid_instance)
    add_child(_grid_lines)
    _grid_lines.visible = show_grid

## Public API

func add_token(token: Token, grid_position: Vector2i) -> void:
    if not _grid.has(grid_position):
        push_error("Invalid grid position: %s" % grid_position)
        return

    if _tokens.has(token.token_id):
        push_error("Token ID already exists: %s" % token.token_id)
        return

    _tokens[token.token_id] = token
    add_child(token)
    token.set_grid_position(grid_position, cell_size)
    token_added.emit(token)

func remove_token(token_id: String) -> void:
    if not _tokens.has(token_id):
        return

    var token: Token = _tokens[token_id]
    _tokens.erase(token_id)
    remove_child(token)
    token_removed.emit(token)

func move_token(token_id: String, new_position: Vector2i) -> void:
    if not _tokens.has(token_id):
        return

    var token: Token = _tokens[token_id]
    var old_position := token.grid_position

    if token.animate_to_position(new_position, cell_size):
        token_moved.emit(token_id, old_position, new_position)

func get_token(token_id: String) -> Token:
    return _tokens.get(token_id)

func get_tokens_at(position: Vector2i) -> Array[Token]:
    var result: Array[Token] = []
    for token in _tokens.values():
        if token.grid_position == position:
            result.append(token)
    return result

func get_cell(position: Vector2i) -> CellData:
    return _grid.get(position)

func set_terrain(position: Vector2i, terrain: CellData.TerrainType) -> void:
    var cell := get_cell(position)
    if cell:
        cell.terrain_type = terrain
        _update_cell_visual(cell)

func set_cell_height(position: Vector2i, height: float) -> void:
    var cell := get_cell(position)
    if cell:
        cell.height = height
        _update_terrain_mesh()

func set_difficult_terrain(position: Vector2i, difficult: bool) -> void:
    var cell := get_cell(position)
    if cell:
        cell.is_difficult = difficult

func calculate_distance(from: Vector2i, to: Vector2i) -> int:
    # Manhattan distance for grid movement
    return abs(from.x - to.x) + abs(from.y - to.y)

func get_path(from: Vector2i, to: Vector2i) -> Array[Vector2i]:
    # A* pathfinding
    var open_set: Array[Vector2i] = [from]
    var came_from: Dictionary = {}
    var g_score: Dictionary = {from: 0}
    var f_score: Dictionary = {from: _heuristic(from, to)}

    while open_set.size() > 0:
        open_set.sort_custom(_compare_f_score.bind(f_score))
        var current := open_set[0]

        if current == to:
            return _reconstruct_path(came_from, current)

        open_set.erase(current)

        for neighbor in _get_neighbors(current):
            if not _grid.has(neighbor):
                continue

            var cell: CellData = _grid[neighbor]
            if cell.is_obstacle:
                continue

            var tentative_g := g_score[current] + (1 if not cell.is_difficult else 2)

            if not g_score.has(neighbor) or tentative_g < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f_score[neighbor] = tentative_g + _heuristic(neighbor, to)

                if neighbor not in open_set:
                    open_set.append(neighbor)

    return []  # No path found

## Fog of War

func update_fog_of_war(player_positions: Array[Vector2i], vision_range: int) -> void:
    if not _fog_of_war:
        return

    var visible_cells := _fog_of_war.calculate_visibility(player_positions, vision_range)

    for cell in _grid.values():
        cell.is_visible = visible_cells.has(cell.position)
        _update_cell_visibility(cell)

    fog_updated.emit(visible_cells)

func set_fog_enabled(enabled: bool) -> void:
    if _fog_of_war:
        _fog_of_war.set_enabled(enabled)

func reveal_all() -> void:
    for cell in _grid.values():
        cell.is_visible = true
        _update_cell_visibility(cell)

func hide_all() -> void:
    for cell in _grid.values():
        cell.is_visible = false
        _update_cell_visibility(cell)

## Input Handling

func _input(event: InputEvent) -> void:
    if event is InputEventMouseButton and event.pressed:
        if event.button_index == MOUSE_BUTTON_LEFT:
            var clicked_cell := _get_cell_from_screen(event.position)
            if clicked_cell:
                grid_clicked.emit(clicked_cell)

## Private Helpers

func _get_cell_from_screen(screen_pos: Vector2) -> Vector2i:
    var camera := get_viewport().get_camera_3d()
    if not camera:
        return Vector2i.MAX

    var plane := Plane(Vector3.UP, 0)
    var from := camera.project_ray_origin(screen_pos)
    var dir := camera.project_ray_normal(screen_pos)

    var intersection := plane.intersects_ray(from, dir)
    if intersection:
        var pos: Vector3 = intersection
        return Vector2i(
            int(pos.x / cell_size),
            int(pos.z / cell_size)
        )

    return Vector2i.MAX

func _heuristic(a: Vector2i, b: Vector2i) -> int:
    return abs(a.x - b.x) + abs(a.y - b.y)

func _get_neighbors(pos: Vector2i) -> Array[Vector2i]:
    var neighbors: Array[Vector2i] = []
    for offset in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
        var neighbor := pos + offset
        if _grid.has(neighbor):
            neighbors.append(neighbor)
    return neighbors

func _compare_f_score(a: Vector2i, b: Vector2i, f_score: Dictionary) -> bool:
    var f_a := f_score.get(a, INF)
    var f_b := f_score.get(b, INF)
    return f_a < f_b

func _reconstruct_path(came_from: Dictionary, current: Vector2i) -> Array[Vector2i]:
    var path: Array[Vector2i] = [current]
    while current in came_from:
        current = came_from[current]
        path.append(current)
    path.reverse()
    return path

func _initialize_fog_of_war() -> void:
    _fog_of_war = FogOfWar.new()
    _fog_of_war.battle_map = self
    add_child(_fog_of_war)

func _setup_lighting() -> void:
    var ambient := DirectionalLight3D.new()
    ambient.light_color = ambient_light_color
    ambient.light_energy = 0.3
    add_child(ambient)

func _update_cell_visual(cell: CellData) -> void:
    # Update visual representation based on cell data
    pass

func _update_terrain_mesh() -> void:
    # Regenerate terrain mesh based on height map
    pass

func _update_cell_visibility(cell: CellData) -> void:
    # Apply fog of war visual effect
    pass
```

### Grid Visualization Modes

```gdscript
class_name GridDisplayMode
extends Node

enum DisplayMode {
    STANDARD,      # 5ft squares
    HEX,           # Hexagonal grid
    ISOMETRIC,     # Isometric view
    TOPOGRAPHIC,   # Height-based coloring
    VISION_RANGES, # Show vision ranges
    MOVEMENT,      # Show movement paths
}

static func get_color_for_height(height: float, max_height: float) -> Color:
    var t := clampf(height / max_height, 0.0, 1.0)
    return Color(
        lerp(0.2, 0.8, t),
        lerp(0.5, 0.4, t),
        lerp(0.3, 0.2, t)
    )

static func get_color_for_terrain(terrain: BattleMap.CellData.TerrainType) -> Color:
    match terrain:
        BattleMap.CellData.TerrainType.FLOOR:
            return Color(0.4, 0.35, 0.3)
        BattleMap.CellData.TerrainType.WALL:
            return Color(0.3, 0.3, 0.35)
        BattleMap.CellData.TerrainType.WATER:
            return Color(0.2, 0.4, 0.6)
        BattleMap.CellData.TerrainType.LAVA:
            return Color(0.8, 0.3, 0.1)
        BattleMap.CellData.TerrainType.PIT:
            return Color(0.1, 0.1, 0.15)
        _:
            return Color(0.5, 0.5, 0.5)
```

### Fog of War System

```gdscript
class_name FogOfWar
extends Node3D

## Dynamic fog of war system for TTRPG visibility

signal visibility_changed(visible_cells: Array[Vector2i])

var battle_map: BattleMap
var fog_texture: ImageTexture
var fog_image: Image
var fog_material: ShaderMaterial

@export var fog_color: Color = Color(0.0, 0.0, 0.0, 0.85)
@export var explored_color: Color = Color(0.1, 0.1, 0.1, 0.6)
@export var revealed_color: Color = Color(0.0, 0.0, 0.0, 0.0)

var _visible_cells: Dictionary = {}  # Vector2i -> bool (currently visible)
var _explored_cells: Dictionary = {}  # Vector2i -> bool (previously seen)
var _enabled: bool = true

func _ready() -> void:
    _initialize_fog_texture()
    _create_fog_plane()

func _initialize_fog_texture() -> void:
    fog_image = Image.create(
        battle_map.grid_size.x,
        battle_map.grid_size.y,
        false,
        Image.FORMAT_RGBA8
    )
    fog_image.fill(fog_color)

    fog_texture = ImageTexture.new()
    fog_texture.set_image(fog_image)

func _create_fog_plane() -> void:
    var fog_plane := MeshInstance3D.new()
    fog_plane.name = "FogPlane"

    var plane := PlaneMesh.new()
    plane.size = Vector2(
        battle_map.grid_size.x * battle_map.cell_size,
        battle_map.grid_size.y * battle_map.cell_size
    )

    fog_material = ShaderMaterial.new()
    fog_material.shader = preload("res://shaders/effects/fog_of_war.gdshader")
    fog_material.set_shader_parameter("fog_texture", fog_texture)
    fog_material.set_shader_parameter("grid_size", battle_map.grid_size)
    fog_material.set_shader_parameter("cell_size", battle_map.cell_size)

    plane.material = fog_material
    fog_plane.mesh = plane
    fog_plane.position = Vector3(
        battle_map.grid_size.x * battle_map.cell_size / 2.0,
        0.02,
        battle_map.grid_size.y * battle_map.cell_size / 2.0
    )

    add_child(fog_plane)

func calculate_visibility(
    player_positions: Array[Vector2i],
    vision_range: int
) -> Array[Vector2i]:
    var newly_visible: Array[Vector2i] = []
    _visible_cells.clear()

    for player_pos in player_positions:
        var visible := _calculate_visibility_from(player_pos, vision_range)
        for cell in visible:
            if not _visible_cells.has(cell):
                _visible_cells[cell] = true
                newly_visible.append(cell)
            _explored_cells[cell] = true

    if newly_visible.size() > 0:
        _update_fog_texture()
        visibility_changed.emit(_visible_cells.keys())

    return _visible_cells.keys()

func _calculate_visibility_from(
    origin: Vector2i,
    vision_range: int
) -> Array[Vector2i]:
    var visible: Array[Vector2i] = []
    var radius_squared := vision_range * vision_range

    # Simple distance check - replace with raycasting for obstacles
    for x in range(-vision_range, vision_range + 1):
        for y in range(-vision_range, vision_range + 1):
            if x * x + y * y > radius_squared:
                continue

            var cell_pos := origin + Vector2i(x, y)
            if battle_map.get_cell(cell_pos):
                visible.append(cell_pos)

    return visible

func _update_fog_texture() -> void:
    for x in battle_map.grid_size.x:
        for y in battle_map.grid_size.y:
            var pos := Vector2i(x, y)
            var color: Color

            if _visible_cells.has(pos):
                color = revealed_color
            elif _explored_cells.has(pos):
                color = explored_color
            else:
                color = fog_color

            fog_image.set_pixel(x, y, color)

    fog_texture.update(fog_image)

func set_enabled(enabled: bool) -> void:
    _enabled = enabled
    visible = enabled

func is_visible(cell: Vector2i) -> bool:
    return _visible_cells.has(cell)

func is_explored(cell: Vector2i) -> bool:
    return _explored_cells.has(cell)
```

---

## Character Visualization

### Token System

```gdscript
class_name Token
extends Node3D

## Token class for battle map character/monster representation

signal selected()
signal deselected()
signal hover_started()
signal hover_ended()
signal animation_completed(animation_name: String)

@export_group("Token Data")
@export var token_id: String
@export var display_name: String
@export var faction: FactionType = FactionType.NEUTRAL

@export_group("Visual")
@export var texture: Texture2D
@export var scale_3d: float = 1.0
@export var billboard: bool = true
@export var show_health_bar: bool = true
@export var show_name_label: bool = true

@export_group("Game Stats")
@export var max_hp: int = 10
@export var current_hp: int = 10
@export var armor_class: int = 10
@export var speed: int = 30  # feet per round
@export var size: CreatureSize = CreatureSize.MEDIUM

enum FactionType { PLAYER, ALLY, ENEMY, NEUTRAL }
enum CreatureSize { TINY, SMALL, MEDIUM, LARGE, HUGE, GARGANTUAN }

## Internal nodes
var _sprite: Sprite3D
var _health_bar: ProgressBar3D
var _name_label: Label3D
var _selection_ring: MeshInstance3D
var _effect_container: Node3D
var _conditions: Dictionary = {}  # String -> ConditionEffect

## State
var grid_position: Vector2i = Vector2i.ZERO
var is_selected: bool = false
var is_hovered: bool = false

func _ready() -> void:
    _create_sprite()
    _create_health_bar()
    _create_name_label()
    _create_selection_ring()
    _create_effect_container()
    _setup_size()

func _create_sprite() -> void:
    _sprite = Sprite3D.new()
    _sprite.texture = texture
    _sprite.pixel_size = 0.01
    _sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED if billboard else BaseMaterial3D.BILLBOARD_DISABLED
    _sprite.modulate = _get_faction_color()
    add_child(_sprite)

func _create_health_bar() -> void:
    if not show_health_bar:
        return

    _health_bar = ProgressBar3D.new()
    _health_bar.value = float(current_hp) / float(max_hp)
    _health_bar.position = Vector3(0, 2.5, 0)
    _health_bar.size = Vector2(2.0, 0.2)
    add_child(_health_bar)

func _create_name_label() -> void:
    if not show_name_label:
        return

    _name_label = Label3D.new()
    _name_label.text = display_name
    _name_label.pixel_size = 0.005
    _name_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
    _name_label.position = Vector3(0, 2.8, 0)
    _name_label.outline_size = 5
    _name_label.outline_color = Color.BLACK
    add_child(_name_label)

func _create_selection_ring() -> void:
    _selection_ring = MeshInstance3D.new()
    var torus := TorusMesh.new()
    torus.inner_radius = 0.4
    torus.outer_radius = 0.5
    torus.rings = 32
    torus.radial_segments = 32

    var mat := StandardMaterial3D.new()
    mat.albedo_color = Color(1.0, 1.0, 0.0, 0.5)
    mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
    mat.no_depth_test = true
    torus.material = mat

    _selection_ring.mesh = torus
    _selection_ring.position = Vector3(0, 0.05, 0)
    _selection_ring.visible = false
    add_child(_selection_ring)

func _create_effect_container() -> void:
    _effect_container = Node3D.new()
    _effect_container.name = "Effects"
    add_child(_effect_container)

func _setup_size() -> void:
    match size:
        CreatureSize.TINY:
            scale = Vector3(0.5, 0.5, 0.5) * scale_3d
        CreatureSize.SMALL:
            scale = Vector3(0.75, 0.75, 0.75) * scale_3d
        CreatureSize.MEDIUM:
            scale = Vector3(1.0, 1.0, 1.0) * scale_3d
        CreatureSize.LARGE:
            scale = Vector3(2.0, 2.0, 2.0) * scale_3d
        CreatureSize.HUGE:
            scale = Vector3(3.0, 3.0, 3.0) * scale_3d
        CreatureSize.GARGANTUAN:
            scale = Vector3(4.0, 4.0, 4.0) * scale_3d

## Public API

func set_grid_position(pos: Vector2i, cell_size: float) -> void:
    grid_position = pos
    position = Vector3(
        (pos.x + 0.5) * cell_size,
        0,
        (pos.y + 0.5) * cell_size
    )

func animate_to_position(pos: Vector2i, cell_size: float) -> bool:
    var target := Vector3(
        (pos.x + 0.5) * cell_size,
        0,
        (pos.y + 0.5) * cell_size
    )

    var tween := create_tween()
    tween.set_parallel(false)
    tween.set_ease(Tween.EASE_OUT)
    tween.set_trans(Tween.TRANS_CIRC)

    # Hop animation
    var hop_height := 1.0
    tween.parallel().tween_property(self, "position:x", target.x, 0.3)
    tween.parallel().tween_property(self, "position:z", target.z, 0.3)
    tween.parallel().tween_property(
        self, "position:y", hop_height, 0.15
    ).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUAD)
    tween.tween_property(self, "position:y", 0.0, 0.15).set_ease(
        Tween.EASE_IN
    ).set_trans(Tween.TRANS_QUAD)

    tween.tween_callback(func(): grid_position = pos)
    return true

func set_hp(value: int) -> void:
    current_hp = clampi(value, 0, max_hp)
    _update_health_bar()

    if current_hp <= 0:
        _play_death_animation()

func modify_hp(amount: int) -> void:
    set_hp(current_hp + amount)
    _show_damage_number(amount)

func _update_health_bar() -> void:
    if _health_bar:
        _health_bar.value = float(current_hp) / float(max_hp)

func _show_damage_number(amount: int) -> void:
    var dmg_label := Label3D.new()
    dmg_label.text = str(abs(amount))
    dmg_label.pixel_size = 0.01
    dmg_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED

    if amount < 0:
        dmg_label.modulate = Color.RED
    else:
        dmg_label.modulate = Color.GREEN

    dmg_label.position = Vector3(0, 2.0, 0)
    add_child(dmg_label)

    var tween := create_tween()
    tween.parallel().tween_property(dmg_label, "position:y", 4.0, 1.0)
    tween.parallel().tween_property(dmg_label, "modulate:a", 0.0, 1.0)
    tween.tween_callback(dmg_label.queue_free)

func _play_death_animation() -> void:
    var tween := create_tween()
    tween.set_parallel(true)
    tween.tween_property(_sprite, "modulate:a", 0.0, 0.5)
    tween.tween_property(self, "scale", Vector3.ZERO, 0.5)
    tween.tween_callback(queue_free).set_delay(0.5)

## Selection

func select() -> void:
    is_selected = true
    if _selection_ring:
        _selection_ring.visible = true
    selected.emit()

func deselect() -> void:
    is_selected = false
    if _selection_ring:
        _selection_ring.visible = false
    deselected.emit()

func set_hover(hover: bool) -> void:
    is_hovered = hover

    if hover:
        if _sprite:
            _sprite.modulate = Color.WHITE
        hover_started.emit()
    else:
        if _sprite:
            _sprite.modulate = _get_faction_color()
        hover_ended.emit()

## Conditions

func add_condition(condition: ConditionEffect) -> void:
    _conditions[condition.condition_id] = condition
    _effect_container.add_child(condition)
    condition.apply_to_token(self)

func remove_condition(condition_id: String) -> void:
    if _conditions.has(condition_id):
        var condition: ConditionEffect = _conditions[condition_id]
        _conditions.erase(condition_id)
        condition.queue_free()

func has_condition(condition_id: String) -> bool:
    return _conditions.has(condition_id)

func get_conditions() -> Array[ConditionEffect]:
    return _conditions.values()

## Visual Updates

func set_texture(new_texture: Texture2D) -> void:
    texture = new_texture
    if _sprite:
        _sprite.texture = texture

func set_display_name(name: String) -> void:
    display_name = name
    if _name_label:
        _name_label.text = name

func play_animation(animation_name: String) -> void:
    # Trigger animation based on name
    match animation_name:
        "attack":
            _play_attack_animation()
        "cast":
            _play_cast_animation()
        "hurt":
            _play_hurt_animation()
        "idle":
            _play_idle_animation()

func _play_attack_animation() -> void:
    var tween := create_tween()
    tween.set_parallel(false)

    # Lean forward
    tween.tween_property(self, "rotation:z", -0.2, 0.1)
    tween.tween_property(self, "rotation:z", 0.2, 0.1)
    tween.tween_property(self, "rotation:z", 0.0, 0.1)

    animation_completed.emit("attack")

func _play_cast_animation() -> void:
    var tween := create_tween()
    tween.set_parallel(true)
    tween.tween_property(self, "scale", Vector3(1.2, 1.2, 1.2), 0.2)
    tween.tween_property(_sprite, "modulate", Color.CYAN, 0.2)
    tween.tween_callback(func(): _sprite.modulate = _get_faction_color())
    tween.tween_property(self, "scale", Vector3(1.0, 1.0, 1.0), 0.2)

    animation_completed.emit("cast")

func _play_hurt_animation() -> void:
    var tween := create_tween()
    tween.set_parallel(true)
    tween.tween_property(_sprite, "modulate", Color.RED, 0.1)
    tween.tween_callback(func(): _sprite.modulate = _get_faction_color()).set_delay(0.1)
    tween.tween_property(self, "position", position + Vector3(0, 0, -0.2), 0.05)
    tween.tween_property(self, "position", position, 0.05)

    animation_completed.emit("hurt")

func _play_idle_animation() -> void:
    # Subtle breathing/bobbing animation
    var tween := create_tween()
    tween.set_loops()
    tween.set_parallel(false)
    tween.tween_property(_sprite, "position:y", 0.05, 1.0).set_ease(
        Tween.EASE_IN_OUT
    )
    tween.tween_property(_sprite, "position:y", -0.05, 1.0).set_ease(
        Tween.EASE_IN_OUT
    )

    animation_completed.emit("idle")

## Helpers

func _get_faction_color() -> Color:
    match faction:
        FactionType.PLAYER:
            return Color(0.3, 0.7, 1.0)
        FactionType.ALLY:
            return Color(0.3, 1.0, 0.5)
        FactionType.ENEMY:
            return Color(1.0, 0.3, 0.3)
        _:
            return Color(0.8, 0.8, 0.8)

func get_size_in_cells() -> Vector2i:
    match size:
        CreatureSize.TINY:
            return Vector2i(1, 1)
        CreatureSize.SMALL:
            return Vector2i(1, 1)
        CreatureSize.MEDIUM:
            return Vector2i(1, 1)
        CreatureSize.LARGE:
            return Vector2i(2, 2)
        CreatureSize.HUGE:
            return Vector3(3, 3)
        CreatureSize.GARGANTUAN:
            return Vector2i(4, 4)
    return Vector2i(1, 1)
```

### Condition Effects

```gdscript
class_name ConditionEffect
extends Node3D

## Visual representation of status conditions (poisoned, stunned, etc.)

signal condition_expired(condition_id: String)

@export var condition_id: String
@export var display_name: String
@export var duration: int = -1  # -1 = permanent, 0 = expired
@export var icon_texture: Texture2D

var _icon: Sprite3D
var _particles: GPUParticles3D
var _target_token: Token

func _ready() -> void:
    _create_icon()
    _create_particles()

func _create_icon() -> void:
    _icon = Sprite3D.new()
    _icon.texture = icon_texture
    _icon.pixel_size = 0.005
    _icon.billboard = BaseMaterial3D.BILLBOARD_ENABLED
    _icon.position = Vector3(0, 3.0, 0)
    add_child(_icon)

func _create_particles() -> void:
    _particles = GPUParticles3D.new()
    _particles.position = Vector3(0, 1.5, 0)
    add_child(_particles)

    _configure_particles_for_condition()

func _configure_particles_for_condition() -> void:
    match condition_id:
        "poisoned":
            _configure_poison_particles()
        "burning":
            _configure_burning_particles()
        "frozen":
            _configure_frozen_particles()
        "blessed":
            _configure_blessed_particles()
        "cursed":
            _configure_cursed_particles()

func _configure_poison_particles() -> void:
    var mat := StandardMaterial3D.new()
    mat.albedo_color = Color(0.3, 0.8, 0.2)
    mat.emission = Color(0.2, 0.5, 0.1)
    mat.emission_energy = 2.0

    _particles.draw_pass_1 = SphereMesh.new()
    _particles.draw_pass_1.radius = 0.05
    _particles.draw_pass_1.material = mat
    _particles.amount = 20
    _particles.lifetime = 2.0
    _particles.process_material = _create_poison_process_material()

func _create_poison_process_material() -> ParticleProcessMaterial:
    var mat := ParticleProcessMaterial.new()
    mat.gravity = Vector3(0, -0.5, 0)
    mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
    mat.emission_sphere_radius = 0.5
    mat.tangential_accel_min = -0.5
    mat.tangential_accel_max = 0.5
    return mat

func _configure_burning_particles() -> void:
    var mat := StandardMaterial3D.new()
    mat.albedo_color = Color(1.0, 0.5, 0.1)
    mat.emission = Color(1.0, 0.3, 0.0)
    mat.emission_energy = 3.0

    _particles.draw_pass_1 = SphereMesh.new()
    _particles.draw_pass_1.radius = 0.03
    _particles.draw_pass_1.material = mat
    _particles.amount = 50
    _particles.lifetime = 1.0
    _particles.process_material = _create_burning_process_material()

func _create_burning_process_material() -> ParticleProcessMaterial:
    var mat := ParticleProcessMaterial.new()
    mat.gravity = Vector3(0, -2.0, 0)
    mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
    mat.emission_extents = Vector3(0.4, 0.1, 0.4)
    mat.scale_curve = _create_burning_scale_curve()
    return mat

func _create_burning_scale_curve() -> Curve:
    var curve := Curve.new()
    curve.add_point(0.0, 1.0)
    curve.add_point(0.5, 0.5)
    curve.add_point(1.0, 0.0)
    return curve

func _configure_frozen_particles() -> void:
    var mat := StandardMaterial3D.new()
    mat.albedo_color = Color(0.7, 0.9, 1.0)
    mat.emission = Color(0.5, 0.7, 1.0)
    mat.emission_energy = 1.5
    mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA

    _particles.draw_pass_1 = BoxMesh.new()
    _particles.draw_pass_1.size = Vector3(0.05, 0.05, 0.05)
    _particles.draw_pass_1.material = mat
    _particles.amount = 30
    _particles.lifetime = 0.5

func _configure_blessed_particles() -> void:
    var mat := StandardMaterial3D.new()
    mat.albedo_color = Color(1.0, 1.0, 0.7)
    mat.emission = Color(1.0, 0.9, 0.5)
    mat.emission_energy = 2.0

    _particles.draw_pass_1 = SphereMesh.new()
    _particles.draw_pass_1.radius = 0.02
    _particles.draw_pass_1.material = mat
    _particles.amount = 40
    _particles.lifetime = 1.5
    _particles.process_material = _create_rising_process_material()

func _configure_cursed_particles() -> void:
    var mat := StandardMaterial3D.new()
    mat.albedo_color = Color(0.5, 0.1, 0.7)
    mat.emission = Color(0.3, 0.0, 0.5)
    mat.emission_energy = 2.0

    _particles.draw_pass_1 = SphereMesh.new()
    _particles.draw_pass_1.radius = 0.03
    _particles.draw_pass_1.material = mat
    _particles.amount = 30
    _particles.lifetime = 2.0
    _particles.process_material = _create_cursed_process_material()

func _create_rising_process_material() -> ParticleProcessMaterial:
    var mat := ParticleProcessMaterial.new()
    mat.gravity = Vector3(0, 1.0, 0)
    mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
    mat.emission_sphere_radius = 0.5
    return mat

func _create_cursed_process_material() -> ParticleProcessMaterial:
    var mat := ParticleProcessMaterial.new()
    mat.gravity = Vector3(0, 0.5, 0)
    mat.tangential_accel_min = -1.0
    mat.tangential_accel_max = 1.0
    mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_POINT
    return mat

func apply_to_token(token: Token) -> void:
    _target_token = token

func tick() -> void:
    if duration > 0:
        duration -= 1
        if duration == 0:
            condition_expired.emit(condition_id)
            queue_free()

func set_icon_position(pos: Vector3) -> void:
    if _icon:
        _icon.position = pos
```

### 3D Miniature Viewer

```gdscript
class_name MiniatureViewer
extends Control

## 3D character model viewer for detailed character inspection

@onready var viewport_container: SubViewportContainer = $VBoxContainer/ViewportContainer
@onready var viewport: SubViewport = $VBoxContainer/ViewportContainer/SubViewport
@onready var camera_3d: Camera3D = $VBoxContainer/ViewportContainer/SubViewport/Camera3D
@onready var lighting: DirectionalLight3D = $VBoxContainer/ViewportContainer/SubViewport/DirectionalLight3D
@onready var character_root: Node3D = $VBoxContainer/ViewportContainer/SubViewport/CharacterRoot

@onready var name_label: Label = $VBoxContainer/NameLabel
@onready var class_label: Label = $VBoxContainer/ClassLabel
@onready var level_label: Label = $VBoxContainer/LevelLabel
@onready var hp_bar: ProgressBar = $VBoxContainer/HPBar
@onready var stats_panel: VBoxContainer = $VBoxContainer/StatsPanel

var current_character: Node3D
var rotation_speed: float = 0.5
var zoom_level: float = 3.0
var target_rotation: float = 0.0

func _ready() -> void:
    viewport.world_3d = World3D.new()
    viewport.render_target_update_mode = SubViewport.UPDATE_ONCE
    _setup_lighting()

func _setup_lighting() -> void:
    # Three-point lighting setup
    var key_light := DirectionalLight3D.new()
    key_light.light_color = Color(1.0, 0.95, 0.9)
    key_light.light_energy = 1.0
    key_light.position = Vector3(-2, 3, 2)
    key_light.look_at(Vector3.ZERO)
    viewport.add_child(key_light)

    var fill_light := DirectionalLight3D.new()
    fill_light.light_color = Color(0.7, 0.8, 1.0)
    fill_light.light_energy = 0.4
    fill_light.position = Vector3(2, 2, -2)
    fill_light.look_at(Vector3.ZERO)
    viewport.add_child(fill_light)

    var rim_light := DirectionalLight3D.new()
    rim_light.light_color = Color(1.0, 0.9, 0.8)
    rim_light.light_energy = 0.6
    rim_light.position = Vector3(0, 1, -3)
    rim_light.look_at(Vector3.ZERO)
    viewport.add_child(rim_light)

func load_character(character_scene: PackedScene) -> void:
    if current_character:
        current_character.queue_free()

    current_character = character_scene.instantiate()
    character_root.add_child(current_character)
    viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS

func display_character_data(data: Dictionary) -> void:
    name_label.text = data.get("name", "Unknown")
    class_label.text = data.get("class", "Adventurer")
    level_label.text = "Level " + str(data.get("level", 1))

    var hp = data.get("hp", 10)
    var max_hp = data.get("max_hp", 10)
    hp_bar.value = float(hp) / float(max_hp) * 100.0
    hp_bar.text = "%d / %d" % [hp, max_hp]

    _update_stats_panel(data)

func _update_stats_panel(data: Dictionary) -> void:
    for child in stats_panel.get_children():
        child.queue_free()

    var stats = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"]
    for stat in stats:
        var stat_key := stat.to_lower().substr(0, 3)
        var stat_value = data.get(stat_key, 10)

        var stat_row := HBoxContainer.new()
        stats_panel.add_child(stat_row)

        var stat_label := Label.new()
        stat_label.text = stat + ":"
        stat_label.custom_minimum_size = Vector2(100, 0)
        stat_row.add_child(stat_label)

        var value_label := Label.new()
        value_label.text = str(stat_value)
        stat_row.add_child(value_label)

func _input(event: InputEvent) -> void:
    if not visible:
        return

    if event is InputEventMouseMotion:
        if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
            target_rotation += event.relative.x * rotation_speed * 0.01

    if event is InputEventMouseButton:
        if event.button_index == MOUSE_BUTTON_WHEEL_UP:
            zoom_level = maxf(1.5, zoom_level - 0.3)
        elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
            zoom_level = minf(8.0, zoom_level + 0.3)

func _process(_delta: float) -> void:
    if current_character:
        current_character.rotation.y = lerp_angle(
            current_character.rotation.y,
            target_rotation,
            0.1
        )

    camera_3d.position.z = lerp(camera_3d.position.z, zoom_level, 0.1)
```

---

## Effect Visualization

### Effect Manager

```gdscript
class_name EffectManager
extends Node3D

## Central manager for spell and ability effects

signal effect_started(effect_id: String)
signal effect_completed(effect_id: String)
signal effect_triggered(trigger_type: String, data: Dictionary)

var _active_effects: Dictionary = {}  # String -> EffectInstance
var _effect_library: EffectLibrary

@onready var audio_player: AudioStreamPlayer3D = $AudioPlayer3D

func _ready() -> void:
    _effect_library = EffectLibrary.new()

## Public API

func play_effect(
    effect_name: String,
    target_position: Vector3,
    target_nodes: Array[Node3D] = [],
    parameters: Dictionary = {}
) -> String:
    var effect_data := _effect_library.get_effect(effect_name)
    if not effect_data:
        push_error("Effect not found: %s" % effect_name)
        return ""

    var effect_id := effect_name + "_" + str(Time.get_ticks_msec())
    var effect := EffectInstance.new(effect_id, effect_data, target_position, target_nodes, parameters)

    add_child(effect)
    _active_effects[effect_id] = effect

    effect.completed.connect(_on_effect_completed.bind(effect_id))
    effect.triggered.connect(_on_effect_triggered)

    effect.execute()
    effect_started.emit(effect_id)

    return effect_id

func stop_effect(effect_id: String) -> void:
    if _active_effects.has(effect_id):
        _active_effects[effect_id].stop()
        _active_effects.erase(effect_id)

func stop_all_effects() -> void:
    for effect in _active_effects.values():
        effect.stop()
    _active_effects.clear()

## Callbacks

func _on_effect_completed(effect_id: String) -> void:
    _active_effects.erase(effect_id)
    effect_completed.emit(effect_id)

func _on_effect_triggered(trigger_type: String, data: Dictionary) -> void:
    effect_triggered.emit(trigger_type, data)

## Effect Presets

func play_fireball(target_position: Vector3, damage: int = 0) -> String:
    return play_effect(
        "fireball",
        target_position,
        [],
        {
            "damage": damage,
            "radius": 20.0,
            "color": Color.ORANGE_RED
        }
    )

func play_heal(target_node: Node3D, amount: int = 0) -> String:
    return play_effect(
        "heal",
        target_node.global_position,
        [target_node],
        {"amount": amount}
    )

func play_lightning(target_position: Vector3) -> String:
    return play_effect("lightning", target_position)

func play_teleport(from: Vector3, to: Vector3) -> String:
    return play_effect("teleport", to, [], {"from_position": from})

func play_shield(target_node: Node3D, duration: float = 10.0) -> String:
    return play_effect(
        "shield",
        target_node.global_position,
        [target_node],
        {"duration": duration}
    )
```

### Effect Instance

```gdscript
class_name EffectInstance
extends Node3D

## Single instance of a spell/ability effect

signal completed(effect_id: String)
signal triggered(trigger_type: String, data: Dictionary)

var effect_id: String
var effect_data: EffectData
var target_position: Vector3
var target_nodes: Array[Node3D]
var parameters: Dictionary

var _is_running: bool = false
var _current_stage := 0
var _stages: Array[EffectStage]

func _init(
    p_id: String,
    p_data: EffectData,
    p_position: Vector3,
    p_targets: Array[Node3D],
    p_params: Dictionary
) -> void:
    effect_id = p_id
    effect_data = p_data
    target_position = p_position
    target_nodes = p_targets
    parameters = p_params

    _build_stages()

func _ready() -> void:
    global_position = target_position

func execute() -> void:
    if _stages.is_empty():
        completed.emit(effect_id)
        return

    _is_running = true
    _run_stage(0)

func stop() -> void:
    _is_running = false
    _cleanup()

func _build_stages() -> void:
    _stages.clear()

    # Build stages from effect data
    for stage_def in effect_data.stages:
        var stage := EffectStage.new(stage_def)
        _stages.append(stage)

func _run_stage(index: int) -> void:
    if not _is_running or index >= _stages.size():
        _cleanup()
        completed.emit(effect_id)
        return

    _current_stage = index
    var stage := _stages[index]

    # Execute stage
    stage.execute(
        self,
        target_position,
        target_nodes,
        parameters,
        _on_stage_completed.bind(index + 1)
    )

func _on_stage_completed(next_index: int) -> void:
    # Check for triggers
    _check_triggers()

    # Run next stage
    _run_stage(next_index)

func _check_triggers() -> void:
    for trigger in effect_data.triggers:
        if trigger.condition.is_met(self):
            triggered.emit(trigger.type, trigger.data)

func _cleanup() -> void:
    _is_running = false
    queue_free()
```

### Effect Library

```gdscript
class_name EffectLibrary
extends RefCounted

## Library of pre-defined visual effects

var _effects: Dictionary = {}

func _init() -> void:
    _register_default_effects()

func get_effect(effect_name: String) -> EffectData:
    return _effects.get(effect_name.to_lower())

func register_effect(data: EffectData) -> void:
    _effects[data.name.to_lower()] = data

func _register_default_effects() -> void:
    _register_fireball()
    _register_heal()
    _register_lightning()
    _register_teleport()
    _register_shield()
    _register_poison_cloud()
    _register_ice_spike()
    _register_holy_smite()
    _register_summon()

func _register_fireball() -> void:
    var data := EffectData.new()
    data.name = "Fireball"
    data.sound = "res://audio/effects/fireball.wav"
    data.duration = 2.0

    # Impact stage
    var impact := EffectStage.new({
        "type": "particles",
        "duration": 1.5,
        "particles": {
            "scene": "res://scenes/effects/fire_particles.tscn",
            "count": 100,
            "spread": 20.0,
            "color": Color.ORANGE_RED
        }
    })
    data.stages.append(impact)

    # Light flash
    var flash := EffectStage.new({
        "type": "light",
        "duration": 0.2,
        "light": {
            "color": Color.ORANGE,
            "intensity": 5.0,
            "range": 30.0
        }
    })
    data.stages.append(flash)

    # Camera shake
    var shake := EffectStage.new({
        "type": "camera_shake",
        "duration": 0.5,
        "intensity": 0.3
    })
    data.stages.append(shake)

    # Damage trigger
    data.triggers.append(EffectTrigger.new(
        "damage",
        func(effect): return effect._current_stage >= 1,
        {"delay": 0.3}
    ))

    register_effect(data)

func _register_heal() -> void:
    var data := EffectData.new()
    data.name = "Heal"
    data.sound = "res://audio/effects/heal.wav"
    data.duration = 1.5

    # Rising particles
    var particles := EffectStage.new({
        "type": "particles",
        "duration": 1.0,
        "particles": {
            "scene": "res://scenes/effects/heal_particles.tscn",
            "count": 50,
            "spread": 2.0,
            "color": Color(0.3, 1.0, 0.3)
        }
    })
    data.stages.append(particles)

    # Light beam
    var beam := EffectStage.new({
        "type": "beam",
        "duration": 1.0,
        "beam": {
            "color": Color(0.5, 1.0, 0.5),
            "width": 0.5,
            "height": 10.0
        }
    })
    data.stages.append(beam)

    register_effect(data)

func _register_lightning() -> void:
    var data := EffectData.new()
    data.name = "Lightning"
    data.sound = "res://audio/effects/lightning.wav"
    data.duration = 0.8

    # Lightning bolt
    var bolt := EffectStage.new({
        "type": "lightning",
        "duration": 0.3,
        "lightning": {
            "color": Color(0.5, 0.7, 1.0),
            "branches": 5,
            "jitter": 0.5
        }
    })
    data.stages.append(bolt)

    # Light flash
    var flash := EffectStage.new({
        "type": "light",
        "duration": 0.1,
        "light": {
            "color": Color(0.7, 0.8, 1.0),
            "intensity": 8.0,
            "range": 50.0
        }
    })
    data.stages.append(flash)

    register_effect(data)

func _register_teleport() -> void:
    var data := EffectData.new()
    data.name = "Teleport"
    data.sound = "res://audio/effects/teleport.wav"
    data.duration = 1.0

    # Departure effect
    var depart := EffectStage.new({
        "type": "scale_out",
        "duration": 0.3,
        "targets": "source"
    })
    data.stages.append(depart)

    # Arrival effect
    var arrive := EffectStage.new({
        "type": "scale_in",
        "duration": 0.3,
        "targets": "destination",
        "delay": 0.4
    })
    data.stages.append(arrive)

    # Portal effect
    var portal := EffectStage.new({
        "type": "portal",
        "duration": 0.8,
        "portal": {
            "color": Color.CYAN,
            "inner_color": Color(0.2, 0.0, 0.5),
            "size": 2.0
        }
    })
    data.stages.append(portal)

    register_effect(data)

func _register_shield() -> void:
    var data := EffectData.new()
    data.name = "Shield"
    data.sound = "res://audio/effects/shield.wav"
    data.duration = 0.5

    # Shield sphere
    var sphere := EffectStage.new({
        "type": "shield_sphere",
        "duration": 0.0,  # Persistent
        "shield": {
            "color": Color(0.3, 0.5, 1.0),
            "opacity": 0.3,
            "pulse": true
        }
    })
    data.stages.append(sphere)

    register_effect(data)

func _register_poison_cloud() -> void:
    var data := EffectData.new()
    data.name = "Poison Cloud"
    data.sound = "res://audio/effects/poison.wav"
    data.duration = 5.0

    # Cloud particles
    var cloud := EffectStage.new({
        "type": "particles",
        "duration": 5.0,
        "particles": {
            "scene": "res://scenes/effects/poison_cloud.tscn",
            "count": 200,
            "spread": 15.0,
            "color": Color(0.3, 0.7, 0.2)
        }
    })
    data.stages.append(cloud)

    # Area damage trigger
    data.triggers.append(EffectTrigger.new(
        "area_damage",
        func(effect): return true,
        {"interval": 1.0, "total": 5}
    ))

    register_effect(data)

func _register_ice_spike() -> void:
    var data := EffectData.new()
    data.name = "Ice Spike"
    data.sound = "res://audio/effects/ice.wav"
    data.duration = 1.0

    # Spike formation
    var spike := EffectStage.new({
        "type": "mesh_animation",
        "duration": 0.5,
        "mesh": {
            "scene": "res://scenes/effects/ice_spike.tscn",
            "animation": "rise",
            "scale": Vector3(1, 3, 1)
        }
    })
    data.stages.append(spike)

    # Shatter
    var shatter := EffectStage.new({
        "type": "shatter",
        "duration": 0.3,
        "delay": 0.7,
        "particles": {
            "count": 30,
            "color": Color(0.8, 0.9, 1.0)
        }
    })
    data.stages.append(shatter)

    register_effect(data)

func _register_holy_smite() -> void:
    var data := EffectData.new()
    data.name = "Holy Smite"
    data.sound = "res://audio/effects/holy.wav"
    data.duration = 1.5

    # Light beam from above
    var beam := EffectStage.new({
        "type": "vertical_beam",
        "duration": 1.0,
        "beam": {
            "color": Color(1.0, 1.0, 0.7),
            "width_start": 0.1,
            "width_end": 3.0,
            "height": 50.0
        }
    })
    data.stages.append(beam)

    # Impact burst
    var burst := EffectStage.new({
        "type": "burst",
        "duration": 0.5,
        "delay": 0.5,
        "burst": {
            "color": Color(1.0, 0.9, 0.5),
            "rays": 12,
            "length": 5.0
        }
    })
    data.stages.append(burst)

    register_effect(data)

func _register_summon() -> void:
    var data := EffectData.new()
    data.name = "Summon"
    data.sound = "res://audio/effects/summon.wav"
    data.duration = 2.0

    # Magic circle
    var circle := EffectStage.new({
        "type": "magic_circle",
        "duration": 2.0,
        "circle": {
            "radius": 3.0,
            "color": Color(0.5, 0.2, 0.8),
            "rotate": true,
            "glow": true
        }
    })
    data.stages.append(circle)

    # Rising entity
    var rise := EffectStage.new({
        "type": "rise_from_ground",
        "duration": 1.0,
        "delay": 0.5,
        "target": "summoned"
    })
    data.stages.append(rise)

    register_effect(data)
```

### Effect Data Classes

```gdscript
class_name EffectData
extends RefCounted

var name: String
var sound: String = ""
var duration: float = 1.0
var stages: Array[EffectStage] = []
var triggers: Array[EffectTrigger] = []

func _init(p_data: Dictionary = {}) -> void:
    if p_data.has("name"):
        name = p_data.name
    if p_data.has("sound"):
        sound = p_data.sound
    if p_data.has("duration"):
        duration = p_data.duration


class_name EffectStage
extends RefCounted

var type: String
var duration: float
var delay: float = 0.0
var parameters: Dictionary = {}

func _init(p_data: Dictionary) -> void:
    type = p_data.get("type", "unknown")
    duration = p_data.get("duration", 1.0)
    delay = p_data.get("delay", 0.0)
    parameters = p_data.get("parameters", {})

func execute(
    effect: EffectInstance,
    position: Vector3,
    targets: Array[Node3D],
    params: Dictionary,
    callback: Callable
) -> void:
    # Implementation depends on stage type
    match type:
        "particles":
            _execute_particles(effect, position, params)
        "light":
            _execute_light(effect, position, params)
        "camera_shake":
            _execute_camera_shake(params)
        _:
            push_warning("Unknown effect stage type: %s" % type)

    # Schedule callback
    if duration > 0:
        var timer := effect.get_tree().create_timer(duration + delay)
        timer.timeout.connect(func(): callback.call())


class_name EffectTrigger
extends RefCounted

var type: String
var condition: Callable
var data: Dictionary = {}

func _init(p_type: String, p_condition: Callable, p_data: Dictionary = {}) -> void:
    type = p_type
    condition = p_condition
    data = p_data
```

---

## Theia Integration

### DMLoG Panel Extension

```typescript
/**
 * DMLoG Panel Extension for Theia IDE
 *
 * Extends si-godot-embed for TTRPG-specific features.
 * Located at: apps/theia-ide/extensions/si-dmlog-panel/
 */

import { injectable } from '@theia/core/shared/inversify';
import { Widget } from '@theia/core/lib/browser/widgets/widget';
import { GodotWebSocketService } from 'si-godot-embed/lib/browser/godot-websocket';

export type DMLogMessageHandler = (data: DMLogMessage) => void;

export interface DMLogMessage {
  type: DMLogMessageType;
  data: unknown;
  timestamp: number;
}

export type DMLogMessageType =
  | 'battle_map_created'
  | 'token_added'
  | 'token_moved'
  | 'effect_triggered'
  | 'initiative_updated'
  | 'condition_applied'
  | 'dice_rolled'
  | 'fog_updated'
  | 'turn_started'
  | 'combat_started'
  | 'combat_ended';

/**
 * Battle map configuration
 */
export interface BattleMapConfig {
  name: string;
  width: number;  // cells
  height: number; // cells
  cellSize: number; // feet (typically 5)
  terrain?: TerrainCell[][];
  lighting?: LightingConfig;
  fogEnabled?: boolean;
}

export interface TerrainCell {
  type: 'floor' | 'wall' | 'water' | 'lava' | 'pit';
  height?: number;
  difficult?: boolean;
}

export interface LightingConfig {
  ambient: { r: number; g: number; b: number };
  darkness: { r: number; g: number; b: number };
}

/**
 * Token data for battle map
 */
export interface TokenData {
  id: string;
  name: string;
  faction: 'player' | 'ally' | 'enemy' | 'neutral';
  texture?: string;
  position: { x: number; y: number };
  hp: number;
  maxHp: number;
  ac: number;
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
  conditions?: string[];
}

/**
 * Effect trigger request
 */
export interface EffectRequest {
  effectName: string;
  targetPosition?: { x: number; y: number; z: number };
  targetTokens?: string[];
  parameters?: Record<string, unknown>;
}

/**
 * Initiative order entry
 */
export interface InitiativeEntry {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  maxHp: number;
  isCurrent: boolean;
}

/**
 * Dice roll request/response
 */
export interface DiceRoll {
  formula: string;  // e.g., "2d6+5", "1d20", "4d6kh3"
  reason?: string;
  result?: DiceRollResult;
}

export interface DiceRollResult {
  total: number;
  rolls: Array<{ die: string; value: number; kept: boolean }>;
  modifier: number;
  critical: 'success' | 'failure' | null;
}

/**
 * Condition data
 */
export interface ConditionData {
  id: string;
  tokenId: string;
  conditionType: string;
  duration: number; // -1 for permanent
  displayName: string;
}

@injectable()
export class DMLogGodotService extends GodotWebSocketService {
  private dmHandlers: DMLogMessageHandler[] = [];
  private currentMap: BattleMapConfig | null = null;
  private tokens: Map<string, TokenData> = new Map();
  private initiative: InitiativeEntry[] = [];
  private currentTurnIndex = 0;

  async connect(): Promise<void> {
    await super.connect();

    // Add DM-specific message handler
    this.onMessage(this._handleDMLogMessage.bind(this));
  }

  /**
   * Battle Map Operations
   */

  async createBattleMap(config: BattleMapConfig): Promise<void> {
    this.send('create_battle_map', config);
    this.currentMap = config;
  }

  async loadBattleMap(scenePath: string): Promise<void> {
    this.send('load_battle_map', { scene: scenePath });
  }

  async setTerrain(cell: { x: number; y: number }, terrain: TerrainCell): Promise<void> {
    this.send('set_terrain', { cell, terrain });
  }

  async updateFogOfWar(
    playerPositions: Array<{ x: number; y: number }>,
    visionRange: number
  ): Promise<void> {
    this.send('update_fog', { positions: playerPositions, range: visionRange });
  }

  async revealAll(): Promise<void> {
    this.send('fog_reveal_all', {});
  }

  async hideAll(): Promise<void> {
    this.send('fog_hide_all', {});
  }

  /**
   * Token Operations
   */

  async addToken(token: TokenData): Promise<void> {
    this.send('add_token', token);
    this.tokens.set(token.id, token);
  }

  async removeToken(tokenId: string): Promise<void> {
    this.send('remove_token', { id: tokenId });
    this.tokens.delete(tokenId);
  }

  async moveToken(tokenId: string, position: { x: number; y: number }): Promise<void> {
    this.send('move_token', { id: tokenId, position });
    const token = this.tokens.get(tokenId);
    if (token) {
      token.position = position;
    }
  }

  async updateTokenHP(tokenId: string, hp: number): Promise<void> {
    this.send('update_hp', { id: tokenId, hp });
    const token = this.tokens.get(tokenId);
    if (token) {
      token.hp = hp;
    }
  }

  /**
   * Effect Operations
   */

  async playEffect(request: EffectRequest): Promise<string> {
    const effectId = `effect_${Date.now()}`;
    this.send('play_effect', { ...request, effectId });
    return effectId;
  }

  async playFireball(position: { x: number; y: number }, damage: number): Promise<void> {
    return this.playEffect({
      effectName: 'fireball',
      targetPosition: { x: position.x, y: 0, z: position.y },
      parameters: { damage }
    });
  }

  async playHeal(tokenId: string, amount: number): Promise<void> {
    const token = this.tokens.get(tokenId);
    if (token) {
      return this.playEffect({
        effectName: 'heal',
        targetPosition: { x: token.position.x, y: 0, z: token.position.y },
        targetTokens: [tokenId],
        parameters: { amount }
      });
    }
  }

  async playLightning(targetPosition: { x: number; y: number }): Promise<void> {
    return this.playEffect({
      effectName: 'lightning',
      targetPosition: { x: targetPosition.x, y: 0, z: targetPosition.y }
    });
  }

  async playTeleport(
    tokenId: string,
    from: { x: number; y: number },
    to: { x: number; y: number }
  ): Promise<void> {
    return this.playEffect({
      effectName: 'teleport',
      targetTokens: [tokenId],
      parameters: {
        fromPosition: { x: from.x, y: 0, z: from.y },
        toPosition: { x: to.x, y: 0, z: to.y }
      }
    });
  }

  /**
   * Initiative Operations
   */

  async setInitiative(entries: InitiativeEntry[]): Promise<void> {
    this.send('set_initiative', { entries });
    this.initiative = entries;
  }

  async startCombat(): Promise<void> {
    this.send('start_combat', {});
  }

  async endCombat(): Promise<void> {
    this.send('end_combat', {});
  }

  async nextTurn(): Promise<void> {
    this.send('next_turn', {});
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.initiative.length;
    this._updateCurrentTurn();
  }

  async previousTurn(): Promise<void> {
    this.send('prev_turn', {});
    this.currentTurnIndex =
      (this.currentTurnIndex - 1 + this.initiative.length) % this.initiative.length;
    this._updateCurrentTurn();
  }

  private _updateCurrentTurn(): void {
    this.initiative.forEach((entry, i) => {
      entry.isCurrent = i === this.currentTurnIndex;
    });
  }

  /**
   * Condition Operations
   */

  async applyCondition(condition: ConditionData): Promise<void> {
    this.send('apply_condition', condition);
  }

  async removeCondition(tokenId: string, conditionId: string): Promise<void> {
    this.send('remove_condition', { tokenId, conditionId });
  }

  /**
   * Dice Operations
   */

  async rollDice(roll: DiceRoll): Promise<DiceRollResult> {
    return new Promise((resolve) => {
      const handler = (data: DMLogMessage) => {
        if (data.type === 'dice_rolled') {
          const result = data.data as DiceRollResult;
          if (result && roll.formula === result?.toString()) {
            resolve(result);
            this.offMessage(handler);
          }
        }
      };
      this.onDMLogMessage(handler);
      this.send('roll_dice', roll);
    });
  }

  async rollD20(modifier: number = 0, reason?: string): Promise<DiceRollResult> {
    return this.rollDice({ formula: '1d20', modifier, reason });
  }

  async rollDamage(dice: string, modifier: number = 0): Promise<DiceRollResult> {
    return this.rollDice({ formula: dice, modifier, reason: 'damage' });
  }

  /**
   * Grid Operations
   */

  async showGrid(show: boolean): Promise<void> {
    this.send('show_grid', { show });
  }

  async setGridColor(color: { r: number; g: number; b: number; a: number }): Promise<void> {
    this.send('set_grid_color', { color });
  }

  async setGridSize(size: number): Promise<void> {
    this.send('set_grid_size', { size });
  }

  /**
   * Camera Operations
   */

  async panToPosition(position: { x: number; y: number }): Promise<void> {
    this.send('pan_camera', { position });
  }

  async zoomToLevel(level: number): Promise<void> {
    this.send('zoom_camera', { level });
  }

  async focusToken(tokenId: string): Promise<void> {
    const token = this.tokens.get(tokenId);
    if (token) {
      this.send('focus_token', { tokenId, position: token.position });
    }
  }

  /**
   * DM Message Handlers
   */

  onDMLogMessage(handler: DMLogMessageHandler): void {
    this.dmHandlers.push(handler);
  }

  offMessage(handler: DMLogMessageHandler): void {
    const index = this.dmHandlers.indexOf(handler);
    if (index >= 0) {
      this.dmHandlers.splice(index, 1);
    }
  }

  private _handleDMLogMessage(data: unknown): void {
    try {
      const msg = data as DMLogMessage;
      this.dmHandlers.forEach((h) => h(msg));

      // Handle specific message types
      switch (msg.type) {
        case 'token_moved':
          this._handleTokenMoved(msg.data as { id: string; from: any; to: any });
          break;
        case 'initiative_updated':
          this._handleInitiativeUpdated(msg.data as { entries: InitiativeEntry[] });
          break;
        case 'turn_started':
          this._handleTurnStarted(msg.data as { tokenId: string });
          break;
      }
    } catch (e) {
      console.error('[DMLogService] Failed to handle message:', e);
    }
  }

  private _handleTokenMoved(data: { id: string; from: unknown; to: unknown }): void {
    const token = this.tokens.get(data.id);
    if (token && typeof data.to === 'object' && data.to !== null) {
      const pos = data.to as { x: number; y: number };
      token.position = pos;
    }
  }

  private _handleInitiativeUpdated(data: { entries: InitiativeEntry[] }): void {
    this.initiative = data.entries;
  }

  private _handleTurnStarted(data: { tokenId: string }): void {
    const index = this.initiative.findIndex((e) => e.id === data.tokenId);
    if (index >= 0) {
      this.currentTurnIndex = index;
      this._updateCurrentTurn();
    }
  }

  /**
   * Getters
   */

  getCurrentMap(): BattleMapConfig | null {
    return this.currentMap;
  }

  getTokens(): TokenData[] {
    return Array.from(this.tokens.values());
  }

  getToken(tokenId: string): TokenData | undefined {
    return this.tokens.get(tokenId);
  }

  getInitiative(): InitiativeEntry[] {
    return this.initiative;
  }

  getCurrentTurn(): InitiativeEntry | undefined {
    return this.initiative[this.currentTurnIndex];
  }

  isCombatActive(): boolean {
    return this.initiative.length > 0;
  }
}
```

### Theia Bridge for DMLoG

```gdscript
class_name DMLogTheiaBridge
extends Node

## DMLoG-specific Theia bridge implementation
## Extends shared TheiaBridge with TTRPG-specific functionality

signal battle_map_loaded(map_data: Dictionary)
signal combat_started(initiative: Array)
signal combat_ended()
signal turn_changed(token_id: String)
signal dice_rolled(result: Dictionary)

var _ws: WebSocketPeer
var _connected: bool = false
var _pending_messages: Array = []

const PORT = 7352
const HOST = "ws://localhost"

func _ready() -> void:
    _connect()

func _process(_delta: float) -> void:
    _poll()

func _connect() -> void:
    _ws = WebSocketPeer.new()
    var error := _ws.connect_to_url("%s:%d" % [HOST, PORT])
    if error != OK:
        print("Failed to connect to Theia: ", error)
        return

func _poll() -> void:
    _ws.poll()
    var state := _ws.get_ready_state()

    if state == WebSocketPeer.STATE_OPEN:
        if not _connected:
            _connected = true
            print("Connected to Theia")
            _send_pending()

        while _ws.get_available_packet_count() > 0:
            var data := _ws.get_packet()
            _handle_message(data)

    elif state == WebSocketPeer.STATE_CLOSED:
        _connected = false
        # Attempt reconnect
        if _ws.get_close_code() != 1000:
            await get_tree().create_timer(2.0).timeout
            _connect()

func send(type: String, data: Dictionary) -> void:
    var message := {
        type = type,
        data = data,
        timestamp = Time.get_ticks_msec()
    }

    var json := JSON.stringify(message)

    if _connected:
        _ws.send_text(json)
    else:
        _pending_messages.append(json)

func _send_pending() -> void:
    for msg in _pending_messages:
        _ws.send_text(msg)
    _pending_messages.clear()

func _handle_message(data: PackedByteArray) -> void:
    var json := data.get_string_from_utf8()
    var parsed := JSON.new()

    if parsed.parse(json) != OK:
        print("Failed to parse message: ", json)
        return

    var message := parsed.data
    var type := message.get("type", "")
    var msg_data := message.get("data", {})

    match type:
        "create_battle_map":
            _on_create_battle_map(msg_data)
        "add_token":
            _on_add_token(msg_data)
        "move_token":
            _on_move_token(msg_data)
        "play_effect":
            _on_play_effect(msg_data)
        "set_initiative":
            _on_set_initiative(msg_data)
        "start_combat":
            _on_start_combat()
        "end_combat":
            _on_end_combat()
        "next_turn":
            _on_next_turn()
        "apply_condition":
            _on_apply_condition(msg_data)
        "roll_dice":
            _on_roll_dice(msg_data)
        _:
            print("Unknown message type: ", type)

## DMLoG-specific handlers

func _on_create_battle_map(data: Dictionary) -> void:
    battle_map_loaded.emit(data)
    # Create battle map in scene
    var battle_map := get_node_or_null("/root/Main/BattleMap") as BattleMap
    if battle_map:
        battle_map.queue_free()

    battle_map = BattleMap.new()
    battle_map.name = "BattleMap"
    battle_map.grid_size = Vector2i(data.get("width", 20), data.get("height", 20))
    battle_map.cell_size = data.get("cellSize", 5.0)
    get_tree().root.add_child(battle_map)

func _on_add_token(data: Dictionary) -> void:
    var battle_map := get_node("/root/Main/BattleMap") as BattleMap
    if not battle_map:
        return

    var token := Token.new()
    token.token_id = data.get("id", "")
    token.display_name = data.get("name", "Unknown")
    token.faction = _parse_faction(data.get("faction", "neutral"))
    token.max_hp = data.get("maxHp", 10)
    token.current_hp = data.get("hp", 10)

    if data.has("texture"):
        token.texture = load(data.texture)

    var pos = data.get("position", {x = 0, y = 0})
    battle_map.add_token(token, Vector2i(pos.x, pos.y))

func _on_move_token(data: Dictionary) -> void:
    var battle_map := get_node("/root/Main/BattleMap") as BattleMap
    if not battle_map:
        return

    var token_id = data.get("id", "")
    var pos = data.get("position", {x = 0, y = 0})
    battle_map.move_token(token_id, Vector2i(pos.x, pos.y))

func _on_play_effect(data: Dictionary) -> void:
    var effect_manager := get_node("/root/Main/EffectManager") as EffectManager
    if not effect_manager:
        return

    var effect_name = data.get("effectName", "")
    var target_pos = data.get("targetPosition", {x = 0, y = 0, z = 0})
    var target_tokens = data.get("targetTokens", [])
    var parameters = data.get("parameters", {})

    effect_manager.play_effect(
        effect_name,
        Vector3(target_pos.x, target_pos.y, target_pos.z),
        target_tokens,
        parameters
    )

func _on_set_initiative(data: Dictionary) -> void:
    combat_started.emit(data.get("entries", []))

func _on_start_combat() -> void:
    var initiative_tracker := get_node("/root/Main/UI/InitiativeTracker")
    if initiative_tracker:
        initiative_tracker.show()

func _on_end_combat() -> void:
    combat_ended.emit()
    var initiative_tracker := get_node("/root/Main/UI/InitiativeTracker")
    if initiative_tracker:
        initiative_tracker.hide()

func _on_next_turn() -> void:
    # Advance turn based on current initiative order
    pass

func _on_apply_condition(data: Dictionary) -> void:
    var battle_map := get_node("/root/Main/BattleMap") as BattleMap
    if not battle_map:
        return

    var token_id = data.get("tokenId", "")
    var token := battle_map.get_token(token_id)
    if not token:
        return

    var condition := ConditionEffect.new()
    condition.condition_id = data.get("id", "")
    condition.display_name = data.get("displayName", "")
    condition.duration = data.get("duration", -1)

    token.add_condition(condition)

func _on_roll_dice(data: Dictionary) -> void:
    dice_rolled.emit(data)
    # Visual dice roll handled by DiceRoller3D

func _parse_faction(faction_string: String) -> Token.FactionType:
    match faction_string.to_lower():
        "player":
            return Token.FactionType.PLAYER
        "ally":
            return Token.FactionType.ALLY
        "enemy":
            return Token.FactionType.ENEMY
        _:
            return Token.FactionType.NEUTRAL

## DMLoG-specific senders

func send_token_moved(token_id: String, from: Vector2i, to: Vector2i) -> void:
    send("token_moved", {
        id = token_id,
        from = {x = from.x, y = from.y},
        to = {x = to.x, y = to.y}
    })

func send_effect_triggered(effect_name: String, targets: Array) -> void:
    send("effect_triggered", {
        effect = effect_name,
        targets = targets
    })

func send_initiative_updated(entries: Array) -> void:
    send("initiative_updated", {
        entries = entries
    })

func send_turn_started(token_id: String) -> void:
    send("turn_started", {
        tokenId = token_id
    })

func send_condition_applied(token_id: String, condition: String) -> void:
    send("condition_applied", {
        tokenId = token_id,
        condition = condition
    })

func send_dice_rolled(formula: String, result: int, rolls: Array) -> void:
    send("dice_rolled", {
        formula = formula,
        result = result,
        rolls = rolls
    })

func send_fog_updated(visible_cells: Array) -> void:
    send("fog_updated", {
        cells = visible_cells
    })

func send_combat_started() -> void:
    send("combat_started", {})

func send_combat_ended() -> void:
    send("combat_ended", {})
```

---

## Implementation

### Project Structure

```
dmlog-godot-project/
├── project.godot
├── addons/
│   ├── dmlog_battle_map/
│   │   ├── plugin.gd
│   │   └── plugin.cfg
│   ├── dmlog_tokens/
│   ├── dmlog_effects/
│   ├── dmlog_fog_of_war/
│   ├── dmlog_initiative/
│   └── shared/
│       └── theia_bridge/
├── scenes/
│   ├── main/
│   │   └── main.tscn
│   ├── battle_maps/
│   │   ├── dungeon_cellar.tscn
│   │   ├── forest_clearing.tscn
│   │   ├── tavern_interior.tscn
│   │   └── temple_ruins.tscn
│   ├── tokens/
│   │   ├── player_token.tscn
│   │   ├── goblin_token.tscn
│   │   └── dragon_token.tscn
│   ├── effects/
│   │   ├── fireball.tscn
│   │   ├── lightning_bolt.tscn
│   │   └── healing_circle.tscn
│   └── ui/
│       ├── initiative_tracker.tscn
│       ├── condition_panel.tscn
│       └── dice_roller.tscn
├── scripts/
│   ├── dmlog/
│   │   ├── battle_map.gd
│   │   ├── token.gd
│   │   ├── fog_of_war.gd
│   │   ├── effect_manager.gd
│   │   ├── initiative_tracker.gd
│   │   ├── condition_effect.gd
│   │   └── dice_roller.gd
│   └── shared/
│       └── theia_bridge.gd
└── shaders/
    ├── effects/
    │   ├── fireball.gdshader
    │   ├── lightning.gdshader
    │   ├── teleport.gdshader
    │   └── fog_of_war.gdshader
    └── post_processing/
        └── outline.gdshader
```

### Plugin Configuration

```gdscript
# addons/dmlog_battle_map/plugin.gd
@tool
extends EditorPlugin

var dock: Control

func _enter_tree() -> void:
    # Add battle map creation menu
    add_tool_menu_item("Create DMLoG Battle Map", _create_battle_map)

    # Create dock
    dock = preload("res://addons/dmlog_battle_map/dock.tscn").instantiate()
    add_control_to_dock(DOCK_SLOT_LEFT_UL, dock)

func _exit_tree() -> void:
    remove_control_from_docks(dock)
    remove_tool_menu_item("Create DMLoG Battle Map")

func _create_battle_map() -> void:
    var template := preload("res://scenes/battle_maps/battle_map_template.tscn")
    var instance := template.instantiate()
    EditorInterface.get_editor_main_screen().add_child(instance)
    instance.set_owner(EditorInterface.get_edited_scene_root())
```

```ini
# addons/dmlog_battle_map/plugin.cfg
[plugin]

name="DMLoG Battle Map System"
author="SuperInstance.AI"
description="Battle map system for TTRPG visualization"
version="1.0.0"
script="plugin.gd"
```

---

## Code Examples

### Creating a Battle Map

```gdscript
## Create a new battle map programmatically

func create_dungeon_battle_map() -> void:
    var map := BattleMap.new()
    map.grid_size = Vector2i(30, 20)  # 150x100 ft
    map.cell_size = 5.0  # 5ft squares
    map.name = "DungeonMap"
    get_tree().root.add_child(map)

    # Add walls
    for x in 30:
        map.set_terrain(Vector2i(x, 0), BattleMap.CellData.TerrainType.WALL)
        map.set_terrain(Vector2i(x, 19), BattleMap.CellData.TerrainType.WALL)

    for y in 20:
        map.set_terrain(Vector2i(0, y), BattleMap.CellData.TerrainType.WALL)
        map.set_terrain(Vector2i(29, y), BattleMap.CellData.TerrainType.WALL)

    # Add some columns
    var columns := [Vector2i(7, 7), Vector2i(7, 12), Vector2i(22, 7), Vector2i(22, 12)]
    for col in columns:
        map.set_terrain(col, BattleMap.CellData.TerrainType.WALL)
        var cell := map.get_cell(col)
        if cell:
            cell.is_obstacle = true

    # Add a pit trap
    for x in range(10, 15):
        for y in range(8, 12):
            map.set_terrain(Vector2i(x, y), BattleMap.CellData.TerrainType.PIT)

func create_forest_clearing() -> void:
    var map := BattleMap.new()
    map.grid_size = Vector2i(40, 40)
    map.cell_size = 5.0
    map.name = "ForestClearing"
    get_tree().root.add_child(map)

    # Add trees as obstacles
    var rng := RandomNumberGenerator.new()
    rng.randomize()

    for i in 50:
        var pos := Vector2i(
            rng.randi_range(2, 37),
            rng.randi_range(2, 37)
        )
        var cell := map.get_cell(pos)
        if cell:
            cell.is_obstacle = true
            cell.is_difficult = true  # Difficult terrain around trees

    # Add a stream
    for y in range(0, 40):
        map.set_terrain(Vector2i(20, y), BattleMap.CellData.TerrainType.WATER)
        if y > 10 and y < 15:
            # Shallow crossing
            var cell := map.get_cell(Vector2i(20, y))
            if cell:
                cell.is_difficult = true
```

### Token Management

```gdscript
## Token management examples

func spawn_player_characters() -> void:
    var map := get_node("/root/BattleMap") as BattleMap
    if not map:
        return

    # Fighter
    var fighter := Token.new()
    fighter.token_id = "fighter_1"
    fighter.display_name = "Thorin"
    fighter.faction = Token.FactionType.PLAYER
    fighter.texture = preload("res://textures/tokens/fighter.png")
    fighter.max_hp = 45
    fighter.current_hp = 45
    fighter.armor_class = 18
    fighter.speed = 30
    fighter.size = Token.CreatureSize.MEDIUM
    map.add_token(fighter, Vector2i(5, 10))

    # Wizard
    var wizard := Token.new()
    wizard.token_id = "wizard_1"
    wizard.display_name = "Elara"
    wizard.faction = Token.FactionType.PLAYER
    wizard.texture = preload("res://textures/tokens/wizard.png")
    wizard.max_hp = 24
    wizard.current_hp = 24
    wizard.armor_class = 12
    wizard.speed = 30
    wizard.size = Token.CreatureSize.MEDIUM
    map.add_token(wizard, Vector2i(4, 10))

    # Rogue
    var rogue := Token.new()
    rogue.token_id = "rogue_1"
    rogue.display_name = "Sylas"
    rogue.faction = Token.FactionType.PLAYER
    rogue.texture = preload("res://textures/tokens/rogue.png")
    rogue.max_hp = 32
    rogue.current_hp = 32
    rogue.armor_class = 16
    rogue.speed = 40
    rogue.size = Token.CreatureSize.MEDIUM
    map.add_token(rogue, Vector2i(6, 10))

func spawn_monster_encounter() -> void:
    var map := get_node("/root/BattleMap") as BattleMap
    if not map:
        return

    # Goblin boss
    var boss := Token.new()
    boss.token_id = "goblin_boss"
    boss.display_name = "Grishnak"
    boss.faction = Token.FactionType.ENEMY
    boss.texture = preload("res://textures/tokens/goblin_boss.png")
    boss.max_hp = 45
    boss.current_hp = 45
    boss.armor_class = 17
    boss.speed = 30
    boss.size = Token.CreatureSize.MEDIUM
    map.add_token(boss, Vector2i(25, 10))

    # Goblin minions
    for i in 4:
        var goblin := Token.new()
        goblin.token_id = "goblin_%d" % i
        goblin.display_name = "Goblin Warrior"
        goblin.faction = Token.FactionType.ENEMY
        goblin.texture = preload("res://textures/tokens/goblin.png")
        goblin.max_hp = 15
        goblin.current_hp = 15
        goblin.armor_class = 13
        goblin.speed = 30
        goblin.size = Token.CreatureSize.SMALL
        map.add_token(goblin, Vector2i(23 + i, 9 + (i % 2) * 2))

func apply_damage_to_token(token_id: String, damage: int) -> void:
    var map := get_node("/root/BattleMap") as BattleMap
    if not map:
        return

    var token := map.get_token(token_id)
    if token:
        token.modify_hp(-damage)
        token.play_animation("hurt")
```

### Effect Animations

```gdscript
## Effect animation examples

func cast_fireball(caster_position: Vector2i, target_position: Vector2i) -> void:
    var effect_manager := get_node("/root/EffectManager") as EffectManager
    if not effect_manager:
        return

    var target_world := Vector3(
        (target_position.x + 0.5) * 5.0,
        0,
        (target_position.y + 0.5) * 5.0
    )

    # Play fireball effect
    var effect_id := effect_manager.play_fireball(target_world, 28)  # 8d6 damage

    # Get tokens in blast radius (20ft = 4 cells)
    var map := get_node("/root/BattleMap") as BattleMap
    var affected_tokens := []

    for token in map.get_tokens():
        var distance := map.calculate_distance(target_position, token.grid_position)
        if distance <= 4:
            affected_tokens.append(token)

    # Apply damage after effect delay
    await get_tree().create_timer(0.5).timeout

    for token in affected_tokens:
        if token.faction == Token.FactionType.ENEMY:
            var damage := _roll_fireball_damage()
            var dex_save := _roll_dexterity_save(token)
            if dex_save >= 15:
                damage = damage / 2
            token.modify_hp(-damage)

func _roll_fireball_damage() -> int:
    var damage := 0
    for i in 8:
        damage += randi() % 6 + 1
    return damage

func _roll_dexterity_save(token: Token) -> int:
    # In production, this would query the character sheet
    return randi() % 20 + 1 + 2  # +2 DEX bonus

func cast_healing_word(caster_token_id: String, target_token_id: String) -> void:
    var map := get_node("/root/BattleMap") as BattleMap
    var effect_manager := get_node("/root/EffectManager") as EffectManager

    var target_token := map.get_token(target_token_id)
    if not target_token:
        return

    var heal_amount := 10  # 1d4 + 4 at level 5

    # Play heal effect
    effect_manager.play_heal(target_token, heal_amount)

    # Apply healing
    await get_tree().create_timer(0.3).timeout
    target_token.modify_hp(heal_amount)

func cast_lightning_bolt(caster_position: Vector3, direction: Vector2) -> void:
    var effect_manager := get_node("/root/EffectManager") as EffectManager

    # Calculate line path for lightning
    var path_points := []
    var current := caster_position
    var bolt_vector := Vector3(direction.x, 0, direction.y).normalized() * 10.0

    for i in 100:  # 100ft range
        path_points.append(current)
        current += bolt_vector * 0.5

        # Check if we hit a wall
        # (simplified - in production would do proper collision)

    # Play lightning effect
    effect_manager.play_effect("lightning", path_points[0])

func animate_teleport(token_id: String, from: Vector2i, to: Vector2i) -> void:
    var map := get_node("/root/BattleMap") as BattleMap
    var token := map.get_token(token_id)
    if not token:
        return

    var from_world := Vector3(
        (from.x + 0.5) * 5.0,
        0,
        (from.y + 0.5) * 5.0
    )

    var to_world := Vector3(
        (to.x + 0.5) * 5.0,
        0,
        (to.y + 0.5) * 5.0
    )

    # Play teleport effect
    var effect_manager := get_node("/root/EffectManager") as EffectManager
    effect_manager.play_teleport(from_world, to_world)

    # Move token during fade out
    await get_tree().create_timer(0.3).timeout
    map.move_token(token_id, to)
```

### Initiative Tracker

```gdscript
class_name InitiativeTracker
extends Control

## Initiative tracker UI for turn management

@onready var initiative_list: ItemList = $VBoxContainer/InitiativeList
@onready var next_button: Button = $VBoxContainer/NextTurnButton
@onready var prev_button: Button = $VBoxContainer/PrevTurnButton
@onready var current_label: Label = $VBoxContainer/CurrentTurnLabel
@onready var round_label: Label = $VBoxContainer/RoundLabel

var entries: Array[InitiativeEntry] = []
var current_index: int = 0
var round_number: int = 1

signal turn_changed(entry: InitiativeEntry)
signal round_changed(round: int)

func _ready() -> void:
    next_button.pressed.connect(_on_next_turn)
    prev_button.pressed.connect(_on_prev_turn)

func set_initiative(new_entries: Array[Dictionary]) -> void:
    entries.clear()
    initiative_list.clear()

    for entry_data in new_entries:
        var entry := InitiativeEntry.new()
        entry.id = entry_data.get("id", "")
        entry.name = entry_data.get("name", "Unknown")
        entry.initiative = entry_data.get("initiative", 0)
        entry.hp = entry_data.get("hp", 10)
        entry.max_hp = entry_data.get("maxHp", 10)

        entries.append(entry)
        initiative_list.add_item("%s (Init: %d)" % [entry.name, entry.initiative])

    # Sort by initiative (descending)
    entries.sort_custom(func(a, b): return a.initiative > b.initiative)
    _refresh_list()

    current_index = 0
    _update_current_turn()

func add_entry(id: String, name: String, initiative: int, hp: int, max_hp: int) -> void:
    var entry := InitiativeEntry.new()
    entry.id = id
    entry.name = name
    entry.initiative = initiative
    entry.hp = hp
    entry.max_hp = max_hp
    entry.is_current = false

    entries.append(entry)

    # Re-sort
    entries.sort_custom(func(a, b): return a.initiative > b.initiative)
    _refresh_list()

func remove_entry(id: String) -> void:
    entries = entries.filter(func(e): return e.id != id)
    _refresh_list()

func update_hp(id: String, hp: int) -> void:
    for entry in entries:
        if entry.id == id:
            entry.hp = hp
            break
    _refresh_list()

func next_turn() -> void:
    # Check if round is complete
    if current_index >= entries.size() - 1:
        current_index = 0
        round_number += 1
        round_changed.emit(round_number)
    else:
        current_index += 1

    _update_current_turn()
    _announce_turn()

func prev_turn() -> void:
    if current_index <= 0:
        if round_number > 1:
            round_number -= 1
            current_index = entries.size() - 1
            round_changed.emit(round_number)
    else:
        current_index -= 1

    _update_current_turn()

func _update_current_turn() -> void:
    for i in entries.size():
        entries[i].is_current = (i == current_index)

    _refresh_list()

    if current_index < entries.size():
        var entry := entries[current_index]
        current_label.text = "Current: %s" % entry.name
        turn_changed.emit(entry)

    round_label.text = "Round: %d" % round_number

func _refresh_list() -> void:
    initiative_list.clear()

    for i in entries.size():
        var entry := entries[i]
        var hp_percent := float(entry.hp) / float(entry.max_hp) * 100.0
        var hp_text = "(HP: %d/%d)" % [entry.hp, entry.max_hp]

        var text := "%s %s" % [entry.name, hp_text]
        if entry.is_current:
            text = "> " + text

        var idx := initiative_list.add_item(text)
        initiative_list.set_item_custom_fg_color(
            idx,
            Color.GREEN if entry.is_current else Color.WHITE
        )

func _announce_turn() -> void:
    if current_index < entries.size():
        var entry := entries[current_index]
        print("Turn %d: %s" % [round_number, entry.name])

func _on_next_turn() -> void:
    next_turn()

func _on_prev_turn() -> void:
    prev_turn()


class_name InitiativeEntry
extends RefCounted

var id: String
var name: String
var initiative: int
var hp: int
var max_hp: int
var is_current: bool = false
```

---

## RPC Protocol

### Message Types

```typescript
/**
 * Complete RPC protocol for DMLoG-Godot communication
 */

// Battle Map Operations
interface CreateBattleMapMessage {
  type: 'create_battle_map';
  data: {
    name: string;
    width: number;
    height: number;
    cellSize: number;
    terrain?: TerrainCellData[][];
    lighting?: LightingData;
  };
}

interface SetTerrainMessage {
  type: 'set_terrain';
  data: {
    cell: { x: number; y: number };
    terrain: {
      type: 'floor' | 'wall' | 'water' | 'lava' | 'pit';
      height?: number;
      difficult?: boolean;
    };
  };
}

// Token Operations
interface AddTokenMessage {
  type: 'add_token';
  data: {
    id: string;
    name: string;
    faction: 'player' | 'ally' | 'enemy' | 'neutral';
    texture?: string;
    position: { x: number; y: number };
    hp: number;
    maxHp: number;
    ac: number;
    size?: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
    conditions?: ConditionData[];
  };
}

interface MoveTokenMessage {
  type: 'move_token';
  data: {
    id: string;
    position: { x: number; y: number };
    animate?: boolean;
  };
}

interface UpdateTokenHPMessage {
  type: 'update_hp';
  data: {
    id: string;
    hp: number;
    showDamageNumber?: boolean;
  };
}

// Effect Operations
interface PlayEffectMessage {
  type: 'play_effect';
  data: {
    effectId?: string;
    effectName: string;
    targetPosition?: { x: number; y: number; z: number };
    targetTokens?: string[];
    parameters?: Record<string, unknown>;
  };
}

// Initiative/Combat Operations
interface SetInitiativeMessage {
  type: 'set_initiative';
  data: {
    entries: Array<{
      id: string;
      name: string;
      initiative: number;
      hp: number;
      maxHp: number;
    }>;
  };
}

interface StartCombatMessage {
  type: 'start_combat';
  data: {
    surpriseRound?: boolean;
  };
}

interface NextTurnMessage {
  type: 'next_turn';
  data: Record<string, never>;
}

// Condition Operations
interface ApplyConditionMessage {
  type: 'apply_condition';
  data: {
    id: string;
    tokenId: string;
    conditionType: string;
    duration: number;
    displayName: string;
  };
}

// Dice Operations
interface RollDiceMessage {
  type: 'roll_dice';
  data: {
    formula: string;
    reason?: string;
    showVisual?: boolean;
  };
}

// Fog of War Operations
interface UpdateFogMessage {
  type: 'update_fog';
  data: {
    positions: Array<{ x: number; y: number }>;
    range: number;
  };
}

// Camera Operations
interface PanCameraMessage {
  type: 'pan_camera';
  data: {
    position: { x: number; y: number };
    duration?: number;
  };
}

interface ZoomCameraMessage {
  type: 'zoom_camera';
  data: {
    level: number;
    duration?: number;
  };
}

// Godot to Theia messages
interface TokenMovedMessage {
  type: 'token_moved';
  data: {
    id: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
  };
  timestamp: number;
}

interface EffectCompletedMessage {
  type: 'effect_completed';
  data: {
    effectId: string;
    targets?: string[];
  };
  timestamp: number;
}

interface InitiativeUpdatedMessage {
  type: 'initiative_updated';
  data: {
    entries: InitiativeEntry[];
  };
  timestamp: number;
}

interface DiceRolledMessage {
  type: 'dice_rolled';
  data: {
    formula: string;
    result: {
      total: number;
      rolls: Array<{ die: string; value: number }>;
      modifier: number;
      critical?: 'success' | 'failure';
    };
  };
  timestamp: number;
}

type DMLogRPCMessage =
  | CreateBattleMapMessage
  | SetTerrainMessage
  | AddTokenMessage
  | MoveTokenMessage
  | UpdateTokenHPMessage
  | PlayEffectMessage
  | SetInitiativeMessage
  | StartCombatMessage
  | NextTurnMessage
  | ApplyConditionMessage
  | RollDiceMessage
  | UpdateFogMessage
  | PanCameraMessage
  | ZoomCameraMessage
  | TokenMovedMessage
  | EffectCompletedMessage
  | InitiativeUpdatedMessage
  | DiceRolledMessage;
```

---

## Scene Templates

### Battle Map Scene Template

```gdscript
[gd_scene load_steps=3 format=3 uid="uid://dmlog/battle_map_template"]

[ext_resource type="Script" path="res://scripts/dmlog/battle_map.gd" id="1"]

[sub_resource type="ProceduralSkyMaterial" id="ProceduralSkyMaterial_1"]
sky_horizon_color = Color(0.64625, 0.655, 0.670, 1)
ground_horizon_color = Color(0.64625, 0.655, 0.670, 1)

[node name="BattleMap" type="Node3D"]
script = ExtResource("1")

[node name="Camera3D" type="Camera3D" parent="."]
transform = Transform3D(0.707107, 0.408248, 0.57735, -0.707107, 0.408248, 0.57735, 0, -0.816497, 0.57735, 25, 25, 25)
fov = 45.0

[node name="DirectionalLight3D" type="DirectionalLight3D" parent="."]
transform = Transform3D(0.866025, -0.433013, 0.25, 0, 0.5, 0.866025, -0.5, -0.75, 0.433013, 0, 0, 0)
shadow_enabled = true
directional_shadow_distance = 100.0

[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
environment = Environment.new()

[node name="UI" type="CanvasLayer" parent="."]

[node name="InitiativeTracker" type="Control" parent="UI"]
offset_right = 300.0
offset_bottom = 400.0

[node name="EffectManager" type="Node3D" parent="."]
```

### Token Scene Template

```gdscript
[gd_scene load_steps=4 format=3 uid="uid://dmlog/token_template"]

[ext_resource type="Script" path="res://scripts/dmlog/token.gd" id="1"]
[ext_resource type="Texture2D" uid="uid://default_token" path="res://textures/tokens/default.png" id="2"]

[sub_resource type="SphereMesh" id="SphereMesh_1"]
radius = 0.4
height = 0.8

[node name="Token" type="Node3D"]
script = ExtResource("1")

[node name="Sprite3D" type="Sprite3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)
texture = ExtResource("2")
pixel_size = 0.01

[node name="SelectionRing" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.05, 0)
mesh = SubResource("SphereMesh_1")

[node name="HealthBar" type="Control" parent="."]
offset_left = -20.0
offset_top = 30.0
offset_right = 20.0
offset_bottom = 40.0

[node name="Label" type="Label3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2.5, 0)
text = "Token"
pixel_size = 0.005
```

---

## Shader Library

### Fireball Shader

```glsl
// shaders/effects/fireball.gdshader

shader_type spatial;
render_mode unshaded, cull_disabled;

uniform vec4 color_inner : source_color = vec4(1.0, 0.8, 0.2, 1.0);
uniform vec4 color_outer : source_color = vec4(1.0, 0.3, 0.0, 0.0);
uniform float size : hint_range(0.1, 10.0) = 1.0;
uniform float noise_scale : hint_range(1.0, 100.0) = 50.0;
uniform float speed : hint_range(0.1, 5.0) = 1.0;

varying vec3 world_pos;

void vertex() {
    world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

float noise(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

void fragment() {
    vec3 p = world_pos * noise_scale + TIME * speed;
    float n = fbm(p);

    float dist = length(UV - vec2(0.5)) * 2.0;
    float edge = smoothstep(1.0, 0.0, dist);

    vec4 fire_color = mix(color_outer, color_inner, edge * n);
    fire_color.a = edge * (1.0 - dist);

    ALBEDO = fire_color.rgb;
    ALPHA = fire_color.a;
    EMISSION = fire_color.rgb * fire_color.a * 2.0;
}
```

### Fog of War Shader

```glsl
// shaders/effects/fog_of_war.gdshader

shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never;

uniform sampler2D fog_texture;
uniform ivec2 grid_size;
uniform float cell_size;
uniform vec4 unexplored_color : source_color = vec4(0.0, 0.0, 0.0, 0.85);
uniform vec4 explored_color : source_color = vec4(0.1, 0.1, 0.1, 0.5);
uniform vec4 visible_color : source_color = vec4(0.0, 0.0, 0.0, 0.0);

varying vec3 world_pos;

void fragment() {
    // Calculate grid cell
    ivec2 cell = ivec2(floor(world_pos.xz / cell_size));

    // Sample fog texture
    vec4 fog_sample = texelFetch(fog_texture, cell, 0);

    // Determine visibility level
    float visibility = fog_sample.r;

    vec4 fog_color;
    if (visibility > 0.9) {
        fog_color = visible_color;
    } else if (visibility > 0.1) {
        fog_color = explored_color;
    } else {
        fog_color = unexplored_color;
    }

    ALBEDO = vec3(0.0);
    ALPHA = fog_color.a;
    EMISSION = fog_color.rgb;
}
```

### Teleport Shader

```glsl
// shaders/effects/teleport.gdshader

shader_type spatial;
render_mode unshaded, cull_disabled, blend_add;

uniform vec4 color : source_color = vec4(0.3, 0.6, 1.0, 1.0);
uniform float time_offset : hint_range(0.0, 10.0) = 0.0;
uniform float intensity : hint_range(0.1, 5.0) = 1.0;

varying vec3 world_pos;
varying vec3 vertex_normal;

void vertex() {
    world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
    vertex_normal = NORMAL;

    // Swirl effect
    float dist = length(VERTEX.xz);
    float angle = atan(VERTEX.z, VERTEX.x) + time_offset;

    float swirl = sin(dist * 3.0 - TIME * 5.0 + time_offset) * 0.1 * intensity;
    VERTEX.x += cos(angle + swirl) * swirl * dist;
    VERTEX.z += sin(angle + swirl) * swirl * dist;

    // Vertical displacement
    VERTEX.y += sin(dist * 5.0 - TIME * 3.0 + time_offset) * 0.2 * intensity;
}

void fragment() {
    float dist = length(UV - vec2(0.5)) * 2.0;
    float ring = sin(dist * 20.0 - TIME * 5.0 + time_offset) * 0.5 + 0.5;
    float alpha = smoothstep(1.0, 0.0, dist) * ring;

    vec3 glow = color.rgb * (ring + 0.5) * intensity;

    ALBEDO = glow;
    ALPHA = alpha * color.a;
    EMISSION = glow * 2.0;
}
```

### Magic Circle Shader

```glsl
// shaders/effects/magic_circle.gdshader

shader_type spatial;
render_mode unshaded, cull_disabled, blend_add;

uniform vec4 color : source_color = vec4(0.5, 0.2, 0.8, 1.0);
uniform vec4 inner_color : source_color = vec4(0.2, 0.0, 0.5, 1.0);
uniform float rotation_speed : hint_range(0.0, 5.0) = 1.0;
uniform float pulse_speed : hint_range(0.0, 5.0) = 2.0;
uniform float glyph_count : hint_range(4, 24) = 12.0;

varying vec3 world_pos;

void fragment() {
    vec2 pos = (world_pos.xz - vec2(0.0)) * 0.5;
    float dist = length(pos);
    float angle = atan(pos.y, pos.x);

    // Rotating rings
    float ring1 = smoothstep(0.45, 0.5, abs(dist - 0.3 - sin(TIME * 0.5) * 0.05));
    float ring2 = smoothstep(0.45, 0.5, abs(dist - 0.6 + sin(TIME * 0.3) * 0.05));
    float ring3 = smoothstep(0.45, 0.5, abs(dist - 0.9 + sin(TIME * 0.7) * 0.05));

    // Rotating glyphs
    float glyph_angle = angle + TIME * rotation_speed;
    float glyph_index = floor(glyph_angle / (2.0 * 3.14159) * glyph_count);
    float glyph_pulse = sin(float(glyph_index) + TIME * pulse_speed) * 0.5 + 0.5;

    float glyph = step(0.8, sin(glyph_angle * glyph_count)) * step(abs(dist - 0.5), 0.1);
    glyph *= glyph_pulse;

    // Combine
    float pattern = max(ring1, max(ring2, ring3)) + glyph;

    // Pulsing glow
    float pulse = sin(TIME * pulse_speed) * 0.3 + 0.7;

    vec3 final_color = mix(inner_color.rgb, color.rgb, pattern);
    float alpha = pattern * pulse;

    // Radial fade
    alpha *= smoothstep(1.2, 0.8, dist);

    ALBEDO = final_color;
    ALPHA = alpha;
    EMISSION = final_color * alpha * 2.0;
}
```

---

## Appendix: Character Class Mapping

### D&D 5e Classes to Visual Styles

| Class | Visual Style | Color Palette | Effect Preferences |
|-------|-------------|---------------|-------------------|
| Fighter | Heavy armor, weapon-forward | Steel, gold, crimson | Physical, earth |
| Wizard | Robes, arcane symbols | Blue, purple, silver | Arcane, elemental |
| Rogue | Dark, stealthy, agile | Black, dark green, gray | Shadow, poison |
| Cleric | Holy symbols, light | White, gold, amber | Holy, healing |
| Druid | Natural, animal forms | Green, brown, earth | Nature, elemental |
| Bard | Colorful, musical | Rainbow, bright colors | Charm, illusion |
| Paladin | Heavy armor, holy aura | Silver, white, gold | Holy, radiant |
| Ranger | Wilderness, ranged | Green, brown, leather | Nature, storm |
| Sorcerer | Wild magic, flowing | Various, dramatic | Chaotic, elemental |
| Warlock | Dark, eldritch | Purple, black, green | Eldritch, curse |
| Monk | Flowing, martial arts | Saffron, white, brown | Ki, wind |
| Barbarian | Fierce, wild | Brown, red, fur | Rage, physical |

### Monster Size Visualization

| Size | Grid Cells | Height Scale | Token Size |
|------|-----------|--------------|------------|
| Tiny | 0.5x0.5 | 0.5x | Small dot |
| Small | 1x1 | 0.75x | Small circle |
| Medium | 1x1 | 1.0x | Standard token |
| Large | 2x2 | 1.5x | Big circle |
| Huge | 3x3 | 2.0x | Very big |
| Gargantuan | 4x4+ | 2.5x+ | Massive |

---

## Summary

This document outlines the complete Godot 4.x integration for DMLoG.AI, including:

1. **Shared Components**: Reusing StudyLoG's TheiaBridge, moon-interval, Orchestrator, DialogueQuest, Scene Builder, Godot Jolt, and Character SDK
2. **Battle Map System**: Grid-based tactical maps with fog of war, pathfinding, and terrain types
3. **Character Visualization**: Token system with 2D/3D support, conditions, and equipment display
4. **Effect Visualization**: Spell effects library with fireball, healing, lightning, teleport, and more
5. **Theia Integration**: TypeScript service for DMLoG-specific RPC commands
6. **Implementation**: Complete GDScript classes for all major systems
7. **Code Examples**: Practical examples for creating maps, managing tokens, and animating effects
8. **RPC Protocol**: Complete message type definitions
9. **Scene Templates**: Godot scene templates for quick setup
10. **Shader Library**: Visual effects shaders for spells and abilities

The integration leverages Godot 4.x's features including:
- GDScript 2.0 with type hints
- New particle systems
- Improved 3D navigation
- Shader enhancements
- Multiplayer improvements for shared sessions

---

*Document maintained for DMLoG.AI by SuperInstance.AI*
*Last Updated: January 2026*
*Based on StudyLoG.AI Godot Integration v1.0*
