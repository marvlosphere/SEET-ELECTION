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

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()

  await db.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await db.from('voter_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await db.from('vote_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await db.from('voters').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  await db.from('audit_log').insert({
    event_type: 'ELECTION_RESET',
    details: 'All voter and vote data cleared by admin',
    success: true,
  })

  return NextResponse.json({ success: true })
}