import { createClient } from 'npm:@supabase/supabase-js@2'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}
import webpush from 'npm:web-push@3.6.7'

const WEBHOOK_SECRET = Deno.env.get('LEADS_WEBHOOK_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const RAW_SUBJECT = (Deno.env.get('VAPID_SUBJECT') ?? '').trim()
const VAPID_SUBJECT = RAW_SUBJECT
  ? (RAW_SUBJECT.startsWith('mailto:') || RAW_SUBJECT.startsWith('http')
      ? RAW_SUBJECT
      : `mailto:${RAW_SUBJECT}`)
  : 'mailto:admin@example.com'

let vapidReady = false
try {
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
    vapidReady = true
  }
} catch (e) {
  console.error('[leads-webhook] vapid init failed', e)
}

const DOGMARU_CAMPAIGN = '도그마루_홈캠'

async function broadcastLeadPush(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  channel: 'meta' | 'dogmaru',
) {
  if (!vapidReady) return
  const isDogmaru = channel === 'dogmaru'
  const title = '📢 [신규 리드 인입]'
  const body = isDogmaru
    ? '도그마루에 새 잠재고객이 등록되었습니다. 즉시 확인 후 해피콜을 진행하세요.'
    : '메타광고에 새 잠재고객이 등록되었습니다. 즉시 확인 후 해피콜을 진행하세요.'
  const url = `/leads?tab=${channel}&highlight=${leadId}`

  const { data: profs } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('status', 'active')
    .eq('push_enabled', true)
  const uids = (profs ?? []).map((p: any) => p.user_id).filter(Boolean)
  if (uids.length === 0) return

  const { data: tokens } = await supabase
    .from('user_push_tokens')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', uids)

  const payload = JSON.stringify({
    title,
    body,
    url,
    tag: `lead-${channel}-${leadId}`,
    icon: '/pwa-192.png',
    vibrate: [200, 100, 200],
  })

  await Promise.all(
    (tokens ?? []).map(async (t: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          payload,
        )
      } catch (e: any) {
        const status = e?.statusCode
        if (status === 404 || status === 410) {
          await supabase.from('user_push_tokens').delete().eq('id', t.id)
        } else {
          console.warn('[leads-webhook] push failed', status, e?.message)
        }
      }
    }),
  )
}

function unauthorized(msg = 'Unauthorized') {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Meta webhook verification (GET)
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const verifyToken = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (mode === 'subscribe' && verifyToken === WEBHOOK_SECRET) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  const token =
    req.headers.get('x-webhook-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
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
  const phone = pick('phone', 'customer_phone', '연락처', '고객 전화번호')
  const source = pick('source') ?? 'webhook'

  // ── Meta 리드 중복 방지 (phone + campaign_name + status = "신규 접수") ──
  if (phone && campaignName && source === 'meta') {
    const supabaseCheck = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: existing } = await supabaseCheck
      .from('leads')
      .select('id')
      .eq('phone', phone)
      .eq('campaign_name', campaignName)
      .eq('status', '신규 접수')
      .maybeSingle()
    if (existing) {
      return new Response(JSON.stringify({ ok: true, id: existing.id, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // 도그마루 Apps Script에서 보내는 ISO 타임스탬프
  const registeredAt = pick('registered_at')

  const row = {
    name: pick('name', 'customer_name', '고객 성명', '성명'),
    phone,
    current_carrier: pick('current_carrier'),
    desired_device: pick('desired_device'),
    desired_product: pick('desired_product'),
    campaign_name: campaignName,
    channel: null,
    memo: pick('memo') ?? null,
    status: '신규 접수',
    source,
    registration_date: pick('registration_date', '접수 일자', '접수일자'),
    customer_name: pick('customer_name', 'name', '고객 성명', '성명'),
    customer_phone: phone,
    branch_name: pick('branch_name', '접수 지점명', '지점명'),
    activation_status: pick('activation_status', '개통 상태', '개통상태'),
    cancellation_status: pick('cancellation_status', '해지 및 철회', '해지및철회'),
    activation_number: pick('activation_number', '가입번호'),
    ...(registeredAt ? { created_at: registeredAt } : {}),
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data, error } = await supabase.from('leads').insert(row).select('id').single()
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 푸시 알림
  try {
    const pushChannel: 'meta' | 'dogmaru' = campaignName === DOGMARU_CAMPAIGN ? 'dogmaru' : 'meta'
    await broadcastLeadPush(supabase, data.id as string, pushChannel)
  } catch (e) {
    console.warn('[leads-webhook] broadcast failed', e)
  }

  return new Response(JSON.stringify({ ok: true, id: data.id, updated: false }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})


