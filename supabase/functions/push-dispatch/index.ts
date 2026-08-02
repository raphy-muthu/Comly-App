// push-dispatch
// Sends an Expo push notification to one or more device tokens. Call this from
// database webhooks/triggers (e.g. after an application is inserted) or other
// edge functions — never directly from the client app. Expo's push API needs
// no secret for sending, so the caller's own identity is the only gate; this
// function requires the service-role key precisely because the anon key is
// public (shipped inside the app), and without this check anyone holding it
// could blast arbitrary push notifications to arbitrary device tokens.
//
// POST { to: string | string[], title: string, body: string, data?: object }
// Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>

import { corsHeaders, json } from '../_shared/cors.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isServiceRole(req: Request): boolean {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return !!serviceKey && token === serviceKey;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!isServiceRole(req)) {
    return json({ error: 'Forbidden: service-role access only' }, 403);
  }

  try {
    const { to, title, body, data } = await req.json();
    if (!to || !title) return json({ error: 'to and title are required' }, 400);

    const tokens = Array.isArray(to) ? to : [to];
    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body: body ?? '',
      data: data ?? {},
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    return json(await res.json(), res.ok ? 200 : 502);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
