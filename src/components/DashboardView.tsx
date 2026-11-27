import React from 'react';
import { UserPlus, ArrowRight, FileCheck2, GraduationCap, Award, AlertTriangle } from 'lucide-react';
import type { Candidate, ConsultancySettings } from '../types/scholarship';

interface DashboardViewProps {
  candidates: Candidate[];
  settings: ConsultancySettings;
  onNavigate: (section: string) => void;
  onSelectCandidate: (candidateId: string, targetSection?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  candidates,
  settings,
  onNavigate,
  onSelectCandidate,
}) => {
  const totalCandidates = candidates.length;
  const phdCount = candidates.filter((c) => c.intendedProgramme.intendedDegree === 'PhD').length;
  const mastersCount = candidates.filter((c) =>
    ["Master's", 'MS', 'MPhil'].includes(c.intendedProgramme.intendedDegree)
  ).length;
  const bachelorsCount = candidates.filter((c) => c.intendedProgramme.intendedDegree === "Bachelor's").length;
  const excellentCount = candidates.filter((c) => c.assessment.classification === 'Excellent').length;
  const needsImprovementCount = candidates.filter(
    (c) => c.assessment.classification === 'Needs Improvement'
  ).length;
  const completedCount = candidates.filter((c) => c.assessmentStatus === 'completed').length;

  const avgScore =
    totalCandidates > 0
      ? (candidates.reduce((sum, c) => sum + c.assessment.normalizedScore, 0) / totalCandidates).toFixed(1)
      : '0.0';

  const kpis = [
    { label: 'Total Registered Candidates', value: totalCandidates, note: `${completedCount} completed assessments` },
    { label: 'PhD Applicants', value: phdCount, note: 'Doctoral pathway' },
    { label: "Master's / MS / MPhil", value: mastersCount, note: 'Postgraduate pathway' },
    { label: "Bachelor's Applicants", value: bachelorsCount, note: 'Undergraduate pathway' },
    { label: 'Excellent Profiles (85–100)', value: excellentCount, note: 'Top scholarship tier' },
    { label: 'Requiring Improvement (<50)', value: needsImprovementCount, note: 'Priority coaching needed' },
    { label: 'Completed Assessments', value: completedCount, note: `Avg normalized score: ${avgScore}/100` },
  ];

  return (
    <div className="space-y-8">
      {/* Executive Banner */}
      <section className="bg-[#0B1F3A] text-white rounded-xl border border-[#1D3E6E] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wider text-[#D9B45B] mb-2">
            {settings.companyName}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight text-balance">
            {settings.applicationName}
          </h2>
          <p className="text-sm sm:text-base text-slate-300 mt-2 leading-relaxed">
            {settings.tagline}. Evaluate academic qualifications, research capabilities, and English proficiency on a
            standardized 100-mark rubric with AI-powered international scholarship and supervisor matching.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('register')}
            className="px-5 py-2.5 rounded-lg bg-[#C69B3A] hover:bg-[#D9B45B] text-[#071426] font-semibold text-sm flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Start Assessment (Upload CV or Manual)</span>
          </button>
          <button
            onClick={() => onNavigate('academic')}
            className="px-4 py-2.5 rounded-lg border border-white/25 hover:bg-white/10 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            View Assessments
          </button>
        </div>
      </section>

      {/* Live Computed KPI Strip */}
      <section aria-label="Consultancy Summary Statistics">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-base font-semibold text-[#0B1F3A]">Live Portfolio Overview</h3>
          <span className="text-xs text-slate-500">
            Computed directly from {totalCandidates} registered record{totalCandidates === 1 ? '' : 's'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((item) => (
            <div
              key={item.label}
              className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between"
            >
              <span className="text-xs font-medium text-slate-500">{item.label}</span>
              <span className="text-3xl font-bold text-[#0B1F3A] tabular-nums font-mono mt-2 mb-1">
                {item.value}
              </span>
              <span className="text-xs text-slate-500">{item.note}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Pathway Quick Access & Recent Candidates */}
      {totalCandidates === 0 ? (
        <section className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#FAF3E0] text-[#A88026] flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-[#0B1F3A] mb-2">No Registered Candidates Yet</h3>
          <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6 leading-relaxed">
            All dashboard counts and assessment analytics derive strictly from real registered candidates. Register your
            first applicant to generate a 100-mark evaluation, AI scholarship screening, and PDF dossier.
          </p>
          <button
            onClick={() => onNavigate('register')}
            className="px-5 py-2.5 rounded-lg bg-[#0B1F3A] hover:bg-[#132D52] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register First Candidate</span>
          </button>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Recent Candidate Assessments Table */}
          <section className="lg:col-span-8 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[#0B1F3A]">Recent Candidate Evaluations</h3>
                <p className="text-xs text-slate-500">Click any candidate to inspect academic, research, or AI reports</p>
              </div>
              <button
                onClick={() => onNavigate('database')}
                className="text-xs font-semibold text-[#0B1F3A] hover:text-[#A88026] flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Candidate</th>
                    <th className="py-2.5 px-4">Pathway</th>
                    <th className="py-2.5 px-4 text-right">Normalized</th>
                    <th className="py-2.5 px-4">Classification</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidates.slice(0, 8).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#0B1F3A]">{c.personalInfo.fullName}</div>
                        <div className="text-xs text-slate-500">
                          {c.referenceCode} · {c.personalInfo.nationality || 'Nationality N/A'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div>{c.intendedProgramme.intendedDegree}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[180px]">
                          {c.intendedProgramme.preferredResearchField || 'General'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#0B1F3A]">
                        {c.assessment.normalizedScore.toFixed(1)}
                        <span className="text-xs font-normal text-slate-400"> / 100</span>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-700">
                        {c.assessment.classification}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onSelectCandidate(c.id, 'academic')}
                          className="text-xs font-semibold text-[#0B1F3A] hover:text-[#A88026] underline-offset-4 hover:underline whitespace-nowrap"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Classification Distribution */}
          <section className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-base font-semibold text-[#0B1F3A]">Competitiveness Distribution</h3>
            <div className="space-y-3">
              {(
                [
                  { label: 'Excellent (85–100)', cls: 'Excellent', bar: 'bg-emerald-600', icon: Award },
                  { label: 'Very Good (75–84)', cls: 'Very Good', bar: 'bg-[#0B1F3A]', icon: FileCheck2 },
                  { label: 'Good (65–74)', cls: 'Good', bar: 'bg-[#C69B3A]', icon: GraduationCap },
                  { label: 'Average (50–64)', cls: 'Average', bar: 'bg-amber-500', icon: AlertTriangle },
                  { label: 'Needs Improvement (<50)', cls: 'Needs Improvement', bar: 'bg-red-600', icon: AlertTriangle },
                ] as const
              ).map((tier) => {
                const count = candidates.filter((c) => c.assessment.classification === tier.cls).length;
                const pct = totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0;
                return (
                  <div key={tier.cls} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-medium">{tier.label}</span>
                      <span className="font-mono tabular-nums text-slate-600">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full ${tier.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-200 text-xs text-slate-500 leading-relaxed">
              Evidence Mode: <strong className="text-slate-700">{settings.strictEvidenceMode ? 'Strict Verification' : 'Provisional Advisory'}</strong>. Scores reflect preliminary profile evaluation and do not guarantee admission or funding.
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
