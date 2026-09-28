import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'

function App() {
  const [health, setHealth] = useState<any>(null)

  useEffect(() => {
    fetch('/api/v1/../health')
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => setHealth(data))
      .catch(() => setHealth({ status: 'unreachable', database: 'unknown' }))
  }, [])

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-oil-dark">
        {/* ─── Simulated Data Banner ─── */}
        <div className="simulated-banner justify-center text-center rounded-none border-x-0 border-t-0">
          ⚠️ SIMULATED DATA — All data shown is synthetic for demonstration purposes only.
        </div>

        {/* ─── Header ─── */}
        <header className="border-b border-white/10 bg-oil-mid/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center font-bold text-lg">
                NX
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">NWIS-X</h1>
                <p className="text-xs text-gray-400">Nearby Wells Intelligence & Risk eXplorer</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                health?.status === 'healthy'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {health ? `API: ${health.status}` : 'Connecting...'}
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                health?.database === 'connected'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {health ? `DB: ${health.database}` : '...'}
              </div>
            </div>
          </div>
        </header>

        {/* ─── Main Content ─── */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<HomePage health={health} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

function HomePage({ health }: { health: any }) {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero */}
      <div className="glass-card p-8 text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent mb-3">
          Nearby Wells Intelligence & Risk eXplorer
        </h2>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Depth-aware drilling institutional memory and early-warning platform for
          Oil India Ltd — SIH26121
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="kpi-card">
          <div className="text-sm text-gray-400 mb-1">API Status</div>
          <div className="text-2xl font-bold text-white">
            {health?.status === 'healthy' ? '✅ Online' : '⏳ Loading...'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="text-sm text-gray-400 mb-1">Database</div>
          <div className="text-2xl font-bold text-white">
            {health?.database === 'connected' ? '✅ Connected' : '⏳ Connecting...'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="text-sm text-gray-400 mb-1">Version</div>
          <div className="text-2xl font-bold text-white">
            {health?.version || '...'}
          </div>
        </div>
      </div>

      {/* Phase Status */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Build Progress</h3>
        <div className="space-y-3">
          {[
            { phase: 'P0: Scaffolding & Infrastructure', status: 'complete', color: 'emerald' },
            { phase: 'P1: Core Data Pipeline', status: 'next', color: 'amber' },
            { phase: 'P2: Frontend & Copilot', status: 'pending', color: 'gray' },
            { phase: 'P3: Polish & Advanced', status: 'design-only', color: 'gray' },
          ].map(item => (
            <div key={item.phase} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <span className="text-gray-300">{item.phase}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium bg-${item.color}-500/20 text-${item.color}-400`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
