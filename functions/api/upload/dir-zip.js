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
    const name = formData.get('name') || 'archive.zip';
    const filePath = formData.get('path') || '';
    const caption = formData.get('caption') || '';
    const totalSize = parseInt(formData.get('total_size')) || file.size;

    if (!file) {
      return new Response(JSON.stringify({ error: 'File is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tgFormData = new FormData();
    tgFormData.append('chat_id', env.CHANNEL_ID);
    tgFormData.append('document', file, name);

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
      'INSERT INTO uploads (user_id, file_name, file_size, caption, file_path, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(data.user.id, name, totalSize, caption, filePath, 'success').run();

    await env.DB.prepare(
      'UPDATE users SET upload_count = upload_count + 1, total_size = total_size + ? WHERE id = ?'
    ).bind(totalSize, data.user.id).run();

    return new Response(JSON.stringify({ success: true, file_size: totalSize }), {
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
