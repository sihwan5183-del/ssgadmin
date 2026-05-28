import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const WEBHOOK_SECRET = Deno.env.get('LEADS_WEBHOOK_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function unauthorized(msg = 'Unauthorized') {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Auth: shared secret via header or query string
  const url = new URL(req.url)
  const token =
    req.headers.get('x-webhook-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    url.searchParams.get('secret') ??
    ''
  if (!WEBHOOK_SECRET || token !== WEBHOOK_SECRET) return unauthorized()

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const str = (v: unknown) =>
    typeof v === 'string' ? v.trim() : v == null ? null : String(v)

  const row = {
    name: str(body.name),
    phone: str(body.phone),
    current_carrier: str(body.current_carrier),
    desired_device: str(body.desired_device),
    desired_product: str(body.desired_product),
    campaign_name: str(body.campaign_name),
    memo: str(body.memo) ?? null,
    status: '신규 접수',
    source: str(body.source) ?? 'webhook',
    registration_date: str(body.registration_date),
    customer_name: str(body.customer_name),
    customer_phone: str(body.customer_phone),
    branch_name: str(body.branch_name),
    activation_status: str(body.activation_status),
    cancellation_status: str(body.cancellation_status),
    activation_number: str(body.activation_number),
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data, error } = await supabase.from('leads').insert(row).select('id').single()
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, id: data.id }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})