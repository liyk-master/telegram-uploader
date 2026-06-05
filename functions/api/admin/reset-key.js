export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, name, upload_count, total_size, created_at FROM users ORDER BY created_at DESC'
    ).all();

    return new Response(JSON.stringify({ users: results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'POST') {
    const { user_id } = await request.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = await env.DB.prepare(
      'SELECT name FROM users WHERE id = ?'
    ).bind(user_id).first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const newApiKey = 'tk_' + crypto.randomUUID().replace(/-/g, '');

    await env.DB.prepare(
      'UPDATE users SET api_key = ? WHERE id = ?'
    ).bind(newApiKey, user_id).run();

    return new Response(JSON.stringify({ new_api_key: newApiKey, user_name: user.name }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}
