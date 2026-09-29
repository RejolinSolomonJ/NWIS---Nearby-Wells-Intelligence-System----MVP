import React, { useState } from 'react';
import { loginUser } from '../api/client';
import { Lock, Shield, Activity, Eye, X, ArrowRight } from 'lucide-react';

export interface UserProfile {
  username: string;
  role: 'admin' | 'engineer' | 'read_only';
  full_name?: string;
}

interface Props {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
  onLogout: () => void;
}

export const LoginModal: React.FC<Props> = ({
  isOpen,
  currentUser,
  onClose,
  onLoginSuccess,
  onLogout,
}) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please provide both username and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await loginUser(username, password);
      onLoginSuccess({
        username: res.username,
        role: (res.role as 'admin' | 'engineer' | 'read_only') || 'admin',
        full_name: res.username === 'admin' ? 'Chief Operations Lead' : 'Field Drilling Engineer',
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (user: string, pass: string, roleName: 'admin' | 'engineer' | 'read_only', title: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await loginUser(user, pass);
      onLoginSuccess({
        username: res.username || user,
        role: (res.role as any) || roleName,
        full_name: title,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-display">
                Authentication &amp; RBAC Control
              </h3>
              <p className="text-[11px] text-slate-400 font-sans">Security Credentials &amp; Role Permissions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current User Status Banner */}
        <div className="bg-slate-950/50 px-6 py-3 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Authenticated:</span>
            <span className="font-bold text-cyan-300">{currentUser.username}</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
              currentUser.role === 'admin'
                ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                : currentUser.role === 'engineer'
                ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            Role: {currentUser.role}
          </span>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
              <span className="font-bold text-rose-400 mr-1.5">ERROR:</span>{error}
            </div>
          )}

          {/* Preset Roles Quick Switch */}
          <div>
            <label className="block text-[10px] uppercase text-slate-400 font-bold mb-2">
              Fast-Switch Demo Credentials:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin', 'admin123', 'admin', 'Chief System Administrator')}
                disabled={loading}
                className="p-2.5 rounded-xl bg-slate-950 border border-rose-900/60 hover:border-rose-500/80 text-center transition-all group hover:scale-[1.02]"
              >
                <div className="flex justify-center text-rose-400 mb-1"><Shield className="w-4 h-4" /></div>
                <div className="font-bold text-rose-400 text-[11px]">Admin</div>
                <div className="text-[9px] text-slate-500">Superintendent</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('engineer', 'engineer123', 'engineer', 'Senior Drilling Engineer')}
                disabled={loading}
                className="p-2.5 rounded-xl bg-slate-950 border border-cyan-900/60 hover:border-cyan-500/80 text-center transition-all group hover:scale-[1.02]"
              >
                <div className="flex justify-center text-cyan-400 mb-1"><Activity className="w-4 h-4" /></div>
                <div className="font-bold text-cyan-400 text-[11px]">Engineer</div>
                <div className="text-[9px] text-slate-500">Drilling Ops</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('viewer', 'viewer123', 'read_only', 'Field Observer')}
                disabled={loading}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-600 text-center transition-all group hover:scale-[1.02]"
              >
                <div className="flex justify-center text-slate-300 mb-1"><Eye className="w-4 h-4" /></div>
                <div className="font-bold text-slate-300 text-[11px]">Viewer</div>
                <div className="text-[9px] text-slate-500">Read-Only</div>
              </button>
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase">Or Custom Login</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleCustomLogin} className="space-y-3">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or engineer"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors shadow-md flex items-center justify-center gap-1.5"
              >
                <span>{loading ? 'Authenticating…' : 'Authenticate & Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              {currentUser.username !== 'viewer' && (
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-bold transition-colors"
                >
                  Logout
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Footer info */}
        <div className="bg-slate-950 px-6 py-2.5 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between">
          <span>Protected: /reports/upload, /events/review</span>
          <span>HS256 JWT Valid</span>
        </div>
      </div>
    </div>
  );
};
