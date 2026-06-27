export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  // Disable caching
  const headers = { 'Cache-Control': 'no-store, max-age=0' }
  
  const db = getDb()
  const { data: allVoters } = await db.from('voters').select('has_voted')
  
  const total_voters = allVoters?.length ?? 0
  const total_voted = allVoters?.filter(v => v.has_voted).length ?? 0

  return NextResponse.json(
    { total_voters, total_voted, tokens_sent: 0 },
    { headers }
  )
}
