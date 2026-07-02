'use client'

import { useState, useEffect, useRef } from 'react'
import { Position } from '@/lib/supabase'

interface ResultRow { candidate_id: string; candidate_name: string; position: Position; vote_count: number }
interface Voter { id: string; matric_number: string; full_name: string; department: string; dept_code: string; level: string; phone: string; has_voted: boolean; token_used: boolean; token: string }
interface AuditEntry { id: string; event_type: string; matric_number: string | null; ip_address: string | null; details: string | null; success: boolean; created_at: string }
interface SchoolDept { id: string; school_name: string; dept_name: string; dept_code: string }
interface AdminCandidate { id: string; name: string; position: string; department: string; level: string; manifesto: string; photo_url: string | null; created_at: string }
interface PositionItem { id: string; name: string; display_order: number }

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [authError, setAuthError] = useState('')
  const [tab, setTab] = useState<'dashboard' | 'voters' | 'candidates' | 'results' | 'whatsapp' | 'audit' | 'settings'>('dashboard')
  const [results, setResults] = useState<ResultRow[]>([])
  const [voters, setVoters] = useState<Voter[]>([])
  const [schoolsDepts, setSchoolsDepts] = useState<SchoolDept[]>([])
  const [adminCandidates, setAdminCandidates] = useState<AdminCandidate[]>([])
  const [positions, setPositions] = useState<PositionItem[]>([])
  const [newPositionName, setNewPositionName] = useState('')
  const [positionStatus, setPositionStatus] = useState('')
  const [adminSessions, setAdminSessions] = useState(0)
  const [resetDeptCode, setResetDeptCode] = useState('')
  const [candForm, setCandForm] = useState({ name: '', position: '', department: '', level: '', manifesto: '', photo_url: '' })
  const [candUploading, setCandUploading] = useState(false)
  const [candSubmitting, setCandSubmitting] = useState(false)
  const [candStatus, setCandStatus] = useState('')
  const [uploadDeptCode, setUploadDeptCode] = useState('')
  const [filterDeptCode, setFilterDeptCode] = useState('')
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [electionOpen, setElectionOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadCSV, setUploadCSV] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [sendingTokens, setSendingTokens] = useState(false)
  const [sendDeptCode, setSendDeptCode] = useState('')
  const keyRef = useRef('')
  const sessionTokenRef = useRef('')

  async function fetchData() {
    const k = keyRef.current
    if (!k) return
    try {
      const h = { 'x-admin-key': k }
      const t = Date.now()
      const [r, v, st, a, sd, c, p, ses] = await Promise.all([
        fetch(`/api/admin/results?t=${t}`, { headers: h }),
        fetch(`/api/admin/voters?t=${t}`, { headers: h }),
        fetch(`/api/admin/settings?t=${t}`, { headers: h }),
        fetch(`/api/admin/audit-log?t=${t}`, { headers: h }),
        fetch(`/api/admin/schools-departments?t=${t}`, { headers: h }),
        fetch(`/api/admin/candidates?t=${t}`, { headers: h }),
        fetch(`/api/admin/positions?t=${t}`, { headers: h }),
        fetch(`/api/admin/sessions?t=${t}`, { headers: h }),
      ])
      if (r.ok) setResults(await r.json())
      if (v.ok) setVoters(await v.json())
      if (st.ok) { const d = await st.json(); setElectionOpen(d.election_open) }
      if (a.ok) setAuditLog(await a.json())
      if (sd.ok) setSchoolsDepts(await sd.json())
      if (c.ok) setAdminCandidates(await c.json())
      if (p.ok) setPositions(await p.json())
      if (ses.ok) { const s = await ses.json(); setAdminSessions(s.count) }
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!authed) return
    fetchData()
    const interval = setInterval(fetchData, 5000)
    const heartbeatInterval = setInterval(() => {
      if (sessionTokenRef.current) {
        fetch('/api/admin/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': keyRef.current },
          body: JSON.stringify({ session_token: sessionTokenRef.current }),
        }).catch(() => {})
      }
    }, 60 * 1000)
    const snapshotInterval = setInterval(() => {
      fetch('/api/admin/snapshot', { method: 'POST', headers: { 'x-admin-key': keyRef.current } }).catch(() => {})
    }, 5 * 60 * 1000)
    return () => { clearInterval(interval); clearInterval(heartbeatInterval); clearInterval(snapshotInterval) }
  }, [authed])

  async function handleAdminAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: adminKey }),
    })
    setLoading(false)
    if (res.ok) {
      const data = await res.json()
      keyRef.current = adminKey
      sessionTokenRef.current = data.session_token
      setAuthed(true)
      setAuthError('')
    } else {
      const data = await res.json()
      setAuthError(data.error || 'Invalid admin key.')
    }
  }

  async function toggleElection() {
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': keyRef.current },
      body: JSON.stringify({ election_open: !electionOpen }),
    })
    setElectionOpen(!electionOpen)
  }

  async function handleUploadVoters() {
    if (!uploadCSV.trim()) return
    if (!uploadDeptCode) { setUploadStatus('❌ Please select a department first'); return }
    setUploadStatus('Uploading...')
    const res = await fetch('/api/admin/voters/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': keyRef.current },
      body: JSON.stringify({ csv: uploadCSV, dept_code: uploadDeptCode }),
    })
    const data = await res.json()
    if (res.ok) {
      setUploadStatus(`✅ ${data.count} voters uploaded. Tokens generated.`)
      fetchData()
    } else {
      const detailsText = data.details ? '\n' + data.details.join('\n') : ''
      setUploadStatus(`❌ ${data.error}${detailsText}`)
    }
  }

  async function handleSendTokens() {
    setSendingTokens(true)
    const url = sendDeptCode ? `/api/admin/voters/send-tokens?dept_code=${sendDeptCode}` : '/api/admin/voters/send-tokens'
    const res = await fetch(url, { method: 'POST', headers: { 'x-admin-key': keyRef.current } })    
    const data = await res.json()
    setSendingTokens(false)
    if (res.ok) setUploadStatus(`✅ Tokens sent to ${data.sent} voters via SMS`)
    else setUploadStatus(`❌ ${data.error}`)
  }
  async function handlePhotoUpload(file: File) {
    const MAX_SIZE_MB = 2
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setCandStatus(`❌ Photo is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Please use an image under ${MAX_SIZE_MB}MB.`)
      return
    }
    if (!file.type.startsWith('image/')) {
      setCandStatus('❌ Please select an image file (JPG, PNG, etc.)')
      return
    }
    setCandUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
  
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      )
      const data = await res.json()
      if (data.secure_url) {
        setCandForm(prev => ({ ...prev, photo_url: data.secure_url }))
      } else {
        setCandStatus('❌ Photo upload failed')
      }
    } catch {
      setCandStatus('❌ Photo upload failed')
    }
    setCandUploading(false)
  }
  
  async function handleAddCandidate() {
    if (!candForm.name.trim() || !candForm.position.trim()) {
      setCandStatus('❌ Name and position are required')
      return
    }
    setCandSubmitting(true)
    setCandStatus('')
    const res = await fetch('/api/admin/candidates/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': keyRef.current },
      body: JSON.stringify(candForm),
    })
    const data = await res.json()
    setCandSubmitting(false)
    if (res.ok) {
      setCandStatus(`✅ ${candForm.name} added to ${candForm.position}`)
      setCandForm({ name: '', position: '', department: '', level: '', manifesto: '', photo_url: '' })
      fetchData()
    } else {
      setCandStatus(`❌ ${data.error}`)
    }
  }
  
  async function handleDeleteCandidate(id: string, name: string) {
    if (!confirm(`Remove ${name} from the ballot?`)) return
    const res = await fetch('/api/admin/candidates/manage', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': keyRef.current },
      body: JSON.stringify({ id }),
    })
    if (res.ok) fetchData()
  }
  async function handleAddPosition() {
    if (!newPositionName.trim()) return
    setPositionStatus('Adding...')
    const res = await fetch('/api/admin/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': keyRef.current },
      body: JSON.stringify({ name: newPositionName.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      setPositionStatus(`✅ "${newPositionName}" added`)
      setNewPositionName('')
      fetchData()
    } else {
      setPositionStatus(`❌ ${data.error}`)
    }
  }
  
  async function handleDeletePosition(id: string, name: string) {
    if (!confirm(`Remove position "${name}"? This only works if no candidates are assigned to it.`)) return
    const res = await fetch('/api/admin/positions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': keyRef.current },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (res.ok) fetchData()
    else alert(data.error)
  }
  const totalVoters = voters.length
  const totalVoted = voters.filter(v => v.has_voted).length
  const turnout = totalVoters ? Math.round((totalVoted / totalVoters) * 100) : 0

  const resultsByPosition = positions.map(p => ({
    position: p.name,
    candidates: results.filter(r => r.position === p.name).sort((a, b) => b.vote_count - a.vote_count),
  }))

  if (!authed) {
    return (
      <main className="min-h-screen bg-dark flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-3">
              <span className="text-white text-xl">🔑</span>
            </div>
            <h1 className="text-xl font-bold text-dark">FUTABallot Admin</h1>
            <p className="text-gray-500 text-sm mt-1">Electoral Committee Access</p>
          </div>
          <form onSubmit={handleAdminAuth} className="space-y-4">
            <input
              className="input"
              type="password"
              placeholder="Admin key"
              value={adminKey}
              onChange={e => setAdminKey(e.target.value)}
              required
            />
            {authError && <p className="text-red-600 text-sm">{authError}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Checking...' : 'Enter Admin Panel'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-light">
      <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
        <div>
          <p className="font-bold">FUTABallot Admin</p>
          <p className="text-white/60 text-xs">Electoral Committee Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${electionOpen ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {electionOpen ? '🟢 Election Open' : '🔴 Election Closed'}
          </span>
          <button onClick={async () => {
            if (sessionTokenRef.current) {
              await fetch('/api/admin/auth', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_token: sessionTokenRef.current }),
              })
            }
            setAuthed(false)
            keyRef.current = ''
            sessionTokenRef.current = ''
          }} className="text-white/50 hover:text-white text-sm">Logout</button>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {(['dashboard', 'voters', 'candidates', 'results', 'whatsapp', 'audit', 'settings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-dark'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {tab === 'dashboard' && (
          <div>
            <h2 className="text-xl font-bold text-dark mb-6">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="card text-center">
                <p className="text-3xl font-bold text-primary">{totalVoters || '—'}</p>
                <p className="text-gray-500 text-sm mt-1">Registered Voters</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-success">{totalVoted || '—'}</p>
                <p className="text-gray-500 text-sm mt-1">Have Voted</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-accent">{turnout}%</p>
                <p className="text-gray-500 text-sm mt-1">Voter Turnout</p>
              </div>
            </div>
            <div className="card">
              <h3 className="font-bold text-dark mb-2">Quick Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button onClick={toggleElection} className={electionOpen ? 'btn-danger' : 'btn-primary'}>
                  {electionOpen ? 'Close Election' : 'Open Election'}
                </button>
                <button onClick={fetchData} className="btn-primary bg-gray-600 hover:bg-gray-700">
                  Refresh Data
                </button>
                <button
                  onClick={() => fetch('/api/admin/snapshot', { method: 'POST', headers: { 'x-admin-key': keyRef.current } }).then(() => fetchData())}
                  className="btn-accent"
                >
                  📸 Take Snapshot
                </button>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    className="input w-auto text-sm"
                    value={resetDeptCode}
                    onChange={e => setResetDeptCode(e.target.value)}
                  >
                    <option value="">All departments</option>
                    {schoolsDepts.map(sd => (
                      <option key={sd.id} value={sd.dept_code}>{sd.dept_code} — {sd.dept_name}</option>
                    ))}
                  </select>
                  <button
                    onClick={async () => {
                      const scope = resetDeptCode ? `department ${resetDeptCode}` : 'ALL departments'
                      if (!confirm(`This will permanently delete voters and votes for ${scope}. This cannot be undone. Are you sure?`)) return
                      if (!confirm(`Second confirmation: delete all voter data for ${scope}?`)) return
                      const res = await fetch(`/api/admin/reset${resetDeptCode ? `?dept_code=${resetDeptCode}` : ''}`, {
                        method: 'POST',
                        headers: { 'x-admin-key': keyRef.current }
                      })
                      if (res.ok) { alert('Election data cleared successfully.'); fetchData() }
                      else { const d = await res.json(); alert(`Error: ${d.error}`) }
                    }}
                    className="btn-danger"
                  >
                    🗑️ Reset Election Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'voters' && (
          <div>
            <h2 className="text-xl font-bold text-dark mb-6">Voter Management</h2>
            <div className="card mb-6">
              <h3 className="font-semibold text-dark mb-3">Upload Voter List (CSV)</h3>
              <p className="text-gray-500 text-sm mb-3">
                Paste CSV with columns: <code className="bg-gray-100 px-1 rounded">matric_number, full_name, department, level, phone</code>
              </p>
              <div className="mb-3">
                <label className="block text-sm font-medium text-dark mb-1.5">Department (tags every voter in this upload)</label>
                <select
                  className="input"
                  value={uploadDeptCode}
                  onChange={e => setUploadDeptCode(e.target.value)}
                >
                  <option value="">— Select department —</option>
                  {schoolsDepts.map(sd => (
                    <option key={sd.id} value={sd.dept_code}>
                      {sd.dept_code} — {sd.dept_name} ({sd.school_name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative border border-gray-300 rounded-lg overflow-hidden">
                <div className="flex h-48">
                  <div
                    id="csv-line-numbers"
                    className="bg-gray-50 text-gray-400 text-xs font-mono py-3 px-2 select-none text-right border-r border-gray-200 overflow-y-hidden"
                    style={{ lineHeight: '1.5rem', minWidth: '2.5rem' }}
                  >
                    {(uploadCSV.split('\n').length > 0 ? uploadCSV.split('\n') : ['']).map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  <textarea
                    className="flex-1 font-mono text-sm p-3 outline-none resize-none overflow-y-auto"
                    style={{ lineHeight: '1.5rem' }}
                    placeholder={`matric_number,full_name,department,level,phone\nENG/2021/001,John Doe,Civil Engineering,400,08012345678`}
                    value={uploadCSV}
                    onChange={e => setUploadCSV(e.target.value)}
                    onScroll={e => {
                      const gutter = document.getElementById('csv-line-numbers')
                      if (gutter) gutter.scrollTop = e.currentTarget.scrollTop
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-3">
                <button onClick={handleUploadVoters} className="btn-primary">Upload & Generate Tokens</button>
                <div className="flex gap-3 mt-3 flex-wrap">
                  <select className="input w-auto" value={sendDeptCode} onChange={e => setSendDeptCode(e.target.value)}>
                    <option value="">All departments</option>
                    {schoolsDepts.map(sd => (
                      <option key={sd.id} value={sd.dept_code}>{sd.dept_code} — {sd.dept_name}</option>
                    ))}
                  </select>
                  <button onClick={handleSendTokens} disabled={sendingTokens} className="btn-accent">
                    {sendingTokens ? 'Sending...' : 'Send Tokens via SMS'}
                  </button>
                </div>
              </div>
              {uploadStatus && <p className="mt-3 text-sm whitespace-pre-line">{uploadStatus}</p>}
            </div>
            <div className="card overflow-x-auto">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h3 className="font-semibold text-dark">
                  Registered Voters ({filterDeptCode ? voters.filter(v => v.dept_code === filterDeptCode).length : voters.length})
                </h3>
                <select
                  className="input w-auto"
                  value={filterDeptCode}
                  onChange={e => setFilterDeptCode(e.target.value)}
                >
                  <option value="">All departments</option>
                  {schoolsDepts.map(sd => (
                    <option key={sd.id} value={sd.dept_code}>{sd.dept_code} — {sd.dept_name}</option>
                  ))}
                </select>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 font-medium text-gray-500">Matric</th>
                    <th className="pb-2 font-medium text-gray-500">Name</th>
                    <th className="pb-2 font-medium text-gray-500">Dept</th>
                    <th className="pb-2 font-medium text-gray-500">Phone</th>
                    <th className="pb-2 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(filterDeptCode ? voters.filter(v => v.dept_code === filterDeptCode) : voters).map(voter => (
                    <tr key={voter.id}>
                      <td className="py-2 font-mono text-xs">{voter.matric_number}</td>
                      <td className="py-2">{voter.full_name}</td>
                      <td className="py-2 text-gray-500 text-xs">{voter.department}</td>
                      <td className="py-2 text-gray-500 text-xs">{voter.phone}</td>
                      <td className="py-2">
                        {voter.has_voted
                          ? <span className="badge bg-green-100 text-green-700">Voted</span>
                          : <span className="badge bg-gray-100 text-gray-500">Pending</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'results' && (
          <div>
            <h2 className="text-xl font-bold text-dark mb-6">Live Results</h2>
            <div className="space-y-4">
              {positions.map(p => {
                const position = p.name
                const positionCandidates = results.filter(r => r.position === position)
                const forVotes = positionCandidates.filter(r => !r.candidate_name.startsWith('AGAINST:'))
                const againstEntries = positionCandidates.filter(r => r.candidate_name.startsWith('AGAINST:'))
        
                // Check if unopposed (has against votes entry)
                const isUnopposed = againstEntries.length > 0 || 
                  (positionCandidates.length <= 2 && positionCandidates.some(r => results.find(x => x.candidate_name === r.candidate_name && x !== r)))
        
                // Get unique candidate names for this position
                const uniqueCandidates = forVotes.reduce((acc, r) => {
                  const existing = acc.find(x => x.candidate_name === r.candidate_name)
                  if (!existing) acc.push(r)
                  return acc
                }, [] as typeof forVotes)
        
                return (
                  <div key={position} className="card">
                    <h3 className="font-bold text-dark mb-4">{position}</h3>
                    {positionCandidates.length === 0 ? (
                      <p className="text-gray-400 text-sm">No votes yet</p>
                    ) : (
                      <div className="space-y-4">
                        {uniqueCandidates.map(candidate => {
                          const forCount = positionCandidates.find(r => 
                            r.candidate_name === candidate.candidate_name && 
                            r.candidate_id === candidate.candidate_id
                          )?.vote_count ?? 0
        
                          const againstCandidate = positionCandidates.find(r => 
                            r.candidate_name === candidate.candidate_name && 
                            r.candidate_id !== candidate.candidate_id
                          )
                          const againstCount = againstCandidate?.vote_count ?? 0
                          const hasAgainst = againstCount > 0 || againstEntries.length > 0
        
                          const net = forCount - againstCount
                          const total = forVotes.reduce((sum, x) => sum + x.vote_count, 0) + 
                            againstEntries.reduce((sum, x) => sum + x.vote_count, 0)
                          const pct = total > 0 ? Math.round((forCount / total) * 100) : 0
        
                          return (
                            <div key={candidate.candidate_id} className="border border-gray-100 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-3">
                                <p className="font-semibold text-dark">{candidate.candidate_name}</p>
                                {hasAgainst && (
                                  <span className={`badge ${net > 0 ? 'bg-green-100 text-green-700' : net < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                    Net: {net > 0 ? '+' : ''}{net}
                                  </span>
                                )}
                              </div>
                              {hasAgainst ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-green-600 font-medium">For</span>
                                    <span className="text-gray-500">{forCount} votes</span>
                                  </div>
                                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full transition-all"
                                      style={{ width: `${total > 0 ? Math.round((forCount / total) * 100) : 0}%` }} />
                                  </div>
                                  <div className="flex items-center justify-between text-sm mt-2">
                                    <span className="text-red-500 font-medium">Against</span>
                                    <span className="text-gray-500">{againstCount} votes</span>
                                  </div>
                                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-400 rounded-full transition-all"
                                      style={{ width: `${total > 0 ? Math.round((againstCount / total) * 100) : 0}%` }} />
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-gray-500">{forCount} votes ({pct}%)</span>
                                  </div>
                                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary rounded-full transition-all"
                                      style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'whatsapp' && (
  <div>
    <h2 className="text-xl font-bold text-dark mb-2">WhatsApp Token Distribution</h2>
    <p className="text-gray-500 text-sm mb-6">
      Click each button to open WhatsApp with the token pre-filled. Work through the list one by one.
    </p>
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <th className="pb-2 font-medium text-gray-500">Name</th>
            <th className="pb-2 font-medium text-gray-500">Matric</th>
            <th className="pb-2 font-medium text-gray-500">Token</th>
            <th className="pb-2 font-medium text-gray-500">Status</th>
            <th className="pb-2 font-medium text-gray-500">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {voters.filter(v => !v.has_voted).map(voter => {
            const phone = voter.phone.startsWith('+') ? voter.phone.replace('+', '') : '234' + voter.phone.slice(1)
            const message = encodeURIComponent(
              `Hello ${voter.full_name.split(' ')[0]}, your SEET Election voting token is: ${voter.token}\n\nMatric: ${voter.matric_number}\nVote at: seet-election.vercel.app/vote\n\nThis token is for one-time use only. Do not share it.`
            )
            const waLink = `https://wa.me/${phone}?text=${message}`
            return (
              <tr key={voter.id}>
                <td className="py-2 font-medium">{voter.full_name}</td>
                <td className="py-2 font-mono text-xs text-gray-500">{voter.matric_number}</td>
                <td className="py-2 font-mono text-xs text-primary font-bold">{voter.token}</td>
                <td className="py-2">
                  {voter.has_voted
                    ? <span className="badge bg-green-100 text-green-700">Voted</span>
                    : <span className="badge bg-gray-100 text-gray-500">Pending</span>}
                </td>
                <td className="py-2">
                  
                    <a href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    📱 Send
                  </a>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {voters.filter(v => !v.has_voted).length === 0 && (
        <p className="text-center text-gray-400 py-8">All voters have already voted!</p>
      )}
    </div>
    <p className="text-gray-400 text-xs mt-4">
      Showing {voters.filter(v => !v.has_voted).length} pending voters. Students who have already voted are hidden.
    </p>
  </div>
)}
        {tab === 'candidates' && (
          <div>
            <h2 className="text-xl font-bold text-dark mb-2">Candidate Management</h2>
            <p className="text-gray-500 text-sm mb-6">
              Add candidates one at a time. If a position has only one candidate, a &quot;Vote Against&quot; option is created automatically. Adding a second candidate removes it.
            </p>
            <div className="card mb-6">
              <h3 className="font-semibold text-dark mb-3">Manage Positions</h3>
              <p className="text-gray-500 text-sm mb-3">Define positions before adding candidates. Candidates can only be added to positions on this list.</p>
              <div className="flex gap-3 mb-4">
                <input
                  className="input"
                  value={newPositionName}
                  onChange={e => setNewPositionName(e.target.value)}
                  placeholder="e.g. Director of Welfare"
                />
                <button onClick={handleAddPosition} className="btn-primary whitespace-nowrap">Add Position</button>
              </div>
              {positionStatus && <p className="text-sm mb-3">{positionStatus}</p>}
              <div className="flex flex-wrap gap-2">
                {positions.map(p => (
                  <span key={p.id} className="badge bg-gray-100 text-gray-700 px-3 py-1.5 flex items-center gap-2">
                    {p.name}
                    <button onClick={() => handleDeletePosition(p.id, p.name)} className="text-danger hover:text-red-700 font-bold">×</button>
                  </span>
                ))}
                {positions.length === 0 && <p className="text-gray-400 text-sm">No positions defined yet</p>}
              </div>
            </div>
        
            <div className="card mb-6">
              <h3 className="font-semibold text-dark mb-4">Add Candidate</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark mb-1.5">Full Name</label>
                  <input className="input" value={candForm.name} onChange={e => setCandForm({ ...candForm, name: e.target.value })} placeholder="e.g. John Doe" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark mb-1.5">Position</label>
                  <select className="input" value={candForm.position} onChange={e => setCandForm({ ...candForm, position: e.target.value })}>
                    <option value="">— Select position —</option>
                    {positions.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark mb-1.5">Department</label>
                  <input className="input" value={candForm.department} onChange={e => setCandForm({ ...candForm, department: e.target.value })} placeholder="e.g. Mechanical Engineering" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark mb-1.5">Level</label>
                  <input className="input" value={candForm.level} onChange={e => setCandForm({ ...candForm, level: e.target.value })} placeholder="e.g. 300" />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-dark mb-1.5">Manifesto</label>
                <textarea className="input h-24" value={candForm.manifesto} onChange={e => setCandForm({ ...candForm, manifesto: e.target.value })} placeholder="Candidate's manifesto..." />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-dark mb-1.5">Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:text-sm file:font-semibold hover:file:bg-blue-900"
                />
                {candUploading && <p className="text-sm text-gray-400 mt-2">Uploading...</p>}
                {candForm.photo_url && (
                  <img src={candForm.photo_url} alt="Preview" className="mt-3 w-24 h-24 object-cover rounded-lg border border-gray-200" />
                )}
              </div>
              {candStatus && <p className="mt-3 text-sm">{candStatus}</p>}
              <button onClick={handleAddCandidate} disabled={candSubmitting || candUploading} className="btn-primary mt-4">
                {candSubmitting ? 'Adding...' : 'Add Candidate'}
              </button>
            </div>
        
            <div className="card">
              <h3 className="font-semibold text-dark mb-4">Current Ballot ({adminCandidates.filter(c => c.manifesto !== 'AGAINST').length} candidates)</h3>
              {Array.from(new Set(adminCandidates.map(c => c.position))).map(position => (
                <div key={position} className="mb-6 last:mb-0">
                  <p className="font-semibold text-dark text-sm mb-2">{position}</p>
                  <div className="space-y-2">
                    {adminCandidates.filter(c => c.position === position).map(c => (
                      <div key={c.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          {c.photo_url ? (
                            <img src={c.photo_url} alt={c.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">No photo</div>
                          )}
                          <div>
                            <p className="font-medium text-dark text-sm">
                              {c.manifesto === 'AGAINST' ? `Vote Against ${c.name}` : c.name}
                            </p>
                            {c.manifesto !== 'AGAINST' && (
                              <p className="text-gray-400 text-xs">{c.department} · {c.level} Level</p>
                            )}
                          </div>
                        </div>
                        {c.manifesto !== 'AGAINST' && (
                          <button onClick={() => handleDeleteCandidate(c.id, c.name)} className="text-danger text-xs hover:underline">
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {adminCandidates.length === 0 && <p className="text-gray-400 text-sm">No candidates added yet</p>}
            </div>
          </div>
        )}        
        {tab === 'audit' && (
  <div>
    <h2 className="text-xl font-bold text-dark mb-2">Audit Log</h2>
    <p className="text-gray-500 text-sm mb-6">
      Complete record of authentication attempts and vote submissions. Most recent 200 entries shown.
    </p>
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <th className="pb-2 font-medium text-gray-500">Time</th>
            <th className="pb-2 font-medium text-gray-500">Event</th>
            <th className="pb-2 font-medium text-gray-500">Matric</th>
            <th className="pb-2 font-medium text-gray-500">IP Address</th>
            <th className="pb-2 font-medium text-gray-500">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {auditLog.map(entry => (
            <tr key={entry.id}>
              <td className="py-2 text-xs text-gray-500 whitespace-nowrap">
                {new Date(entry.created_at).toLocaleString()}
              </td>
              <td className="py-2">
                <span className={`badge text-xs ${
                  entry.success
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {entry.event_type}
                </span>
              </td>
              <td className="py-2 font-mono text-xs">{entry.matric_number ?? '—'}</td>
              <td className="py-2 text-xs text-gray-500">{entry.ip_address ?? '—'}</td>
              <td className="py-2 text-xs text-gray-600">{entry.details ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {auditLog.length === 0 && (
        <p className="text-center text-gray-400 py-8">No audit entries yet</p>
      )}
    </div>
  </div>
)}
        {tab === 'settings' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="font-semibold text-dark">Election Status</p>
                <p className="text-gray-500 text-sm">Allow students to vote</p>
              </div>
              <button onClick={toggleElection}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${electionOpen ? 'bg-success' : 'bg-gray-300'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${electionOpen ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="font-semibold text-dark">Active Admin Sessions</p>
                <p className="text-gray-500 text-sm">Devices currently logged into the admin panel</p>
              </div>
              <span className={`badge text-white text-sm px-3 py-1.5 ${adminSessions >= 3 ? 'bg-danger' : 'bg-primary'}`}>
                {adminSessions} / 3
              </span>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
