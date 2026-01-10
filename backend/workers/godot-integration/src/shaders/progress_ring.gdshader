// progress_ring.gdshader
// Visual shader for progress ring in StudyLoG.AI
// Displays a circular progress indicator with glow effects

shader_type spatial;
render_mode unshaded, cull_disabled;

// Uniforms
uniform float progress: hint_range(0.0, 1.0) = 0.5;
uniform vec4 color: source_color = vec4(0.2, 0.6, 1.0, 1.0);
uniform vec4 bg_color: source_color = vec4(0.1, 0.1, 0.1, 1.0);
uniform float ring_thickness: hint_range(0.01, 1.0) = 0.15;
uniform float glow_amount: hint_range(0.0, 1.0) = 0.5;
uniform bool animate_glow = true;
uniform float time: source_time = 0.0;

// Varyings
varying vec3 local_pos;

// Vertex shader
void vertex() {
    local_pos = VERTEX;
}

// Fragment shader
void fragment() {
    // Convert to polar coordinates
    float dist = length(local_pos.xz);
    float angle = atan(local_pos.z, local_pos.x);

    // Normalize angle to 0-1 range
    float norm_angle = (angle + PI) / (2.0 * PI);

    // Check if we're in the ring
    float inner_radius = 1.0 - ring_thickness;
    float outer_radius = 1.0;

    // Ring mask
    float ring_mask = smoothstep(inner_radius - 0.02, inner_radius, dist) *
                     (1.0 - smoothstep(outer_radius, outer_radius + 0.02, dist));

    // Progress mask (only show filled portion)
    float progress_mask = norm_angle < progress ? 1.0 : 0.0;

    // Combine masks
    float filled_mask = ring_mask * progress_mask;
    float empty_mask = ring_mask * (1.0 - progress_mask);

    // Animated glow
    float glow = animate_glow ? sin(time * 2.0 + angle * 4.0) * 0.5 + 0.5 : 0.0;
    float glow_mask = ring_mask * progress_mask * glow * glow_amount;

    // Final color
    vec3 filled_color = color.rgb * (1.0 + glow * glow_amount);
    vec3 final_color = mix(
        bg_color.rgb * empty_mask,
        filled_color * filled_mask,
        filled_mask
    );

    // Add glow
    final_color += color.rgb * glow_mask;

    // Alpha
    float alpha = ring_mask;

    ALBEDO = final_color;
    ALPHA = alpha;

    // Emission for glow effect
    EMISSION = filled_color * glow_mask * 2.0;
}
