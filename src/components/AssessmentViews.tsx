import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  MinusCircle,
  Edit3,
  ArrowRight,
  FileText,
  Download,
  Sparkles,
  Loader2,
  Upload,
} from 'lucide-react';
import type { Candidate, CategoryScore, ConsultancySettings } from '../types/scholarship';
import { apiClient } from '../api/client';
import { generateCandidatePdfReport } from '../utils/pdfReport';
import { CREST_IMAGE_URL } from './AuthGate';

interface AssessmentViewsProps {
  mode: 'academic' | 'research';
  candidate: Candidate | null;
  settings: ConsultancySettings;
  onEditCandidate: (candidate: Candidate) => void;
  onCandidateUpdated: (updated: Candidate) => void;
  onNavigate: (section: string) => void;
}

function StatusBadge({ cat }: { cat: CategoryScore }) {
  if (cat.status === 'not_applicable') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
        <MinusCircle className="w-3.5 h-3.5" />
        <span>Not Applicable</span>
      </span>
    );
  }
  if (cat.status === 'missing') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
        <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
        <span>Missing Info</span>
      </span>
    );
  }
  if (cat.status === 'unverified') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Unverified (Projected: {cat.projectedMarks}/{cat.maxMarks})</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
      <CheckCircle2 className="w-3.5 h-3.5" />
      <span>Verified</span>
    </span>
  );
}

