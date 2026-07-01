'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Candidate } from '@/lib/supabase'

type Step = 'auth' | 'ballot' | 'confirm' | 'done'

interface VoterSession {
  voter_id: string
  full_name: string
  matric_number: string
  session_token: string
}

type Position = string

export default function VotePage() {
  const [step, setStep] = useState<Step>('auth')
  const [matric, setMatric] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [voterSession, setVoterSession] = useState<VoterSession | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selections, setSelections] = useState<Record<string, string>>({}) // position → candidate_id
  const [dynamicPositions, setDynamicPositions] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  // ─── Step 1: Verify token ──────────────────────────────────────────────────
  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matric_number: matric.trim().toUpperCase(), token: token.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Verification failed'); return }
      setVoterSession(data.voter)
      setCandidates(data.candidates)
      // Fetch positions from database
      const posRes = await fetch(`/api/positions?t=${Date.now()}`)
      if (posRes.ok) {
        const posData = await posRes.json()
        setDynamicPositions(posData)
      }
      setStep('ballot')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Step 2: Select candidates ─────────────────────────────────────────────
  function selectCandidate(position: Position, candidateId: string) {
    setSelections(prev => ({ ...prev, [position]: candidateId }))
  }

  function allPositionsSelected() {
    return dynamicPositions.every(p => selections[p])
  }

  // ─── Step 3: Submit votes ──────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    try {
      const votes = Object.entries(selections).map(([position, candidate_id]) => ({
        position,
        candidate_id,
      }))
      const res = await fetch('/api/vote/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voter_id: voterSession!.voter_id,
          session_token: voterSession!.session_token,
          votes,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Submission failed'); return }
      setStep('done')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const candidatesForPosition = (position: Position) =>
    candidates.filter(c => c.position === position)

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-light">
      {/* Top bar */}
      <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-white/70 hover:text-white text-sm">← Back</Link>
        <span className="font-semibold text-sm">FUTABallot</span>
        <span className="text-white/40 text-xs">
          {step === 'auth' ? 'Step 1 of 3' : step === 'ballot' ? 'Step 2 of 3' : step === 'confirm' ? 'Step 3 of 3' : '✓'}
        </span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ── Auth Step ─────────────────────────────────────────────────────── */}
        {step === 'auth' && (
          <div className="card">
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔐</span>
              </div>
              <h1 className="text-2xl font-bold text-dark">Verify Your Identity</h1>
              <p className="text-gray-500 mt-2 text-sm">
                Enter your matric number and the token sent to your phone
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mt-4 text-left">
                <p className="text-amber-800 text-xs font-semibold mb-1">⚠️ Network Advisory</p>
                <p className="text-amber-700 text-xs leading-relaxed">
                  Please vote using your personal mobile data, not a shared network like FUTANet or a public hotspot. Shared networks may cause your vote to be blocked if too many students vote from the same connection.
                </p>
              </div>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark mb-1.5">Matric Number</label>
                <input
                  className="input uppercase"
                  placeholder="e.g. ENG/2021/001"
                  value={matric}
                  onChange={e => setMatric(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-1.5">Voting Token</label>
                <input
                  className="input uppercase tracking-[0.25em] text-center text-xl font-mono"
                  placeholder="XXXX-XXXX"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  maxLength={9}
                  required
                />
                <p className="text-gray-400 text-xs mt-1.5">Check your SMS or WhatsApp message</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {loading ? 'Verifying...' : 'Continue to Ballot →'}
              </button>
            </form>
          </div>
        )}

        {/* ── Ballot Step ───────────────────────────────────────────────────── */}
        {step === 'ballot' && (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-dark">Cast Your Vote</h1>
              <p className="text-gray-500 text-sm mt-1">
                Welcome, <strong>{voterSession?.full_name}</strong>. Select one candidate per position.
              </p>
            </div>

            <div className="space-y-6">
              {dynamicPositions.map(position => (
                <div key={position} className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-dark">{position}</h2>
                    {selections[position] ? (
                      <span className="badge bg-green-100 text-green-700">✓ Selected</span>
                    ) : (
                      <span className="badge bg-yellow-100 text-yellow-700">Choose one</span>
                    )}
                  </div>

                  <div className="grid gap-3">
                    {candidatesForPosition(position).map(candidate => {
                      const selected = selections[position] === candidate.id
                      const isAgainst = candidate.manifesto === 'AGAINST'
                      return (
                        <button
                          key={candidate.id}
                          onClick={() => selectCandidate(position, candidate.id)}
                          className={`text-left border-2 rounded-xl p-4 transition-all ${
                            selected
                              ? isAgainst ? 'border-danger bg-red-50' : 'border-primary bg-primary/5'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                              selected ? 'border-primary bg-primary' : 'border-gray-300'
                            }`}>
                              {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            {!isAgainst && (
                              candidate.photo_url
                                ? <img src={candidate.photo_url} alt={candidate.name} className="w-24 h-24 rounded-full object-cover flex-shrink-0 border-2 border-gray-100" />
                                  : <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400 text-xs">No photo</div>
                            )}
                            <div className="flex-1">
                              {isAgainst ? (
                                <>
                                  <p className="font-semibold text-danger">Vote Against {candidate.name}</p>
                                  <p className="text-gray-500 text-xs mt-0.5">Cast your vote against this candidate</p>
                                </>
                              ) : (
                                <>
                                  <p className="font-semibold text-dark">{candidate.name}</p>
                                  <p className="text-gray-500 text-xs mt-0.5">
                                    {candidate.department} · {candidate.level} Level
                                  </p>
                                  <p className="text-gray-600 text-sm mt-2 leading-relaxed">
                                    {candidate.manifesto}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 card bg-primary/5 border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-dark">
                    {Object.keys(selections).length} of {dynamicPositions.length} positions selected
                  </p>
                  {!allPositionsSelected() && (
                    <p className="text-gray-500 text-sm">Please select a candidate for every position</p>
                  )}
                </div>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={!allPositionsSelected()}
                  className="btn-primary"
                >
                  Review →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Confirm Step ──────────────────────────────────────────────────── */}
        {step === 'confirm' && (
          <div className="card">
            <h1 className="text-2xl font-bold text-dark mb-2">Review Your Choices</h1>
            <p className="text-gray-500 text-sm mb-6">Once submitted, your vote cannot be changed.</p>

            <div className="space-y-3 mb-8">
              {dynamicPositions.map(position => {
                const candidate = candidates.find(c => c.id === selections[position])
                return (
                  <div key={position} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">{position}</p>
                      <p className="font-semibold text-dark mt-0.5">{candidate?.name}</p>
                    </div>
                    <button
                      onClick={() => setStep('ballot')}
                      className="text-primary text-sm hover:underline"
                    >
                      Change
                    </button>
                  </div>
                )
              })}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-accent w-full text-center"
            >
              {submitting ? 'Submitting...' : '🗳️ Submit My Vote'}
            </button>
          </div>
        )}

        {/* ── Done Step ─────────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="card text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">✅</span>
            </div>
            <h1 className="text-2xl font-bold text-dark mb-2">Vote Submitted!</h1>
            <p className="text-gray-500 mb-1">
              Thank you, <strong>{voterSession?.full_name}</strong>.
            </p>
            <p className="text-gray-500 text-sm mb-8">
              Your vote has been recorded securely. Results will be announced after the election closes.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 text-left text-sm text-gray-600">
              <p className="font-medium text-dark mb-2">Important reminder</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Your token is now invalid — you cannot vote again</li>
                <li>Your choices are private and anonymous</li>
                <li>Results will be published after the election closes</li>
              </ul>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
