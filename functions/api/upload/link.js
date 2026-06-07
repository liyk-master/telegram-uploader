import { selectBot, markRateLimited, clearRateLimit } from '../bot.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { url, caption } = await request.json();

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const normalizedUrl = url.toLowerCase();
    if (!normalizedUrl.startsWith('https://cloud.189.cn/') && !normalizedUrl.startsWith('http://cloud.189.cn/')) {
      return new Response(JSON.stringify({ error: '仅支持 cloud.189.cn 分享链接' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const channelId = env.CHANNEL_ID;
    let text = `📎 天翼云盘分享\n${url}`;
    if (caption && caption.trim()) {
      text += `\n\n${caption.trim()}`;
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

      const tgRes = await fetch(
        `https://api.telegram.org/bot${bot.token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: channelId, text, disable_web_page_preview: false }),
        }
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
      return new Response(JSON.stringify({ success: true }), {
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