export const AssessmentViews: React.FC<AssessmentViewsProps> = ({
  mode,
  candidate,
  settings,
  onEditCandidate,
  onCandidateUpdated,
  onNavigate,
}) => {
  const [runningFullAi, setRunningFullAi] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!candidate) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-4">
        <h3 className="text-lg font-bold text-[#0B1F3A]">Start a New Profile Assessment</h3>
        <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
          Upload a candidate&apos;s CV, transcripts, or research proposal for AI extraction—or enter qualifications
          manually—to compute their 100-mark score and generate full AI scholarship &amp; university recommendations.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigate('register')}
            className="px-5 py-2.5 rounded-lg bg-[#C69B3A] hover:bg-[#D9B45B] text-[#071426] text-xs font-bold inline-flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Documents or Fill Manually</span>
          </button>
          <button
            onClick={() => onNavigate('database')}
            className="px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Select Existing Candidate
          </button>
        </div>
      </div>
    );
  }

  const handleRunFullAssessment = async () => {
    setAiError(null);
    setAiMessage(null);
    setRunningFullAi(true);
    try {
      const res = await apiClient.runFullAiAssessment(candidate.id);
      onCandidateUpdated(res.candidate);
      if (res.warnings.length > 0) {
        setAiMessage(`Assessment completed with notes: ${res.warnings.join(' | ')}`);
      } else {
        setAiMessage('Complete AI Assessment generated across Eligibility, Scholarships, Supervisors, and Improvement Plan.');
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to run complete AI assessment.');
    } finally {
      setRunningFullAi(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await generateCandidatePdfReport(candidate, settings, CREST_IMAGE_URL);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const a = candidate.assessment;

  if (mode === 'academic') {
    return (
      <div className="space-y-6">
        {/* Candidate Summary & One-Click Full Assessment Bar */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="text-xs font-medium text-slate-500">
              {candidate.referenceCode} · {candidate.intendedProgramme.intendedDegree} Pathway ·{' '}
              {candidate.intendedProgramme.preferredResearchField || 'General Field'}
            </p>
            <h2 className="text-2xl font-bold text-[#0B1F3A] mt-1">{candidate.personalInfo.fullName}</h2>
            <p className="text-xs text-slate-600 mt-1">
              {candidate.personalInfo.nationality || 'Nationality N/A'} · Target Countries:{' '}
              {candidate.intendedProgramme.preferredCountries.join(', ') || 'Flexible'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="text-xs text-slate-500">Normalized Score</div>
              <div className="text-3xl font-bold font-mono tabular-nums text-[#0B1F3A]">
                {a.normalizedScore.toFixed(1)}
                <span className="text-sm font-normal text-slate-400"> / 100</span>
              </div>
              <div className="text-xs text-slate-500 font-mono tabular-nums">
                {a.totalObtained} / {a.totalApplicableMax} applicable marks
              </div>
            </div>

            <div className="pl-6 border-l border-slate-200">
              <div className="text-xs text-slate-500">Classification</div>
              <div className="text-lg font-bold text-[#A88026]">{a.classification}</div>
              <button
                onClick={() => onEditCandidate(candidate)}
                className="mt-1 text-xs font-semibold text-[#0B1F3A] hover:text-[#A88026] inline-flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Update Profile &amp; Docs</span>
              </button>
            </div>
          </div>
        </section>

        {/* Assessment Actions Toolbar */}
        <section className="bg-[#0B1F3A] text-white rounded-xl border border-[#1D3E6E] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-slate-200">
            <strong className="text-white">AI Profile Assessment &amp; Results:</strong> Generate eligibility screening,
            live university/scholarship matches, supervisor matches, and improvement plan in one step.
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={runningFullAi}
              onClick={handleRunFullAssessment}
              className="px-4 py-2 rounded-lg bg-[#C69B3A] hover:bg-[#D9B45B] text-[#071426] text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
            >
              {runningFullAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{runningFullAi ? 'Running Full AI Assessment...' : 'Run Complete AI Assessment'}</span>
            </button>
            <button
              type="button"
              disabled={downloadingPdf}
              onClick={handleDownloadPdf}
              className="px-4 py-2 rounded-lg border border-white/25 hover:bg-white/10 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}</span>
            </button>
          </div>
        </section>

        {aiMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs">
            {aiMessage}
          </div>
        )}
        {aiError && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs">
            {aiError}
          </div>
        )}

        {/* Sub-score Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Academic Score', val: a.subScores.academicObtained, max: a.subScores.academicMax },
            { label: 'Research Score', val: a.subScores.researchObtained, max: a.subScores.researchMax },
            { label: 'English Proficiency', val: a.subScores.englishObtained, max: a.subScores.englishMax },
            { label: 'Experience Score', val: a.subScores.experienceObtained, max: a.subScores.experienceMax },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-medium">{s.label}</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#0B1F3A] mt-1">
                {s.max > 0 ? `${s.val} / ${s.max}` : 'N/A'}
              </div>
            </div>
          ))}
        </div>

        {/* Preliminary Disclaimer */}
        <div className="bg-[#FAF3E0] border border-[#C69B3A]/40 rounded-xl p-4 text-xs text-[#0B1F3A] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span>
            <strong>Preliminary Assessment Notice:</strong> This 100-mark score is a structured consultancy screening
            benchmark and does not guarantee university admission or scholarship funding.
          </span>
          <button
            onClick={() => onNavigate('register')}
            className="px-3.5 py-1.5 rounded-lg bg-[#0B1F3A] text-white font-semibold inline-flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
          >
            <span>Assess Another Candidate</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 10-Category Breakdown Table */}
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-base font-bold text-[#0B1F3A]">10-Category Transparent Scoring Breakdown</h3>
            <p className="text-xs text-slate-500">
              Formula: Normalized Score = (Marks Obtained ÷ Maximum Applicable Marks) × 100
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {a.categories.map((cat) => (
              <div key={cat.id} className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <div className="lg:col-span-4">
                  <div className="font-semibold text-sm text-[#0B1F3A]">
                    {cat.id}. {cat.name}
                  </div>
                  <div className="mt-1">
                    <StatusBadge cat={cat} />
                  </div>
                </div>
                <div className="lg:col-span-6 text-xs text-slate-700 space-y-1">
                  <p>{cat.explanation}</p>
                  {cat.details.length > 0 && (
                    <ul className="text-slate-500 space-y-0.5 pt-1">
                      {cat.details.map((d, i) => (
                        <li key={i}>· {d}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="lg:col-span-2 lg:text-right font-mono tabular-nums">
                  <div className="text-lg font-bold text-[#0B1F3A]">
                    {cat.applicable ? `${cat.marksObtained} / ${cat.maxMarks}` : 'N/A'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Integrated AI Assessment Results Summary */}
        {(candidate.aiEligibility || candidate.scholarshipMatches || candidate.improvementPlan) && (
          <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <div className="border-b border-slate-200 pb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#0B1F3A]">AI Assessment &amp; Matching Results</h3>
                <p className="text-xs text-slate-500">
                  Generated summary across degree eligibility, university matches, and improvement plan
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onNavigate('eligibility')}
                  className="text-xs font-semibold text-[#0B1F3A] hover:text-[#A88026] underline"
                >
                  Full Eligibility View
                </button>
                <span className="text-slate-300">·</span>
                <button
                  onClick={() => onNavigate('matching')}
                  className="text-xs font-semibold text-[#0B1F3A] hover:text-[#A88026] underline"
                >
                  Full University &amp; Supervisor Matches
                </button>
              </div>
            </div>

            {candidate.aiEligibility && (
              <div className="space-y-3">
                <p className="text-xs text-slate-700 leading-relaxed">
                  <strong>Executive AI Evaluation:</strong> {candidate.aiEligibility.executiveSummary}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {candidate.aiEligibility.pathways.map((pw) => (
                    <div key={pw.pathway} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                      <div className="font-bold text-[#0B1F3A]">{pw.pathway}</div>
                      <div className="font-semibold text-[#A88026] mt-0.5">{pw.overallStatus}</div>
                      <p className="text-slate-600 mt-1">{pw.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {candidate.scholarshipMatches && candidate.scholarshipMatches.opportunities.length > 0 && (
              <div className="text-xs space-y-2">
                <div className="font-bold text-[#0B1F3A]">
                  Matched International Scholarships ({candidate.scholarshipMatches.opportunities.length})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {candidate.scholarshipMatches.opportunities.slice(0, 4).map((o) => (
                    <div key={o.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="font-semibold text-[#0B1F3A]">{o.scholarshipName}</div>
                      <div className="text-slate-600">
                        {o.university} ({o.country}) · {o.fundingCoverage}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {candidate.improvementPlan && candidate.improvementPlan.items.length > 0 && (
              <div className="text-xs space-y-2">
                <div className="font-bold text-[#0B1F3A]">Priority Improvement Roadmap</div>
                <div className="space-y-1.5">
                  {candidate.improvementPlan.items.slice(0, 4).map((it) => (
                    <div key={it.id} className="text-slate-700">
                      · <strong>[{it.priority}] {it.actionTitle}:</strong> {it.targetMetric} ({it.timeline})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Strengths, Weaknesses, Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-2.5">
            <h4 className="text-sm font-bold text-emerald-800">Identified Strengths</h4>
            <ul className="text-xs text-slate-700 space-y-2">
              {a.strengths.map((s, i) => (
                <li key={i}>· {s}</li>
              ))}
            </ul>
          </section>
          <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-2.5">
            <h4 className="text-sm font-bold text-amber-800">Key Weaknesses &amp; Gaps</h4>
            <ul className="text-xs text-slate-700 space-y-2">
              {a.weaknesses.length === 0 ? (
                <li>· No critical weaknesses detected.</li>
              ) : (
                a.weaknesses.map((w, i) => <li key={i}>· {w}</li>)
              )}
            </ul>
          </section>
          <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-2.5">
            <h4 className="text-sm font-bold text-[#0B1F3A]">Improvement Recommendations</h4>
            <ul className="text-xs text-slate-700 space-y-2">
              {a.recommendations.map((r, i) => (
                <li key={i}>· {r}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    );
  }

  // RESEARCH ASSESSMENT VIEW
  const rp = candidate.researchProfile;
  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">
            {candidate.referenceCode} · Research &amp; Scholarly Output Audit
          </p>
          <h2 className="text-2xl font-bold text-[#0B1F3A]">{candidate.personalInfo.fullName}</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-slate-500">Research Domain Score</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#0B1F3A]">
              {a.subScores.researchObtained} / {a.subScores.researchMax || 'N/A'}
            </div>
          </div>
          <button
            onClick={() => onNavigate('matching')}
            className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold whitespace-nowrap"
          >
            Match Supervisors
          </button>
        </div>
      </section>

      {/* Thesis & Research Profile */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h3 className="text-base font-bold text-[#0B1F3A]">Research Profile &amp; Methodology</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs font-semibold text-slate-500">Previous Thesis Title</div>
            <div className="text-slate-900 mt-0.5">{rp.previousThesisTitle || 'Not provided'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Intended Research Topic</div>
            <div className="text-slate-900 mt-0.5">{rp.intendedResearchTopic || 'Not provided'}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-slate-500">Research Abstract</div>
            <div className="text-slate-700 text-xs leading-relaxed mt-0.5">
              {rp.researchAbstract || 'No research abstract recorded.'}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Research Interests</div>
            <div className="text-slate-800 text-xs mt-0.5">{rp.researchInterests || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Methodology &amp; Techniques</div>
            <div className="text-slate-800 text-xs mt-0.5">
              {rp.researchMethodology || '—'} · {rp.researchTechniques || '—'}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Laboratory Expertise</div>
            <div className="text-slate-800 text-xs mt-0.5">{rp.laboratoryExpertise || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Data Analysis &amp; Scientific Software</div>
            <div className="text-slate-800 text-xs mt-0.5">
              {rp.dataAnalysisSkills || '—'} · {rp.scientificSoftware || '—'}
            </div>
          </div>
        </div>
      </section>

      {/* Publications Table */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#0B1F3A]">
            Publications ({candidate.publications.length})
          </h3>
          <span className="text-xs font-mono tabular-nums font-semibold text-[#0B1F3A]">
            Category 1: {a.categories[0].applicable ? `${a.categories[0].marksObtained}/10` : 'N/A'}
          </span>
        </div>
        {candidate.publications.length === 0 ? (
          <p className="p-6 text-xs text-slate-500">No publications recorded for this candidate.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-4">Title &amp; Journal</th>
                  <th className="py-2.5 px-4">Indexing</th>
                  <th className="py-2.5 px-4">Quartile</th>
                  <th className="py-2.5 px-4">Authorship</th>
                  <th className="py-2.5 px-4">DOI / URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidate.publications.map((p) => {
                  const isDup = a.duplicatePublicationIds.includes(p.id);
                  return (
                    <tr key={p.id} className={isDup ? 'bg-amber-50/60' : ''}>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#0B1F3A]">
                          {p.title || 'Untitled'} {isDup ? '(Duplicate Excluded)' : ''}
                        </div>
                        <div className="text-slate-500">
                          {p.journalName} · {p.publicationYear} · {p.publicationType}
                        </div>
                      </td>
                      <td className="py-3 px-4">{p.indexing}</td>
                      <td className="py-3 px-4 font-mono">{p.quartile}</td>
                      <td className="py-3 px-4">{p.authorship}</td>
                      <td className="py-3 px-4 font-mono text-slate-600 truncate max-w-[180px]">
                        {p.doiOrUrl || 'Missing DOI'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Conferences & Experience */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0B1F3A]">Conferences ({candidate.conferences.length})</h3>
            <span className="text-xs font-mono tabular-nums font-semibold">
              {a.categories[6].applicable ? `${a.categories[6].marksObtained}/10` : 'N/A'}
            </span>
          </div>
          {candidate.conferences.length === 0 ? (
            <p className="text-xs text-slate-500">No conference presentations recorded.</p>
          ) : (
            <div className="space-y-2.5">
              {candidate.conferences.map((cf) => (
                <div key={cf.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <div className="font-semibold text-[#0B1F3A]">{cf.title}</div>
                  <div className="text-slate-600 mt-0.5">
                    {cf.scope} · {cf.presentationType} · {cf.year}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0B1F3A]">
              Experience ({a.experienceSummary.yearsDisplay})
            </h3>
            <span className="text-xs font-mono tabular-nums font-semibold">
              {a.categories[7].applicable ? `${a.categories[7].marksObtained}/10` : 'N/A'}
            </span>
          </div>
          {candidate.experiences.length === 0 ? (
            <p className="text-xs text-slate-500">No research or professional experience recorded.</p>
          ) : (
            <div className="space-y-2.5">
              {candidate.experiences.map((ex) => (
                <div key={ex.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <div className="font-semibold text-[#0B1F3A]">
                    {ex.jobTitle} — {ex.organization}
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    {ex.experienceType} · {ex.startDate} to {ex.isCurrent ? 'Present' : ex.endDate}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Secure Uploaded Evidence */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#0B1F3A]">Uploaded Verification Documents ({candidate.documents.length})</h3>
        {candidate.documents.length === 0 ? (
          <p className="text-xs text-slate-500">No documents uploaded yet. Edit candidate to attach supporting files.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {candidate.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0B1F3A] shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 truncate">{doc.originalName}</div>
                    <div className="text-[11px] text-slate-500">{doc.category.replace('_', ' ')}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => apiClient.downloadDocument(candidate.id, doc)}
                  className="p-1.5 rounded hover:bg-white text-[#0B1F3A]"
                  title="Download secure document"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
