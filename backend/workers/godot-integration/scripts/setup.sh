#!/bin/bash
# setup.sh - Setup script for Godot integration
# Part of StudyLoG.AI

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
GODOT_INTEGRATION_DIR="$PROJECT_ROOT/backend/workers/godot-integration"
GODOT_SOURCE_DIR="$PROJECT_ROOT/godot-source"
PROJECT_TEMPLATE_DIR="$GODOT_INTEGRATION_DIR/project_template"

echo "======================================"
echo "StudyLoG.AI - Godot Integration Setup"
echo "======================================"
echo ""

# Check if Godot source exists
if [ ! -d "$GODOT_SOURCE_DIR" ]; then
    echo "Godot source not found. Cloning..."
    git clone --depth 1 https://github.com/godotengine/godot.git "$GODOT_SOURCE_DIR"
    echo "Godot source cloned to: $GODOT_SOURCE_DIR"
else
    echo "Godot source found at: $GODOT_SOURCE_DIR"
fi

echo ""

# Create addon directories
echo "Creating addon directories..."
mkdir -p "$PROJECT_TEMPLATE_DIR/addons"
echo "Addon directory created: $PROJECT_TEMPLATE_DIR/addons"

echo ""

# Install addons if not present
ADDONS=(
    "https://github.com/sci-comp/scene-builder:scene_builder"
    "https://github.com/dog-on-moon/moon-interval:moon-interval"
    "https://github.com/don-tnowe/godot-worldmap-builder:worldmap_builder"
)

echo "Installing addons..."
for addon in "${ADDONS[@]}"; do
    IFS=':' read -r url name <<< "$addon"
    target_dir="$PROJECT_TEMPLATE_DIR/addons/$name"

    if [ ! -d "$target_dir" ]; then
        echo "  Installing $name..."
        git clone --depth 1 "$url" "$target_dir"
    else
        echo "  $name already installed, skipping..."
    fi
done

echo ""

# Create scenes directory
echo "Creating scenes directory..."
mkdir -p "$PROJECT_TEMPLATE_DIR/scenes"

# Create Main scene if it doesn't exist
MAIN_SCENE="$PROJECT_TEMPLATE_DIR/scenes/Main.tscn"
if [ ! -f "$MAIN_SCENE" ]; then
    echo "Creating Main scene..."
    cat > "$MAIN_SCENE" << 'EOF'
[gd_scene load_steps=2 format=3 uid="uid://mainscene"]

[ext_resource type="Script" path="res://scenes/Main.gd" id="1_0mabc"]

[node name="Main" type="Node3D"]
script = ExtResource("1_0mabc")

[node name="Camera3D" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 0.866025, 0.5, 0, -0.5, 0.866025, 0, 5, 10)

[node name="DirectionalLight3D" type="DirectionalLight3D" parent="."]
transform = Transform3D(0.866025, -0.433013, 0.25, 0, 0.5, 0.866025, -0.5, -0.75, 0.433013, 0, 10, 0)
shadow_enabled = true

[node name="Ground" type="MeshInstance3D" parent="."]
mesh = SubResource("1_plane")

[sub_resource type="PlaneMesh" id="1_plane"]
size = Vector2(50, 50)
EOF

    cat > "$PROJECT_TEMPLATE_DIR/scenes/Main.gd" << 'EOF'
extends Node3D

# Main scene for StudyLoG.AI Godot integration
# Handles the basic scene setup and Theia bridge coordination

func _ready() -> void:
    print("Main scene loaded")
    print("TheiaBridge is available as: TheiaBridge")

    # Notify Theia that scene is ready
    if TheiaBridge:
        TheiaBridge.send_json({
            "type": "scene_ready",
            "scene": "Main"
        })

func _input(event: InputEvent) -> void:
    # Handle basic camera controls
    if event is InputEventKey:
        if event.pressed and event.keycode == KEY_R:
            get_tree().reload_current_scene()
        if event.pressed and event.keycode == KEY_ESCAPE:
            get_tree().quit()
EOF

    echo "Main scene created at: $MAIN_SCENE"
else
    echo "Main scene already exists at: $MAIN_SCENE"
fi

echo ""
echo "======================================"
echo "Setup complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Open the project in Godot 4.4+"
echo "  2. Enable plugins in Project Settings > Plugins"
echo "  3. Run the project to start the bridge server"
echo ""
echo "Project location: $PROJECT_TEMPLATE_DIR"
echo ""
