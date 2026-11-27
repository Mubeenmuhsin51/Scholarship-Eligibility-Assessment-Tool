import React, { useState } from 'react';
import {
  Sparkles,
  Globe,
  ExternalLink,
  AlertCircle,
  Loader2,
  UserCheck,
  TrendingUp,
} from 'lucide-react';
import { SUPPORTED_COUNTRIES, type Candidate } from '../types/scholarship';
import { apiClient } from '../api/client';

interface AiMatchingViewsProps {
  mode: 'eligibility' | 'matching';
  candidate: Candidate | null;
  onCandidateUpdated: (updated: Candidate) => void;
  onNavigate: (section: string) => void;
}

function sanitizeHttpUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
    return null;
  } catch {
    return null;
  }
}

export const AiMatchingViews: React.FC<AiMatchingViewsProps> = ({
  mode,
  candidate,
  onCandidateUpdated,
  onNavigate,
}) => {
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingScholarships, setLoadingScholarships] = useState(false);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    candidate?.intendedProgramme.preferredCountries || ['Germany', 'United Kingdom', 'Netherlands']
  );
  const [degreeFilter, setDegreeFilter] = useState<string>(candidate?.intendedProgramme.intendedDegree || 'PhD');
  const [queryFocus, setQueryFocus] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!candidate) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
        <h3 className="text-lg font-bold text-[#0B1F3A]">Select a Candidate First</h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Choose a registered candidate from the database to run AI scholarship eligibility, live university search, and
          supervisor matching.
        </p>
        <button
          onClick={() => onNavigate('database')}
          className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold"
        >
          Go to Candidate Database
        </button>
      </div>
    );
  }

  const handleRunEligibility = async () => {
    setError(null);
    setLoadingEligibility(true);
    try {
      const res = await apiClient.runAiEligibility(candidate.id);
      onCandidateUpdated(res.candidate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run eligibility analysis.');
    } finally {
      setLoadingEligibility(false);
    }
  };

  const handleRunImprovementPlan = async () => {
    setError(null);
    setLoadingPlan(true);
    try {
      const res = await apiClient.runAiImprovementPlan(candidate.id);
      onCandidateUpdated(res.candidate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate improvement plan.');
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleSearchScholarships = async () => {
    setError(null);
    setLoadingScholarships(true);
    try {
      const res = await apiClient.runAiScholarships({
        candidateId: candidate.id,
        targetCountries: selectedCountries,
        degreeFilter,
        queryFocus,
      });
      onCandidateUpdated(res.candidate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Live scholarship search failed.');
    } finally {
      setLoadingScholarships(false);
    }
  };

  const handleSearchSupervisors = async () => {
    setError(null);
    setLoadingSupervisors(true);
    try {
      const res = await apiClient.runAiSupervisors({
        candidateId: candidate.id,
        targetCountries: selectedCountries,
      });
      onCandidateUpdated(res.candidate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Supervisor matching failed.');
    } finally {
      setLoadingSupervisors(false);
    }
  };

  if (mode === 'eligibility') {
    const elig = candidate.aiEligibility;
    const plan = candidate.improvementPlan;
    return (
      <div className="space-y-6">
        <section className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">
              {candidate.referenceCode} · Normalized Score {candidate.assessment.normalizedScore}/100 (
              {candidate.assessment.classification})
            </p>
            <h2 className="text-2xl font-bold text-[#0B1F3A]">
              Scholarship Eligibility &amp; Improvement Roadmap
            </h2>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={loadingEligibility}
              onClick={handleRunEligibility}
              className="px-4 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#132D52] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
            >
              {loadingEligibility ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{elig ? 'Refresh AI Eligibility' : 'Analyze Pathway Eligibility'}</span>
            </button>
            <button
              type="button"
              disabled={loadingPlan}
              onClick={handleRunImprovementPlan}
              className="px-4 py-2 rounded-lg bg-[#C69B3A] hover:bg-[#D9B45B] text-[#071426] text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
            >
              {loadingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
              <span>{plan ? 'Regenerate Improvement Plan' : 'Generate Improvement Plan'}</span>
            </button>
          </div>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Eligibility Results */}
        {!elig ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-600">
            Click &ldquo;Analyze Pathway Eligibility&rdquo; to evaluate {candidate.personalInfo.fullName} independently
            across Bachelor&apos;s, Master&apos;s/MPhil, and PhD scholarship tracks.
          </div>
        ) : (
          <div className="space-y-4">
            {elig.isFallbackMode && elig.fallbackNotice && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-xs">
                <strong>Fallback Mode Notice:</strong> {elig.fallbackNotice}
              </div>
            )}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs font-semibold text-slate-500 mb-1">
                Executive Screening Summary · Generated {new Date(elig.generatedAt).toLocaleString()}
              </div>
              <p className="text-sm text-slate-800 leading-relaxed">{elig.executiveSummary}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {elig.pathways.map((pw) => (
                <section key={pw.pathway} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                  <div className="border-b border-slate-200 pb-3">
                    <div className="text-xs font-semibold text-[#A88026]">{pw.overallStatus}</div>
                    <h3 className="text-lg font-bold text-[#0B1F3A] mt-0.5">{pw.pathway} Pathway</h3>
                    <p className="text-xs text-slate-600 mt-1">{pw.summary}</p>
                  </div>
                  <div className="space-y-3">
                    {pw.tracks.map((tr, i) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-[#0B1F3A]">{tr.trackName}</span>
                          <span className="text-[11px] font-semibold text-slate-700 shrink-0">{tr.status}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{tr.reasoning}</p>
                        {tr.requirements.length > 0 && (
                          <ul className="text-[11px] text-slate-500 pt-1 space-y-0.5">
                            {tr.requirements.map((req, ri) => (
                              <li key={ri}>· {req}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {/* AI Improvement Plan */}
        {plan && (
          <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-[#0B1F3A]">Personalized Improvement Roadmap</h3>
              <p className="text-xs text-slate-600 mt-1">{plan.strategicSummary}</p>
              {plan.isFallbackMode && plan.fallbackNotice && (
                <p className="text-xs text-amber-700 mt-1">{plan.fallbackNotice}</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plan.items.map((item) => (
                <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#0B1F3A]">{item.category}</span>
                    <span className="font-semibold text-[#A88026]">
                      {item.priority} Priority · {item.timeline}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{item.actionTitle}</div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                  <div className="text-[11px] font-mono text-slate-700 pt-1">Target: {item.targetMetric}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // UNIVERSITY & SUPERVISOR MATCHING VIEW
  const matches = candidate.scholarshipMatches;
  const sups = candidate.supervisorMatches;

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">
              {candidate.referenceCode} · Live Web-Grounded University, Scholarship &amp; Supervisor Finder
            </p>
            <h2 className="text-2xl font-bold text-[#0B1F3A]">{candidate.personalInfo.fullName}</h2>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={loadingScholarships}
              onClick={handleSearchScholarships}
              className="px-4 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#132D52] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
            >
              {loadingScholarships ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              <span>Search Live Scholarships</span>
            </button>
            <button
              type="button"
              disabled={loadingSupervisors}
              onClick={handleSearchSupervisors}
              className="px-4 py-2 rounded-lg bg-[#C69B3A] hover:bg-[#D9B45B] text-[#071426] text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
            >
              {loadingSupervisors ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              <span>Match Supervisors</span>
            </button>
          </div>
        </div>

        {/* Search Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Degree Filter</label>
            <select
              value={degreeFilter}
              onChange={(e) => setDegreeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
            >
              <option value="Bachelor's">Bachelor&apos;s</option>
              <option value="Master's">Master&apos;s / MS / MPhil</option>
              <option value="PhD">PhD / Doctoral</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Search Focus (Optional)</label>
            <input
              type="text"
              value={queryFocus}
              onChange={(e) => setQueryFocus(e.target.value)}
              placeholder="e.g. DAAD, Erasmus Mundus, Marie Curie, fully funded robotics PhD..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Target Countries ({selectedCountries.length} selected)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SUPPORTED_COUNTRIES.map((country) => {
                const active = selectedCountries.includes(country);
                return (
                  <button
                    key={country}
                    type="button"
                    onClick={() =>
                      setSelectedCountries((prev) =>
                        prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]
                      )
                    }
                    className={`px-2.5 py-1 rounded text-xs font-medium border ${
                      active
                        ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {country}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Scholarship Matches */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-base font-bold text-[#0B1F3A]">International University &amp; Scholarship Finder</h3>
          {matches && (
            <span className="text-xs text-slate-500">
              Verified {new Date(matches.generatedAt).toLocaleDateString()}
            </span>
          )}
        </div>

        {!matches ? (
          <p className="text-xs text-slate-500 py-4">
            Run &ldquo;Search Live Scholarships&rdquo; to query verified international programmes and funding calls.
          </p>
        ) : matches.isFallbackMode ? (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <strong>Fallback Notice:</strong> {matches.fallbackNotice}
          </div>
        ) : matches.opportunities.length === 0 ? (
          <p className="text-xs text-slate-500">
            No matching verified opportunities returned for these exact filters. Try broadening target countries or focus keywords.
          </p>
        ) : (
          <div className="space-y-4">
            {matches.opportunities.map((opp) => {
              const safeUrl = sanitizeHttpUrl(opp.officialUrl);
              return (
                <div key={opp.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <div className="text-xs text-slate-500">
                        {opp.country} · {opp.university} · {opp.degreeProgramme}
                      </div>
                      <h4 className="text-base font-bold text-[#0B1F3A]">{opp.scholarshipName}</h4>
                    </div>
                    <div className="text-xs font-semibold shrink-0">
                      <span
                        className={
                          opp.verificationStatus === 'verified'
                            ? 'text-emerald-700'
                            : opp.verificationStatus === 'expired'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }
                      >
                        {opp.verificationStatus.toUpperCase()} · {opp.verificationDate}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-700">
                    <div><strong>Coverage:</strong> {opp.fundingCoverage}</div>
                    <div><strong>Min CGPA:</strong> {opp.minimumCgpa}</div>
                    <div><strong>English:</strong> {opp.englishRequirements}</div>
                    <div><strong>Research:</strong> {opp.researchRequirements}</div>
                    <div><strong>Nationality:</strong> {opp.nationalityRestrictions}</div>
                    <div><strong>Deadline:</strong> {opp.applicationDeadline}</div>
                  </div>
                  <p className="text-xs text-slate-600">{opp.matchRationale}</p>
                  {safeUrl && (
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B1F3A] hover:text-[#A88026]"
                    >
                      <span>Official Programme Portal</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              );
            })}

            {matches.groundingSources.length > 0 && (
              <div className="pt-3 border-t border-slate-200 text-xs text-slate-500">
                <div className="font-semibold text-slate-700 mb-1">Verified Search Grounding Sources:</div>
                <div className="flex flex-wrap gap-3">
                  {matches.groundingSources.slice(0, 6).map((src, idx) => {
                    const safe = sanitizeHttpUrl(src.uri);
                    return safe ? (
                      <a
                        key={idx}
                        href={safe}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-[#0B1F3A]"
                      >
                        {src.title}
                      </a>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Supervisor Matching */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="text-base font-bold text-[#0B1F3A]">AI Research &amp; Supervisor Matching</h3>
          <p className="text-xs text-slate-500">
            Matches candidate thesis and research techniques with verified university departments and faculty profiles.
          </p>
        </div>

        {!sups ? (
          <p className="text-xs text-slate-500 py-4">
            Click &ldquo;Match Supervisors&rdquo; to identify aligned faculty and research groups for Master&apos;s/PhD pathways.
          </p>
        ) : sups.isFallbackMode ? (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <strong>Fallback Notice:</strong> {sups.fallbackNotice}
          </div>
        ) : (
          <div className="space-y-4">
            {sups.extractedResearchThemes.length > 0 && (
              <div className="text-xs text-slate-700">
                <strong>Extracted Research Themes:</strong> {sups.extractedResearchThemes.join(' · ')}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sups.supervisors.map((s) => {
                const safeUrl = sanitizeHttpUrl(s.officialProfileUrl);
                return (
                  <div key={s.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-[#0B1F3A]">
                          {s.professorName} · {s.title}
                        </h4>
                        <div className="text-xs text-slate-600">
                          {s.university} ({s.country}) · {s.department}
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 shrink-0">
                        {s.verificationStatus.toUpperCase()}
                      </span>
                    </div>
                    {s.researchGroup && (
                      <div className="text-xs text-slate-700">
                        <strong>Research Group:</strong> {s.researchGroup}
                      </div>
                    )}
                    <p className="text-xs text-slate-600 leading-relaxed">{s.relevanceReason}</p>
                    <div className="text-[11px] text-amber-800">{s.acceptingStudentsNote}</div>
                    {safeUrl && (
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B1F3A] hover:text-[#A88026]"
                      >
                        <span>Official Faculty Profile</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
