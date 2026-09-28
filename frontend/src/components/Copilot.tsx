import React, { useState } from 'react';
import { Well, askCopilot, CopilotResponse } from '../api/client';

interface Props {
  wells: Well[];
  selectedWell: Well | null;
  onSelectWell: (well: Well) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
  wellContext?: any;
}

export const Copilot: React.FC<Props> = ({ wells, selectedWell, onSelectWell }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        '👋 Welcome to the **NWIS-X Drilling Institutional Memory Copilot**.\n\nI answer queries strictly based on verified offset well records, deterministic risk calculations, and completion reports from the Assam-Arakan Basin. **I never invent facts** — all scores and metrics come from deterministic algorithms.\n\nSelect a well and ask a question, or try one of the suggested prompts below.',
    },
  ]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const suggestedPrompts = [
    'What drilling risks exist below 2800m in this field?',
    'Show all gas kicks and lost circulation incidents in Barail Coal-Shale.',
    'What mud density program was used to control kicks in offset wells?',
    'Compare differential sticking incidents between Tipam and Barail formations.',
  ];

  const handleSend = async (userText: string) => {
    if (!userText.trim() || loading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setQuery('');
    setLoading(true);

    try {
      const res: CopilotResponse = await askCopilot(userText, selectedWell?.id);
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: res.response || res.answer || 'No response returned.',
          citations: res.citations || [],
          wellContext: res.well_context,
        },
      ]);
    } catch (e) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: '⚠️ Failed to connect to copilot service. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-xl flex flex-col h-[700px] shadow-2xl backdrop-blur-md overflow-hidden">
      {/* Copilot Header */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <h3 className="text-base font-bold text-slate-100 font-mono">
              Drilling Institutional Copilot
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800">
              RAG + MANDATORY CITATIONS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict narration of deterministic DB facts |{' '}
            <span className="text-amber-400 font-mono font-semibold">SIMULATED DATA</span>
          </p>
        </div>

        {/* Well Context Picker */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-slate-400">Context Well:</label>
          <select
            value={selectedWell?.id || ''}
            onChange={(e) => {
              const found = wells.find((w) => w.id === e.target.value);
              if (found) onSelectWell(found);
            }}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-cyan-500"
          >
            <option value="">-- No specific well --</option>
            {wells.map((w) => (
              <option key={w.id} value={w.id}>
                {w.well_name} ({w.well_id_code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${
              m.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-2xl rounded-xl p-4 shadow-md ${
                m.role === 'user'
                  ? 'bg-cyan-600 text-white rounded-br-none'
                  : 'bg-slate-950/80 border border-slate-800 text-slate-200 rounded-bl-none'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed space-y-2">
                {m.content}
              </div>

              {/* Citations Box */}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-800">
                  <div className="text-[11px] font-mono font-bold text-cyan-400 uppercase mb-2 flex items-center gap-1.5">
                    <span>📖</span> Verified Archival Citations ({m.citations.length}):
                  </div>
                  <div className="space-y-1.5">
                    {m.citations.map((c: any, cIdx: number) => (
                      <div
                        key={cIdx}
                        className="bg-slate-900/90 border border-slate-800 p-2 rounded text-[11px] font-mono"
                      >
                        <div className="flex items-center justify-between text-cyan-300">
                          <span className="font-bold">
                            {c.document_title || c.well_name} (Page {c.page || 1})
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Relevance: {(c.relevance * 100).toFixed(0)}%
                          </span>
                        </div>
                        {c.excerpt && (
                          <p className="text-slate-400 mt-1 italic font-sans text-[11px]">
                            &ldquo;{c.excerpt}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs p-3">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            Retrieving verified offset records &amp; synthesizing citation report...
          </div>
        )}
      </div>

      {/* Suggested Prompt Chips */}
      <div className="px-4 py-2 bg-slate-950/70 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">Suggested:</span>
        {suggestedPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            className="text-[11px] font-mono whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-colors"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend(query)}
          placeholder="Ask a technical question regarding offset wells, formations, kicks, mud weights..."
          className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-4 py-2.5 text-xs focus:outline-none focus:border-cyan-500"
        />
        <button
          onClick={() => handleSend(query)}
          disabled={loading || !query.trim()}
          className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs font-mono transition-all"
        >
          Send
        </button>
      </div>
    </div>
  );
};
