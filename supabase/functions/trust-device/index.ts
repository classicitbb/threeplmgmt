import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function clientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return (
    req.headers.get('cf-connecting-ip')?.trim() ||
    forwarded ||
    req.headers.get('x-real-ip')?.trim() ||
    ''
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: { deviceId?: string; isDesktop?: boolean }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const deviceId = body.deviceId?.trim()
  if (!deviceId) {
    return json({ error: 'Device is required' }, 400)
  }

  if (body.isDesktop) {
    return json({ error: 'Trusted device shortcut is unavailable' }, 403)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const authorization = req.headers.get('authorization')

  if (!supabaseUrl || !anonKey || !authorization) {
    return json({ error: 'Server configuration error' }, 500)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error } = await userClient.rpc('refresh_user_device_trust', {
    in_device_id: deviceId,
    in_user_agent: req.headers.get('user-agent') ?? '',
    in_last_known_ip: clientIp(req),
    in_is_desktop: false,
  })

  if (error) {
    return json({ error: 'Trusted device setup failed' }, 400)
  }

  return json({ ok: true, expiresInDays: 30 })
})
