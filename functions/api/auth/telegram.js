import { verifyTelegramAuth } from '../tg-auth.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const authData = await request.json();
    const { id, first_name, username, auth_date, hash } = authData;

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

    const displayName = first_name || username || `tg_${id}`;

    const existingUser = await env.DB.prepare(
      'SELECT id, name, api_key, is_admin FROM users WHERE telegram_id = ?'
    ).bind(id).first();

    if (existingUser) {
      return new Response(JSON.stringify({
        api_key: existingUser.api_key,
        name: existingUser.name,
        is_admin: !!existingUser.is_admin,
        telegram_username: username || null,
        first_name: first_name || null,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first();
    const isAdmin = count === 0 ? 1 : 0;
    const apiKey = 'tk_' + crypto.randomUUID().replace(/-/g, '');

    await env.DB.prepare(
      'INSERT INTO users (name, api_key, is_admin, telegram_id, telegram_username) VALUES (?, ?, ?, ?, ?)'
    ).bind(displayName, apiKey, isAdmin, id, username || null).run();

    return new Response(JSON.stringify({
      api_key: apiKey,
      name: displayName,
      is_admin: !!isAdmin,
      telegram_username: username || null,
      first_name: first_name || null,
    }), {
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
