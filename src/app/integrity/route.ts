import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { POSITIONS } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const db = getDb()

  const { count: total_voters } = await db.from('voters').select('*', { count: 'exact', head: true })
  const { count: total_voted } = await db.from('voters').select('*', { count: 'exact', head: true }).eq('has_voted', true)
  const { count: total_votes_cast } = await db.from('votes').select('*', { count: 'exact', head: true })
  const { count: snapshot_count } = await db.from('vote_snapshots').select('*', { count: 'exact', head: true })

  const { data: lastSnapshot } = await db
    .from('vote_snapshots')
    .select('snapshot_at')
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .single()

  const expected_votes_per_voter = POSITIONS.length
  const expected_total_votes = (total_voted ?? 0) * expected_votes_per_voter
  const is_consistent = (total_votes_cast ?? 0) === expected_total_votes

  return NextResponse.json(
    {
      total_voters: total_voters ?? 0,
      total_voted: total_voted ?? 0,
      total_votes_cast: total_votes_cast ?? 0,
      expected_votes_per_voter,
      expected_total_votes,
      is_consistent,
      last_snapshot_at: lastSnapshot?.snapshot_at ?? null,
      snapshot_count: snapshot_count ?? 0,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    }
  )
}