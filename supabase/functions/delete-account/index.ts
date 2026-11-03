// Deletes the signed-in person's own account. Only the Supabase service role
// can remove an auth user, so this runs server-side with that key, never the
// publishable key the app ships with.
//
// Safety: a Manager cannot delete their account while other people are still
// active members of their business, so a team is never left without a
// Manager. Every other record created by this person (horses, costs,
// invoices...) is kept for the business, with its "created by" cleared
// rather than the record deleted.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not signed in.' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Identifies the caller from their own token; never trust a user id in the request body.
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userRes, error: userErr } = await asCaller.auth.getUser();
  if (userErr || !userRes.user) return json({ error: 'Not signed in.' }, 401);
  const userId = userRes.user.id;

  const admin = createClient(url, serviceKey);

  // Block deletion if this person is the Manager of a business that still has
  // other active people in it — they would lose access to everything at once.
  const { data: managerRows, error: memErr } = await admin
    .from('memberships')
    .select('business_id, businesses(name)')
    .eq('user_id', userId)
    .eq('role', 'manager')
    .eq('active', true);
  if (memErr) return json({ error: memErr.message }, 500);

  for (const row of managerRows ?? []) {
    const { count, error: countErr } = await admin
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', row.business_id)
      .eq('active', true)
      .neq('user_id', userId);
    if (countErr) return json({ error: countErr.message }, 500);
    if ((count ?? 0) > 0) {
      const name = (row as unknown as { businesses: { name: string } | null }).businesses?.name ?? 'your business';
      return json(
        {
          error: `You're the Manager of ${name} and other people are still on the team. Make someone else the Manager first, or remove the other team members, then try again.`,
        },
        409,
      );
    }
  }

  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteErr) return json({ error: deleteErr.message }, 500);

  return json({ ok: true });
});
