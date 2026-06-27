'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { POSITIONS, Position } from '@/lib/supabase'

interface Stats {
  total_voters: number
  total_voted: number
  tokens_sent: number
}

interface ResultRow {
  candidate_id: string
  candidate_name: string
  position: Position
  vote_count: number
}

interface Voter {
  id: string
  matric_number: string
  full_name: string
  department: string
  level: string
  phone: string
  has_voted: boolean
  token_used: boolean
  token: string
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const adminKeyRef = useRef('')
  const [authError, setAuthError] = useState('')
  const [tab, setTab] = useState<'dashboard' | 'voters' | 'results' | 'settings'>('dashboard')
  const [stats, setStats] = useState<Stats | null>(null)
  const [results, setResults] = useState<ResultRow[]>([])
  const [voters, setVoters] = useState<Voter[]>([])
  const [electionOpen, setElectionOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadCSV, setUploadCSV] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [sendingTokens, setSendingTokens] = useState(false)

  const fetchData = useCallback(async (key?: string) => {
  const authKey = key || adminKeyRef.current || adminKey
  if (!authKey) return
  try {
    const [statsRes, resultsRes, votersRes, settingsRes] = await Promise.all([
      fetch('/api/admin/stats', { headers: { 'x-admin-key': authKey } }),
      fetch('/api/admin/results', { headers: { 'x-admin-key': authKey } }),
      fetch('/api/admin/voters', { headers: { 'x-admin-key': authKey } }),
      fetch('/api/admin/settings', { headers: { 'x-admin-key': authKey } }),
    ])
    if (statsRes.ok) setStats(await statsRes.json())
    if (resultsRes.ok) setResults(await resultsRes.json())
    if (votersRes.ok) setVoters(await votersRes.json())
    if (settingsRes.ok) { const s = await settingsRes.json(); setElectionOpen(s.election_open) }
  } catch { /* silent */ }
}, [adminKey])

