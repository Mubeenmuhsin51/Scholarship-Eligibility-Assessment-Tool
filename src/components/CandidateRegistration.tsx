import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Upload,
  AlertCircle,
  Save,
  FileText,
  Download,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  DOCUMENT_CATEGORIES,
  SUPPORTED_COUNTRIES,
  type Candidate,
  type ConferenceItem,
  type ConsultancySettings,
  type DocumentCategory,
  type EnglishTestType,
  type ExperienceItem,
  type IntendedDegree,
  type IntakeTerm,
  type PublicationItem,
} from '../types/scholarship';
import {
  calculateExperienceDurationMonths,
  calculatePercentage,
  detectDuplicatePublications,
  evaluateCandidateAssessment,
  formatMonthsAsYears,
  normalizeCgpa,
} from '../utils/scoringEngine';
import { apiClient } from '../api/client';

interface CandidateRegistrationProps {
  editingCandidate: Candidate | null;
  settings: ConsultancySettings;
  onSaved: (candidate: Candidate, isEdit: boolean) => void;
  onCancel: () => void;
}

const STEPS = [
  'Personal Info',
  'Intended Programme',
  'Academic Qualifications',
  'English Proficiency',
  'Publications',
  'Conferences',
  'Experience',
  'Research Profile',
  'Document Upload',
] as const;

type FormState = Omit<
  Candidate,
  'id' | 'referenceCode' | 'assessment' | 'createdBy' | 'createdAt' | 'updatedAt'
>;

function createEmptyForm(): FormState {
  return {
    personalInfo: {
      fullName: '',
      email: '',
      contactNumber: '',
      nationality: '',
      countryOfResidence: '',
      dateOfBirth: '',
      age: undefined,
      gender: '',
      currentLocation: '',
    },
    intendedProgramme: {
      intendedDegree: 'PhD',
      preferredResearchField: '',
      preferredCountries: ['Germany', 'United Kingdom'],
      intendedAdmissionYear: new Date().getFullYear() + 1,
      preferredIntake: 'Fall',
    },
    qualifications: {
      matriculation: {
        status: 'completed',
        institution: '',
        obtainedMarks: '',
        totalMarks: '',
        percentage: '',
        evidenceVerified: false,
      },
      intermediate: {
        status: 'completed',
        institution: '',
        obtainedMarks: '',
        totalMarks: '',
        percentage: '',
        evidenceVerified: false,
      },
      bachelors: {
        status: 'completed',
        degreeTitle: '',
        university: '',
        country: '',
        cgpa: '',
        totalScale: 4.0,
        completionYear: '',
        evidenceVerified: false,
      },
      masters: {
        status: 'not_completed',
        degreeTitle: '',
        university: '',
        country: '',
        cgpa: '',
        totalScale: 4.0,
        completionYear: '',
        evidenceVerified: false,
      },
    },
    englishProficiency: {
      testType: 'IELTS',
      overallScore: '',
      listening: '',
      reading: '',
      writing: '',
      speaking: '',
      testDate: '',
      validityDate: '',
      certificateNumber: '',
      evidenceVerified: false,
    },
    publications: [],
    conferences: [],
    experiences: [],
    researchProfile: {
      previousThesisTitle: '',
      researchAbstract: '',
      researchInterests: '',
      researchMethodology: '',
      researchTechniques: '',
      laboratoryExpertise: '',
      dataAnalysisSkills: '',
      scientificSoftware: '',
      researchProposalAvailable: false,
      intendedResearchTopic: '',
    },
    documents: [],
    assessmentStatus: 'completed',
    adminNotes: '',
  };
}

function candidateToFormState(c: Candidate): FormState {
  return {
    personalInfo: { ...c.personalInfo },
    intendedProgramme: { ...c.intendedProgramme },
    qualifications: {
      matriculation: { ...c.qualifications.matriculation },
      intermediate: { ...c.qualifications.intermediate },
      bachelors: { ...c.qualifications.bachelors },
      masters: { ...c.qualifications.masters },
    },
    englishProficiency: { ...c.englishProficiency },
    publications: c.publications.map((p) => ({ ...p })),
    conferences: c.conferences.map((cf) => ({ ...cf })),
    experiences: c.experiences.map((ex) => ({ ...ex })),
    researchProfile: { ...c.researchProfile },
    documents: [...c.documents],
    assessmentStatus: c.assessmentStatus,
    adminNotes: c.adminNotes || '',
  };
}

