export async function onRequest(context) {
  const { request, env, data } = context;

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const user = await env.DB.prepare(
      'SELECT id, name, api_key, is_admin, upload_count, total_size, created_at FROM users WHERE id = ?'
    ).bind(data.user.id).first();

    const { results: uploads } = await env.DB.prepare(
      'SELECT id, file_name, file_size, caption, file_path, status, created_at FROM uploads WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(data.user.id).all();

    return new Response(JSON.stringify({ user, uploads }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