  useEffect(() => {
  if (authed && adminKey) {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }
}, [authed, adminKey, fetchData])

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
    setAuthed(true)
    adminKeyRef.current = adminKey
    setAuthError('')
    fetchData(adminKey)
  }
  else setAuthError('Invalid admin key.')
}

  async function toggleElection() {
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ election_open: !electionOpen }),
    })
    setElectionOpen(!electionOpen)
  }

  async function handleUploadVoters() {
    if (!uploadCSV.trim()) return
    setUploadStatus('Uploading...')
    const res = await fetch('/api/admin/voters/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ csv: uploadCSV }),
    })
    const data = await res.json()
    if (res.ok) { setUploadStatus(`✅ ${data.count} voters uploaded. Tokens generated.`); fetchData() }
    else setUploadStatus(`❌ Error: ${data.error}`)
  }

  async function handleSendTokens() {
    setSendingTokens(true)
    const res = await fetch('/api/admin/voters/send-tokens', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
    })
    const data = await res.json()
    setSendingTokens(false)
    if (res.ok) setUploadStatus(`✅ Tokens sent to ${data.sent} voters via SMS`)
    else setUploadStatus(`❌ ${data.error}`)
  }

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
            <p className="text-gray-500 text-sm mt-1">SEET Electoral Committee</p>
          </div>
          <form onSubmit={handleAdminAuth} className="space-y-4">
            <input
              className="input"
              type="password"
              placeholder="Admin key"
              value={adminKey}
              onChange={e => { setAdminKey(e.target.value); adminKeyRef.current = e.target.value }}
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
      {/* Admin header */}
      <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
        <div>
          <p className="font-bold">SEET Admin Panel</p>
          <p className="text-white/60 text-xs">Electoral Committee Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${electionOpen ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {electionOpen ? '🟢 Election Open' : '🔴 Election Closed'}
          </span>
          <button onClick={() => setAuthed(false)} className="text-white/50 hover:text-white text-sm">Logout</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {(['dashboard', 'voters', 'results', 'settings'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-dark'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Dashboard */}
        {tab === 'dashboard' && (
          <div>
            <h2 className="text-xl font-bold text-dark mb-6">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="card text-center">
                <p className="text-3xl font-bold text-primary">{stats?.total_voters ?? '—'}</p>
                <p className="text-gray-500 text-sm mt-1">Registered Voters</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-success">{stats?.total_voted ?? '—'}</p>
                <p className="text-gray-500 text-sm mt-1">Have Voted</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-accent">
                  {stats?.total_voters ? Math.round((stats.total_voted / stats.total_voters) * 100) : 0}%
                </p>
                <p className="text-gray-500 text-sm mt-1">Voter Turnout</p>
              </div>
            </div>

            <div className="card">
              <h3 className="font-bold text-dark mb-2">Quick Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button onClick={toggleElection} className={electionOpen ? 'btn-danger' : 'btn-primary'}>
                  {electionOpen ? 'Close Election' : 'Open Election'}
                </button>
                <button onClick={() => fetchData()} className="btn-primary bg-gray-600 hover:bg-gray-700">
                  Refresh Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Voters */}
        {tab === 'voters' && (
          <div>
            <h2 className="text-xl font-bold text-dark mb-6">Voter Management</h2>

            {/* Upload */}
            <div className="card mb-6">
              <h3 className="font-semibold text-dark mb-3">Upload Voter List (CSV)</h3>
              <p className="text-gray-500 text-sm mb-3">
                Paste CSV with columns: <code className="bg-gray-100 px-1 rounded">matric_number, full_name, department, level, phone</code>
              </p>
              <textarea
                className="input h-32 font-mono text-sm"
                placeholder={`matric_number,full_name,department,level,phone\nENG/2021/001,John Doe,Civil Engineering,400,08012345678`}
                value={uploadCSV}
                onChange={e => setUploadCSV(e.target.value)}
              />
              <div className="flex gap-3 mt-3">
                <button onClick={handleUploadVoters} className="btn-primary">Upload & Generate Tokens</button>
                <button onClick={handleSendTokens} disabled={sendingTokens} className="btn-accent">
                  {sendingTokens ? 'Sending...' : 'Send Tokens via SMS'}
                </button>
              </div>
              {uploadStatus && <p className="mt-3 text-sm">{uploadStatus}</p>}
            </div>

            {/* Voter table */}
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

        {/* Results */}
        {tab === 'results' && (
          <div>
            <h2 className="text-xl font-bold text-dark mb-6">Live Results</h2>
            <div className="space-y-4">
              {resultsByPosition.map(({ position, candidates }) => (
                <div key={position} className="card">
                  <h3 className="font-bold text-dark mb-4">{position}</h3>
                  {candidates.length === 0 ? (
                    <p className="text-gray-400 text-sm">No votes yet</p>
                  ) : (
                    <div className="space-y-3">
                      {candidates.map((c, i) => {
                        const total = candidates.reduce((sum, x) => sum + x.vote_count, 0)
                        const pct = total > 0 ? Math.round((c.vote_count / total) * 100) : 0
                        return (
                          <div key={c.candidate_id}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-dark">
                                {i === 0 && <span className="text-accent mr-1">👑</span>}
                                {c.candidate_name}
                              </span>
                              <span className="text-sm text-gray-500">{c.vote_count} votes ({pct}%)</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${i === 0 ? 'bg-primary' : 'bg-gray-300'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        {tab === 'settings' && (
          <div className="card max-w-lg">
            <h2 className="text-xl font-bold text-dark mb-6">Election Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-semibold text-dark">Election Status</p>
                  <p className="text-gray-500 text-sm">Allow students to vote</p>
                </div>
                <button
                  onClick={toggleElection}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${electionOpen ? 'bg-success' : 'bg-gray-300'}`}
                >
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
