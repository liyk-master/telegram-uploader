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

  const existingSet = new Set();
  const BATCH_SIZE = 100;
  for (let i = 0; i < md5s.length; i += BATCH_SIZE) {
    const batch = md5s.slice(i, i + BATCH_SIZE);
    const stmts = batch.map(md5 =>
      env.DB.prepare('SELECT 1 FROM uploads WHERE content_hash = ?').bind(md5)
    );
    const results = await env.DB.batch(stmts);
    results.forEach((r, j) => { if (r.results.length > 0) existingSet.add(batch[j]); });
  }
  const existingMd5s = md5s.filter(m => existingSet.has(m));
  const newMd5s = md5s.filter(m => !existingSet.has(m));

  return new Response(JSON.stringify({ new_md5s: newMd5s, existing_md5s: existingMd5s }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
