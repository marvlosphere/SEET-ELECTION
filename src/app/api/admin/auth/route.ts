import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const MAX_ADMIN_SESSIONS = 3
const SESSION_HOURS = 8
const YOUR_IP_WHITELIST = [
  '102.89.45.123', // replace with your current IP
]

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  )
}

export async function POST(req: NextRequest) {
  const db = getDb()
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  // Geo/VPN check
  if (!YOUR_IP_WHITELIST.includes(ip) && ip !== 'unknown') {
    try {
      const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,proxy`)
      const geoData = await geoRes.json()

      if (geoData.status === 'success') {
        if (geoData.countryCode !== 'NG') {
          await db.from('audit_log').insert({
            event_type: 'ADMIN_AUTH_BLOCKED_GEO',
            ip_address: ip,
            details: `Admin access blocked from ${geoData.country}`,
            success: false,
          })
          return NextResponse.json({ error: 'Admin access is only permitted from Nigeria.' }, { status: 403 })
        }

        if (geoData.proxy === true) {
          await db.from('audit_log').insert({
            event_type: 'ADMIN_AUTH_BLOCKED_VPN',
            ip_address: ip,
            details: 'VPN or proxy detected on admin login attempt',
            success: false,
          })
          return NextResponse.json({ error: 'VPN and proxy connections are not permitted for admin access.' }, { status: 403 })
        }
      }
    } catch {
      // Fail open
    }
  }

  // Rate limiting
  const { data: rateData } = await db
    .from('rate_limit')
    .select('*')
    .eq('matric_number', `ADMIN_${ip}`)
    .single()

  if (rateData?.locked_until && new Date(rateData.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(rateData.locked_until).getTime() - Date.now()) / 60000)
    return NextResponse.json({ error: `Too many failed attempts. Try again in ${minutesLeft} minutes.` }, { status: 429 })
  }

  // Verify admin key
  const { key } = await req.json()

  if (key !== process.env.ADMIN_KEY) {
    const newAttempts = (rateData?.attempts ?? 0) + 1
    const shouldLock = newAttempts >= 5
    await db.from('rate_limit').upsert({
      matric_number: `ADMIN_${ip}`,
      attempts: newAttempts,
      locked_until: shouldLock ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
      last_attempt: new Date().toISOString(),
    }, { onConflict: 'matric_number' })

    await db.from('audit_log').insert({
      event_type: 'ADMIN_AUTH_FAILED',
      ip_address: ip,
      details: `Invalid admin key. Attempt ${newAttempts} of 5.`,
      success: false,
    })

    return NextResponse.json({ error: 'Invalid key' }, { status: 401 })
  }

  // Clean up expired sessions
  await db.from('admin_sessions').delete().lt('expires_at', new Date().toISOString())

  // Check active session count
  const { data: activeSessions } = await db
    .from('admin_sessions')
    .select('id, ip_address, created_at')

  if ((activeSessions?.length ?? 0) >= MAX_ADMIN_SESSIONS) {
    await db.from('audit_log').insert({
      event_type: 'ADMIN_SESSION_LIMIT',
      ip_address: ip,
      details: `Admin session limit (${MAX_ADMIN_SESSIONS}) reached. Login rejected.`,
      success: false,
    })
    return NextResponse.json({
      error: `The admin panel is currently open on ${MAX_ADMIN_SESSIONS} devices, which is the maximum allowed. Please ask one of the active admins to log out, or wait up to 3 minutes for inactive sessions to expire automatically.`
    }, { status: 429 })
  }

  // Create new session
  const sessionToken = uuidv4()
  await db.from('admin_sessions').insert({
    session_token: sessionToken,
    ip_address: ip,
    user_agent: userAgent,
    expires_at: new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString(),
  })

  await db.from('rate_limit').delete().eq('matric_number', `ADMIN_${ip}`)
  await db.from('audit_log').insert({
    event_type: 'ADMIN_AUTH_SUCCESS',
    ip_address: ip,
    details: `Admin session created. ${(activeSessions?.length ?? 0) + 1}/${MAX_ADMIN_SESSIONS} slots used.`,
    success: true,
  })

  return NextResponse.json({ success: true, session_token: sessionToken })
}

export async function DELETE(req: NextRequest) {
  const db = getDb()
  const { session_token } = await req.json()
  if (session_token) {
    await db.from('admin_sessions').delete().eq('session_token', session_token)
  }
  return NextResponse.json({ success: true })
}
