const PUBLIC_ROUTES = ['/api/register'];

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (PUBLIC_ROUTES.includes(url.pathname)) {
    return context.next();
  }

  const authHeader = request.headers.get('Authorization') || '';
  const apiKey = authHeader.replace('Bearer ', '');

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await env.DB.prepare(
    'SELECT id, name, api_key, is_admin FROM users WHERE api_key = ?'
  ).bind(apiKey).first();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid API key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  context.data = { user };
  return context.next();
}
