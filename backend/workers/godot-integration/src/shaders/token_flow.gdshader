// token_flow.gdshader
// Visual shader for token flow animation
// Shows tokens flowing through the neural network

shader_type spatial;
render_mode unshaded, cull_disabled, blend_add;

// Uniforms
uniform vec4 color: source_color = vec4(0.3, 0.7, 1.0, 1.0);
uniform float flow_speed: hint_range(0.1, 10.0) = 2.0;
uniform float particle_size: hint_range(0.01, 0.5) = 0.05;
uniform float time: source_time = 0.0;
uniform float spawn_time: hint_range(0.0, 10.0) = 0.0;

// Varyings
varying float life;
varying vec3 world_pos;

// Vertex shader
void vertex() {
    world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;

    // Calculate particle life (0 = spawn, 1 = death)
    life = (time - spawn_time) * flow_speed;

    // Scale based on life (grow then shrink)
    float scale = sin(life * PI) * particle_size * 20.0;
    VERTEX *= scale;

    // Fade out near end of life
    if (life > 1.0) {
        VERTEX *= 0.0;  // Hide dead particles
    }
}

// Fragment shader
void fragment() {
    // Circular particle
    vec2 uv_centered = (UV - vec2(0.5)) * 2.0;
    float dist = length(uv_centered);
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);

    // Fade in/out based on life
    float fade = sin(life * PI);
    alpha *= fade;

    // Color with glow at center
    vec3 final_color = color.rgb * (1.0 + (1.0 - dist) * 2.0);

    ALBEDO = final_color;
    ALPHA = alpha * color.a;

    // Emission
    EMISSION = final_color * alpha;
}
