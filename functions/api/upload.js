export async function onRequest(context) {
  const { request, env, data } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const caption = formData.get('caption') || '';
    const filePath = formData.get('path') || '';

    if (!file || !file.name) {
      return new Response(JSON.stringify({ error: 'File is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!file.name.endsWith('.cas')) {
      return new Response(JSON.stringify({ error: 'Only .cas files are allowed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let actualSize = file.size;
    let content;
    let meta;

    try {
      content = await file.text();
      const decoded = atob(content);
      meta = JSON.parse(decoded);
      if (typeof meta.size === 'number') {
        actualSize = meta.size;
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid .cas file: cannot parse content' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contentHash = meta.md5 || meta.MD5 || meta.Md5;
    if (!contentHash || typeof contentHash !== 'string') {
      return new Response(JSON.stringify({ error: 'File missing md5 field in .cas JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const sliceMd5 = meta.sliceMD5 || meta.sliceMd5 || meta.slice_md5 || '';

    const existing = await env.DB.prepare(
      'SELECT id FROM uploads WHERE content_hash = ?'
    ).bind(contentHash).first();

    if (existing) {
      return new Response(JSON.stringify({ error: 'Duplicate file', content_hash: contentHash }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tgFormData = new FormData();
    tgFormData.append('chat_id', env.CHANNEL_ID);
    tgFormData.append('document', file, file.name);
    let tgCaption = '';
    if (filePath.trim()) {
      tgCaption += filePath.trim();
    }
    if (caption.trim()) {
      if (tgCaption) tgCaption += '\n\n';
      tgCaption += caption.trim();
    }
    if (tgCaption) {
      tgFormData.append('caption', tgCaption);
    }

    const tgRes = await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/sendDocument`,
      { method: 'POST', body: tgFormData }
    );

    const tgResult = await tgRes.json();

    if (!tgResult.ok) {
      return new Response(JSON.stringify({
        error: 'Telegram API error',
        description: tgResult.description,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await env.DB.prepare(
      'INSERT INTO uploads (user_id, file_name, file_size, caption, file_path, status, content_hash, slice_md5) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(data.user.id, file.name, actualSize, caption.trim() || '', filePath, 'success', contentHash, sliceMd5).run();

    await env.DB.prepare(
      'UPDATE users SET upload_count = upload_count + 1, total_size = total_size + ? WHERE id = ?'
    ).bind(actualSize, data.user.id).run();

    return new Response(JSON.stringify({ success: true, actual_size: actualSize }), {
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
