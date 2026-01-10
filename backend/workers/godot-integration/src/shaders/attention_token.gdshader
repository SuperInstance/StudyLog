// attention_token.gdshader
// Visual shader for attention tokens in AI attention visualization
// Displays tokens as glowing spheres with pulse animation

shader_type spatial;
render_mode unshaded, cull_disabled;

// Uniforms
uniform vec4 color: source_color = vec4(1.0);
uniform float pulse_speed: hint_range(0.0, 5.0) = 1.0;
uniform float pulse_amount: hint_range(0.0, 1.0) = 0.3;
uniform bool pulse_enabled = true;
uniform float time: source_time = 0.0;
uniform float hover: hint_range(0.0, 1.0) = 0.0;

// Vertex shader
void vertex() {
    float pulse = pulse_enabled ? sin(time * pulse_speed) * 0.5 + 0.5 : 0.0;
    float scale = 1.0 + pulse * pulse_amount + hover * 0.2;
    VERTEX *= scale;
}

// Fragment shader
void fragment() {
    // Create soft glow effect
    float dist = length(UV - vec2(0.5));
    float alpha = smoothstep(0.5, 0.0, dist);

    // Add edge glow
    float edge = smoothstep(0.4, 0.5, dist);
    vec3 glow_color = color.rgb * (1.0 + edge * 0.5);

    ALBEDO = glow_color;
    ALPHA = alpha * color.a;

    // Emission for glow effect
    EMISSION = glow_color * alpha * 0.5;
}
