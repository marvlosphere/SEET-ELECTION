'use client'

import { useState, useEffect, useRef } from 'react'
import { POSITIONS, Position } from '@/lib/supabase'

interface ResultRow { candidate_id: string; candidate_name: string; position: Position; vote_count: number }
interface Voter { id: string; matric_number: string; full_name: string; department: string; level: string; phone: string; has_voted: boolean; token_used: boolean; token: string }
interface AuditEntry { id: string; event_type: string; matric_number: string | null; ip_address: string | null; details: string | null; success: boolean; created_at: string }
interface SchoolDept { id: string; school_name: string; dept_name: string; dept_code: string }

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [authError, setAuthError] = useState('')
  const [tab, setTab] = useState<'dashboard' | 'voters' | 'results' | 'whatsapp' | 'audit' | 'settings'>('dashboard')
  const [results, setResults] = useState<ResultRow[]>([])
  const [voters, setVoters] = useState<Voter[]>([])
  const [schoolsDepts, setSchoolsDepts] = useState<SchoolDept[]>([])
  const [uploadDeptCode, setUploadDeptCode] = useState('')
  const [filterDeptCode, setFilterDeptCode] = useState('')
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [electionOpen, setElectionOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadCSV, setUploadCSV] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [sendingTokens, setSendingTokens] = useState(false)
  const keyRef = useRef('')

  async function fetchData() {
    const k = keyRef.current
    if (!k) return
    try {
      const h = { 'x-admin-key': k }
      const t = Date.now()
      const [r, v, st, a, sd] = await Promise.all([
        fetch(`/api/admin/results?t=${t}`, { headers: h }),
        fetch(`/api/admin/voters?t=${t}`, { headers: h }),
        fetch(`/api/admin/settings?t=${t}`, { headers: h }),
        fetch(`/api/admin/audit-log?t=${t}`, { headers: h }),
        fetch(`/api/admin/schools-departments?t=${t}`, { headers: h }),
      ])
      if (r.ok) setResults(await r.json())
      if (v.ok) setVoters(await v.json())
      if (st.ok) { const d = await st.json(); setElectionOpen(d.election_open) }
      if (a.ok) setAuditLog(await a.json())
      if (sd.ok) setSchoolsDepts(await sd.json())
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!authed) return
    fetchData()
    const interval = setInterval(fetchData, 5000)
    const snapshotInterval = setInterval(() => {
      fetch('/api/admin/snapshot', { method: 'POST', headers: { 'x-admin-key': keyRef.current } }).catch(() => {})
  }, 5 * 60 * 1000)
  return () => { clearInterval(interval); clearInterval(snapshotInterval) }
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
      keyRef.current = adminKey
      setAuthed(true)
      setAuthError('')
    } else setAuthError('Invalid admin key.')
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
    if (res.ok) { setUploadStatus(`✅ ${data.count} voters uploaded. Tokens generated.`); fetchData() }
    else setUploadStatus(`❌ Error: ${data.error}`)
  }

  async function handleSendTokens() {
    setSendingTokens(true)
    const res = await fetch('/api/admin/voters/send-tokens', { method: 'POST', headers: { 'x-admin-key': keyRef.current } })
    const data = await res.json()
    setSendingTokens(false)
    if (res.ok) setUploadStatus(`✅ Tokens sent to ${data.sent} voters via SMS`)
    else setUploadStatus(`❌ ${data.error}`)
  }

  const totalVoters = voters.length
  const totalVoted = voters.filter(v => v.has_voted).length
  const turnout = totalVoters ? Math.round((totalVoted / totalVoters) * 100) : 0

  const resultsByPosition = POSITIONS.map(position => ({
    position,
    candidates: results.filter(r => r.position === position).sort((a, b) => b.vote_count - a.vote_count),
  }))

  if (!authed) {
    return (
      <main className="min-h-screen bg-dark flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-3">
              <span className="text-white text-xl">🔑</span>
            </div>
            <h1 className="text-xl font-bold text-dark">Admin Access</h1>
            <p className="text-gray-500 text-sm mt-1">NIMECHE Electoral Committee</p>
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
          <p className="font-bold">NIMECHE Admin Panel</p>
          <p className="text-white/60 text-xs">Electoral Committee Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${electionOpen ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {electionOpen ? '🟢 Election Open' : '🔴 Election Closed'}
          </span>
          <button onClick={() => { setAuthed(false); keyRef.current = '' }} className="text-white/50 hover:text-white text-sm">Logout</button>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {(['dashboard', 'voters', 'results', 'whatsapp', 'audit', 'settings'] as const).map(t => (
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
                <button
                  onClick={() => fetch('/api/admin/snapshot', { method: 'POST', headers: { 'x-admin-key': keyRef.current } }).then(() => fetchData())}
                  className="btn-accent"
                >
                  📸 Take Snapshot
                </button>
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
              <textarea className="input h-32 font-mono text-sm"
                placeholder={`matric_number,full_name,department,level,phone\nENG/2021/001,John Doe,Civil Engineering,400,08012345678`}
                value={uploadCSV} onChange={e => setUploadCSV(e.target.value)} />
              <div className="flex gap-3 mt-3">
                <button onClick={handleUploadVoters} className="btn-primary">Upload & Generate Tokens</button>
                <button onClick={handleSendTokens} disabled={sendingTokens} className="btn-accent">
                  {sendingTokens ? 'Sending...' : 'Send Tokens via SMS'}
                </button>
              </div>
              {uploadStatus && <p className="mt-3 text-sm">{uploadStatus}</p>}
            </div>
            <div className="card overflow-x-auto">
              <h3 className="font-semibold text-dark mb-4">Registered Voters ({voters.length})</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 font-medium text-gray-500">Matric</th>
                    <th className="pb-2 font-medium text-gray-500">Name</th>
                    <th className="pb-2 font-medium text-gray-500">Dept</th>
                    <th className="pb-2 font-medium text-gray-500">Phone</th>
                    <th className="pb-2 font-medium text-gray-500">Token</th>
                    <th className="pb-2 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {voters.map(voter => (
                    <tr key={voter.id}>
                      <td className="py-2 font-mono text-xs">{voter.matric_number}</td>
                      <td className="py-2">{voter.full_name}</td>
                      <td className="py-2 text-gray-500 text-xs">{voter.department}</td>
                      <td className="py-2 text-gray-500 text-xs">{voter.phone}</td>
                      <td className="py-2 font-mono text-xs text-primary">{voter.token}</td>
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
              {POSITIONS.map(position => {
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
          <div className="card max-w-lg">
            <h2 className="text-xl font-bold text-dark mb-6">Election Settings</h2>
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
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <p className="font-semibold text-dark text-sm">Environment Variables Needed</p>
                <p className="text-gray-600 text-xs mt-1 mb-2">Set these in your Vercel dashboard:</p>
                <div className="font-mono text-xs space-y-1 text-gray-700">
                  <p>NEXT_PUBLIC_SUPABASE_URL</p>
                  <p>NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
                  <p>SUPABASE_SERVICE_ROLE_KEY</p>
                  <p>ADMIN_KEY</p>
                  <p>TERMII_API_KEY (for SMS)</p>
                  <p>TERMII_SENDER_ID</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
