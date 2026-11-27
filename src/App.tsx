import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  GraduationCap,
  Microscope,
  Award,
  Globe,
  FileSpreadsheet,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { apiClient, type AuthStatusResponse } from './api/client';
import type { Candidate, ConsultancySettings, UserRole } from './types/scholarship';
import { AuthGate, CREST_IMAGE_URL } from './components/AuthGate';
import { DashboardView } from './components/DashboardView';
import { CandidateRegistration } from './components/CandidateRegistration';
import { CandidateDatabase } from './components/CandidateDatabase';
import { AssessmentViews } from './components/AssessmentViews';
import { AiMatchingViews } from './components/AiMatchingViews';
import { AssessmentReportsView, SettingsView } from './components/ReportsAndSettings';

type NavKey =
  | 'dashboard'
  | 'register'
  | 'database'
  | 'academic'
  | 'research'
  | 'eligibility'
  | 'matching'
  | 'reports'
  | 'settings';

const NAV_ITEMS: { key: NavKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'dashboard', label: 'Home / Dashboard', icon: LayoutDashboard },
  { key: 'register', label: 'Register Candidate', icon: UserPlus },
  { key: 'database', label: 'Candidate Database', icon: Users },
  { key: 'academic', label: 'Academic Assessment', icon: GraduationCap },
  { key: 'research', label: 'Research Assessment', icon: Microscope },
  { key: 'eligibility', label: 'Scholarship Eligibility', icon: Award },
  { key: 'matching', label: 'University Matching', icon: Globe },
  { key: 'reports', label: 'Assessment Reports', icon: FileSpreadsheet },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

