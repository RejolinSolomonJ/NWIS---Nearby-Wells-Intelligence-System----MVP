/**
 * CopilotChat.tsx — NWIS-X Phase 13
 * Citation-Enforced RAG Institutional Copilot Chat Interface
 *
 * 1. Calls /copilot/query for deterministic, citation-enforced retrieval.
 * 2. Every answer bubble renders inline clickable citation chips [WellID · Doc · Page].
 * 3. Neutral-styled badge for "insufficient evidence" responses (reinforces trust, not an error).
 * 4. 5 Preset Question Quick-Buttons matching Section Q examples for fail-safe live demo.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Well, queryCopilot, CopilotCitation, CopilotQueryResponse } from '../api/client';

export interface CopilotChatProps {
  wells: Well[];
  selectedWell: Well | null;
  onSelectWell?: (well: Well) => void;
  onOpenEvidence: (docTitle: string, page: number, excerpt: string, wellName: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: CopilotCitation[];
  isInsufficientEvidence?: boolean;
  timestamp: string;
}

const PRESET_QUESTIONS = [
  {
    title: 'Mud Loss in F3 Band',
    query: 'What drilling risks and mud losses occurred in Barail Formation (F3) between 2740m and 2770m?',
    tag: 'F3 Risk Band',
  },
  {
    title: 'Gas Kicks & Tight Hole',
    query: 'Show all gas kicks and tight hole incidents in offset wells near DEMO-WELL-101.',
    tag: 'Offset Well Analogue',
  },
  {
    title: 'Mud Weight Program',
    query: 'What mud weight was used to control fluid influx in Barail Coal-Shale?',
    tag: 'Well Control',
  },
  {
    title: 'Stuck Pipe Below 3000m',
    query: 'Did any offset wells encounter stuck pipe below 3000m?',
    tag: 'Mechanical Risk',
  },
  {
    title: 'Out-of-Scope (Trust Test)',
    query: 'What was the crude oil market price in Assam in 1985?',
    tag: 'Zero-Hallucination',
  },
];

export const CopilotChat: React.FC<CopilotChatProps> = ({
  wells,
  selectedWell,
  onSelectWell,
  onOpenEvidence,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text:
        '👋 Welcome to the **NWIS-X Drilling Institutional Memory Copilot**.\n\nI answer queries strictly based on verified offset well records, deterministic risk calculations, and completion reports from the Assam-Arakan Basin. **I never invent facts** — every single factual claim is enforced with a clickable source citation.\n\nAsk a question or click one of the preset demo buttons below:',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputQuery, setInputQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const activeWellId = selectedWell?.id || (selectedWell as any)?.well_id;
      const res: CopilotQueryResponse = await queryCopilot(q, activeWellId);

      const isInsufficient =
        res.answer.toLowerCase().includes('insufficient evidence') ||
        res.answer.toLowerCase().includes('no matching drilling events') ||
        (!res.citations || res.citations.length === 0);

      const botMsg: ChatMessage = {
        id: `b-${Date.now()}`,
        sender: 'assistant',
        text: res.answer,
        citations: res.citations || [],
        isInsufficientEvidence: isInsufficient,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text:
          '⚠️ Unable to retrieve evidence from backend copilot service. Ensure FastAPI backend is running on port 8000.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl flex flex-col h-[740px] shadow-2xl backdrop-blur-md overflow-hidden font-mono">
      {/* ─── Header ─── */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-base">
            🤖
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 uppercase">
                Drilling Institutional Memory Copilot
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold">
                CITATION-ENFORCED RAG
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Zero-Hallucination Retrieval · Verbatim Page Proofs
            </p>
          </div>
        </div>

        {/* Well Context Filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Active Well Context:</span>
          <select
            value={selectedWell?.id || (selectedWell as any)?.well_id || ''}
            onChange={(e) => {
              const found = wells.find((w) => (w.id || w.well_id) === e.target.value);
              if (found && onSelectWell) onSelectWell(found);
            }}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Wells (Global Retrieval)</option>
            {wells.map((w) => {
              const wid = w.id || w.well_id;
              return (
                <option key={wid} value={wid}>
                  {w.well_id_code || w.code || w.name}
                </option>
              );
            })}
          </select>

          <button
            onClick={() =>
              setMessages([
                {
                  id: 'welcome-reset',
                  sender: 'assistant',
                  text: 'Chat history cleared. Select a preset question or ask any drilling question below.',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ])
            }
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs ml-1"
            title="Clear Chat History"
          >
            ↺
          </button>
        </div>
      </div>

      {/* ─── Suggested Preset Questions Strip (Phase 13 requirement) ─── */}
      <div className="bg-slate-950/70 border-b border-slate-800/80 px-4 py-2.5 flex items-center gap-2 overflow-x-auto shrink-0">
        <span className="text-[10px] text-slate-500 font-bold uppercase shrink-0">
          Demo Presets:
        </span>
        <div className="flex items-center gap-2">
          {PRESET_QUESTIONS.map((pq, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(pq.query)}
              disabled={loading}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-cyan-950/60 border border-slate-700/80 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 text-[11px] whitespace-nowrap transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <span className="text-cyan-400 font-bold">⚡</span>
              <span>{pq.title}</span>
              <span className="text-[9px] px-1 py-0.2 bg-slate-800 text-slate-400 rounded">
                {pq.tag}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Messages Area ─── */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-950/50">
        {messages.map((m) => {
          const isUser = m.sender === 'user';

          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-3xl ${
                isUser ? 'ml-auto' : 'mr-auto'
              }`}
            >
              {/* Sender & Timestamp */}
              <div className="flex items-center gap-2 mb-1 px-1 text-[10px] text-slate-500">
                <span className="font-bold text-slate-400">
                  {isUser ? 'Drilling Engineer' : 'Drilling Copilot RAG'}
                </span>
                <span>•</span>
                <span>{m.timestamp}</span>
              </div>

              {/* Message Bubble */}
              {m.isInsufficientEvidence ? (
                /* Distinct Neutral-Styled Message for Insufficient Evidence (Phase 13 requirement) */
                <div className="bg-slate-900 border border-blue-500/40 text-slate-200 rounded-2xl p-4 shadow-lg text-xs leading-relaxed space-y-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-[11px]">
                    <span>ℹ️</span>
                    <span>OUT-OF-SCOPE / INSUFFICIENT EVIDENCE ADVISORY</span>
                  </div>
                  <p className="text-slate-300">{m.text}</p>
                  <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
                    Trustworthy Architecture: The system rejects ungrounded queries and never hallucinates numbers or events.
                  </div>
                </div>
              ) : (
                /* Standard Message Bubble */
                <div
                  className={`rounded-2xl p-4 shadow-xl text-xs leading-relaxed ${
                    isUser
                      ? 'bg-cyan-600 text-slate-950 font-semibold rounded-br-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none space-y-3'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>

                  {/* Inline Citation Chips (Phase 13 requirement) */}
                  {!isUser && m.citations && m.citations.length > 0 && (
                    <div className="pt-3 border-t border-slate-800 space-y-2">
                      <div className="text-[10px] text-slate-400 font-bold uppercase flex items-center justify-between">
                        <span>Mandatory Document Citations:</span>
                        <span className="text-cyan-400 font-normal">Click to jump to PDF page</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {m.citations.map((c, cIdx) => (
                          <button
                            key={cIdx}
                            onClick={() => onOpenEvidence(c.doc, c.page, c.snippet, c.well)}
                            className="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 hover:text-cyan-200 text-[11px] font-bold flex items-center gap-2 transition-transform active:scale-95 shadow-sm"
                            title={`Open ${c.doc} at Page ${c.page}`}
                          >
                            <span>📑 [{c.well} · {c.doc} · Page {c.page}]</span>
                            <span className="text-cyan-400 text-xs">↗</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center gap-3 text-cyan-400 text-xs bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl w-fit">
            <span className="animate-spin text-lg">⏳</span>
            <span>Synthesizing verified offset evidence &amp; enforcing citations…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── Chat Input Area ─── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(inputQuery);
        }}
        className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask a technical drilling question (e.g. 'mud losses in Barail F3' or 'tight hole at 2750m')..."
          disabled={loading}
          className="flex-1 bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !inputQuery.trim()}
          className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-transform active:scale-95"
        >
          <span>Ask</span>
          <span>➔</span>
        </button>
      </form>
    </div>
  );
};
