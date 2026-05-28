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

  const str = (v: unknown) => {
    if (typeof v === 'string') {
      const trimmed = v.trim()
      return trimmed.length > 0 ? trimmed : null
    }
    return v == null ? null : String(v)
  }

  const normalizeKey = (key: string) =>
    key.toLowerCase().replace(/[\s_\-().:[\]{}]/g, '')

  const pick = (...keys: string[]) => {
    const sources = [body, body?.data, body?.record, body?.fields, body?.values, body?.payload]
    const normalizedKeys = keys.map(normalizeKey)
    for (const source of sources) {
      if (!source || typeof source !== 'object') continue
      for (const key of keys) {
        const value = str((source as Record<string, unknown>)[key])
        if (value) return value
      }
      for (const [sourceKey, sourceValue] of Object.entries(source as Record<string, unknown>)) {
        if (normalizedKeys.includes(normalizeKey(sourceKey))) {
          const value = str(sourceValue)
          if (value) return value
        }
      }
    }
    return null
  }

  const campaignName = pick('campaign_name', 'campaign name', '캠페인명')

  const row = {
    name: pick('name', 'customer_name', '고객 성명', '성명'),
    phone: pick('phone', 'customer_phone', '연락처', '고객 전화번호'),
    current_carrier: pick('current_carrier'),
    desired_device: pick('desired_device'),
    desired_product: pick('desired_product'),
    campaign_name: campaignName,
    memo: pick('memo') ?? null,
    status: '신규 접수',
    source: pick('source') ?? 'webhook',
    registration_date: pick('registration_date', '접수 일자', '접수일자'),
    customer_name: pick('customer_name', 'name', '고객 성명', '성명'),
    customer_phone: pick('customer_phone', 'phone', '연락처', '고객 전화번호'),
    branch_name: pick('branch_name', '접수 지점명', '지점명'),
    activation_status: pick('activation_status', '개통 상태', '개통상태'),
    cancellation_status: pick('cancellation_status', '해지 및 철회', '해지및철회'),
    activation_number: pick('activation_number', '가입번호'),
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