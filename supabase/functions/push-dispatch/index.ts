// push-dispatch
// Sends an Expo push notification to one or more device tokens. Call this from
// database webhooks/triggers (e.g. after an application is inserted) or other
// edge functions. Expo's push API needs no secret for sending.
//
// POST { to: string | string[], title: string, body: string, data?: object }

import { corsHeaders, json } from '../_shared/cors.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

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
