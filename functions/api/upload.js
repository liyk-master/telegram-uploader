import { selectBot, markRateLimited, clearRateLimit } from './bot.js';

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

    const channelId = env.CHANNEL_ID;
    let tgCaption = '';
    if (filePath.trim()) {
      tgCaption += filePath.trim();
    }
    if (caption.trim()) {
      if (tgCaption) tgCaption += '\n\n';
      tgCaption += caption.trim();
    }

    // Round-robin: try each available bot until one succeeds
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
      fd.append('document', file, file.name);
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
        // Non-429 error — still try another bot
        continue;
      }

      // Success — clear any stale rate-limit and record upload
      await clearRateLimit(env.DB, bot.id);

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
