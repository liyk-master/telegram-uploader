export async function onRequest(context) {
  const { request, env, data } = context;

  if (request.method === 'GET') {
    const { results: codes } = await env.DB.prepare(
      `SELECT rc.id, rc.code, rc.used_by, rc.used_at, rc.created_at,
              u.name AS used_by_name
       FROM reg_codes rc
       LEFT JOIN users u ON rc.used_by = u.id
       ORDER BY rc.created_at DESC`
    ).all();

    return new Response(JSON.stringify({ codes }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'POST') {
    const code = 'rg_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);

    await env.DB.prepare(
      'INSERT INTO reg_codes (code, created_by) VALUES (?, ?)'
    ).bind(code, data.user.id).run();

    return new Response(JSON.stringify({ code }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}
