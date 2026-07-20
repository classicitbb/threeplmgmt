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

function maskTail(value: string | null | undefined, keep = 4): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length <= keep) return '••••' + trimmed
  return '••••' + trimmed.slice(-keep)
}

function randomHex(bytes = 32): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: 'Server configuration error' }, 500)
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user: caller } } = await callerClient.auth.getUser()
  if (!caller) return json({ error: 'Unauthorized' }, 401)

  const { data: roleRows } = await callerClient
    .from('user_roles')
    .select('roles!inner(code)')
    .eq('user_id', caller.id)

  const callerRoles: string[] = (roleRows ?? []).flatMap((r: any) => {
    const nested = r.roles
    if (Array.isArray(nested)) return nested.map((x: any) => String(x.code))
    return nested?.code ? [String(nested.code)] : []
  })

  if (!callerRoles.includes('admin') && !callerRoles.includes('developer')) {
    return json({ error: 'Only admins and developers can manage integrations' }, 403)
  }

  let body: {
    action?: 'save' | 'test' | 'status'
    accountId?: string
    clientId?: string
    clientSecret?: string
    webhookSecret?: string
    enabled?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  async function loadConnection() {
    const { data, error } = await admin
      .from('integration_connections')
      .select('id, enabled, config')
      .eq('system', 'netsuite')
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }

  async function loadSecret(connectionId: string, type: string): Promise<string | null> {
    const { data, error } = await admin
      .from('integration_secrets')
      .select('secret_value')
      .eq('connection_id', connectionId)
      .eq('secret_type', type)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data?.secret_value ?? null
  }

  const action = body.action ?? 'status'

  try {
    if (action === 'status') {
      const connection = await loadConnection()
      if (!connection) {
        return json({ configured: false, enabled: false, accountIdMasked: null, clientIdMasked: null, lastTestedAt: null })
      }
      const config = (connection.config ?? {}) as Record<string, unknown>
      const clientId = await loadSecret(connection.id, 'netsuite_client_id')
      const clientSecret = await loadSecret(connection.id, 'netsuite_client_secret')
      return json({
        configured: Boolean(clientId && clientSecret && config.account_id),
        enabled: Boolean(connection.enabled),
        accountIdMasked: maskTail(typeof config.account_id === 'string' ? config.account_id : null),
        clientIdMasked: maskTail(clientId),
        lastTestedAt: typeof config.last_tested_at === 'string' ? config.last_tested_at : null,
      })
    }

    if (action === 'save') {
      const accountId = (body.accountId ?? '').trim()
      const clientId = (body.clientId ?? '').trim()
      const clientSecret = (body.clientSecret ?? '').trim()
      const enabled = Boolean(body.enabled)
      if (!accountId || !clientId) {
        return json({ error: 'Account ID and Client ID are required' }, 400)
      }

      const existing = await loadConnection()
      const existingConfig = (existing?.config ?? {}) as Record<string, unknown>
      const nextConfig = { ...existingConfig, account_id: accountId }

      let connectionId: string
      if (existing) {
        const { error } = await admin
          .from('integration_connections')
          .update({ enabled, config: nextConfig, name: 'NetSuite' })
          .eq('id', existing.id)
        if (error) throw new Error(error.message)
        connectionId = existing.id
      } else {
        const { data, error } = await admin
          .from('integration_connections')
          .insert({ system: 'netsuite', name: 'NetSuite', enabled, config: nextConfig, created_by: caller.id })
          .select('id')
          .single()
        if (error) throw new Error(error.message)
        connectionId = data.id
      }

      // Client ID (always saved when provided)
      await admin.from('integration_secrets').upsert(
        { connection_id: connectionId, secret_type: 'netsuite_client_id', secret_value: clientId },
        { onConflict: 'connection_id,secret_type' },
      )

      // Client secret only overwritten when a new value is provided
      if (clientSecret) {
        await admin.from('integration_secrets').upsert(
          { connection_id: connectionId, secret_type: 'netsuite_client_secret', secret_value: clientSecret },
          { onConflict: 'connection_id,secret_type' },
        )
      } else {
        const existingSecret = await loadSecret(connectionId, 'netsuite_client_secret')
        if (!existingSecret) {
          return json({ error: 'Client Secret is required on first save' }, 400)
        }
      }

      // Webhook secret: use provided value, else preserve existing, else generate.
      let webhookSecret = (body.webhookSecret ?? '').trim()
      let webhookSecretReturned: string | null = null
      const existingWebhook = await loadSecret(connectionId, 'netsuite_webhook_secret')
      if (!webhookSecret && !existingWebhook) {
        webhookSecret = randomHex(32)
        webhookSecretReturned = webhookSecret
      }
      if (webhookSecret) {
        await admin.from('integration_secrets').upsert(
          { connection_id: connectionId, secret_type: 'netsuite_webhook_secret', secret_value: webhookSecret },
          { onConflict: 'connection_id,secret_type' },
        )
        if (body.webhookSecret) webhookSecretReturned = webhookSecret
      }

      return json({
        ok: true,
        accountIdMasked: maskTail(accountId),
        clientIdMasked: maskTail(clientId),
        webhookSecret: webhookSecretReturned,
      })
    }

    if (action === 'test') {
      const connection = await loadConnection()
      if (!connection) return json({ ok: false, error: 'No NetSuite connection configured' })
      const config = (connection.config ?? {}) as Record<string, unknown>
      const accountId = typeof config.account_id === 'string' ? config.account_id : ''
      const clientId = await loadSecret(connection.id, 'netsuite_client_id')
      const clientSecret = await loadSecret(connection.id, 'netsuite_client_secret')
      if (!accountId || !clientId || !clientSecret) {
        return json({ ok: false, error: 'Credentials incomplete' })
      }

      const tokenUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`
      const basic = btoa(`${clientId}:${clientSecret}`)
      let ok = false
      let errorMessage: string | null = null
      try {
        const res = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        })
        if (res.ok) {
          ok = true
          await res.text()
        } else {
          const text = await res.text()
          errorMessage = `NetSuite responded ${res.status}: ${text.slice(0, 200)}`
        }
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err)
      }

      const nextConfig = { ...config, last_tested_at: new Date().toISOString(), last_test_ok: ok }
      await admin
        .from('integration_connections')
        .update({ config: nextConfig })
        .eq('id', connection.id)

      return ok ? json({ ok: true }) : json({ ok: false, error: errorMessage ?? 'Unknown error' })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('netsuite-connection error', message)
    return json({ error: message }, 500)
  }
})