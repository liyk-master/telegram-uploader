export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { name, code } = await request.json();
    if (!name || !name.trim()) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { count } = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM users'
    ).first();

    let isAdmin = 0;

    if (count === 0) {
      isAdmin = 1;
    } else {
      if (!code || !code.trim()) {
        return new Response(JSON.stringify({ error: 'Registration code is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const regCode = await env.DB.prepare(
        'SELECT id FROM reg_codes WHERE code = ? AND used_by IS NULL'
      ).bind(code.trim()).first();

      if (!regCode) {
        return new Response(JSON.stringify({ error: 'Invalid or already used registration code' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const apiKey = 'tk_' + crypto.randomUUID().replace(/-/g, '');

      await env.DB.prepare(
        'INSERT INTO users (name, api_key, is_admin) VALUES (?, ?, ?)'
      ).bind(name.trim(), apiKey, isAdmin).run();

      await env.DB.prepare(
        "UPDATE reg_codes SET used_by = (SELECT id FROM users WHERE api_key = ?), used_at = datetime('now') WHERE id = ?"
      ).bind(apiKey, regCode.id).run();

      return new Response(JSON.stringify({ api_key: apiKey }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = 'tk_' + crypto.randomUUID().replace(/-/g, '');

    await env.DB.prepare(
      'INSERT INTO users (name, api_key, is_admin) VALUES (?, ?, ?)'
    ).bind(name.trim(), apiKey, isAdmin).run();

    return new Response(JSON.stringify({ api_key: apiKey, is_admin: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
