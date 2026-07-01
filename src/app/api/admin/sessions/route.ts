import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminAuthed } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

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

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const staleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  await db.from('admin_sessions')
    .delete()
    .or(`expires_at.lt.${new Date().toISOString()},last_active.lt.${staleThreshold}`)

  const { data } = await db
    .from('admin_sessions')
    .select('id, ip_address, created_at, expires_at')
    .order('created_at', { ascending: false })

  return NextResponse.json({
    count: data?.length ?? 0,
    sessions: data ?? [],
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const { session_token } = await req.json()
  if (session_token) {
    await db.from('admin_sessions')
      .update({ last_active: new Date().toISOString() })
      .eq('session_token', session_token)
  }
  return NextResponse.json({ success: true })
}
