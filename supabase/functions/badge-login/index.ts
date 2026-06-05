import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

  let body: { badgeCode?: string; pin?: string; deviceId?: string; isDesktop?: boolean }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const badgeCode = body.badgeCode?.trim()
  const pin = body.pin?.trim()
  const deviceId = body.deviceId?.trim()

  if (!badgeCode || !pin || !deviceId || body.isDesktop) {
    return json({ error: 'Badge sign-in is unavailable' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server configuration error' }, 500)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: loginRows, error: loginError } = await admin.rpc('start_badge_device_login', {
    in_badge_code: badgeCode,
    in_pin: pin,
    in_device_id: deviceId,
    in_current_ip: clientIp(req),
    in_is_desktop: Boolean(body.isDesktop),
  })

  if (loginError) {
    return json({ error: 'Badge sign-in is unavailable' }, 401)
  }

  const login = Array.isArray(loginRows) ? loginRows[0] : null
  const email = typeof login?.email === 'string' ? login.email : null

  if (!email) {
    return json({ error: 'Badge login failed' }, 401)
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  const tokenHash = linkData?.properties?.hashed_token

  if (linkError || !tokenHash) {
    console.error('Failed to generate badge login token', { error: linkError?.message })
    return json({ error: 'Badge login could not create a session' }, 500)
  }

  return json({ token_hash: tokenHash })
})
