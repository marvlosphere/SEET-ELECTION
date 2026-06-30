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
  const { data } = await db
    .from('positions')
    .select('id, name, display_order')
    .order('display_order')
    .order('name')

  return NextResponse.json(data ?? [], {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { name } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Position name is required' }, { status: 400 })

    const db = getDb()
    const { data: existing } = await db.from('positions').select('display_order').order('display_order', { ascending: false }).limit(1).single()
    const nextOrder = (existing?.display_order ?? 0) + 1

    const { error } = await db.from('positions').insert({ name: name.trim(), display_order: nextOrder })
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'This position already exists' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'Position id required' }, { status: 400 })

    const db = getDb()

    // Get the position name first
    const { data: pos } = await db.from('positions').select('name').eq('id', id).single()
    if (!pos) return NextResponse.json({ error: 'Position not found' }, { status: 404 })

    // Check if candidates exist for this position
    const { data: candidates } = await db.from('candidates').select('id').eq('position', pos.name)
    if (candidates && candidates.length > 0) {
      return NextResponse.json({ error: 'Cannot delete a position that has candidates. Remove all candidates first.' }, { status: 400 })
    }

    await db.from('positions').delete().eq('id', id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}