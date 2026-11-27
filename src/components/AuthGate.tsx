import React, { useState } from 'react';
import { Lock, ShieldCheck, UserPlus, ArrowRight, AlertCircle } from 'lucide-react';
import { apiClient, type AuthStatusResponse } from '../api/client';
import type { UserRole } from '../types/scholarship';

export const CREST_IMAGE_URL = '/src/assets/images/ue_academic_crest_1795802217816.jpg';

interface AuthGateProps {
  authStatus: AuthStatusResponse;
  onAuthenticated: (token: string, user: { id: string; name: string; email: string; role: UserRole }) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ authStatus, onAuthenticated }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crestError, setCrestError] = useState(false);

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.setupAdmin({ name, email, password });
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete administrator setup.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.login({ email, password });
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1F3A] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-4xl bg-white rounded-xl border border-slate-200 overflow-hidden grid grid-cols-1 md:grid-cols-12 shadow-2xl">
        {/* Brand Panel */}
        <div className="md:col-span-5 bg-[#071426] text-white p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#1D3E6E]">
          <div>
            <div className="w-20 h-20 rounded-xl bg-white p-1.5 flex items-center justify-center mb-6 overflow-hidden">
              {!crestError ? (
                <img
                  src={CREST_IMAGE_URL}
                  alt="UBAID ULLAH ENTERPRISES Academic Crest"
                  referrerPolicy="no-referrer"
                  onError={() => setCrestError(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <ShieldCheck className="w-10 h-10 text-[#0B1F3A]" />
              )}
            </div>
            <p className="text-xs font-semibold tracking-wider text-[#D9B45B] mb-2">
              UBAID ULLAH ENTERPRISES
            </p>
            <h1 className="text-2xl font-bold leading-tight text-white mb-3 text-balance">
              International Scholarship-Assessment Tool
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Empowering Global Academic Opportunities
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 space-y-2.5 text-xs text-slate-300">
            <p>· Automated 100-Mark Academic & Research Engine</p>
            <p>· Bachelor&apos;s, Master&apos;s/MPhil &amp; PhD Pathways</p>
            <p>· Live Grounded Scholarship &amp; Supervisor Matching</p>
            <p>· Encrypted Document Vault &amp; Branded PDF Reports</p>
          </div>
        </div>

        {/* Form Panel */}
        <div className="md:col-span-7 p-8 sm:p-10 bg-white flex flex-col justify-center">
          {authStatus.needsAdminSetup ? (
            <form onSubmit={handleSetupAdmin} className="space-y-4">
              <div className="flex items-center gap-2 text-[#0B1F3A] mb-1">
                <UserPlus className="w-5 h-5 text-[#C69B3A]" />
                <h2 className="text-xl font-bold">Initial Administrator Setup</h2>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Claim the primary administrator account to secure candidate records, documents, and staff permissions.
              </p>

              {error && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Administrator Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ubaid Ullah"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1F3A]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Official Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ubaidullahenterprises.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1F3A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password (min 8 chars)</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1F3A]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1F3A]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-[#0B1F3A] hover:bg-[#132D52] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                <span>{loading ? 'Provisioning Account...' : 'Claim Administrator Workspace'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex items-center gap-2 text-[#0B1F3A] mb-1">
                <Lock className="w-5 h-5 text-[#C69B3A]" />
                <h2 className="text-xl font-bold">Authorized Staff &amp; Admin Sign In</h2>
              </div>
              <p className="text-sm text-slate-600">
                Candidate records and uploaded documents are restricted to authenticated consultancy personnel.
              </p>

              {error && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {authStatus.envPasscodeActive ? 'Email Address (optional with passcode)' : 'Registered Email Address'}
                </label>
                <input
                  type="email"
                  required={!authStatus.envPasscodeActive}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@ubaidullahenterprises.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1F3A]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {authStatus.envPasscodeActive ? 'Password or Administrator Passcode' : 'Password'}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1F3A]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-[#0B1F3A] hover:bg-[#132D52] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                <span>{loading ? 'Verifying Session...' : 'Sign In to Assessment Console'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
