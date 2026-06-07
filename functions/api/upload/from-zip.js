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
    const caption = formData.get('caption') || '';
    const filesInfo = JSON.parse(formData.get('files_info') || '[]');
    const zipMd5s = JSON.parse(formData.get('zip_md5s') || '[]');

    if (!file) {
      return new Response(JSON.stringify({ error: 'File is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let newFiles = filesInfo;
    let dedupCount = 0;
    if (zipMd5s.length > 0) {
      const existingSet = new Set();
      const BATCH_SIZE = 100;
      for (let i = 0; i < zipMd5s.length; i += BATCH_SIZE) {
        const batch = zipMd5s.slice(i, i + BATCH_SIZE);
        const stmts = batch.map(md5 =>
          env.DB.prepare('SELECT 1 FROM uploads WHERE content_hash = ?').bind(md5)
        );
        const results = await env.DB.batch(stmts);
        results.forEach((r, j) => { if (r.results.length > 0) existingSet.add(batch[j]); });
      }

      newFiles = filesInfo.filter(f => f.md5 && existingSet.has(f.md5) ? false : true);
      dedupCount = filesInfo.length - newFiles.length;
    }

    const totalNewSize = newFiles.reduce((sum, f) => sum + (f.size || 0), 0);

    const channelId = env.CHANNEL_ID;
    let tgCaption = '';
    if (caption.trim()) tgCaption = caption.trim();

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

      await clearRateLimit(env.DB, bot.id);

      for (const f of newFiles) {
        await env.DB.prepare(
          'INSERT INTO uploads (user_id, file_name, file_size, caption, file_path, status, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(data.user.id, f.name, f.size, caption, f.path || '', 'success', f.md5).run();
      }

      await env.DB.prepare(
        'UPDATE users SET upload_count = upload_count + ?, total_size = total_size + ? WHERE id = ?'
      ).bind(newFiles.length, totalNewSize, data.user.id).run();

      return new Response(JSON.stringify({
        success: true,
        new_count: newFiles.length,
        dedup_count: dedupCount,
        total_new_size: totalNewSize,
        zip_name: name,
      }), {
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
