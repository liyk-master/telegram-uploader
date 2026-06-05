export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { results: leaders } = await env.DB.prepare(
      `SELECT u.name, u.upload_count, u.total_size
       FROM users u
       WHERE u.upload_count > 0
       ORDER BY u.upload_count DESC, u.total_size DESC
       LIMIT 20`
    ).all();

    const { results: myRank } = await env.DB.prepare(
      `SELECT id, name, upload_count, total_size FROM users WHERE id = ?`
    ).bind(context.data.user.id).all();

    return new Response(JSON.stringify({ leaders, me: myRank[0] || null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
