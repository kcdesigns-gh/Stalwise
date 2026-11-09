// Deletes the signed-in person's own account. Only the Supabase service role
// can remove an auth user, so this runs server-side with that key, never the
// publishable key the app ships with.
//
// Safety: a Manager with other people still on the team is never silently
// removed. The app must send { deleteBusiness: true } (after the Manager types
// DELETE), which deletes the whole business, its stored photos and logo, and
// every record with it. Everyone else keeps the business's records, with
// "created by" cleared rather than the record deleted.
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

// Lists every file under a folder, going into sub-folders.
// deno-lint-ignore no-explicit-any
async function listAll(admin: any, bucket: string, folder: string): Promise<string[]> {
  const out: string[] = [];
  const { data } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
  for (const item of data ?? []) {
    const path = `${folder}/${item.name}`;
    if (item.id) out.push(path);
    else out.push(...(await listAll(admin, bucket, path)));
  }
  return out;
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

  let deleteBusiness = false;
  try {
    const body = await req.json();
    deleteBusiness = body?.deleteBusiness === true;
  } catch {
    // No body: treat as a plain account delete.
  }

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
    if ((count ?? 0) > 0 && !deleteBusiness) {
      const name = (row as unknown as { businesses: { name: string } | null }).businesses?.name ?? 'your business';
      return json(
        {
          error: `You're the Manager of ${name} and other people are still on the team. Make someone else the Manager first, or remove the other team members, then try again.`,
        },
        409,
      );
    }
  }

  // Deleting the business removes every record (cascade) and, first, its files.
  if (deleteBusiness) {
    for (const row of managerRows ?? []) {
      for (const bucket of ['horse-photos', 'business-assets']) {
        const paths = await listAll(admin, bucket, row.business_id);
        for (let i = 0; i < paths.length; i += 100) {
          const { error: rmErr } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
          if (rmErr) return json({ error: rmErr.message }, 500);
        }
      }
      const { error: bizErr } = await admin.from('businesses').delete().eq('id', row.business_id);
      if (bizErr) return json({ error: bizErr.message }, 500);
    }
  }

  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteErr) return json({ error: deleteErr.message }, 500);

  return json({ ok: true });
});
