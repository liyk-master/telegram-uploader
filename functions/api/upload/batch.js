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
    const count = parseInt(formData.get('count')) || 0;

    if (count < 1 || count > 10) {
      return new Response(JSON.stringify({ error: 'Count must be between 1 and 10' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const newFiles = [];
    const duplicated = [];
    const noMd5 = [];

    for (let i = 0; i < count; i++) {
      const file = formData.get(`file_${i}`);
      const name = formData.get(`name_${i}`) || '';
      const filePath = formData.get(`path_${i}`) || '';
      const caption = formData.get(`caption_${i}`) || '';

      if (!file) {
        return new Response(JSON.stringify({ error: `File ${i} is missing` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!name.endsWith('.cas')) {
        return new Response(JSON.stringify({ error: `File ${i}: only .cas files are allowed` }), {
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
        return new Response(JSON.stringify({ error: `File ${i}: invalid .cas file` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const contentHash = meta.md5 || meta.MD5 || meta.Md5;
      if (!contentHash || typeof contentHash !== 'string') {
        noMd5.push({ name, filePath, caption });
        continue;
      }
      const sliceMd5 = meta.sliceMD5 || meta.sliceMd5 || meta.slice_md5 || '';

      const existing = await env.DB.prepare(
        'SELECT id FROM uploads WHERE content_hash = ?'
      ).bind(contentHash).first();

      if (existing) {
        duplicated.push({ name, filePath, caption });
      } else {
        newFiles.push({ file, name, filePath, caption, actualSize, contentHash, sliceMd5 });
      }
    }

    if (newFiles.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        count: 0,
        duplicated: duplicated.map(d => ({ name: d.name, path: d.filePath })),
        no_md5: noMd5.map(d => ({ name: d.name, path: d.filePath })),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const channelId = env.CHANNEL_ID;
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

      const tgFormData = new FormData();
      tgFormData.append('chat_id', channelId);

      const media = newFiles.map((f, i) => {
        let tgCaption = '';
        if (f.filePath.trim()) {
          tgCaption += f.filePath.trim();
        }
        if (f.caption.trim()) {
          if (tgCaption) tgCaption += '\n\n';
          tgCaption += f.caption.trim();
        }
        const entry = { type: 'document', media: `attach://file_${i}` };
        if (tgCaption) entry.caption = tgCaption;
        tgFormData.append(`file_${i}`, f.file, f.name);
        return entry;
      });

      tgFormData.append('media', JSON.stringify(media));

      const tgRes = await fetch(
        `https://api.telegram.org/bot${bot.token}/sendMediaGroup`,
        { method: 'POST', body: tgFormData }
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

      for (const f of newFiles) {
        await env.DB.prepare(
          'INSERT INTO uploads (user_id, file_name, file_size, caption, file_path, status, content_hash, slice_md5) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(data.user.id, f.name, f.actualSize, f.caption, f.filePath, 'success', f.contentHash, f.sliceMd5).run();
      }

      const totalSize = newFiles.reduce((sum, f) => sum + f.actualSize, 0);
      await env.DB.prepare(
        'UPDATE users SET upload_count = upload_count + ?, total_size = total_size + ? WHERE id = ?'
      ).bind(newFiles.length, totalSize, data.user.id).run();

      return new Response(JSON.stringify({
        success: true,
        count: newFiles.length,
        duplicated: duplicated.map(d => ({ name: d.name, path: d.filePath })),
        no_md5: noMd5.map(d => ({ name: d.name, path: d.filePath })),
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
