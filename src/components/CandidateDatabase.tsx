import React, { useMemo, useState } from 'react';
import {
  Search,
  Edit3,
  Trash2,
  Eye,
  Download,
  GitCompare,
  UserPlus,
  X,
} from 'lucide-react';
import { SUPPORTED_COUNTRIES, type Candidate, type UserRole } from '../types/scholarship';
import { apiClient } from '../api/client';

interface CandidateDatabaseProps {
  candidates: Candidate[];
  userRole: UserRole;
  onSelectCandidate: (candidateId: string, targetSection: string) => void;
  onEditCandidate: (candidate: Candidate) => void;
  onDeleteCandidate: (candidateId: string) => Promise<void>;
  onStatusChange: (candidateId: string, status: Candidate['assessmentStatus']) => Promise<void>;
  onNavigateRegister: () => void;
}

export const CandidateDatabase: React.FC<CandidateDatabaseProps> = ({
  candidates,
  userRole,
  onSelectCandidate,
  onEditCandidate,
  onDeleteCandidate,
  onStatusChange,
  onNavigateRegister,
}) => {
  const [searchName, setSearchName] = useState('');
  const [filterNationality, setFilterNationality] = useState('');
  const [filterDegree, setFilterDegree] = useState('');
  const [filterMinScore, setFilterMinScore] = useState('');
  const [filterField, setFilterField] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const nationalities = useMemo(
    () => Array.from(new Set(candidates.map((c) => c.personalInfo.nationality).filter(Boolean))).sort(),
    [candidates]
  );

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (searchName && !c.personalInfo.fullName.toLowerCase().includes(searchName.toLowerCase())) {
        return false;
      }
      if (filterNationality && c.personalInfo.nationality !== filterNationality) {
        return false;
      }
      if (filterDegree && c.intendedProgramme.intendedDegree !== filterDegree) {
        return false;
      }
      if (filterMinScore !== '' && c.assessment.normalizedScore < Number(filterMinScore)) {
        return false;
      }
      if (
        filterField &&
        !c.intendedProgramme.preferredResearchField.toLowerCase().includes(filterField.toLowerCase())
      ) {
        return false;
      }
      if (filterCountry && !c.intendedProgramme.preferredCountries.includes(filterCountry)) {
        return false;
      }
      return true;
    });
  }, [candidates, searchName, filterNationality, filterDegree, filterMinScore, filterField, filterCountry]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const comparedCandidates = useMemo(
    () => candidates.filter((c) => compareIds.includes(c.id)),
    [candidates, compareIds]
  );

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      await onDeleteCandidate(confirmDeleteId);
      setCompareIds((prev) => prev.filter((id) => id !== confirmDeleteId));
      setConfirmDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#0B1F3A]">Candidate Database</h2>
            <p className="text-xs text-slate-500">
              Showing {filtered.length} of {candidates.length} authorized candidate profile(s)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {compareIds.length >= 2 && (
              <button
                type="button"
                onClick={() => setShowCompare(true)}
                className="px-3.5 py-2 rounded-lg bg-[#FAF3E0] border border-[#C69B3A]/50 text-[#0B1F3A] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                <GitCompare className="w-4 h-4" />
                <span>Compare Selected ({compareIds.length})</span>
              </button>
            )}
            {userRole === 'admin' && candidates.length > 0 && (
              <button
                type="button"
                onClick={() => apiClient.exportCandidatesJson()}
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>Export Data</span>
              </button>
            )}
            <button
              type="button"
              onClick={onNavigateRegister}
              className="px-4 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#132D52] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register Candidate</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Search name..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
          </div>
          <select
            value={filterNationality}
            onChange={(e) => setFilterNationality(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
          >
            <option value="">All Nationalities</option>
            {nationalities.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <select
            value={filterDegree}
            onChange={(e) => setFilterDegree(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
          >
            <option value="">All Degrees</option>
            <option value="Bachelor's">Bachelor&apos;s</option>
            <option value="Master's">Master&apos;s</option>
            <option value="MS">MS</option>
            <option value="MPhil">MPhil</option>
            <option value="PhD">PhD</option>
          </select>
          <select
            value={filterMinScore}
            onChange={(e) => setFilterMinScore(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
          >
            <option value="">Any Score</option>
            <option value="85">85+ (Excellent)</option>
            <option value="75">75+ (Very Good+)</option>
            <option value="65">65+ (Good+)</option>
            <option value="50">50+ (Average+)</option>
          </select>
          <input
            type="text"
            value={filterField}
            onChange={(e) => setFilterField(e.target.value)}
            placeholder="Research field..."
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
          />
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
          >
            <option value="">Any Target Country</option>
            {SUPPORTED_COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No candidates match the active filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 w-10">Cmp</th>
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Pathway &amp; Field</th>
                  <th className="py-3 px-4">Target Countries</th>
                  <th className="py-3 px-4 text-right">Score</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={compareIds.includes(c.id)}
                        onChange={() => toggleCompare(c.id)}
                        aria-label={`Select ${c.personalInfo.fullName} for comparison`}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#0B1F3A]">{c.personalInfo.fullName}</div>
                      <div className="text-xs text-slate-500">
                        {c.referenceCode} · {c.personalInfo.nationality || 'Nationality N/A'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{c.intendedProgramme.intendedDegree}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[190px]">
                        {c.intendedProgramme.preferredResearchField || 'Not specified'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-[180px] truncate">
                      {c.intendedProgramme.preferredCountries.join(', ') || 'Flexible'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-[#0B1F3A]">
                      {c.assessment.normalizedScore.toFixed(1)}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">
                      {c.assessment.classification}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={c.assessmentStatus}
                        onChange={(e) =>
                          onStatusChange(c.id, e.target.value as Candidate['assessmentStatus'])
                        }
                        className="px-2 py-1 rounded border border-slate-200 text-xs bg-white"
                      >
                        <option value="draft">Draft</option>
                        <option value="in_review">In Review</option>
                        <option value="completed">Completed</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectCandidate(c.id, 'academic')}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-[#0B1F3A]"
                          title="View full assessment"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditCandidate(c)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700"
                          title="Edit candidate"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {userRole === 'admin' && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(c.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
                            title="Delete candidate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Candidate Comparison Modal */}
      {showCompare && comparedCandidates.length >= 2 && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-5xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#0B1F3A]">Side-by-Side Candidate Comparison</h3>
              <button type="button" onClick={() => setShowCompare(false)} className="p-1 text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto p-6">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2.5 pr-4 font-semibold text-slate-600">Dimension</th>
                    {comparedCandidates.map((c) => (
                      <th key={c.id} className="py-2.5 px-3 font-bold text-[#0B1F3A]">
                        {c.personalInfo.fullName}
                        <div className="font-normal text-slate-500">{c.intendedProgramme.intendedDegree}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 pr-4 font-semibold text-slate-700">Normalized Score</td>
                    {comparedCandidates.map((c) => (
                      <td key={c.id} className="py-2.5 px-3 font-mono tabular-nums font-bold text-[#0B1F3A]">
                        {c.assessment.normalizedScore.toFixed(1)} / 100 ({c.assessment.classification})
                      </td>
                    ))}
                  </tr>
                  {comparedCandidates[0].assessment.categories.map((cat, idx) => (
                    <tr key={cat.key}>
                      <td className="py-2 pr-4 text-slate-600">{cat.name}</td>
                      {comparedCandidates.map((c) => {
                        const item = c.assessment.categories[idx];
                        return (
                          <td key={c.id} className="py-2 px-3 font-mono tabular-nums text-slate-800">
                            {item.applicable ? `${item.marksObtained} / ${item.maxMarks}` : 'N/A'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#0B1F3A]">Confirm Candidate Deletion</h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to permanently delete this candidate profile and all uploaded documents? This action
              cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
