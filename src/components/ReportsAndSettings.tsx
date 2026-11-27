import React, { useEffect, useState } from 'react';
import { Download, FileText, Trash2, UserPlus, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Candidate, ConsultancySettings, UserAccount, UserRole } from '../types/scholarship';
import { apiClient } from '../api/client';
import { generateCandidatePdfReport } from '../utils/pdfReport';
import { CREST_IMAGE_URL } from './AuthGate';

interface ReportsViewProps {
  candidate: Candidate | null;
  settings: ConsultancySettings;
  onNavigate: (section: string) => void;
}

export const AssessmentReportsView: React.FC<ReportsViewProps> = ({
  candidate,
  settings,
  onNavigate,
}) => {
  const [generatingPdf, setGeneratingPdf] = useState(false);

  if (!candidate) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
        <h3 className="text-lg font-bold text-[#0B1F3A]">Select a Candidate for Reporting</h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Choose a candidate from the Candidate Database to preview and download their official UBAID ULLAH ENTERPRISES
          PDF Assessment Report.
        </p>
        <button
          onClick={() => onNavigate('database')}
          className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold"
        >
          Open Candidate Database
        </button>
      </div>
    );
  }

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    try {
      await generateCandidatePdfReport(candidate, settings, CREST_IMAGE_URL);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const a = candidate.assessment;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1F3A]">Official Assessment Report Preview</h2>
          <p className="text-xs text-slate-500">
            Includes company branding, 10-category scoring, AI eligibility, university matches, improvement plan, and
            disclaimer.
          </p>
        </div>
        <button
          type="button"
          disabled={generatingPdf}
          onClick={handleDownloadPdf}
          className="px-5 py-2.5 rounded-lg bg-[#0B1F3A] hover:bg-[#132D52] text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>{generatingPdf ? 'Preparing PDF...' : 'Download PDF Report'}</span>
        </button>
      </div>

      {/* Printable Report Sheet Preview */}
      <article className="bg-white rounded-xl border border-slate-200 overflow-hidden max-w-4xl mx-auto">
        <div className="bg-[#0B1F3A] text-white p-6 border-b-4 border-[#C69B3A] flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={settings.customLogoDataUrl || CREST_IMAGE_URL}
              alt="Company Emblem"
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-lg bg-white p-1 object-contain"
            />
            <div>
              <div className="text-sm font-bold tracking-wide">{settings.companyName}</div>
              <div className="text-base font-bold text-[#D9B45B]">{settings.applicationName}</div>
              <div className="text-xs text-slate-300">{settings.tagline}</div>
            </div>
          </div>
          <div className="text-right text-xs text-slate-300 font-mono">
            <div>{candidate.referenceCode}</div>
            <div>{new Date().toLocaleDateString('en-GB')}</div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6 text-xs text-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="font-bold text-[#0B1F3A] text-sm mb-1">Candidate Summary</div>
              <div>Name: {candidate.personalInfo.fullName}</div>
              <div>Email: {candidate.personalInfo.email}</div>
              <div>Nationality: {candidate.personalInfo.nationality || 'N/A'}</div>
              <div>Intended Pathway: {candidate.intendedProgramme.intendedDegree}</div>
            </div>
            <div className="sm:text-right">
              <div className="font-bold text-[#0B1F3A] text-sm mb-1">Assessment Score</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#0B1F3A]">
                {a.normalizedScore.toFixed(1)} / 100
              </div>
              <div className="font-semibold text-[#A88026]">{a.classification}</div>
              <div className="text-slate-500 font-mono">
                {a.totalObtained} / {a.totalApplicableMax} applicable marks
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-[#0B1F3A] text-sm mb-2">Category-Wise Performance</h4>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {a.categories.map((c) => (
                <div key={c.id} className="px-3.5 py-2 flex items-center justify-between gap-4">
                  <span>
                    {c.id}. {c.name}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-[#0B1F3A]">
                    {c.applicable ? `${c.marksObtained} / ${c.maxMarks}` : 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h4 className="font-bold text-[#0B1F3A] text-sm mb-1">AI Eligibility Summary</h4>
              <p className="text-slate-600 leading-relaxed">
                {candidate.aiEligibility?.executiveSummary ||
                  'Run AI Eligibility screening before exporting for full degree-level track recommendations.'}
              </p>
            </div>
            <div>
              <h4 className="font-bold text-[#0B1F3A] text-sm mb-1">Matched Opportunities &amp; Supervisors</h4>
              <p className="text-slate-600">
                {candidate.scholarshipMatches?.opportunities.length || 0} scholarship match(es) ·{' '}
                {candidate.supervisorMatches?.supervisors.length || 0} supervisor match(es) attached to this report.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500 italic">
            {settings.reportDisclaimer}
          </div>
        </div>
      </article>
    </div>
  );
};

interface SettingsViewProps {
  settings: ConsultancySettings;
  userRole: UserRole;
  onSettingsUpdated: (settings: ConsultancySettings, candidates: Candidate[]) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  userRole,
  onSettingsUpdated,
}) => {
  const [form, setForm] = useState<ConsultancySettings>(settings);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'staff' as UserRole });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  useEffect(() => {
    if (userRole === 'admin') {
      apiClient
        .getUsers()
        .then((res) => setUsers(res.users))
        .catch(() => {});
    }
  }, [userRole]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      const res = await apiClient.updateSettings(form);
      onSettingsUpdated(res.settings, res.candidates);
      setMessage('Consultancy settings saved and candidate assessments recalculated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (files: FileList | null) => {
    if (!files || !files[0]) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((p) => ({ ...p, customLogoDataUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(files[0]);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const res = await apiClient.createUser(newUser);
      setUsers((prev) => [...prev, res.user]);
      setNewUser({ name: '', email: '', password: '', role: 'staff' });
      setMessage(`Added ${res.user.role} account for ${res.user.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create user.');
    }
  };

  const handleDeleteUser = async (id: string) => {
    setError(null);
    try {
      await apiClient.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove user.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-lg font-bold text-[#0B1F3A]">Consultancy Branding &amp; Assessment Governance</h2>
          <p className="text-xs text-slate-500">
            {userRole === 'admin'
              ? 'Manage brand logo placeholder, report disclaimer, and evidence verification policy.'
              : 'Viewing active consultancy configuration (Administrator privileges required to modify).'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name</label>
            <input
              type="text"
              disabled={userRole !== 'admin'}
              value={form.companyName}
              onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Application Title</label>
            <input
              type="text"
              disabled={userRole !== 'admin'}
              value={form.applicationName}
              onChange={(e) => setForm((p) => ({ ...p, applicationName: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-50"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tagline</label>
            <input
              type="text"
              disabled={userRole !== 'admin'}
              value={form.tagline}
              onChange={(e) => setForm((p) => ({ ...p, tagline: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-50"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">PDF Report Disclaimer</label>
            <textarea
              rows={2}
              disabled={userRole !== 'admin'}
              value={form.reportDisclaimer}
              onChange={(e) => setForm((p) => ({ ...p, reportDisclaimer: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs disabled:bg-slate-50"
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <div className="text-xs font-semibold text-[#0B1F3A]">Strict Evidence Enforcement</div>
              <div className="text-[11px] text-slate-500">
                Withhold marks for achievements lacking uploaded documents, DOIs, or verification.
              </div>
            </div>
            <input
              type="checkbox"
              disabled={userRole !== 'admin'}
              checked={form.strictEvidenceMode}
              onChange={(e) => setForm((p) => ({ ...p, strictEvidenceMode: e.target.checked }))}
              className="h-4 w-4"
            />
          </div>
          {userRole === 'admin' && (
            <div className="sm:col-span-2 flex items-center gap-4">
              <img
                src={form.customLogoDataUrl || CREST_IMAGE_URL}
                alt="Active Brand Crest"
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-lg border border-slate-200 object-contain bg-white p-1"
              />
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Replace Company Logo Placeholder</label>
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e.target.files)} className="text-xs" />
                  {form.customLogoDataUrl && (
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, customLogoDataUrl: '' }))}
                      className="text-xs text-red-600 underline"
                    >
                      Restore Default Crest
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {userRole === 'admin' && (
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#132D52] text-white text-xs font-semibold"
            >
              {saving ? 'Saving...' : 'Save Consultancy Settings'}
            </button>
          </div>
        )}
      </form>

      {/* Role-Based Staff Management */}
      {userRole === 'admin' && (
        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Shield className="w-4 h-4 text-[#C69B3A]" />
            <h3 className="text-base font-bold text-[#0B1F3A]">Authorized Staff &amp; Administrator Accounts</h3>
          </div>

          <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={newUser.name}
                onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                required
                value={newUser.email}
                onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password (8+ chars)</label>
              <input
                type="password"
                required
                minLength={8}
                value={newUser.password}
                onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as UserRole }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="staff">Staff Advisor</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add User</span>
            </button>
          </form>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {users.map((u) => (
              <div key={u.id} className="px-4 py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-[#0B1F3A]">{u.name}</span> ·{' '}
                  <span className="text-slate-600">{u.email}</span> ·{' '}
                  <span className="font-semibold text-[#A88026]">{u.role.toUpperCase()}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteUser(u.id)}
                  className="text-red-600 hover:text-red-800 p-1"
                  title="Revoke access"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
