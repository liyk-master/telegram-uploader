import { verifyTelegramAuth } from '../tg-auth.js';

export async function onRequest(context) {
  const { request, env, data } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const authData = await request.json();
    const { id, first_name, username, auth_date, hash, api_key } = authData;

    if (!id || !hash || !auth_date) {
      return new Response(JSON.stringify({ error: 'Missing Telegram auth data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (Math.floor(Date.now() / 1000) - parseInt(auth_date) > 86400) {
      return new Response(JSON.stringify({ error: 'Auth data expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const botToken = env.BOT_TOKEN;
    if (!botToken) {
      return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isValid = await verifyTelegramAuth(authData, botToken);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid auth data' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fallback: look up user by api_key if middleware didn't set data.user
    let userId = data?.user?.id;
    if (!userId && api_key) {
      const userByKey = await env.DB.prepare(
        'SELECT id FROM users WHERE api_key = ?'
      ).bind(api_key).first();
      if (userByKey) userId = userByKey.id;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'API key required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE telegram_id = ? AND id != ?'
    ).bind(id, userId).first();

    if (existingUser) {
      return new Response(JSON.stringify({ error: 'This Telegram account is already bound to another user' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await env.DB.prepare(
      'UPDATE users SET telegram_id = ?, telegram_username = ? WHERE id = ?'
    ).bind(id, username || null, userId).run();

    return new Response(JSON.stringify({
      success: true,
      telegram_username: username || null,
      first_name: first_name || null,
    }), {
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
