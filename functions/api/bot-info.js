export async function onRequest(context) {
  const { env } = context;

  return new Response(JSON.stringify({
    username: env.BOT_USERNAME || '',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
