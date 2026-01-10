// attention_line.gdshader
// Visual shader for attention connection lines
// Displays attention weights as flowing lines with color gradients

shader_type spatial;
render_mode unshaded, cull_disabled, blend_add;

// Uniforms
uniform vec4 low_color: source_color = vec4(0.0, 0.0, 1.0, 1.0);
uniform vec4 high_color: source_color = vec4(1.0, 0.0, 0.0, 1.0);
uniform float weight: hint_range(0.0, 1.0) = 0.5;
uniform float flow_speed: hint_range(0.0, 5.0) = 1.0;
uniform bool flow_enabled = true;
uniform float time: source_time = 0.0;
uniform bool selected = false;

// Vertex shader - pass UV along
void vertex() {
    // Pass position for fragment shader
}

// Fragment shader
void fragment() {
    // Interpolate color based on weight
    vec3 base_color = mix(low_color.rgb, high_color.rgb, weight);

    // Flow animation
    float flow = flow_enabled ? sin(UV.x * 10.0 - time * flow_speed) * 0.5 + 0.5 : 0.0;

    // Highlight effect
    float highlight = selected ? 1.0 : flow * 0.3;

    // Fade edges
    float fade = smoothstep(0.0, 0.2, UV.x) * smoothstep(1.0, 0.8, UV.x);

    vec3 final_color = base_color + vec3(highlight);
    float alpha = weight * fade * (selected ? 1.0 : 0.8);

    ALBEDO = final_color;
    ALPHA = alpha;

    // Emission for visibility
    EMISSION = final_color * alpha * 0.5;
}
