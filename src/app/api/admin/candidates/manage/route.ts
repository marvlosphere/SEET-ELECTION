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

  try {
    const { name, position, department, level, manifesto, photo_url } = await req.json()

    if (!name?.trim() || !position?.trim()) {
      return NextResponse.json({ error: 'Name and position are required' }, { status: 400 })
    }
    
    const db = getDb()
    
    // Validate position exists in the positions table
    const { data: validPosition } = await db.from('positions').select('id').eq('name', position.trim()).single()
    if (!validPosition) {
      return NextResponse.json({ error: `"${position}" is not a defined position. Create it first under Positions.` }, { status: 400 })
    }

    // Check existing real candidates for this position (exclude AGAINST placeholders)
    const { data: existing } = await db
      .from('candidates')
      .select('id, name, manifesto')
      .eq('position', position)

    const realCandidates = (existing ?? []).filter(c => c.manifesto !== 'AGAINST')
    const againstEntry = (existing ?? []).find(c => c.manifesto === 'AGAINST')

    // Insert the new real candidate
    const { error: insertError } = await db.from('candidates').insert({
      name: name.trim(),
      position: position.trim(),
      department: department?.trim() || '',
      level: level?.trim() || '',
      manifesto: manifesto?.trim() || '',
      photo_url: photo_url || null,
    })

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    const totalRealAfterInsert = realCandidates.length + 1

    if (totalRealAfterInsert === 1) {
      // First candidate for this position — ensure an AGAINST option exists
      if (!againstEntry) {
        await db.from('candidates').insert({
          name: name.trim(),
          position: position.trim(),
          department: department?.trim() || '',
          level: level?.trim() || '',
          manifesto: 'AGAINST',
          photo_url: null,
        })
      }
    } else if (totalRealAfterInsert >= 2 && againstEntry) {
      // Position is now contested — remove the AGAINST placeholder
      await db.from('candidates').delete().eq('id', againstEntry.id)
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
    if (!id) return NextResponse.json({ error: 'Candidate id required' }, { status: 400 })

    const db = getDb()

    // Find the candidate being deleted to check position
    const { data: target } = await db.from('candidates').select('position, manifesto').eq('id', id).single()
    if (!target) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

    await db.from('candidates').delete().eq('id', id)

    // If this was a real candidate (not AGAINST), check if position now has only 1 real candidate left
    if (target.manifesto !== 'AGAINST') {
      const { data: remaining } = await db
        .from('candidates')
        .select('id, name, department, level, manifesto')
        .eq('position', target.position)

      const realRemaining = (remaining ?? []).filter(c => c.manifesto !== 'AGAINST')
      const hasAgainst = (remaining ?? []).some(c => c.manifesto === 'AGAINST')

      if (realRemaining.length === 1 && !hasAgainst) {
        const sole = realRemaining[0]
        await db.from('candidates').insert({
          name: sole.name,
          position: target.position,
          department: sole.department,
          level: sole.level,
          manifesto: 'AGAINST',
          photo_url: null,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
