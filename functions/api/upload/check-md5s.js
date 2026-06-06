export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { md5s } = await request.json();
  if (!md5s || !Array.isArray(md5s) || md5s.length === 0) {
    return new Response(JSON.stringify({ error: 'md5s array is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const placeholders = md5s.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT content_hash FROM uploads WHERE content_hash IN (${placeholders})`
  ).bind(...md5s).all();

  const existingSet = new Set(results.map(r => r.content_hash));
  const existingMd5s = md5s.filter(m => existingSet.has(m));
  const newMd5s = md5s.filter(m => !existingSet.has(m));

  return new Response(JSON.stringify({ new_md5s: newMd5s, existing_md5s: existingMd5s }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
