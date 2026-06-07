export async function onRequest(context) {
  const { request, env } = context;

  // GET — list all tags with upload count
  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(`
      SELECT t.id, t.name, t.created_at, COUNT(ut.upload_id) AS upload_count
      FROM tags t
      LEFT JOIN upload_tags ut ON ut.tag_id = t.id
      GROUP BY t.id
      ORDER BY upload_count DESC, t.name ASC
    `).all();

    return new Response(JSON.stringify({ tags: results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // POST — create a new tag
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

    const { name } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return new Response(JSON.stringify({ error: 'name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const result = await env.DB.prepare(
        'INSERT INTO tags (name) VALUES (?)'
      ).bind(name.trim()).run();

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
        return new Response(JSON.stringify({ error: 'Tag already exists' }), {
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

  // DELETE — remove a tag by ?id=
  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: 'id query parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tag = await env.DB.prepare(
      'SELECT id, name FROM tags WHERE id = ?'
    ).bind(parseInt(id)).first();

    if (!tag) {
      return new Response(JSON.stringify({ error: 'Tag not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const count = await env.DB.prepare(
      'SELECT COUNT(*) AS cnt FROM upload_tags WHERE tag_id = ?'
    ).bind(parseInt(id)).first();

    if (count.cnt > 0) {
      await env.DB.prepare(
        'DELETE FROM upload_tags WHERE tag_id = ?'
      ).bind(parseInt(id)).run();
    }

    await env.DB.prepare(
      'DELETE FROM tags WHERE id = ?'
    ).bind(parseInt(id)).run();

    return new Response(JSON.stringify({
      success: true,
      name: tag.name,
      removed_upload_tags: count.cnt,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}
