import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary via-blue-800 to-dark flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="https://res.cloudinary.com/qhpxmquy/image/upload/v1782873345/43916d76-f263-4ba5-8536-2c1fdbedac43_tuceif.png"
            alt="FUTA Logo"
            className="w-10 h-10 object-contain"
          />
          <span className="text-white font-semibold text-sm leading-tight">
            Federal University of<br />
            <span className="text-accent">Technology, Akure</span>
          </span>
        </div>
        <Link href="/admin" className="text-white/60 hover:text-white text-sm transition-colors">
          Admin →
        </Link>
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-4">
          <img
            src="https://res.cloudinary.com/qhpxmquy/image/upload/v1782873345/43916d76-f263-4ba5-8536-2c1fdbedac43_tuceif.png"
            alt="FUTA Logo"
            className="w-24 h-24 object-contain mx-auto mb-4 drop-shadow-lg"
          />
        </div>

        <div className="mb-6">
          <span className="badge bg-accent/20 text-accent border border-accent/30 text-sm px-4 py-1.5">
            🗳️ FUTABallot — Student Elections
          </span>
        </div>

        <h1 className="font-display text-4xl md:text-6xl font-bold text-white leading-tight mb-4">
          Your Vote.<br />
          <span className="text-accent">Your Future.</span>
        </h1>

        <p className="text-white/70 text-lg max-w-md mb-10">
          Cast your vote securely for your student union executives.
          You need your <strong className="text-white">matric number</strong> and your
          <strong className="text-white"> voting token</strong> to proceed.
        </p>

        <Link
          href="/vote"
          className="bg-accent text-dark font-bold text-lg px-10 py-4 rounded-xl hover:bg-yellow-400 transition-all shadow-lg shadow-accent/30 hover:shadow-accent/50 hover:-translate-y-0.5"
        >
          Vote Now
        </Link>

        <p className="mt-6 text-white/40 text-sm">
          Token sent via SMS at registration
        </p>
      </div>

      {/* Positions preview */}
      <div className="px-6 pb-12">
        <p className="text-center text-white/40 text-xs uppercase tracking-widest mb-4">Positions on the ballot</p>
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
          {[
            'President', 'Vice President', 'General Secretary',
            'Asst. General Secretary', 'Financial Secretary',
            'PRO I', 'PRO II', 'Treasurer',
            'Welfare Director', 'Sports Director', 'Social Director'
          ].map(pos => (
            <span key={pos} className="badge bg-white/10 text-white/70 border border-white/10 px-3 py-1 text-xs">
              {pos}
            </span>
          ))}
        </div>
      </div>
    </main>
  )
}
