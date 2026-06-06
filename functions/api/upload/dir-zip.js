import { selectBot, markRateLimited, clearRateLimit } from '../bot.js';

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
    let totalSize = parseInt(formData.get('total_size'));
    if (isNaN(totalSize) || totalSize < 0) totalSize = file.size;
    const md5List = JSON.parse(formData.get('md5_list') || '[]');

    if (!file) {
      return new Response(JSON.stringify({ error: 'File is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let combinedHash = '';
    if (md5List.length > 0) {
      const sortedMd5s = [...md5List].sort().join(',');
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sortedMd5s));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      combinedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const existing = await env.DB.prepare(
        'SELECT id FROM uploads WHERE content_hash = ?'
      ).bind(combinedHash).first();

      if (existing) {
        return new Response(JSON.stringify({
          error: 'All files already exist',
          duplicated: true,
        }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      }
    }

    const channelId = env.CHANNEL_ID;
    let tgCaption = '';
    if (filePath.trim()) {
      tgCaption += filePath.trim();
    }
    if (caption.trim()) {
      if (tgCaption) tgCaption += '\n\n';
      tgCaption += caption.trim();
    }

    const maxBotAttempts = 10;
    let lastError;

    for (let botAttempt = 0; botAttempt < maxBotAttempts; botAttempt++) {
      const bot = await selectBot(env.DB);
      if (!bot) {
        return new Response(JSON.stringify({ error: 'No bot token available. Please add one in admin panel.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const fd = new FormData();
      fd.append('chat_id', channelId);
      fd.append('document', file, name);
      if (tgCaption) fd.append('caption', tgCaption);

      const tgRes = await fetch(
        `https://api.telegram.org/bot${bot.token}/sendDocument`,
        { method: 'POST', body: fd }
      );

      if (tgRes.status === 429) {
        const body = await tgRes.json();
        const retryAfter = Math.min(body.parameters?.retry_after ?? 5, 30);
        lastError = body.description || `Too Many Requests: retry after ${retryAfter}`;
        await markRateLimited(env.DB, bot.id, retryAfter);
        continue;
      }

      const tgResult = await tgRes.json();

      if (!tgResult.ok) {
        lastError = tgResult.description;
        continue;
      }

      // Success
      await clearRateLimit(env.DB, bot.id);

      await env.DB.prepare(
        'INSERT INTO uploads (user_id, file_name, file_size, caption, file_path, status, content_hash, slice_md5) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(data.user.id, name, file.size, caption, filePath, 'success', combinedHash, '').run();

      await env.DB.prepare(
        'UPDATE users SET upload_count = upload_count + 1, total_size = total_size + ? WHERE id = ?'
      ).bind(totalSize, data.user.id).run();

      return new Response(JSON.stringify({ success: true, file_size: file.size, new_size: totalSize }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: 'Telegram API error',
      description: lastError || 'All bots exhausted',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
