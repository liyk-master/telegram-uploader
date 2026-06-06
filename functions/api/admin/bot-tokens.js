export async function onRequest(context) {
  const { request, env } = context;

  // GET — list all bots (mask token prefix for safety)
  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, name, token, upload_count, last_used_at, rate_limited_until, created_at FROM bot_tokens ORDER BY id'
    ).all();

    const bots = results.map(b => ({
      id: b.id,
      name: b.name,
      token_preview: b.token.substring(0, 10) + '...' + b.token.slice(-6),
      upload_count: b.upload_count,
      last_used_at: b.last_used_at,
      rate_limited_until: b.rate_limited_until,
      created_at: b.created_at,
    }));

    return new Response(JSON.stringify({ bots }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // POST — add a new bot token
  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { name, token } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return new Response(JSON.stringify({ error: 'name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!token || typeof token !== 'string' || !token.trim()) {
      return new Response(JSON.stringify({ error: 'token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Basic format validation: Telegram bot tokens are 123456:ABC-DEF1234gh...
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(token.trim())) {
      return new Response(JSON.stringify({ error: 'Invalid Telegram bot token format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const result = await env.DB.prepare(
        'INSERT INTO bot_tokens (name, token) VALUES (?, ?)'
      ).bind(name.trim(), token.trim()).run();

      return new Response(JSON.stringify({
        success: true,
        id: result.meta.last_row_id,
        name: name.trim(),
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      if (e.message?.includes('UNIQUE')) {
        return new Response(JSON.stringify({ error: 'Token already exists' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // DELETE — remove a bot token
  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: 'id query parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await env.DB.prepare(
      'DELETE FROM bot_tokens WHERE id = ?'
    ).bind(parseInt(id)).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Bot not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}
