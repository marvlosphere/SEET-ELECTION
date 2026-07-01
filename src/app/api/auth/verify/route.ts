import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15
const MAX_VOTES_PER_IP = 5
const YOUR_IP_WHITELIST = [
  '105.119.30.83', // replace with your current IP
]

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function logEvent(db: ReturnType<typeof getDb>, event: {
  event_type: string
  matric_number?: string
  ip_address?: string
  user_agent?: string
  details?: string
  success?: boolean
}) {
  await db.from('audit_log').insert({
    event_type: event.event_type,
    matric_number: event.matric_number ?? null,
    ip_address: event.ip_address ?? null,
    user_agent: event.user_agent ?? null,
    details: event.details ?? null,
    success: event.success ?? true,
  })
}

export async function POST(req: NextRequest) {
  const db = getDb()
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  try {
    const { matric_number, token } = await req.json()

    if (!matric_number || !token) {
      return NextResponse.json({ error: 'Matric number and token are required' }, { status: 400 })
    }

    const matric = matric_number.toUpperCase().trim()
    // Check if election is open
    const { data: settings } = await db.from('election_settings').select('election_open').single()
    if (!settings?.election_open) {
      return NextResponse.json({ error: 'Voting is currently closed. Please check back when the election opens.' }, { status: 403 })
    }

    // Country and VPN check (skip for whitelisted IPs)
    if (!YOUR_IP_WHITELIST.includes(ip) && ip !== 'unknown') {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,proxy,hosting`)
        const geoData = await geoRes.json()
    
        if (geoData.status === 'success') {
          if (geoData.countryCode !== 'NG') {
            await logEvent(db, {
              event_type: 'AUTH_BLOCKED_GEO',
              matric_number: matric,
              ip_address: ip,
              user_agent: userAgent,
              details: `Access blocked from ${geoData.country} (${geoData.countryCode})`,
              success: false,
            })
            return NextResponse.json({
              error: 'Access to this election is only permitted from Nigeria. If you are in Nigeria, please switch to mobile data and try again.'
            }, { status: 403 })
          }
    
          if (geoData.proxy === true) {
            await logEvent(db, {
              event_type: 'AUTH_BLOCKED_VPN',
              matric_number: matric,
              ip_address: ip,
              user_agent: userAgent,
              details: `VPN or proxy detected from ${geoData.country}`,
              success: false,
            })
            return NextResponse.json({
              error: 'VPN and proxy connections are not permitted. Please disconnect your VPN and use your personal mobile data or a trusted network.'
            }, { status: 403 })
          }
        }
      } catch {
        // If geo check fails, allow through rather than blocking legitimate voters
        // Log it but don't block
        await logEvent(db, {
          event_type: 'GEO_CHECK_FAILED',
          matric_number: matric,
          ip_address: ip,
          details: 'ip-api.com check failed, allowing through',
          success: true,
        })
      }
    }
    // IP vote limit check (skip for whitelisted IPs)
    if (!YOUR_IP_WHITELIST.includes(ip)) {
      const { data: ipVotes } = await db
        .from('audit_log')
        .select('id')
        .eq('ip_address', ip)
        .eq('event_type', 'VOTE_SUBMITTED')
        .eq('success', true)
    
      if ((ipVotes?.length ?? 0) >= MAX_VOTES_PER_IP) {
        await logEvent(db, {
          event_type: 'AUTH_BLOCKED_IP',
          matric_number: matric,
          ip_address: ip,
          user_agent: userAgent,
          details: `IP ${ip} has reached the ${MAX_VOTES_PER_IP} vote submission limit`,
          success: false,
        })
        return NextResponse.json({
          error: 'Too many votes have been submitted from your network. Please switch to personal mobile data and try again.'
        }, { status: 429 })
      }
    }

    // ── Rate limiting ────────────────────────────────────────────────────────
    const { data: rateData } = await db
      .from('rate_limit')
      .select('*')
      .eq('matric_number', matric)
      .single()

    if (rateData) {
      // Check if currently locked
      if (rateData.locked_until && new Date(rateData.locked_until) > new Date()) {
        const minutesLeft = Math.ceil(
          (new Date(rateData.locked_until).getTime() - Date.now()) / 60000
        )
        await logEvent(db, {
          event_type: 'AUTH_BLOCKED',
          matric_number: matric,
          ip_address: ip,
          user_agent: userAgent,
          details: `Account locked. ${minutesLeft} minutes remaining.`,
          success: false,
        })
        return NextResponse.json({
          error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`
        }, { status: 429 })
      }
    }

    // ── Find voter ───────────────────────────────────────────────────────────
    const { data: voter, error: voterError } = await db
      .from('voters')
      .select('*')
      .eq('matric_number', matric)
      .single()

    if (voterError || !voter) {
      await logEvent(db, {
        event_type: 'AUTH_FAILED',
        matric_number: matric,
        ip_address: ip,
        user_agent: userAgent,
        details: 'Matric number not found',
        success: false,
      })
      return NextResponse.json({ error: 'Matric number not found. Contact the electoral committee.' }, { status: 404 })
    }

    // ── Check already voted ──────────────────────────────────────────────────
    if (voter.has_voted) {
      await logEvent(db, {
        event_type: 'AUTH_ALREADY_VOTED',
        matric_number: matric,
        ip_address: ip,
        user_agent: userAgent,
        details: 'Student has already voted',
        success: false,
      })
      return NextResponse.json({ error: 'This matric number has already been used to vote.' }, { status: 403 })
    }

    // ── Verify token ─────────────────────────────────────────────────────────
    const submittedToken = token.toUpperCase().replace(/\s/g, '')
    if (voter.token !== submittedToken) {
      // Increment failed attempts
      const newAttempts = (rateData?.attempts ?? 0) + 1
      const shouldLock = newAttempts >= MAX_ATTEMPTS
      const lockedUntil = shouldLock
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
        : null

      await db.from('rate_limit').upsert({
        matric_number: matric,
        attempts: newAttempts,
        locked_until: lockedUntil,
        last_attempt: new Date().toISOString(),
      }, { onConflict: 'matric_number' })

      await logEvent(db, {
        event_type: 'AUTH_FAILED',
        matric_number: matric,
        ip_address: ip,
        user_agent: userAgent,
        details: `Invalid token. Attempt ${newAttempts} of ${MAX_ATTEMPTS}.`,
        success: false,
      })

      const attemptsLeft = MAX_ATTEMPTS - newAttempts
      if (shouldLock) {
        return NextResponse.json({
          error: `Too many failed attempts. Your account is locked for ${LOCK_MINUTES} minutes.`
        }, { status: 429 })
      }

      return NextResponse.json({
        error: `Invalid token. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining before lockout.`
      }, { status: 401 })
    }

    // ── Success — reset rate limit ───────────────────────────────────────────
    await db.from('rate_limit').delete().eq('matric_number', matric)

    // ── Create session ───────────────────────────────────────────────────────
    const sessionToken = uuidv4()
    await db.from('voter_sessions').insert({
      voter_id: voter.id,
      session_token: sessionToken,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })

    // ── Fetch candidates ─────────────────────────────────────────────────────
    const { data: candidates } = await db
      .from('candidates')
      .select('*')
      .order('position')
      .order('name')

    // ── Log success ──────────────────────────────────────────────────────────
    await logEvent(db, {
      event_type: 'AUTH_SUCCESS',
      matric_number: matric,
      ip_address: ip,
      user_agent: userAgent,
      details: 'Voter authenticated successfully',
      success: true,
    })

    return NextResponse.json({
      voter: {
        voter_id: voter.id,
        full_name: voter.full_name,
        matric_number: voter.matric_number,
        session_token: sessionToken,
      },
      candidates,
    })
  } catch (err) {
    console.error('Auth error:', err)
    await logEvent(db, {
      event_type: 'AUTH_ERROR',
      ip_address: ip,
      user_agent: userAgent,
      details: String(err),
      success: false,
    })
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
