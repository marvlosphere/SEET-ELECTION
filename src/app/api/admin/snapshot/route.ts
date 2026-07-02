import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminAuthed } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()

  const { data: votes } = await db.from('votes').select('candidate_id, position')
  if (!votes) return NextResponse.json({ error: 'No votes found' }, { status: 404 })

  const candidateIds = Array.from(new Set(votes.map(v => v.candidate_id)))
  const { data: candidates } = await db.from('candidates').select('id, name').in('id', candidateIds)

  const counts: Record<string, { position: string; candidate_id: string; candidate_name: string; vote_count: number }> = {}
  for (const vote of votes) {
    const key = vote.candidate_id
    if (!counts[key]) {
      const candidate = candidates?.find(c => c.id === vote.candidate_id)
      counts[key] = {
        position: vote.position,
        candidate_id: vote.candidate_id,
        candidate_name: candidate?.name ?? 'Unknown',
        vote_count: 0,
      }
    }
    counts[key].vote_count++
  }

  const totalVotesAtSnapshot = votes.length
  const { count: totalVotersVoted } = await db
    .from('voters')
    .select('*', { count: 'exact', head: true })
    .eq('has_voted', true)

  const snapshotRows = Object.values(counts).map(c => ({
    position: c.position,
    candidate_id: c.candidate_id,
    candidate_name: c.candidate_name,
    vote_count: c.vote_count,
    total_votes_at_snapshot: totalVotesAtSnapshot,
    total_voters_voted_at_snapshot: totalVotersVoted ?? 0,
  }))

  const { error } = await db.from('vote_snapshots').insert(snapshotRows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, snapshotted: snapshotRows.length })
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  await db.from('vote_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  return NextResponse.json({ success: true })
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const { data } = await db
    .from('vote_snapshots')
    .select('id, position, candidate_name, vote_count, total_votes_at_snapshot, total_voters_voted_at_snapshot, snapshot_at')
    .order('snapshot_at', { ascending: false })
    .limit(500)

  return NextResponse.json(data ?? [], {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}
