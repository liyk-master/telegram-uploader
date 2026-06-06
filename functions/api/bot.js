/**
 * Multi-bot round-robin helper for Telegram API calls.
 *
 * Selects the least-recently-used bot that is not currently rate-limited.
 * Tracks usage stats and rate-limit state in the `bot_tokens` D1 table.
 */

/**
 * Pick the next available bot using round-robin (least recently used).
 * Updates `last_used_at` and increments `upload_count` on selection.
 *
 * @param {D1Database} db - D1 database binding
 * @returns {{ token: string, id: number } | null}
 */
export async function selectBot(db) {
  const now = new Date().toISOString();

  // Find bots that are not rate-limited, ordered by least recently used
  const { results } = await db.prepare(
    `SELECT id, token FROM bot_tokens
     WHERE rate_limited_until IS NULL OR rate_limited_until < ?
     ORDER BY COALESCE(last_used_at, '1970-01-01') ASC
     LIMIT 1`
  ).bind(now).all();

  if (!results || results.length === 0) return null;

  const bot = results[0];

  // Update usage stats
  await db.prepare(
    `UPDATE bot_tokens
     SET last_used_at = ?, upload_count = upload_count + 1
     WHERE id = ?`
  ).bind(now, bot.id).run();

  return { token: bot.token, id: bot.id };
}

/**
 * Mark a bot as rate-limited after receiving a 429 from Telegram.
 *
 * @param {D1Database} db - D1 database binding
 * @param {number} botId - bot_tokens.id
 * @param {number} retryAfter - seconds to wait (from Telegram's retry_after)
 */
export async function markRateLimited(db, botId, retryAfter) {
  const until = new Date(Date.now() + retryAfter * 1000).toISOString();
  await db.prepare(
    'UPDATE bot_tokens SET rate_limited_until = ? WHERE id = ?'
  ).bind(until, botId).run();
}

/**
 * Clear rate-limit flag (e.g. after successful call).
 *
 * @param {D1Database} db - D1 database binding
 * @param {number} botId - bot_tokens.id
 */
export async function clearRateLimit(db, botId) {
  await db.prepare(
    'UPDATE bot_tokens SET rate_limited_until = NULL WHERE id = ?'
  ).bind(botId).run();
}
