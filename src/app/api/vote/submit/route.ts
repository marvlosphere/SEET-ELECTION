import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { POSITIONS } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { voter_id, session_token, votes } = await req.json()
    if (!voter_id || !session_token || !votes || !Array.isArray(votes)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const db = getDb()
    const { data: session } = await db.from('voter_sessions').select('*').eq('voter_id', voter_id).eq('session_token', session_token).single()
    if (!session) return NextResponse.json({ error: 'Invalid or expired session. Please start again.' }, { status: 401 })
    if (new Date(session.expires_at) < new Date()) return NextResponse.json({ error: 'Your session has expired. Please start again.' }, { status: 401 })
    const { data: voter } = await db.from('voters').select('has_voted').eq('id', voter_id).single()
    if (voter?.has_voted) return NextResponse.json({ error: 'You have already voted.' }, { status: 403 })
    const votedPositions = votes.map((v: { position: string }) => v.position)
    const missingPositions = POSITIONS.filter(p => !votedPositions.includes(p))
    if (missingPositions.length > 0) return NextResponse.json({ error: `Missing votes for: ${missingPositions.join(', ')}` }, { status: 400 })
    const candidateIds = votes.map((v: { candidate_id: string }) => v.candidate_id)
    const { data: validCandidates } = await db.from('candidates').select('id').in('id', candidateIds)
    if (!validCandidates || validCandidates.length !== votes.length) return NextResponse.json({ error: 'Invalid candidate selection.' }, { status: 400 })
    const voteRows = votes.map((v: { position: string; candidate_id: string }) => ({ voter_id, candidate_id: v.candidate_id, position: v.position }))
    const { error: voteError } = await db.from('votes').insert(voteRows)
    if (voteError) throw voteError
    await db.from('voters').update({ has_voted: true, token_used: true }).eq('id', voter_id)
    await db.from('voter_sessions').delete().eq('voter_id', voter_id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
