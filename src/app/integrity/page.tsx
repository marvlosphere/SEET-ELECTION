'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface IntegrityData {
  total_voters: number
  total_voted: number
  total_votes_cast: number
  expected_votes_per_voter: number
  expected_total_votes: number
  is_consistent: boolean
  last_snapshot_at: string | null
  snapshot_count: number
}

export default function IntegrityPage() {
  const [data, setData] = useState<IntegrityData | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchIntegrity() {
    try {
      const res = await fetch(`/api/integrity?t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } catch { /* silent */ }
    setLoading(false)
  }

  useEffect(() => {
    fetchIntegrity()
    const interval = setInterval(fetchIntegrity, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <main className="min-h-screen bg-light">
      <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-white/70 hover:text-white text-sm">← Back</Link>
        <span className="font-semibold text-sm">FUTABallot — Integrity Check</span>
        <span className="text-white/40 text-xs">Public</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-dark mb-2">FUTABallot Integrity Dashboard</h1>
          <p className="text-gray-500 text-sm">
            This page is publicly viewable so anyone can verify the election is running honestly.
            Numbers update every 10 seconds.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-gray-400">Loading...</p>
        ) : !data ? (
          <p className="text-center text-gray-400">Unable to load integrity data.</p>
        ) : (
          <>
            <div className={`card mb-6 border-2 ${data.is_consistent ? 'border-success bg-green-50' : 'border-danger bg-red-50'}`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{data.is_consistent ? '✅' : '🚨'}</span>
                <div>
                  <p className={`font-bold text-lg ${data.is_consistent ? 'text-success' : 'text-danger'}`}>
                    {data.is_consistent ? 'All Checks Passed' : 'Inconsistency Detected'}
                  </p>
                  <p className="text-gray-600 text-sm">
                    {data.is_consistent
                      ? 'Vote counts match expected values based on voter activity.'
                      : 'Vote counts do not match expected values. This requires investigation.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="card text-center">
                <p className="text-3xl font-bold text-primary">{data.total_voters}</p>
                <p className="text-gray-500 text-sm mt-1">Registered Voters</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-success">{data.total_voted}</p>
                <p className="text-gray-500 text-sm mt-1">Have Voted</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-accent">{data.total_votes_cast}</p>
                <p className="text-gray-500 text-sm mt-1">Total Votes Cast</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-dark">{data.expected_total_votes}</p>
                <p className="text-gray-500 text-sm mt-1">Expected Votes</p>
              </div>
            </div>

            <div className="card bg-gray-50">
              <p className="font-semibold text-dark text-sm mb-2">How this works</p>
              <p className="text-gray-600 text-sm leading-relaxed">
                Each voter casts exactly {data.expected_votes_per_voter} votes (one per position).
                Total votes cast should always equal voters who have voted × {data.expected_votes_per_voter}.
                If these numbers ever diverge, it signals a problem requiring immediate investigation.
              </p>
              <p className="text-gray-400 text-xs mt-3">
                {data.snapshot_count} integrity snapshots recorded.
                {data.last_snapshot_at && ` Last snapshot: ${new Date(data.last_snapshot_at).toLocaleString()}`}
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
