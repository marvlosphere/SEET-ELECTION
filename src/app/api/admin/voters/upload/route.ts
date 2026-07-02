import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminAuthed } from '@/lib/adminAuth'
import { generateToken, normalizePhone } from '@/lib/utils'

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { csv, dept_code } = await req.json()
    if (!csv) return NextResponse.json({ error: 'No CSV provided' }, { status: 400 })
    if (!dept_code) return NextResponse.json({ error: 'Department is required' }, { status: 400 })

    const lines = csv.trim().split('\n').map((l: string) => l.trim()).filter(Boolean)
    if (lines.length === 0) return NextResponse.json({ error: 'CSV is empty' }, { status: 400 })

    const dataLines = lines[0].toLowerCase().includes('matric') ? lines.slice(1) : lines
    if (dataLines.length === 0) return NextResponse.json({ error: 'No voter rows found. Only a header row was provided.' }, { status: 400 })

    const rowErrors: string[] = []
    const seenMatrics = new Set<string>()
    const phoneRegex = /^\+?[0-9]{10,14}$/

    const voters = dataLines.map((line: string, idx: number) => {
      const rowNum = idx + (lines[0].toLowerCase().includes('matric') ? 2 : 1)
      const parts = line.split(',').map((s: string) => s.trim())

      if (parts.length < 5) {
        rowErrors.push(`Row ${rowNum}: expected 5 columns (matric_number, full_name, department, level, phone), found ${parts.length}`)
        return null
      }

      const [matric_number, full_name, department, level, phone] = parts

      if (!matric_number) { rowErrors.push(`Row ${rowNum}: missing matric number`); return null }
      if (!full_name) { rowErrors.push(`Row ${rowNum}: missing full name`); return null }
      if (!phone) { rowErrors.push(`Row ${rowNum}: missing phone number`); return null }

      const normalizedPhone = normalizePhone(phone)
      if (!phoneRegex.test(normalizedPhone.replace(/\s/g, ''))) {
        rowErrors.push(`Row ${rowNum}: invalid phone number "${phone}"`)
        return null
      }

      const upperMatric = matric_number.toUpperCase()
      if (seenMatrics.has(upperMatric)) {
        rowErrors.push(`Row ${rowNum}: duplicate matric number "${upperMatric}" within this upload`)
        return null
      }
      seenMatrics.add(upperMatric)

      return {
        matric_number: upperMatric,
        full_name,
        department: department || '',
        dept_code,
        level: level || '',
        phone: normalizedPhone,
        token: generateToken(),
        token_used: false,
        has_voted: false,
      }
    }).filter((v: unknown): v is NonNullable<typeof v> => v !== null)

    if (rowErrors.length > 0) {
      return NextResponse.json({
        error: `Found ${rowErrors.length} issue(s) in your CSV. Fix these and try again:`,
        details: rowErrors.slice(0, 20), // cap at 20 to avoid a huge response
      }, { status: 400 })
    }

    if (voters.length === 0) {
      return NextResponse.json({ error: 'No valid voter rows found after validation' }, { status: 400 })
    }

    const db = getDb()
    const { error } = await db.from('voters').upsert(voters, { onConflict: 'matric_number' })
    if (error) throw error

    return NextResponse.json({ count: voters.length })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
