import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminAuthed } from '@/lib/adminAuth'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const { data } = await db.from('voters').select('id, matric_number, full_name, department, level, phone, has_voted, token_used, token').order('full_name')
  return NextResponse.json(data ?? [])
}