const DEFAULT_SETTINGS: ConsultancySettings = {
  companyName: 'UBAID ULLAH ENTERPRISES',
  applicationName: 'International Scholarship-Assessment Tool',
  tagline: 'Empowering Global Academic Opportunities',
  strictEvidenceMode: true,
  defaultTargetCountries: ['Germany', 'United Kingdom', 'Netherlands', 'Sweden', 'Australia', 'Canada'],
  customLogoDataUrl: '',
  reportDisclaimer:
    'Disclaimer: Preliminary profile assessment only; not a guarantee of admission or funding.',
};

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null>(null);
  const [activeNav, setActiveNav] = useState<NavKey>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [settings, setSettings] = useState<ConsultancySettings>(DEFAULT_SETTINGS);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((curr) => (curr === msg ? null : curr)), 4000);
  }, []);

  const loadWorkspaceData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [candRes, setRes] = await Promise.all([apiClient.getCandidates(), apiClient.getSettings()]);
      setCandidates(candRes.candidates);
      setSettings(setRes.settings);
      setActiveCandidateId((prev) => {
        if (prev && candRes.candidates.some((c) => c.id === prev)) return prev;
        return candRes.candidates[0]?.id ?? null;
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load workspace data.');
    } finally {
      setLoadingData(false);
    }
  }, [showToast]);

  useEffect(() => {
    apiClient.setUnauthorizedHandler(() => {
      apiClient.setToken(null);
      setCurrentUser(null);
      apiClient.getAuthStatus().then(setAuthStatus).catch(() => {});
    });
    apiClient
      .getAuthStatus()
      .then((status) => setAuthStatus(status))
      .catch(() =>
        setAuthStatus({
          needsAdminSetup: false,
          envPasscodeActive: false,
          authenticated: false,
          user: null,
        })
      );
  }, []);

  const handleAuthenticated = (
    token: string,
    user: { id: string; name: string; email: string; role: UserRole }
  ) => {
    apiClient.setToken(token);
    setCurrentUser(user);
    loadWorkspaceData();
  };

  const handleSignOut = () => {
    apiClient.setToken(null);
    setCurrentUser(null);
    setCandidates([]);
    setActiveCandidateId(null);
    apiClient.getAuthStatus().then(setAuthStatus).catch(() => {});
  };

  const activeCandidate = useMemo(
    () => candidates.find((c) => c.id === activeCandidateId) ?? null,
    [candidates, activeCandidateId]
  );

  const handleNavigate = (section: string) => {
    if (section === 'register') {
      setEditingCandidate(null);
    }
    setActiveNav(section as NavKey);
    setMobileMenuOpen(false);
  };

  const handleSelectCandidate = (candidateId: string, targetSection = 'academic') => {
    setActiveCandidateId(candidateId);
    setActiveNav(targetSection as NavKey);
    setMobileMenuOpen(false);
  };

  const handleCandidateSaved = (saved: Candidate, isEdit: boolean) => {
    setCandidates((prev) => {
      const exists = prev.some((c) => c.id === saved.id);
      if (exists) return prev.map((c) => (c.id === saved.id ? saved : c));
      return [saved, ...prev];
    });
    setActiveCandidateId(saved.id);
    setEditingCandidate(null);
    setActiveNav('academic');
    showToast(isEdit ? `Updated ${saved.personalInfo.fullName}.` : `Registered & assessed ${saved.personalInfo.fullName}.`);
  };

  const handleCandidateUpdated = (updated: Candidate) => {
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    await apiClient.deleteCandidate(candidateId);
    setCandidates((prev) => {
      const remaining = prev.filter((c) => c.id !== candidateId);
      if (activeCandidateId === candidateId) {
        setActiveCandidateId(remaining[0]?.id ?? null);
      }
      return remaining;
    });
    showToast('Candidate record deleted.');
  };

  const handleStatusChange = async (candidateId: string, status: Candidate['assessmentStatus']) => {
    const res = await apiClient.updateCandidate(candidateId, { assessmentStatus: status });
    handleCandidateUpdated(res.candidate);
    showToast(`Assessment status updated to ${status.replace('_', ' ')}.`);
  };

  if (!authStatus) {
    return (
      <div className="min-h-screen bg-[#0B1F3A] flex items-center justify-center text-white text-sm">
        Initializing UBAID ULLAH ENTERPRISES Assessment Console...
      </div>
    );
  }

  if (!currentUser) {
    return <AuthGate authStatus={authStatus} onAuthenticated={handleAuthenticated} />;
  }

  const activeNavTitle = NAV_ITEMS.find((n) => n.key === activeNav)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row text-[#0F172A]">
      {/* Mobile Header */}
      <div className="lg:hidden bg-[#0B1F3A] text-white px-4 py-3 flex items-center justify-between border-b border-[#1D3E6E] sticky top-0 z-40">
        <div className="min-w-0">
          <div className="text-[11px] font-bold tracking-wider text-[#D9B45B] truncate">
            {settings.companyName}
          </div>
          <div className="text-sm font-bold truncate">{settings.applicationName}</div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="p-2 rounded-lg hover:bg-white/10"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`${
          mobileMenuOpen ? 'fixed inset-0 z-50 flex' : 'hidden'
        } lg:flex lg:w-[264px] lg:shrink-0 lg:sticky lg:top-0 lg:h-screen bg-[#0B1F3A] text-white flex-col justify-between border-r border-[#1D3E6E]`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="p-5 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={settings.customLogoDataUrl || CREST_IMAGE_URL}
                alt="UBAID ULLAH ENTERPRISES Emblem"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-lg bg-white p-0.5 object-contain shrink-0"
              />
              <div className="min-w-0">
                <div className="text-[11px] font-bold tracking-wider text-[#D9B45B] truncate">
                  {settings.companyName}
                </div>
                <div className="text-xs font-semibold text-white truncate">
                  {settings.applicationName}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 text-slate-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-3 space-y-1 flex-1" aria-label="Main Navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleNavigate(item.key)}
                  className={`w-full px-3.5 py-2.5 rounded-lg text-left text-xs font-medium flex items-center gap-3 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#C69B3A] text-[#071426] font-bold'
                      : 'text-slate-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10 space-y-3 text-xs">
          <div className="text-slate-300">
            <div className="font-semibold text-white truncate">{currentUser.name}</div>
            <div className="text-[11px] text-slate-400 truncate">
              {currentUser.email} · {currentUser.role.toUpperCase()}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 text-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Workspace Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-slate-500">
              {settings.companyName} / {settings.applicationName}
            </div>
            <h1 className="text-lg font-bold text-[#0B1F3A] truncate">{activeNavTitle}</h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {candidates.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="active-candidate-select" className="text-xs text-slate-500 hidden sm:inline whitespace-nowrap">
                  Active Candidate:
                </label>
                <select
                  id="active-candidate-select"
                  value={activeCandidateId || ''}
                  onChange={(e) => setActiveCandidateId(e.target.value || null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-[#0B1F3A] bg-white max-w-[220px]"
                >
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.personalInfo.fullName} ({c.assessment.normalizedScore.toFixed(0)}/100)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleNavigate('register')}
              className="px-4 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#132D52] text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              Register Candidate
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8 max-w-[1320px] w-full mx-auto">
          {toast && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-[#0B1F3A] text-white text-xs font-medium flex items-center justify-between">
              <span>{toast}</span>
              <button type="button" onClick={() => setToast(null)} className="text-slate-300 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {loadingData ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
              Loading consultancy records...
            </div>
          ) : (
            <>
              {activeNav === 'dashboard' && (
                <DashboardView
                  candidates={candidates}
                  settings={settings}
                  onNavigate={handleNavigate}
                  onSelectCandidate={handleSelectCandidate}
                />
              )}

              {activeNav === 'register' && (
                <CandidateRegistration
                  editingCandidate={editingCandidate}
                  settings={settings}
                  onSaved={handleCandidateSaved}
                  onCancel={() => {
                    setEditingCandidate(null);
                    setActiveNav('database');
                  }}
                />
              )}

              {activeNav === 'database' && (
                <CandidateDatabase
                  candidates={candidates}
                  userRole={currentUser.role}
                  onSelectCandidate={handleSelectCandidate}
                  onEditCandidate={(c) => {
                    setEditingCandidate(c);
                    setActiveNav('register');
                  }}
                  onDeleteCandidate={handleDeleteCandidate}
                  onStatusChange={handleStatusChange}
                  onNavigateRegister={() => handleNavigate('register')}
                />
              )}

              {activeNav === 'academic' && (
                <AssessmentViews
                  mode="academic"
                  candidate={activeCandidate}
                  settings={settings}
                  onEditCandidate={(c) => {
                    setEditingCandidate(c);
                    setActiveNav('register');
                  }}
                  onCandidateUpdated={handleCandidateUpdated}
                  onNavigate={handleNavigate}
                />
              )}

              {activeNav === 'research' && (
                <AssessmentViews
                  mode="research"
                  candidate={activeCandidate}
                  settings={settings}
                  onEditCandidate={(c) => {
                    setEditingCandidate(c);
                    setActiveNav('register');
                  }}
                  onCandidateUpdated={handleCandidateUpdated}
                  onNavigate={handleNavigate}
                />
              )}

              {activeNav === 'eligibility' && (
                <AiMatchingViews
                  mode="eligibility"
                  candidate={activeCandidate}
                  onCandidateUpdated={handleCandidateUpdated}
                  onNavigate={handleNavigate}
                />
              )}

              {activeNav === 'matching' && (
                <AiMatchingViews
                  mode="matching"
                  candidate={activeCandidate}
                  onCandidateUpdated={handleCandidateUpdated}
                  onNavigate={handleNavigate}
                />
              )}

              {activeNav === 'reports' && (
                <AssessmentReportsView
                  candidate={activeCandidate}
                  settings={settings}
                  onNavigate={handleNavigate}
                />
              )}

              {activeNav === 'settings' && (
                <SettingsView
                  settings={settings}
                  userRole={currentUser.role}
                  onSettingsUpdated={(newSettings, updatedCandidates) => {
                    setSettings(newSettings);
                    setCandidates(updatedCandidates);
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
