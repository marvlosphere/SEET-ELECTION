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

  // Get current vote counts per candidate
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