export const CandidateRegistration: React.FC<CandidateRegistrationProps> = ({
  editingCandidate,
  settings,
  onSaved,
  onCancel,
}) => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() =>
    editingCandidate ? candidateToFormState(editingCandidate) : createEmptyForm()
  );
  const [queuedFiles, setQueuedFiles] = useState<{ category: DocumentCategory; file: File }[]>([]);
  const [customCountry, setCustomCountry] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingMode, setSavingMode] = useState<'save' | 'full_ai'>('full_ai');
  const [extractingAi, setExtractingAi] = useState(false);
  const [aiExtractNote, setAiExtractNote] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const liveAssessment = useMemo(() => {
    const simulatedDocs = [
      ...form.documents,
      ...queuedFiles.map((q, i) => ({
        id: `queued_${i}`,
        category: q.category,
        originalName: q.file.name,
        mimeType: q.file.type,
        size: q.file.size,
        uploadedAt: new Date().toISOString(),
      })),
    ];
    return evaluateCandidateAssessment({ ...form, documents: simulatedDocs }, settings.strictEvidenceMode);
  }, [form, queuedFiles, settings.strictEvidenceMode]);

  const duplicatePubIds = useMemo(() => detectDuplicatePublications(form.publications), [form.publications]);

  const toggleCountry = (country: string) => {
    setForm((prev) => {
      const exists = prev.intendedProgramme.preferredCountries.includes(country);
      return {
        ...prev,
        intendedProgramme: {
          ...prev.intendedProgramme,
          preferredCountries: exists
            ? prev.intendedProgramme.preferredCountries.filter((c) => c !== country)
            : [...prev.intendedProgramme.preferredCountries, country],
        },
      };
    });
  };

  const addCustomCountry = () => {
    const clean = customCountry.trim();
    if (!clean) return;
    if (!form.intendedProgramme.preferredCountries.includes(clean)) {
      toggleCountry(clean);
    }
    setCustomCountry('');
  };

  const handleDobChange = (dob: string) => {
    let age = form.personalInfo.age;
    if (dob) {
      const d = new Date(dob);
      if (!Number.isNaN(d.getTime())) {
        const diff = Date.now() - d.getTime();
        const computed = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
        if (computed >= 10 && computed <= 100) age = computed;
      }
    }
    setForm((prev) => ({ ...prev, personalInfo: { ...prev.personalInfo, dateOfBirth: dob, age } }));
  };

  const addPublication = () => {
    const item: PublicationItem = {
      id: `pub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: '',
      journalName: '',
      publicationYear: new Date().getFullYear(),
      doiOrUrl: '',
      indexing: 'Scopus',
      quartile: 'Q1',
      authorship: 'First Author',
      publicationType: 'Journal Article',
      relevantToField: true,
      evidenceVerified: false,
    };
    setForm((prev) => ({ ...prev, publications: [...prev.publications, item] }));
  };

  const addConference = () => {
    const item: ConferenceItem = {
      id: `conf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: '',
      scope: 'International',
      presentationType: 'Oral',
      year: new Date().getFullYear(),
      evidenceReference: '',
      evidenceVerified: false,
    };
    setForm((prev) => ({ ...prev, conferences: [...prev.conferences, item] }));
  };

  const addExperience = () => {
    const item: ExperienceItem = {
      id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      organization: '',
      jobTitle: '',
      experienceType: 'Research',
      startDate: '',
      endDate: '',
      isCurrent: false,
      responsibilities: '',
      researchActivities: '',
      technicalExpertise: '',
      laboratorySkills: '',
      softwareSkills: '',
      evidenceVerified: false,
    };
    setForm((prev) => ({ ...prev, experiences: [...prev.experiences, item] }));
  };

  const handleFilePick = async (category: DocumentCategory, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    if (editingCandidate) {
      setUploadingDoc(true);
      try {
        let updatedCandidate = editingCandidate;
        for (const file of Array.from(files)) {
          const res = await apiClient.uploadDocument(editingCandidate.id, category, file);
          updatedCandidate = res.candidate;
        }
        setForm((prev) => ({ ...prev, documents: updatedCandidate.documents }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Document upload failed.');
      } finally {
        setUploadingDoc(false);
      }
    } else {
      const additions = Array.from(files).map((file) => ({ category, file }));
      setQueuedFiles((prev) => [...prev, ...additions]);
    }
  };

  const handleDeleteExistingDoc = async (docId: string) => {
    if (!editingCandidate) return;
    setError(null);
    try {
      const res = await apiClient.deleteDocument(editingCandidate.id, docId);
      setForm((prev) => ({ ...prev, documents: res.candidate.documents }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete document.');
    }
  };

  const handleAiDocumentExtract = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setAiExtractNote(null);
    setExtractingAi(true);
    const fileArray = Array.from(files);

    try {
      // Queue or upload the files as CV / Transcript supporting docs
      if (editingCandidate) {
        let updatedCandidate = editingCandidate;
        for (const f of fileArray) {
          const cat: DocumentCategory = f.name.toLowerCase().includes('transcript')
            ? 'transcripts'
            : f.name.toLowerCase().includes('proposal')
            ? 'research_proposal'
            : 'cv';
          const up = await apiClient.uploadDocument(editingCandidate.id, cat, f);
          updatedCandidate = up.candidate;
        }
        setForm((prev) => ({ ...prev, documents: updatedCandidate.documents }));
      } else {
        setQueuedFiles((prev) => [
          ...prev,
          ...fileArray.map((f) => ({
            category: (f.name.toLowerCase().includes('transcript')
              ? 'transcripts'
              : f.name.toLowerCase().includes('proposal')
              ? 'research_proposal'
              : 'cv') as DocumentCategory,
            file: f,
          })),
        ]);
      }

      const res = await apiClient.parseDocumentsWithAi(fileArray);
      const ext = res.extracted as Partial<FormState>;

      if (ext && Object.keys(ext).length > 0) {
        setForm((prev) => {
          const pi = (ext.personalInfo || {}) as Partial<FormState['personalInfo']>;
          const ip = (ext.intendedProgramme || {}) as Partial<FormState['intendedProgramme']>;
          const eq = (ext.qualifications || {}) as Partial<FormState['qualifications']>;
          const ep = (ext.englishProficiency || {}) as Partial<FormState['englishProficiency']>;
          const rp = (ext.researchProfile || {}) as Partial<FormState['researchProfile']>;

          const pubs = Array.isArray(ext.publications)
            ? ext.publications.map((p, idx) => ({
                id: `pub_ai_${Date.now()}_${idx}`,
                title: String(p.title || ''),
                journalName: String(p.journalName || ''),
                publicationYear: p.publicationYear ? Number(p.publicationYear) : new Date().getFullYear(),
                doiOrUrl: String(p.doiOrUrl || ''),
                indexing: (p.indexing || 'Scopus') as PublicationItem['indexing'],
                quartile: (p.quartile || 'N/A') as PublicationItem['quartile'],
                authorship: (p.authorship || 'First Author') as PublicationItem['authorship'],
                publicationType: (p.publicationType || 'Journal Article') as PublicationItem['publicationType'],
                relevantToField: true,
                evidenceVerified: false,
              }))
            : prev.publications;

          const confs = Array.isArray(ext.conferences)
            ? ext.conferences.map((c, idx) => ({
                id: `conf_ai_${Date.now()}_${idx}`,
                title: String(c.title || ''),
                scope: (c.scope === 'National' ? 'National' : 'International') as ConferenceItem['scope'],
                presentationType: (c.presentationType === 'Poster' ? 'Poster' : 'Oral') as ConferenceItem['presentationType'],
                year: c.year ? Number(c.year) : new Date().getFullYear(),
                evidenceReference: '',
                evidenceVerified: false,
              }))
            : prev.conferences;

          const exps = Array.isArray(ext.experiences)
            ? ext.experiences.map((ex, idx) => ({
                id: `exp_ai_${Date.now()}_${idx}`,
                organization: String(ex.organization || ''),
                jobTitle: String(ex.jobTitle || ''),
                experienceType: (ex.experienceType || 'Research') as ExperienceItem['experienceType'],
                startDate: String(ex.startDate || ''),
                endDate: String(ex.endDate || ''),
                isCurrent: Boolean(ex.isCurrent),
                responsibilities: String(ex.responsibilities || ''),
                researchActivities: String(ex.researchActivities || ''),
                technicalExpertise: String(ex.technicalExpertise || ''),
                laboratorySkills: String(ex.laboratorySkills || ''),
                softwareSkills: String(ex.softwareSkills || ''),
                evidenceVerified: false,
              }))
            : prev.experiences;

          return {
            ...prev,
            personalInfo: {
              ...prev.personalInfo,
              fullName: pi.fullName || prev.personalInfo.fullName,
              email: pi.email || prev.personalInfo.email,
              contactNumber: pi.contactNumber || prev.personalInfo.contactNumber,
              nationality: pi.nationality || prev.personalInfo.nationality,
              countryOfResidence: pi.countryOfResidence || prev.personalInfo.countryOfResidence,
              dateOfBirth: pi.dateOfBirth || prev.personalInfo.dateOfBirth,
              currentLocation: pi.currentLocation || prev.personalInfo.currentLocation,
            },
            intendedProgramme: {
              ...prev.intendedProgramme,
              intendedDegree: (ip.intendedDegree || prev.intendedProgramme.intendedDegree) as IntendedDegree,
              preferredResearchField: ip.preferredResearchField || prev.intendedProgramme.preferredResearchField,
              preferredCountries:
                Array.isArray(ip.preferredCountries) && ip.preferredCountries.length > 0
                  ? ip.preferredCountries
                  : prev.intendedProgramme.preferredCountries,
            },
            qualifications: {
              matriculation: { ...prev.qualifications.matriculation, ...(eq.matriculation || {}) },
              intermediate: { ...prev.qualifications.intermediate, ...(eq.intermediate || {}) },
              bachelors: { ...prev.qualifications.bachelors, ...(eq.bachelors || {}) },
              masters: { ...prev.qualifications.masters, ...(eq.masters || {}) },
            },
            englishProficiency: {
              ...prev.englishProficiency,
              ...(ep || {}),
            },
            publications: pubs.length > 0 ? pubs : prev.publications,
            conferences: confs.length > 0 ? confs : prev.conferences,
            experiences: exps.length > 0 ? exps : prev.experiences,
            researchProfile: {
              ...prev.researchProfile,
              ...(rp || {}),
              researchProposalAvailable:
                Boolean(rp.intendedResearchTopic) || prev.researchProfile.researchProposalAvailable,
            },
          };
        });
      }
      setAiExtractNote(res.extractionNotes || 'Document parsed. Review all steps and run your assessment.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to parse uploaded document(s).');
    } finally {
      setExtractingAi(false);
    }
  };

  const saveCandidateRecord = async (runAiAfterSave: boolean) => {
    setError(null);
    if (!form.personalInfo.fullName.trim() || !form.personalInfo.email.trim()) {
      setError('Candidate full name and email address in Step 1 are required.');
      setStep(0);
      return;
    }
    if (liveAssessment.validationWarnings.length > 0 && duplicatePubIds.size === 0) {
      const hardError = liveAssessment.validationWarnings.find(
        (w) =>
          w.includes('exceed') ||
          w.includes('must be between') ||
          w.includes('greater than zero') ||
          w.includes('earlier than') ||
          w.includes('future')
      );
      if (hardError) {
        setError(hardError);
        return;
      }
    }

    setSaving(true);
    setSavingMode(runAiAfterSave ? 'full_ai' : 'save');
    try {
      let savedCandidate: Candidate;
      if (editingCandidate) {
        const res = await apiClient.updateCandidate(editingCandidate.id, form);
        savedCandidate = res.candidate;
      } else {
        const res = await apiClient.createCandidate(form);
        savedCandidate = res.candidate;
        for (const item of queuedFiles) {
          const up = await apiClient.uploadDocument(savedCandidate.id, item.category, item.file);
          savedCandidate = up.candidate;
        }
      }

      if (runAiAfterSave) {
        const aiRes = await apiClient.runFullAiAssessment(savedCandidate.id);
        savedCandidate = aiRes.candidate;
      }

      onSaved(savedCandidate, Boolean(editingCandidate));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save candidate record.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveCandidateRecord(true);
  };

  return (
    <div className="space-y-6">
      {/* Header & Step Progress */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#0B1F3A]">
              {editingCandidate
                ? `Edit Candidate: ${editingCandidate.personalInfo.fullName}`
                : 'New Candidate Registration'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Step {step + 1} of {STEPS.length} · {STEPS[step]}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap self-start sm:self-auto"
          >
            Cancel
          </button>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1.5">
          {STEPS.map((label, idx) => {
            const active = idx === step;
            const visited = idx < step;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStep(idx)}
                className={`px-2 py-2 rounded-lg text-left transition-colors border ${
                  active
                    ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]'
                    : visited
                    ? 'bg-[#FAF3E0] text-[#0B1F3A] border-[#C69B3A]/40'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="text-[11px] font-mono tabular-nums opacity-80">0{idx + 1}</div>
                <div className="text-xs font-medium truncate">{label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Start: AI Document Upload & Auto-Fill */}
      <div className="bg-[#0B1F3A] text-white rounded-xl border border-[#1D3E6E] p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#D9B45B]">
            <Sparkles className="w-4 h-4" />
            <span>AI Profile Extraction &amp; Assessment</span>
          </div>
          <h3 className="text-base font-bold text-white">
            Upload CV, Transcripts, or Research Proposal to Auto-Fill
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl">
            Upload PDF, DOCX, TXT, or image files and AI will extract qualifications, test scores, publications, and
            experience into the 9 steps below—or fill the fields manually and click &ldquo;Save &amp; Run AI Assessment&rdquo;.
          </p>
        </div>
        <label className="px-4 py-2.5 rounded-lg bg-[#C69B3A] hover:bg-[#D9B45B] text-[#071426] text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 self-start md:self-auto">
          {extractingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          <span>{extractingAi ? 'Extracting Profile with AI...' : 'Upload Documents for AI Auto-Fill'}</span>
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
            multiple
            disabled={extractingAi}
            className="hidden"
            onChange={(e) => handleAiDocumentExtract(e.target.files)}
          />
        </label>
      </div>

      {aiExtractNote && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs flex items-start gap-2.5">
          <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
          <div>
            <strong>AI Extraction Summary:</strong> {aiExtractNote}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Main Step Form */}
        <form onSubmit={handleSubmit} className="xl:col-span-8 bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          {/* STEP 1: PERSONAL INFO */}
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#0B1F3A] border-b border-slate-200 pb-2">
                01. Personal Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={form.personalInfo.fullName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, personalInfo: { ...p.personalInfo, fullName: e.target.value } }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={form.personalInfo.email}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, personalInfo: { ...p.personalInfo, email: e.target.value } }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Number</label>
                  <input
                    type="tel"
                    value={form.personalInfo.contactNumber}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, personalInfo: { ...p.personalInfo, contactNumber: e.target.value } }))
                    }
                    placeholder="+92 300 0000000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nationality</label>
                  <input
                    type="text"
                    value={form.personalInfo.nationality}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, personalInfo: { ...p.personalInfo, nationality: e.target.value } }))
                    }
                    placeholder="e.g. Pakistani"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Country of Residence</label>
                  <input
                    type="text"
                    value={form.personalInfo.countryOfResidence}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        personalInfo: { ...p.personalInfo, countryOfResidence: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Current City / Location</label>
                  <input
                    type="text"
                    value={form.personalInfo.currentLocation}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, personalInfo: { ...p.personalInfo, currentLocation: e.target.value } }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={form.personalInfo.dateOfBirth}
                    onChange={(e) => handleDobChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Age</label>
                    <input
                      type="number"
                      min={12}
                      max={95}
                      value={form.personalInfo.age ?? ''}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          personalInfo: {
                            ...p.personalInfo,
                            age: e.target.value === '' ? undefined : Number(e.target.value),
                          },
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Gender (Optional)</label>
                    <select
                      value={form.personalInfo.gender || ''}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, personalInfo: { ...p.personalInfo, gender: e.target.value } }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                    >
                      <option value="">Prefer not to say</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: INTENDED PROGRAMME */}
          {step === 1 && (
            <div className="space-y-5">
              <h3 className="text-base font-bold text-[#0B1F3A] border-b border-slate-200 pb-2">
                02. Intended Academic Programme
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Intended Degree Pathway *</label>
                  <select
                    value={form.intendedProgramme.intendedDegree}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        intendedProgramme: {
                          ...p.intendedProgramme,
                          intendedDegree: e.target.value as IntendedDegree,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    <option value="Bachelor's">Bachelor&apos;s</option>
                    <option value="Master's">Master&apos;s</option>
                    <option value="MS">MS</option>
                    <option value="MPhil">MPhil</option>
                    <option value="PhD">PhD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preferred Research / Study Field
                  </label>
                  <input
                    type="text"
                    value={form.intendedProgramme.preferredResearchField}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        intendedProgramme: { ...p.intendedProgramme, preferredResearchField: e.target.value },
                      }))
                    }
                    placeholder="e.g. Biomedical Engineering, Machine Learning"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Intended Admission Year</label>
                  <input
                    type="number"
                    min={2025}
                    max={2035}
                    value={form.intendedProgramme.intendedAdmissionYear}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        intendedProgramme: {
                          ...p.intendedProgramme,
                          intendedAdmissionYear: Number(e.target.value) || new Date().getFullYear() + 1,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Preferred Intake</label>
                  <select
                    value={form.intendedProgramme.preferredIntake}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        intendedProgramme: { ...p.intendedProgramme, preferredIntake: e.target.value as IntakeTerm },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    <option value="Fall">Fall / Autumn</option>
                    <option value="Spring">Spring</option>
                    <option value="Summer">Summer</option>
                    <option value="Rolling / Flexible">Rolling / Flexible</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Preferred Study Countries ({form.intendedProgramme.preferredCountries.length} selected)
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {SUPPORTED_COUNTRIES.map((country) => {
                    const selected = form.intendedProgramme.preferredCountries.includes(country);
                    return (
                      <button
                        key={country}
                        type="button"
                        onClick={() => toggleCountry(country)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          selected
                            ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {country}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCountry}
                    onChange={(e) => setCustomCountry(e.target.value)}
                    placeholder="Add another country..."
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addCustomCountry}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: ACADEMIC QUALIFICATIONS */}
          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-base font-bold text-[#0B1F3A] border-b border-slate-200 pb-2">
                03. Academic Qualifications
              </h3>

              {/* School Qualifications: Matric & Intermediate */}
              {(
                [
                  { key: 'matriculation', title: 'Matriculation / O-Level / Secondary School' },
                  { key: 'intermediate', title: 'Intermediate / FSc / A-Level / High School' },
                ] as const
              ).map(({ key, title }) => {
                const q = form.qualifications[key];
                return (
                  <div key={key} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-[#0B1F3A]">{title}</h4>
                      <select
                        value={q.status}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            qualifications: {
                              ...p.qualifications,
                              [key]: { ...q, status: e.target.value as typeof q.status },
                            },
                          }))
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-medium"
                      >
                        <option value="completed">Completed</option>
                        <option value="not_completed">Not Yet Completed</option>
                        <option value="not_applicable">Not Applicable</option>
                      </select>
                    </div>

                    {q.status === 'completed' && (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Institution / Board</label>
                          <input
                            type="text"
                            value={q.institution}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                qualifications: {
                                  ...p.qualifications,
                                  [key]: { ...q, institution: e.target.value },
                                },
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Obtained Marks</label>
                          <input
                            type="number"
                            min={0}
                            value={q.obtainedMarks}
                            onChange={(e) => {
                              const obt = e.target.value === '' ? '' : Number(e.target.value);
                              const pct = calculatePercentage(obt, q.totalMarks);
                              setForm((p) => ({
                                ...p,
                                qualifications: {
                                  ...p.qualifications,
                                  [key]: {
                                    ...q,
                                    obtainedMarks: obt,
                                    percentage: pct !== '' ? pct : q.percentage,
                                  },
                                },
                              }));
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white font-mono tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Total Marks</label>
                          <input
                            type="number"
                            min={1}
                            value={q.totalMarks}
                            onChange={(e) => {
                              const tot = e.target.value === '' ? '' : Number(e.target.value);
                              const pct = calculatePercentage(q.obtainedMarks, tot);
                              setForm((p) => ({
                                ...p,
                                qualifications: {
                                  ...p.qualifications,
                                  [key]: {
                                    ...q,
                                    totalMarks: tot,
                                    percentage: pct !== '' ? pct : q.percentage,
                                  },
                                },
                              }));
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white font-mono tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Percentage (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            max={100}
                            value={q.percentage}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                qualifications: {
                                  ...p.qualifications,
                                  [key]: {
                                    ...q,
                                    percentage: e.target.value === '' ? '' : Number(e.target.value),
                                  },
                                },
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white font-mono tabular-nums"
                          />
                        </div>
                        <div className="sm:col-span-3 flex items-end pb-1">
                          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={q.evidenceVerified}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  qualifications: {
                                    ...p.qualifications,
                                    [key]: { ...q, evidenceVerified: e.target.checked },
                                  },
                                }))
                              }
                              className="rounded border-slate-300 text-[#0B1F3A]"
                            />
                            <span>Official transcript / certificate verified (or upload transcript in Step 9)</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Higher Qualifications: Bachelor's & Master's */}
              {(
                [
                  { key: 'bachelors', title: "Bachelor's / BS Qualification" },
                  { key: 'masters', title: "Master's / MS / MPhil Qualification" },
                ] as const
              ).map(({ key, title }) => {
                const q = form.qualifications[key];
                const norm = normalizeCgpa(q.cgpa, q.totalScale);
                return (
                  <div key={key} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-[#0B1F3A]">{title}</h4>
                        {q.status === 'completed' && norm !== null && (
                          <p className="text-xs text-slate-500 font-mono tabular-nums">
                            Normalized 4.00 Scale: {norm.toFixed(2)} / 4.00
                          </p>
                        )}
                      </div>
                      <select
                        value={q.status}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            qualifications: {
                              ...p.qualifications,
                              [key]: { ...q, status: e.target.value as typeof q.status },
                            },
                          }))
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-medium"
                      >
                        <option value="completed">Completed</option>
                        <option value="not_completed">Not Yet Completed</option>
                        <option value="not_applicable">Not Applicable</option>
                      </select>
                    </div>

                    {q.status === 'completed' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Degree Title</label>
                          <input
                            type="text"
                            value={q.degreeTitle}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                qualifications: {
                                  ...p.qualifications,
                                  [key]: { ...q, degreeTitle: e.target.value },
                                },
                              }))
                            }
                            placeholder="e.g. BS Computer Science"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">University</label>
                          <input
                            type="text"
                            value={q.university}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                qualifications: {
                                  ...p.qualifications,
                                  [key]: { ...q, university: e.target.value },
                                },
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Country</label>
                          <input
                            type="text"
                            value={q.country}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                qualifications: {
                                  ...p.qualifications,
                                  [key]: { ...q, country: e.target.value },
                                },
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Obtained CGPA</label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={q.cgpa}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                qualifications: {
                                  ...p.qualifications,
                                  [key]: { ...q, cgpa: e.target.value === '' ? '' : Number(e.target.value) },
                                },
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white font-mono tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Total CGPA Scale</label>
                          <input
                            type="number"
                            step="0.1"
                            min={0.1}
                            value={q.totalScale}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                qualifications: {
                                  ...p.qualifications,
                                  [key]: {
                                    ...q,
                                    totalScale: e.target.value === '' ? '' : Number(e.target.value),
                                  },
                                },
                              }))
                            }
                            placeholder="4.0, 5.0, 10.0, or 100"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white font-mono tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Completion Year</label>
                          <input
                            type="number"
                            min={1970}
                            max={new Date().getFullYear() + 2}
                            value={q.completionYear}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                qualifications: {
                                  ...p.qualifications,
                                  [key]: {
                                    ...q,
                                    completionYear: e.target.value === '' ? '' : Number(e.target.value),
                                  },
                                },
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white font-mono tabular-nums"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={q.evidenceVerified}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  qualifications: {
                                    ...p.qualifications,
                                    [key]: { ...q, evidenceVerified: e.target.checked },
                                  },
                                }))
                              }
                              className="rounded border-slate-300 text-[#0B1F3A]"
                            />
                            <span>Official degree / transcript verified (or upload document in Step 9)</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* STEP 4: ENGLISH PROFICIENCY */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#0B1F3A] border-b border-slate-200 pb-2">
                04. English Proficiency
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">English Qualification</label>
                  <select
                    value={form.englishProficiency.testType}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        englishProficiency: {
                          ...p.englishProficiency,
                          testType: e.target.value as EnglishTestType,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    <option value="IELTS">IELTS Academic</option>
                    <option value="TOEFL">TOEFL iBT</option>
                    <option value="PTE">PTE Academic</option>
                    <option value="Duolingo">Duolingo English Test</option>
                    <option value="MOI">Medium of Instruction (MOI) Certificate</option>
                    <option value="None">No English Test</option>
                  </select>
                </div>
                {form.englishProficiency.testType !== 'None' && form.englishProficiency.testType !== 'MOI' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Overall Score</label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      value={form.englishProficiency.overallScore}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          englishProficiency: {
                            ...p.englishProficiency,
                            overallScore: e.target.value === '' ? '' : Number(e.target.value),
                          },
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                    />
                  </div>
                )}
              </div>

              {form.englishProficiency.testType !== 'None' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Test Date</label>
                    <input
                      type="date"
                      value={form.englishProficiency.testDate}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          englishProficiency: { ...p.englishProficiency, testDate: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Validity Expiry Date</label>
                    <input
                      type="date"
                      value={form.englishProficiency.validityDate}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          englishProficiency: { ...p.englishProficiency, validityDate: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Certificate / TRF Reference No.
                    </label>
                    <input
                      type="text"
                      value={form.englishProficiency.certificateNumber}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          englishProficiency: { ...p.englishProficiency, certificateNumber: e.target.value },
                        }))
                      }
                      placeholder="TRF or Certificate ID"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                    />
                  </div>
                </div>
              )}

              {form.englishProficiency.testType !== 'None' && (
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={form.englishProficiency.evidenceVerified}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        englishProficiency: { ...p.englishProficiency, evidenceVerified: e.target.checked },
                      }))
                    }
                    className="rounded border-slate-300 text-[#0B1F3A]"
                  />
                  <span>English proficiency certificate verified (or upload score report in Step 9)</span>
                </label>
              )}
            </div>
          )}

          {/* STEP 5: PUBLICATIONS */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <h3 className="text-base font-bold text-[#0B1F3A]">05. Research Publications</h3>
                  <p className="text-xs text-slate-500">
                    Duplicate DOIs or identical titles are automatically detected and excluded from scoring.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addPublication}
                  className="px-3 py-1.5 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Publication</span>
                </button>
              </div>

              {form.publications.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                  No research publications added. Click &ldquo;Add Publication&rdquo; if applicable.
                </p>
              ) : (
                <div className="space-y-4">
                  {form.publications.map((pub, index) => {
                    const isDup = duplicatePubIds.has(pub.id);
                    return (
                      <div
                        key={pub.id}
                        className={`p-4 rounded-xl border space-y-3 ${
                          isDup ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#0B1F3A]">
                            Publication #{index + 1} {isDup ? '· DUPLICATE DETECTED (EXCLUDED)' : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setForm((p) => ({
                                ...p,
                                publications: p.publications.filter((item) => item.id !== pub.id),
                              }))
                            }
                            className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Publication Title</label>
                            <input
                              type="text"
                              value={pub.title}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  publications: p.publications.map((it) =>
                                    it.id === pub.id ? { ...it, title: e.target.value } : it
                                  ),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Journal Name</label>
                            <input
                              type="text"
                              value={pub.journalName}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  publications: p.publications.map((it) =>
                                    it.id === pub.id ? { ...it, journalName: e.target.value } : it
                                  ),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">DOI or Official URL</label>
                            <input
                              type="text"
                              value={pub.doiOrUrl}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  publications: p.publications.map((it) =>
                                    it.id === pub.id ? { ...it, doiOrUrl: e.target.value } : it
                                  ),
                                }))
                              }
                              placeholder="10.1016/j... or https://..."
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Indexing Database</label>
                            <select
                              value={pub.indexing}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  publications: p.publications.map((it) =>
                                    it.id === pub.id
                                      ? { ...it, indexing: e.target.value as PublicationItem['indexing'] }
                                      : it
                                  ),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                            >
                              <option value="Scopus">Scopus</option>
                              <option value="Web of Science">Web of Science</option>
                              <option value="Other indexed journals">Other indexed journals</option>
                              <option value="Non-indexed publications">Non-indexed publications</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Journal Quartile</label>
                            <select
                              value={pub.quartile}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  publications: p.publications.map((it) =>
                                    it.id === pub.id
                                      ? { ...it, quartile: e.target.value as PublicationItem['quartile'] }
                                      : it
                                  ),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                            >
                              <option value="Q1">Q1</option>
                              <option value="Q2">Q2</option>
                              <option value="Q3">Q3</option>
                              <option value="Q4">Q4</option>
                              <option value="N/A">N/A</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Authorship Position</label>
                            <select
                              value={pub.authorship}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  publications: p.publications.map((it) =>
                                    it.id === pub.id
                                      ? { ...it, authorship: e.target.value as PublicationItem['authorship'] }
                                      : it
                                  ),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                            >
                              <option value="First Author">First Author</option>
                              <option value="Corresponding Author">Corresponding Author</option>
                              <option value="Co-Author">Co-Author</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                              <select
                                value={pub.publicationType}
                                onChange={(e) =>
                                  setForm((p) => ({
                                    ...p,
                                    publications: p.publications.map((it) =>
                                      it.id === pub.id
                                        ? {
                                            ...it,
                                            publicationType: e.target.value as PublicationItem['publicationType'],
                                          }
                                        : it
                                    ),
                                  }))
                                }
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                              >
                                <option value="Journal Article">Journal Article</option>
                                <option value="Review Article">Review Article</option>
                                <option value="Conference Paper">Conference Paper</option>
                                <option value="Book Chapter">Book Chapter</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
                              <input
                                type="number"
                                min={1980}
                                max={new Date().getFullYear() + 1}
                                value={pub.publicationYear}
                                onChange={(e) =>
                                  setForm((p) => ({
                                    ...p,
                                    publications: p.publications.map((it) =>
                                      it.id === pub.id
                                        ? {
                                            ...it,
                                            publicationYear: e.target.value === '' ? '' : Number(e.target.value),
                                          }
                                        : it
                                    ),
                                  }))
                                }
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm bg-white font-mono tabular-nums"
                              />
                            </div>
                          </div>
                          <div className="sm:col-span-2 flex flex-wrap gap-5 pt-1">
                            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={pub.relevantToField}
                                onChange={(e) =>
                                  setForm((p) => ({
                                    ...p,
                                    publications: p.publications.map((it) =>
                                      it.id === pub.id ? { ...it, relevantToField: e.target.checked } : it
                                    ),
                                  }))
                                }
                              />
                              <span>Relevant to intended research field</span>
                            </label>
                            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={pub.evidenceVerified}
                                onChange={(e) =>
                                  setForm((p) => ({
                                    ...p,
                                    publications: p.publications.map((it) =>
                                      it.id === pub.id ? { ...it, evidenceVerified: e.target.checked } : it
                                    ),
                                  }))
                                }
                              />
                              <span>Indexing &amp; authorship verified (or provide DOI / PDF)</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 6: CONFERENCES */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-base font-bold text-[#0B1F3A]">06. Conferences</h3>
                <button
                  type="button"
                  onClick={addConference}
                  className="px-3 py-1.5 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Conference</span>
                </button>
              </div>

              {form.conferences.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                  No conference presentations added.
                </p>
              ) : (
                <div className="space-y-4">
                  {form.conferences.map((conf, idx) => (
                    <div key={conf.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#0B1F3A]">Conference #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              conferences: p.conferences.filter((it) => it.id !== conf.id),
                            }))
                          }
                          className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Conference Title</label>
                          <input
                            type="text"
                            value={conf.title}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                conferences: p.conferences.map((it) =>
                                  it.id === conf.id ? { ...it, title: e.target.value } : it
                                ),
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Scope</label>
                          <select
                            value={conf.scope}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                conferences: p.conferences.map((it) =>
                                  it.id === conf.id
                                    ? { ...it, scope: e.target.value as ConferenceItem['scope'] }
                                    : it
                                ),
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                          >
                            <option value="International">International</option>
                            <option value="National">National</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Presentation Type</label>
                          <select
                            value={conf.presentationType}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                conferences: p.conferences.map((it) =>
                                  it.id === conf.id
                                    ? { ...it, presentationType: e.target.value as ConferenceItem['presentationType'] }
                                    : it
                                ),
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                          >
                            <option value="Oral">Oral Presentation</option>
                            <option value="Poster">Poster Presentation</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
                          <input
                            type="number"
                            value={conf.year}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                conferences: p.conferences.map((it) =>
                                  it.id === conf.id
                                    ? { ...it, year: e.target.value === '' ? '' : Number(e.target.value) }
                                    : it
                                ),
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white font-mono tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Certificate Reference / Link
                          </label>
                          <input
                            type="text"
                            value={conf.evidenceReference}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                conferences: p.conferences.map((it) =>
                                  it.id === conf.id ? { ...it, evidenceReference: e.target.value } : it
                                ),
                              }))
                            }
                            placeholder="Certificate ID or URL"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={conf.evidenceVerified}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  conferences: p.conferences.map((it) =>
                                    it.id === conf.id ? { ...it, evidenceVerified: e.target.checked } : it
                                  ),
                                }))
                              }
                            />
                            <span>Conference certificate verified (or upload in Step 9)</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 7: RESEARCH & PROFESSIONAL EXPERIENCE */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <h3 className="text-base font-bold text-[#0B1F3A]">07. Research &amp; Professional Experience</h3>
                  <p className="text-xs text-slate-500">
                    Duration calculated automatically without double-counting overlapping intervals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addExperience}
                  className="px-3 py-1.5 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Experience</span>
                </button>
              </div>

              {form.experiences.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                  No research or professional experience entries recorded.
                </p>
              ) : (
                <div className="space-y-4">
                  {form.experiences.map((exp, idx) => {
                    const dur = calculateExperienceDurationMonths([exp], false, true);
                    return (
                      <div key={exp.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#0B1F3A]">
                            Experience #{idx + 1} · {formatMonthsAsYears(dur.months)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setForm((p) => ({
                                ...p,
                                experiences: p.experiences.filter((it) => it.id !== exp.id),
                              }))
                            }
                            className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Organization</label>
                            <input
                              type="text"
                              value={exp.organization}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  experiences: p.experiences.map((it) =>
                                    it.id === exp.id ? { ...it, organization: e.target.value } : it
                                  ),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Job Title / Role</label>
                            <input
                              type="text"
                              value={exp.jobTitle}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  experiences: p.experiences.map((it) =>
                                    it.id === exp.id ? { ...it, jobTitle: e.target.value } : it
                                  ),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Experience Type</label>
                            <select
                              value={exp.experienceType}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  experiences: p.experiences.map((it) =>
                                    it.id === exp.id
                                      ? { ...it, experienceType: e.target.value as ExperienceItem['experienceType'] }
                                      : it
                                  ),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                            >
                              <option value="Research">Research</option>
                              <option value="Academic / Teaching">Academic / Teaching</option>
                              <option value="Laboratory">Laboratory</option>
                              <option value="Industry / Professional">Industry / Professional</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                              <input
                                type="date"
                                value={exp.startDate}
                                onChange={(e) =>
                                  setForm((p) => ({
                                    ...p,
                                    experiences: p.experiences.map((it) =>
                                      it.id === exp.id ? { ...it, startDate: e.target.value } : it
                                    ),
                                  }))
                                }
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                              <input
                                type="date"
                                disabled={exp.isCurrent}
                                value={exp.endDate}
                                onChange={(e) =>
                                  setForm((p) => ({
                                    ...p,
                                    experiences: p.experiences.map((it) =>
                                      it.id === exp.id ? { ...it, endDate: e.target.value } : it
                                    ),
                                  }))
                                }
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm bg-white disabled:bg-slate-100"
                              />
                            </div>
                          </div>
                          <div className="sm:col-span-2 flex flex-wrap gap-5">
                            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={exp.isCurrent}
                                onChange={(e) =>
                                  setForm((p) => ({
                                    ...p,
                                    experiences: p.experiences.map((it) =>
                                      it.id === exp.id ? { ...it, isCurrent: e.target.checked } : it
                                    ),
                                  }))
                                }
                              />
                              <span>Currently active role</span>
                            </label>
                            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={exp.evidenceVerified}
                                onChange={(e) =>
                                  setForm((p) => ({
                                    ...p,
                                    experiences: p.experiences.map((it) =>
                                      it.id === exp.id ? { ...it, evidenceVerified: e.target.checked } : it
                                    ),
                                  }))
                                }
                              />
                              <span>Experience certificate verified (or upload in Step 9)</span>
                            </label>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Responsibilities</label>
                            <textarea
                              rows={2}
                              value={exp.responsibilities}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  experiences: p.experiences.map((it) =>
                                    it.id === exp.id ? { ...it, responsibilities: e.target.value } : it
                                  ),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Research Activities</label>
                            <textarea
                              rows={2}
                              value={exp.researchActivities}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  experiences: p.experiences.map((it) =>
                                    it.id === exp.id ? { ...it, researchActivities: e.target.value } : it
                                  ),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Technical &amp; Lab Skills
                            </label>
                            <input
                              type="text"
                              value={exp.technicalExpertise}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  experiences: p.experiences.map((it) =>
                                    it.id === exp.id
                                      ? { ...it, technicalExpertise: e.target.value, laboratorySkills: e.target.value }
                                      : it
                                  ),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Software Skills</label>
                            <input
                              type="text"
                              value={exp.softwareSkills}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  experiences: p.experiences.map((it) =>
                                    it.id === exp.id ? { ...it, softwareSkills: e.target.value } : it
                                  ),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 8: RESEARCH PROFILE */}
          {step === 7 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#0B1F3A] border-b border-slate-200 pb-2">
                08. Research Profile
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Previous Thesis Title</label>
                  <input
                    type="text"
                    value={form.researchProfile.previousThesisTitle}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        researchProfile: { ...p.researchProfile, previousThesisTitle: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Research Abstract</label>
                  <textarea
                    rows={3}
                    value={form.researchProfile.researchAbstract}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        researchProfile: { ...p.researchProfile, researchAbstract: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Intended PhD / Master&apos;s Research Topic
                  </label>
                  <input
                    type="text"
                    value={form.researchProfile.intendedResearchTopic}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        researchProfile: { ...p.researchProfile, intendedResearchTopic: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Research Interests</label>
                  <input
                    type="text"
                    value={form.researchProfile.researchInterests}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        researchProfile: { ...p.researchProfile, researchInterests: e.target.value },
                      }))
                    }
                    placeholder="Comma-separated topics"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Research Methodology</label>
                  <input
                    type="text"
                    value={form.researchProfile.researchMethodology}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        researchProfile: { ...p.researchProfile, researchMethodology: e.target.value },
                      }))
                    }
                    placeholder="Quantitative, Experimental, Mixed-Methods..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Research Techniques</label>
                  <input
                    type="text"
                    value={form.researchProfile.researchTechniques}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        researchProfile: { ...p.researchProfile, researchTechniques: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Laboratory Expertise</label>
                  <input
                    type="text"
                    value={form.researchProfile.laboratoryExpertise}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        researchProfile: { ...p.researchProfile, laboratoryExpertise: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Data Analysis Skills</label>
                  <input
                    type="text"
                    value={form.researchProfile.dataAnalysisSkills}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        researchProfile: { ...p.researchProfile, dataAnalysisSkills: e.target.value },
                      }))
                    }
                    placeholder="SPSS, R, Python, Regression, SEM..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Scientific Software</label>
                  <input
                    type="text"
                    value={form.researchProfile.scientificSoftware}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        researchProfile: { ...p.researchProfile, scientificSoftware: e.target.value },
                      }))
                    }
                    placeholder="MATLAB, PyTorch, LaTeX, ANSYS..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="sm:col-span-2 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.researchProfile.researchProposalAvailable}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          researchProfile: { ...p.researchProfile, researchProposalAvailable: e.target.checked },
                        }))
                      }
                    />
                    <span>Candidate has a drafted Research Proposal available</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 9: DOCUMENT UPLOAD */}
          {step === 8 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-2">
                <h3 className="text-base font-bold text-[#0B1F3A]">09. Secure Document Upload</h3>
                <p className="text-xs text-slate-500">
                  Files are stored securely on the server and accessible only to authenticated consultancy staff.
                  Uploading transcripts, certificates, or publication PDFs automatically verifies matching score
                  categories.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DOCUMENT_CATEGORIES.map((cat) => {
                  const existingDocs = form.documents.filter((d) => d.category === cat.key);
                  const queuedForCat = queuedFiles.filter((q) => q.category === cat.key);
                  return (
                    <div key={cat.key} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#0B1F3A]">{cat.label}</span>
                        <label className="px-2.5 py-1 rounded-md bg-white border border-slate-300 text-xs font-medium text-[#0B1F3A] hover:bg-slate-100 cursor-pointer flex items-center gap-1 whitespace-nowrap">
                          <Upload className="w-3 h-3" />
                          <span>{uploadingDoc ? 'Uploading...' : 'Upload'}</span>
                          <input
                            type="file"
                            accept={cat.accept}
                            multiple
                            className="hidden"
                            onChange={(e) => handleFilePick(cat.key, e.target.files)}
                          />
                        </label>
                      </div>

                      {existingDocs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between gap-2 text-xs bg-white px-2.5 py-1.5 rounded border border-slate-200"
                        >
                          <span className="truncate flex items-center gap-1.5 text-slate-700">
                            <FileText className="w-3.5 h-3.5 text-[#0B1F3A] shrink-0" />
                            <span className="truncate">{doc.originalName}</span>
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            {editingCandidate && (
                              <button
                                type="button"
                                onClick={() => apiClient.downloadDocument(editingCandidate.id, doc)}
                                className="text-[#0B1F3A] hover:text-[#A88026]"
                                title="Download secure file"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteExistingDoc(doc.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete file"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {queuedForCat.map((q, qIdx) => (
                        <div
                          key={`${q.file.name}_${qIdx}`}
                          className="flex items-center justify-between gap-2 text-xs bg-white px-2.5 py-1.5 rounded border border-[#C69B3A]/40"
                        >
                          <span className="truncate text-slate-700">{q.file.name} (queued)</span>
                          <button
                            type="button"
                            onClick={() =>
                              setQueuedFiles((prev) => prev.filter((item) => item !== q))
                            }
                            className="text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assessment Status</label>
                <select
                  value={form.assessmentStatus}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      assessmentStatus: e.target.value as Candidate['assessmentStatus'],
                    }))
                  }
                  className="w-full sm:w-64 px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="completed">Completed</option>
                  <option value="in_review">In Review</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
          )}

          {/* Step Footer Navigation */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <div className="flex items-center gap-2.5">
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                  className="px-4 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#132D52] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <span>Next Step</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : null}

              <button
                type="button"
                disabled={saving}
                onClick={() => saveCandidateRecord(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#0B1F3A] text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                <span>{saving && savingMode === 'save' ? 'Saving...' : 'Save Profile Only'}</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-[#C69B3A] hover:bg-[#D9B45B] text-[#071426] text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
              >
                {saving && savingMode === 'full_ai' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>
                  {saving && savingMode === 'full_ai'
                    ? 'Saving & Running AI Assessment...'
                    : editingCandidate
                    ? 'Save & Re-Assess with AI'
                    : 'Save & Run Full AI Assessment'}
                </span>
              </button>
            </div>
          </div>
        </form>

        {/* Live Automated Scoring Sidebar */}
        <aside className="xl:col-span-4 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">Live Automated Engine</p>
              <h4 className="text-lg font-bold text-[#0B1F3A]">100-Mark Preview</h4>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold font-mono tabular-nums text-[#0B1F3A]">
                {liveAssessment.normalizedScore.toFixed(1)}
                <span className="text-xs font-normal text-slate-400"> / 100</span>
              </div>
              <div className="text-xs font-semibold text-[#A88026]">{liveAssessment.classification}</div>
            </div>
          </div>

          <div className="text-xs text-slate-600 flex items-center justify-between">
            <span>Applicable Marks Obtained</span>
            <span className="font-mono tabular-nums font-semibold text-[#0B1F3A]">
              {liveAssessment.totalObtained} / {liveAssessment.totalApplicableMax}
            </span>
          </div>

          {liveAssessment.totalProjected > liveAssessment.totalObtained && (
            <div className="p-3 rounded-lg bg-[#FAF3E0] border border-[#C69B3A]/40 text-xs text-[#0B1F3A]">
              Projected score once unverified records are verified:{' '}
              <strong className="font-mono tabular-nums">{liveAssessment.projectedNormalizedScore.toFixed(1)} / 100</strong>
            </div>
          )}

          {liveAssessment.validationWarnings.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              {liveAssessment.validationWarnings.map((w) => (
                <p key={w}>· {w}</p>
              ))}
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {liveAssessment.categories.map((cat) => (
              <div key={cat.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 truncate">
                    {cat.id}. {cat.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {cat.status === 'not_applicable'
                      ? 'Not Applicable'
                      : cat.status === 'missing'
                      ? 'Missing Info'
                      : cat.status === 'unverified'
                      ? `Unverified (Projected: ${cat.projectedMarks})`
                      : 'Verified'}
                  </div>
                </div>
                <div className="font-mono tabular-nums font-semibold text-[#0B1F3A] shrink-0">
                  {cat.applicable ? `${cat.marksObtained}/${cat.maxMarks}` : 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
