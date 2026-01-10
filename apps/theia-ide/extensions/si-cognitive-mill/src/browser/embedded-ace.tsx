export async function handleEmbeddedACEThought(
  req: Request,
  env: Env
): Promise<Response> {
  const { jetsonId, observation } = await req.json();

  // Check if this is a simulated Jetson (not real hardware)
  const jetson = await env.STUDENT_STATE.prepare(
    'SELECT * FROM simulated_hardware WHERE id = ?'
  ).bind(jetsonId).first();

  if (!jetson) {
    return new Response(JSON.stringify({ error: 'Not a simulated device' }), {
      status: 400
    });
  }

  // Run ACE inference with constraints
  const response = await env.AI_GATEWAY.run('nvidia/ace-jetson-reasoning-4b', {
    prompt: buildPrompt(jetson.persona, observation),
    max_tokens: 150, // Constrained by "memory_mb"
    temperature: 0.7
  });

  // Log thought for student to see
  await env.STUDENT_STATE.prepare(
    'INSERT INTO ace_thoughts (jetson_id, thought, timestamp) VALUES (?, ?, ?)'
  ).bind(jetsonId, response, new Date().toISOString()).run();

  return new Response(JSON.stringify({ thought: response }));
}