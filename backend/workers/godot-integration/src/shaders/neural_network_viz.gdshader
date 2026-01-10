// neural_network_viz.gdshader
// Visual shader for neural network visualization
// Displays nodes, connections, and activations

shader_type spatial;
render_mode unshaded, cull_disabled;

// Uniforms
uniform vec4 node_color: source_color = vec4(0.2, 0.6, 1.0, 1.0);
uniform vec4 connection_color: source_color = vec4(0.3, 0.3, 0.3, 1.0);
uniform vec4 active_color: source_color = vec4(1.0, 0.6, 0.2, 1.0);
uniform float activation: hint_range(0.0, 1.0) = 0.0;
uniform float time: source_time = 0.0;
uniform bool pulse_active = true;
uniform sampler2D activation_texture;

// Varyings
varying float node_dist;
varying vec3 local_pos;

// Vertex shader
void vertex() {
    local_pos = VERTEX;
    node_dist = length(VERTEX.xy);

    // Pulse effect for active nodes
    if (pulse_active && activation > 0.5) {
        float pulse = sin(time * 3.0) * 0.1 + 1.0;
        VERTEX *= pulse;
    }
}

// Fragment shader
void fragment() {
    // Determine if we're rendering a node or connection
    float is_node = smoothstep(0.3, 0.35, node_dist);

    // Node color with activation blend
    vec3 node_col = mix(node_color.rgb, active_color.rgb, activation);

    // Pulse on active nodes
    float pulse = pulse_active ? sin(time * 3.0) * 0.5 + 0.5 : 0.0;
    node_col += active_color.rgb * activation * pulse * 0.3;

    // Connection color
    vec3 conn_col = connection_color.rgb * (1.0 + activation * 0.5);

    // Mix based on node/connection
    vec3 final_color = mix(conn_col, node_col, is_node);

    // Edge glow for nodes
    float edge = smoothstep(0.2, 0.25, node_dist) * (1.0 - smoothstep(0.3, 0.35, node_dist));
    final_color += active_color.rgb * edge * activation * 2.0;

    // Alpha
    float alpha = smoothstep(0.4, 0.2, node_dist);

    ALBEDO = final_color;
    ALPHA = alpha;

    // Emission for active elements
    float emission_strength = activation * (is_node + edge);
    EMISSION = final_color * emission_strength * 2.0;
}
