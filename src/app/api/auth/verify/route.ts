import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const { matric_number, token } = await req.json()
    if (!matric_number || !token) return NextResponse.json({ error: 'Matric number and token are required' }, { status: 400 })
    const db = getDb()
    const { data: voter, error: voterError } = await db.from('voters').select('*').eq('matric_number', matric_number.toUpperCase()).single()
    if (voterError || !voter) return NextResponse.json({ error: 'Matric number not found. Contact the electoral committee.' }, { status: 404 })
    if (voter.has_voted) return NextResponse.json({ error: 'This matric number has already been used to vote.' }, { status: 403 })
    if (voter.token_used) return NextResponse.json({ error: 'This token has already been used.' }, { status: 403 })
    if (voter.token !== token.toUpperCase().replace(/\s/g, '')) return NextResponse.json({ error: 'Invalid token. Check your SMS/WhatsApp message.' }, { status: 401 })
    const sessionToken = uuidv4()
    await db.from('voter_sessions').insert({ voter_id: voter.id, session_token: sessionToken, expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() })
    const { data: candidates } = await db.from('candidates').select('*').order('position').order('name')
    return NextResponse.json({ voter: { voter_id: voter.id, full_name: voter.full_name, matric_number: voter.matric_number, session_token: sessionToken }, candidates })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
