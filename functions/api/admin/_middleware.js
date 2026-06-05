export async function onRequest(context) {
  const { data } = context;

  if (!data.user || !data.user.is_admin) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return context.next();
}
