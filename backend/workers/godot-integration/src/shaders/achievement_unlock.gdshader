// achievement_unlock.gdshader
// Visual shader for achievement unlock effect
// Creates a burst/star effect when achievements are unlocked

shader_type spatial;
render_mode unshaded, cull_disabled, blend_add;

// Uniforms
uniform vec4 color: source_color = vec4(1.0, 0.8, 0.3, 1.0);
uniform float time: source_time = 0.0;
uniform float duration: hint_range(0.1, 5.0) = 1.0;
uniform int star_points: hint_range(3, 12) = 5;
uniform float burst_amount: hint_range(0.0, 2.0) = 1.0;

// Varyings
varying float dist_from_center;
varying float angle;

// Vertex shader
void vertex() {
    vec2 pos = VERTEX.xy;
    dist_from_center = length(pos);
    angle = atan(pos.y, pos.x);

    // Burst outward
    float burst = 1.0 + dist_from_center * burst_amount * (time / duration);
    VERTEX.xy *= burst;

    // Rotate
    float rot = time * 2.0;
    float c = cos(rot);
    float s = sin(rot);
    mat2 rot_mat = mat2(vec2(c, s), vec2(-s, c));
    VERTEX.xy = rot_mat * VERTEX.xy;
}

// Fragment shader
void fragment() {
    // Calculate star shape
    float star_angle = angle * float(star_points);
    float star_radius = cos(star_angle) * 0.5 + 0.5;
    float star = smoothstep(star_radius - 0.2, star_radius, dist_from_center);

    // Fade out over time
    float life = time / duration;
    float fade = 1.0 - life;

    // Sparkle effect
    float sparkle = sin(time * 10.0 + angle * 5.0) * 0.5 + 0.5;
    sparkle *= (1.0 - life);

    // Combine
    float alpha = star * fade * color.a;
    vec3 final_color = color.rgb + vec3(sparkle * 0.5);

    // Outer glow
    float glow = exp(-dist_from_center * 2.0) * fade;
    final_color += color.rgb * glow * 2.0;

    ALBEDO = final_color;
    ALPHA = alpha;

    // Emission for bright effect
    EMISSION = final_color * 2.0;
}
