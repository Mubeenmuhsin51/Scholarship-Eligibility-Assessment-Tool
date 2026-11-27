import type {
  AcademicQualifications,
  AssessmentBreakdown,
  Candidate,
  CandidateDocument,
  CategoryScore,
  CompetitivenessClass,
  ConferenceItem,
  EnglishProficiency,
  ExperienceItem,
  IntendedDegree,
  PublicationItem,
  ResearchProfile,
} from '../types/scholarship';

export function calculatePercentage(obtained: number | '', total: number | ''): number | '' {
  if (obtained === '' || total === '' || !Number.isFinite(obtained) || !Number.isFinite(total)) {
    return '';
  }
  if (total <= 0 || obtained < 0 || obtained > total) {
    return '';
  }
  return Number(((obtained / total) * 100).toFixed(2));
}

export function normalizeCgpa(cgpa: number | '', scale: number | ''): number | null {
  if (cgpa === '' || scale === '' || !Number.isFinite(cgpa) || !Number.isFinite(scale)) {
    return null;
  }
  if (scale <= 0 || cgpa < 0 || cgpa > scale) {
    return null;
  }
  return Number(((cgpa / scale) * 4.0).toFixed(3));
}

export function scorePercentageBand(percentage: number): number {
  if (percentage >= 90) return 10;
  if (percentage >= 80) return 8;
  if (percentage >= 70) return 6;
  if (percentage >= 60) return 4;
  if (percentage >= 50) return 2;
  return 0;
}

export function scoreNormalizedCgpa(cgpa4: number): number {
  if (cgpa4 >= 3.995) return 10;
  if (cgpa4 >= 3.0) return 7;
  if (cgpa4 >= 2.0) return 4;
  if (cgpa4 >= 1.0) return 0.5;
  return 0;
}

export function convertEnglishToIeltsEquivalent(prof: EnglishProficiency): {
  ieltsBand: number | null;
  marks: number;
  note: string;
} {
  const score = prof.overallScore;
  if (prof.testType === 'None') {
    return { ieltsBand: null, marks: 0, note: 'No English proficiency test recorded.' };
  }
  if (prof.testType === 'MOI') {
    return {
      ieltsBand: 6.5,
      marks: 6,
      note: 'Medium of Instruction (MOI) Certificate recorded (treated as 6.0–6.5 equivalent = 6/10; verify university-specific IELTS/TOEFL waivers).',
    };
  }
  if (score === '' || !Number.isFinite(score) || score < 0) {
    return { ieltsBand: null, marks: 0, note: `${prof.testType} selected, but test score is missing.` };
  }

  let ieltsBand = 0;
  if (prof.testType === 'IELTS') {
    if (score > 9) return { ieltsBand: null, marks: 0, note: 'Invalid IELTS score (> 9.0).' };
    ieltsBand = score;
  } else if (prof.testType === 'TOEFL') {
    if (score > 120) return { ieltsBand: null, marks: 0, note: 'Invalid TOEFL iBT score (> 120).' };
    if (score >= 110) ieltsBand = 8.0;
    else if (score >= 94) ieltsBand = 7.0;
    else if (score >= 79) ieltsBand = 6.0;
    else if (score >= 46) ieltsBand = 5.0;
    else ieltsBand = 4.5;
  } else if (prof.testType === 'PTE') {
    if (score > 90) return { ieltsBand: null, marks: 0, note: 'Invalid PTE Academic score (> 90).' };
    if (score >= 79) ieltsBand = 8.0;
    else if (score >= 65) ieltsBand = 7.0;
    else if (score >= 50) ieltsBand = 6.0;
    else if (score >= 36) ieltsBand = 5.0;
    else ieltsBand = 4.5;
  } else if (prof.testType === 'Duolingo') {
    if (score > 160) return { ieltsBand: null, marks: 0, note: 'Invalid Duolingo score (> 160).' };
    if (score >= 140) ieltsBand = 8.0;
    else if (score >= 120) ieltsBand = 7.0;
    else if (score >= 100) ieltsBand = 6.0;
    else if (score >= 80) ieltsBand = 5.0;
    else ieltsBand = 4.5;
  }

  let marks = 0;
  if (ieltsBand >= 8.0) marks = 10;
  else if (ieltsBand >= 7.0) marks = 8;
  else if (ieltsBand >= 6.0) marks = 6;
  else if (ieltsBand >= 5.0) marks = 4;
  else marks = 0;

  return {
    ieltsBand,
    marks,
    note: `${prof.testType} score ${score} mapped to IELTS band ${ieltsBand.toFixed(1)} equivalent (${marks}/10).`,
  };
}

export function detectDuplicatePublications(publications: PublicationItem[]): Set<string> {
  const seenDois = new Set<string>();
  const seenTitles = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const pub of publications) {
    const normDoi = pub.doiOrUrl.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
    const normTitle = `${pub.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}::${pub.publicationYear}`;

    const isDoiDup = normDoi.length > 4 && seenDois.has(normDoi);
    const isTitleDup = pub.title.trim().length > 3 && seenTitles.has(normTitle);

    if (isDoiDup || isTitleDup) {
      duplicateIds.add(pub.id);
    } else {
      if (normDoi.length > 4) seenDois.add(normDoi);
      if (pub.title.trim().length > 3) seenTitles.add(normTitle);
    }
  }
  return duplicateIds;
}

export function calculateExperienceDurationMonths(
  experiences: ExperienceItem[],
  onlyVerified: boolean,
  hasUploadedExpDoc: boolean
): { months: number; warnings: string[] } {
  const warnings: string[] = [];
  const intervals: [number, number][] = [];
  const now = new Date();
  const maxYear = now.getFullYear() + 1;

  for (const exp of experiences) {
    if (!exp.startDate) continue;
    const start = new Date(exp.startDate);
    const end = exp.isCurrent ? now : exp.endDate ? new Date(exp.endDate) : null;

    if (Number.isNaN(start.getTime())) {
      warnings.push(`Experience "${exp.jobTitle || exp.organization}" has an invalid start date.`);
      continue;
    }
    if (start.getFullYear() > maxYear) {
      warnings.push(`Experience "${exp.jobTitle || exp.organization}" starts in an impossible future date.`);
      continue;
    }
    if (!end || Number.isNaN(end.getTime())) {
      warnings.push(`Experience "${exp.jobTitle || exp.organization}" is missing a valid end date.`);
      continue;
    }
    if (end.getTime() < start.getTime()) {
      warnings.push(`Experience "${exp.jobTitle || exp.organization}" has an end date earlier than its start date.`);
      continue;
    }

    const isVerified = exp.evidenceVerified || hasUploadedExpDoc;
    if (onlyVerified && !isVerified) continue;

    const startMonth = start.getFullYear() * 12 + start.getMonth();
    const endMonth = end.getFullYear() * 12 + end.getMonth() + 1;
    intervals.push([startMonth, Math.max(startMonth + 1, endMonth)]);
  }

  if (intervals.length === 0) return { months: 0, warnings };

  intervals.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    if (intervals[i][0] <= last[1]) {
      last[1] = Math.max(last[1], intervals[i][1]);
    } else {
      merged.push(intervals[i]);
    }
  }

  const months = merged.reduce((sum, [s, e]) => sum + (e - s), 0);
  return { months, warnings };
}

export function formatMonthsAsYears(months: number): string {
  if (months <= 0) return '0 months';
  const yrs = Math.floor(months / 12);
  const rem = months % 12;
  if (yrs === 0) return `${rem} month${rem === 1 ? '' : 's'}`;
  if (rem === 0) return `${yrs} year${yrs === 1 ? '' : 's'}`;
  return `${yrs} yr${yrs === 1 ? '' : 's'} ${rem} mo${rem === 1 ? '' : 's'}`;
}

export function classifyScore(score: number): CompetitivenessClass {
  if (score >= 85) return 'Excellent';
  if (score >= 75) return 'Very Good';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Average';
  return 'Needs Improvement';
}

function hasDoc(docs: CandidateDocument[], cat: CandidateDocument['category']): boolean {
  return docs.some((d) => d.category === cat);
}

export function validateCandidateData(candidate: Partial<Candidate>): string[] {
  const warnings: string[] = [];
  const q = candidate.qualifications;
  if (q) {
    for (const [label, item] of [
      ['Matriculation', q.matriculation],
      ['Intermediate/FSc', q.intermediate],
    ] as const) {
      if (item.status === 'completed') {
        if (item.percentage !== '' && (item.percentage < 0 || item.percentage > 100)) {
          warnings.push(`${label} percentage (${item.percentage}%) must be between 0 and 100.`);
        }
        if (item.obtainedMarks !== '' && item.totalMarks !== '' && item.obtainedMarks > item.totalMarks) {
          warnings.push(`${label} obtained marks exceed total marks.`);
        }
      }
    }
    for (const [label, item] of [
      ["Bachelor's", q.bachelors],
      ["Master's/MS/MPhil", q.masters],
    ] as const) {
      if (item.status === 'completed') {
        if (item.totalScale !== '' && item.totalScale <= 0) {
          warnings.push(`${label} CGPA scale must be greater than zero.`);
        }
        if (item.cgpa !== '' && item.totalScale !== '' && item.cgpa > item.totalScale) {
          warnings.push(`${label} CGPA (${item.cgpa}) cannot exceed scale (${item.totalScale}).`);
        }
        if (item.completionYear !== '' && (item.completionYear < 1960 || item.completionYear > new Date().getFullYear() + 2)) {
          warnings.push(`${label} completion year (${item.completionYear}) appears invalid.`);
        }
      }
    }
  }

  if (candidate.personalInfo?.dateOfBirth) {
    const dob = new Date(candidate.personalInfo.dateOfBirth);
    if (Number.isNaN(dob.getTime()) || dob > new Date()) {
      warnings.push('Date of birth cannot be in the future.');
    }
  }

  if (candidate.englishProficiency) {
    const ep = candidate.englishProficiency;
    if (ep.testDate && ep.validityDate && new Date(ep.validityDate) < new Date(ep.testDate)) {
      warnings.push('English test validity date cannot be earlier than the test date.');
    }
  }

  return warnings;
}

export function evaluateCandidateAssessment(
  candidate: Omit<Candidate, 'assessment' | 'id' | 'referenceCode' | 'createdBy' | 'createdAt' | 'updatedAt'> & {
    id?: string;
  },
  strictEvidenceMode = true
): AssessmentBreakdown {
  const intendedDegree: IntendedDegree = candidate.intendedProgramme.intendedDegree;
  const isBachelors = intendedDegree === "Bachelor's";
  const isMasters = intendedDegree === "Master's" || intendedDegree === 'MS' || intendedDegree === 'MPhil';
  const isPhd = intendedDegree === 'PhD';

  const docs = candidate.documents || [];
  const validationWarnings = validateCandidateData(candidate);

  const hasTranscriptDoc = hasDoc(docs, 'transcripts') || hasDoc(docs, 'degree_certificates');
  const hasEnglishDoc = hasDoc(docs, 'english_certificates');
  const hasPubDoc = hasDoc(docs, 'publications');
  const hasConfDoc = hasDoc(docs, 'conference_certificates');
  const hasExpDoc = hasDoc(docs, 'experience_certificates');
  const hasProposalDoc = hasDoc(docs, 'research_proposal');

  // 1. Research Publications (10 Marks)
  const publications = candidate.publications || [];
  const dupPubIds = detectDuplicatePublications(publications);
  if (dupPubIds.size > 0) {
    validationWarnings.push(`${dupPubIds.size} duplicate publication entry(ies) excluded from scoring.`);
  }

  const cat1Applicable = !isBachelors || publications.length > 0;
  let cat1Projected = 0;
  let cat1Verified = 0;
  const cat1Details: string[] = [];

  if (!cat1Applicable) {
    // N/A for Bachelor's without publications
  } else if (publications.length === 0) {
    cat1Details.push('No research publications entered.');
  } else {
    for (const pub of publications) {
      if (dupPubIds.has(pub.id)) {
        cat1Details.push(`Duplicate skipped: "${pub.title || 'Untitled'}"`);
        continue;
      }
      const hasEvidence = pub.evidenceVerified || hasPubDoc || pub.doiOrUrl.trim().length > 5;
      let pts = 0;
      const isFirst = pub.authorship === 'First Author' || pub.authorship === 'Corresponding Author';
      if (pub.indexing === 'Non-indexed publications') {
        pts = 0;
      } else if (pub.indexing === 'Other indexed journals') {
        pts = isFirst ? 0.5 : 0.25;
      } else {
        // Scopus / Web of Science
        if (pub.quartile === 'Q1') pts = isFirst ? 3 : 1;
        else if (pub.quartile === 'Q2') pts = isFirst ? 2 : 1;
        else if (pub.quartile === 'Q3' || pub.quartile === 'Q4') pts = isFirst ? 1 : 0.5;
        else pts = isFirst ? 0.5 : 0.25;
      }
      if (!pub.relevantToField && pts > 0) {
        pts = Number((pts * 0.5).toFixed(2));
      }
      cat1Projected = Math.min(10, Number((cat1Projected + pts).toFixed(2)));
      if (!strictEvidenceMode || hasEvidence) {
        cat1Verified = Math.min(10, Number((cat1Verified + pts).toFixed(2)));
      }
      cat1Details.push(
        `"${pub.title || 'Untitled'}" (${pub.indexing}, ${pub.quartile}, ${pub.authorship}${pub.relevantToField ? '' : ', low field relevance'}): ${pts} pts [${hasEvidence ? 'Verified via DOI/Doc' : 'Unverified — needs DOI or PDF'}]`
      );
    }
  }

  const cat1: CategoryScore = {
    id: 1,
    key: 'publications',
    name: 'Research Publications',
    marksObtained: cat1Applicable ? cat1Verified : 0,
    projectedMarks: cat1Applicable ? cat1Projected : 0,
    maxMarks: 10,
    applicable: cat1Applicable,
    status: !cat1Applicable
      ? 'not_applicable'
      : publications.length === 0
      ? 'missing'
      : cat1Verified === 0 && cat1Projected > 0
      ? 'unverified'
      : 'verified',
    explanation: !cat1Applicable
      ? "Not Applicable for Bachelor's pathway."
      : publications.length === 0
      ? 'Missing information: no publications recorded.'
      : cat1Verified < cat1Projected
      ? `Awarded ${cat1Verified}/10 from verified entries (projected ${cat1Projected}/10 once DOI/URL or PDF evidence is provided).`
      : `Awarded ${cat1Verified}/10 across verified non-duplicate indexed publications (capped at 10).`,
    details: cat1Details,
  };

  // Helper for Matriculation & Intermediate
  function scoreSchoolCategory(
    id: number,
    key: string,
    name: string,
    qual: AcademicQualifications['matriculation']
  ): CategoryScore {
    if (qual.status === 'not_applicable') {
      return {
        id,
        key,
        name,
        marksObtained: 0,
        projectedMarks: 0,
        maxMarks: 10,
        applicable: false,
        status: 'not_applicable',
        explanation: 'Marked Not Applicable for candidate educational system.',
        details: [],
      };
    }
    const pct =
      qual.percentage !== ''
        ? Number(qual.percentage)
        : calculatePercentage(qual.obtainedMarks, qual.totalMarks);
    if (qual.status === 'not_completed' || pct === '' || !Number.isFinite(pct) || pct < 0 || pct > 100) {
      return {
        id,
        key,
        name,
        marksObtained: 0,
        projectedMarks: 0,
        maxMarks: 10,
        applicable: true,
        status: 'missing',
        explanation:
          qual.status === 'not_completed'
            ? `${name} marked not completed — awaiting final results.`
            : `Missing information: enter valid ${name} marks or percentage (0–100%).`,
        details: [],
      };
    }
    const pts = scorePercentageBand(pct);
    const hasEvidence = qual.evidenceVerified || hasTranscriptDoc;
    const awarded = !strictEvidenceMode || hasEvidence ? pts : 0;
    return {
      id,
      key,
      name,
      marksObtained: awarded,
      projectedMarks: pts,
      maxMarks: 10,
      applicable: true,
      status: hasEvidence || !strictEvidenceMode ? 'verified' : 'unverified',
      explanation:
        !hasEvidence && strictEvidenceMode
          ? `${pct}% maps to ${pts}/10, but marks are withheld (0/10) until transcript evidence is uploaded or verified.`
          : `${pct}% at ${qual.institution || 'institution'} maps to ${awarded}/10.`,
      details: [`Calculated percentage: ${pct}%`, `Evidence: ${hasEvidence ? 'Verified' : 'Pending transcript upload/verification'}`],
    };
  }

  const cat2 = scoreSchoolCategory(2, 'matriculation', 'Matriculation', candidate.qualifications.matriculation);
  const cat3 = scoreSchoolCategory(3, 'intermediate', 'Intermediate / FSc', candidate.qualifications.intermediate);

  // Helper for Bachelor's & Master's
  function scoreHigherCategory(
    id: number,
    key: string,
    name: string,
    qual: AcademicQualifications['bachelors'],
    requiredByPathway: boolean
  ): CategoryScore {
    if (qual.status === 'not_applicable' || (!requiredByPathway && qual.status === 'not_completed')) {
      return {
        id,
        key,
        name,
        marksObtained: 0,
        projectedMarks: 0,
        maxMarks: 10,
        applicable: false,
        status: 'not_applicable',
        explanation: `Not Applicable for ${intendedDegree} pathway (qualification not required or not yet completed).`,
        details: [],
      };
    }
    const norm = normalizeCgpa(qual.cgpa, qual.totalScale);
    if (qual.status === 'not_completed' || norm === null) {
      return {
        id,
        key,
        name,
        marksObtained: 0,
        projectedMarks: 0,
        maxMarks: 10,
        applicable: true,
        status: 'missing',
        explanation:
          qual.status === 'not_completed'
            ? `${name} is pending completion (${intendedDegree} pathway normally expects completed degree).`
            : `Missing or invalid CGPA / scale for ${name}.`,
        details: [],
      };
    }
    const pts = scoreNormalizedCgpa(norm);
    const hasEvidence = qual.evidenceVerified || hasTranscriptDoc;
    const awarded = !strictEvidenceMode || hasEvidence ? pts : 0;
    return {
      id,
      key,
      name,
      marksObtained: awarded,
      projectedMarks: pts,
      maxMarks: 10,
      applicable: true,
      status: hasEvidence || !strictEvidenceMode ? 'verified' : 'unverified',
      explanation:
        !hasEvidence && strictEvidenceMode
          ? `CGPA ${qual.cgpa}/${qual.totalScale} (normalized ${norm.toFixed(2)}/4.00) maps to ${pts}/10, withheld until transcript/degree is verified.`
          : `CGPA ${qual.cgpa}/${qual.totalScale} normalized to ${norm.toFixed(2)}/4.00 = ${awarded}/10.`,
      details: [
        `Degree: ${qual.degreeTitle || 'Not specified'} (${qual.university || 'University N/A'})`,
        `Normalized CGPA: ${norm.toFixed(2)} / 4.00`,
        `Evidence: ${hasEvidence ? 'Verified' : 'Pending transcript/degree upload'}`,
      ],
    };
  }

  const cat4 = scoreHigherCategory(4, 'bachelors', "Bachelor's / BS", candidate.qualifications.bachelors, !isBachelors);
  const cat5 = scoreHigherCategory(5, 'masters', "Master's / MS / MPhil", candidate.qualifications.masters, isPhd);

  // 6. IELTS / English Proficiency (10 Marks)
  const ep = candidate.englishProficiency;
  const engEval = convertEnglishToIeltsEquivalent(ep);
  let cat6: CategoryScore;
  if (ep.testType === 'None' || engEval.ieltsBand === null) {
    cat6 = {
      id: 6,
      key: 'english',
      name: 'IELTS / English Proficiency',
      marksObtained: 0,
      projectedMarks: 0,
      maxMarks: 10,
      applicable: true,
      status: 'missing',
      explanation: engEval.note,
      details: [],
    };
  } else {
    const isExpired = ep.validityDate ? new Date(ep.validityDate) < new Date() : false;
    const hasEvidence = ep.evidenceVerified || hasEnglishDoc || ep.certificateNumber.trim().length > 3;
    const projected = isExpired ? 0 : engEval.marks;
    const awarded = !strictEvidenceMode || hasEvidence ? projected : 0;
    cat6 = {
      id: 6,
      key: 'english',
      name: 'IELTS / English Proficiency',
      marksObtained: awarded,
      projectedMarks: projected,
      maxMarks: 10,
      applicable: true,
      status: isExpired
        ? 'verified'
        : hasEvidence || !strictEvidenceMode
        ? 'verified'
        : 'unverified',
      explanation: isExpired
        ? `English test expired on ${ep.validityDate} (0/10 awarded). Retake required.`
        : !hasEvidence && strictEvidenceMode
        ? `${engEval.note} Withheld (0/10) until certificate/TRF number or score report is uploaded.`
        : engEval.note,
      details: [
        `Test: ${ep.testType}${ep.overallScore !== '' ? ` (${ep.overallScore})` : ''}`,
        `IELTS Equivalent: ${engEval.ieltsBand.toFixed(1)}`,
        `Validity: ${ep.validityDate || 'Not provided'}${isExpired ? ' (EXPIRED)' : ''}`,
      ],
    };
  }

  // 7. Conferences (10 Marks)
  const conferences: ConferenceItem[] = candidate.conferences || [];
  const cat7Applicable = !isBachelors || conferences.length > 0;
  let cat7Projected = 0;
  let cat7Verified = 0;
  const cat7Details: string[] = [];

  if (cat7Applicable) {
    for (const conf of conferences) {
      let pts = 0;
      if (conf.scope === 'International' && conf.presentationType === 'Oral') pts = 2;
      else if (conf.scope === 'International' && conf.presentationType === 'Poster') pts = 1;
      else if (conf.scope === 'National' && conf.presentationType === 'Oral') pts = 1;
      else pts = 0.5;
      const hasEvidence = conf.evidenceVerified || hasConfDoc || conf.evidenceReference.trim().length > 3;
      cat7Projected = Math.min(10, Number((cat7Projected + pts).toFixed(2)));
      if (!strictEvidenceMode || hasEvidence) {
        cat7Verified = Math.min(10, Number((cat7Verified + pts).toFixed(2)));
      }
      cat7Details.push(
        `"${conf.title || 'Conference'}" (${conf.scope} ${conf.presentationType}, ${conf.year || 'N/A'}): ${pts} pts [${hasEvidence ? 'Verified' : 'Unverified'}]`
      );
    }
  }

  const cat7: CategoryScore = {
    id: 7,
    key: 'conferences',
    name: 'Conferences',
    marksObtained: cat7Applicable ? cat7Verified : 0,
    projectedMarks: cat7Applicable ? cat7Projected : 0,
    maxMarks: 10,
    applicable: cat7Applicable,
    status: !cat7Applicable
      ? 'not_applicable'
      : conferences.length === 0
      ? 'missing'
      : cat7Verified === 0 && cat7Projected > 0
      ? 'unverified'
      : 'verified',
    explanation: !cat7Applicable
      ? "Not Applicable for Bachelor's pathway."
      : conferences.length === 0
      ? 'Missing information: no conference presentations recorded.'
      : cat7Verified < cat7Projected
      ? `Awarded ${cat7Verified}/10 (projected ${cat7Projected}/10 once conference certificates are attached).`
      : `Awarded ${cat7Verified}/10 across verified conference presentations.`,
    details: cat7Details,
  };

  // 8. Research / Professional Experience (10 Marks)
  const experiences = candidate.experiences || [];
  const cat8Applicable = !isBachelors || experiences.length > 0;
  const projExp = calculateExperienceDurationMonths(experiences, false, true);
  const verExp = calculateExperienceDurationMonths(experiences, strictEvidenceMode, hasExpDoc);
  validationWarnings.push(...projExp.warnings);

  function scoreExpMonths(months: number): number {
    const yrs = months / 12;
    if (yrs >= 5) return 10;
    if (yrs >= 4) return 8;
    if (yrs >= 3) return 6;
    if (yrs >= 2) return 4;
    if (yrs >= 1) return 2;
    return 0;
  }

  const cat8Projected = cat8Applicable ? scoreExpMonths(projExp.months) : 0;
  const cat8Verified = cat8Applicable ? scoreExpMonths(verExp.months) : 0;

  const cat8: CategoryScore = {
    id: 8,
    key: 'experience',
    name: 'Research / Professional Experience',
    marksObtained: cat8Verified,
    projectedMarks: cat8Projected,
    maxMarks: 10,
    applicable: cat8Applicable,
    status: !cat8Applicable
      ? 'not_applicable'
      : experiences.length === 0
      ? 'missing'
      : cat8Verified === 0 && cat8Projected > 0
      ? 'unverified'
      : 'verified',
    explanation: !cat8Applicable
      ? "Not Applicable for Bachelor's pathway."
      : experiences.length === 0
      ? 'Missing information: no research or professional experience recorded.'
      : cat8Verified < cat8Projected
      ? `${formatMonthsAsYears(projExp.months)} total recorded (projected ${cat8Projected}/10), ${formatMonthsAsYears(verExp.months)} verified (${cat8Verified}/10).`
      : `${formatMonthsAsYears(verExp.months)} verified non-overlapping experience = ${cat8Verified}/10.`,
    details: [
      `Total recorded duration: ${formatMonthsAsYears(projExp.months)}`,
      `Verified duration: ${formatMonthsAsYears(verExp.months)}`,
    ],
  };

  // 9. Research Profile Assessment (10 Marks)
  const rp: ResearchProfile = candidate.researchProfile;
  const cat9Applicable = !isBachelors;
  const rpFields = [
    { label: 'Previous thesis & abstract', ok: rp.previousThesisTitle.trim().length > 3 && rp.researchAbstract.trim().length > 30, pts: 2.5 },
    { label: 'Research methodology & techniques', ok: rp.researchMethodology.trim().length > 5 && rp.researchTechniques.trim().length > 3, pts: 2 },
    { label: 'Laboratory expertise', ok: rp.laboratoryExpertise.trim().length > 3, pts: 1.5 },
    { label: 'Data analysis & scientific software', ok: rp.dataAnalysisSkills.trim().length > 3 || rp.scientificSoftware.trim().length > 2, pts: 2 },
    { label: 'Independent research capability & proposal', ok: rp.researchProposalAvailable && (hasProposalDoc || rp.intendedResearchTopic.trim().length > 5), pts: 2 },
  ];
  const cat9Projected = cat9Applicable
    ? Number(rpFields.reduce((s, f) => s + (f.ok ? f.pts : 0), 0).toFixed(2))
    : 0;
  const hasResearchProfileAny =
    rp.previousThesisTitle.trim().length > 0 ||
    rp.researchAbstract.trim().length > 0 ||
    rp.researchMethodology.trim().length > 0 ||
    rp.laboratoryExpertise.trim().length > 0 ||
    rp.dataAnalysisSkills.trim().length > 0;
  const cat9EvidenceOk = !strictEvidenceMode || !rp.researchProposalAvailable || hasProposalDoc || hasTranscriptDoc || rp.researchAbstract.trim().length > 50;
  const cat9Verified = cat9Applicable ? (cat9EvidenceOk ? cat9Projected : Math.max(0, cat9Projected - (rp.researchProposalAvailable && !hasProposalDoc ? 1 : 0))) : 0;

  const cat9: CategoryScore = {
    id: 9,
    key: 'research_profile',
    name: 'Research Profile Assessment',
    marksObtained: cat9Verified,
    projectedMarks: cat9Projected,
    maxMarks: 10,
    applicable: cat9Applicable,
    status: !cat9Applicable ? 'not_applicable' : !hasResearchProfileAny ? 'missing' : 'verified',
    explanation: !cat9Applicable
      ? "Not Applicable for Bachelor's pathway."
      : !hasResearchProfileAny
      ? 'Missing information: complete research methodology, lab skills, thesis, and software details.'
      : `Evaluated across thesis quality, methodology, lab expertise, data/software skills, and proposal readiness (${cat9Verified}/10).`,
    details: rpFields.map((f) => `${f.label}: ${f.ok ? `${f.pts}/${f.pts}` : `0/${f.pts}`}`),
  };

  // 10. Academic and Research Relevance (10 Marks)
  const field = candidate.intendedProgramme.preferredResearchField.trim().toLowerCase();
  const prevDegree = (isPhd ? candidate.qualifications.masters.degreeTitle : candidate.qualifications.bachelors.degreeTitle).toLowerCase();
  const researchText = `${rp.researchInterests} ${rp.previousThesisTitle} ${rp.intendedResearchTopic} ${rp.researchAbstract}`.toLowerCase();

  let cat10Score = 0;
  const cat10Details: string[] = [];

  if (!field) {
    cat10Details.push('Preferred research/study field not specified.');
  } else {
    const fieldTokens = field.split(/[\s,;/]+/).filter((t) => t.length > 2);
    const hasFieldDeclared = fieldTokens.length > 0;
    const degreeMatches = isBachelors
      ? candidate.qualifications.intermediate.status === 'completed'
      : fieldTokens.some((t) => prevDegree.includes(t)) || prevDegree.length > 3;
    const topicAligned = isBachelors
      ? candidate.intendedProgramme.preferredCountries.length > 0
      : fieldTokens.some((t) => researchText.includes(t)) || rp.intendedResearchTopic.trim().length > 5;
    const proposalReady = isBachelors ? true : rp.researchProposalAvailable;

    if (hasFieldDeclared) {
      cat10Score += 3;
      cat10Details.push(`Target discipline defined (${candidate.intendedProgramme.preferredResearchField}): 3/3`);
    }
    if (degreeMatches) {
      cat10Score += 3;
      cat10Details.push('Prior academic qualification compatibility: 3/3');
    } else {
      cat10Details.push('Prior academic qualification alignment incomplete: 0/3');
    }
    if (topicAligned) {
      cat10Score += 2.5;
      cat10Details.push('Research interests / thesis alignment with target field: 2.5/2.5');
    } else {
      cat10Details.push('Research interest / thesis alignment missing: 0/2.5');
    }
    if (proposalReady) {
      cat10Score += 1.5;
      cat10Details.push(isBachelors ? 'Programme compatibility & country strategy: 1.5/1.5' : 'Research proposal readiness: 1.5/1.5');
    } else {
      cat10Details.push('Research proposal not yet available: 0/1.5');
    }
  }

  const cat10: CategoryScore = {
    id: 10,
    key: 'relevance',
    name: 'Academic & Research Relevance',
    marksObtained: Number(cat10Score.toFixed(2)),
    projectedMarks: Number(cat10Score.toFixed(2)),
    maxMarks: 10,
    applicable: true,
    status: !field ? 'missing' : 'verified',
    explanation: !field
      ? 'Missing information: specify preferred research or study field.'
      : `Evaluated alignment between prior academic background, research interests, and intended ${intendedDegree} pathway (${cat10Score}/10).`,
    details: cat10Details,
  };

  const categories = [cat1, cat2, cat3, cat4, cat5, cat6, cat7, cat8, cat9, cat10];
  const applicableCats = categories.filter((c) => c.applicable);
  const totalApplicableMax = applicableCats.reduce((s, c) => s + c.maxMarks, 0);
  const totalObtained = Number(applicableCats.reduce((s, c) => s + c.marksObtained, 0).toFixed(2));
  const totalProjected = Number(applicableCats.reduce((s, c) => s + c.projectedMarks, 0).toFixed(2));

  const normalizedScore =
    totalApplicableMax > 0 ? Number(((totalObtained / totalApplicableMax) * 100).toFixed(1)) : 0;
  const projectedNormalizedScore =
    totalApplicableMax > 0 ? Number(((totalProjected / totalApplicableMax) * 100).toFixed(1)) : 0;

  const academicCats = [cat2, cat3, cat4, cat5].filter((c) => c.applicable);
  const researchCats = [cat1, cat7, cat9, cat10].filter((c) => c.applicable);

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  for (const c of applicableCats) {
    if (c.marksObtained >= 7) {
      strengths.push(`${c.name}: Strong verified performance (${c.marksObtained}/${c.maxMarks}).`);
    } else if (c.status === 'unverified' && c.projectedMarks >= 6) {
      weaknesses.push(`${c.name}: Strong projected score (${c.projectedMarks}/${c.maxMarks}) currently withheld pending document verification.`);
      recommendations.push(`Upload official supporting documentation for ${c.name} to unlock ${c.projectedMarks} verified marks.`);
    } else if (c.status === 'missing') {
      weaknesses.push(`${c.name}: Missing required academic/profile information.`);
      recommendations.push(`Complete ${c.name} details and attach supporting evidence.`);
    } else if (c.marksObtained < 5) {
      weaknesses.push(`${c.name}: Below competitive threshold (${c.marksObtained}/${c.maxMarks}).`);
      if (c.key === 'english') {
        recommendations.push('Target IELTS 7.0+ (or TOEFL 94+ / PTE 65+) to maximize merit scholarship eligibility.');
      } else if (c.key === 'publications') {
        recommendations.push('Prioritize publishing at least 1–2 Q1/Q2 Scopus or Web of Science articles as first author.');
      } else if (c.key === 'conferences') {
        recommendations.push('Present research orally at peer-reviewed international conferences and retain official certificates.');
      } else if (c.key === 'experience') {
        recommendations.push('Gain documented research assistantship or relevant laboratory/industry experience with formal letters.');
      } else if (c.key === 'research_profile') {
        recommendations.push('Prepare a structured research proposal and document technical, lab, and statistical software proficiencies.');
      }
    }
  }

  if (strengths.length === 0) {
    strengths.push('Baseline profile registered; complete verification and high-impact milestones to establish competitive differentiators.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Profile meets high competitiveness benchmarks; proceed with targeted supervisor outreach and early scholarship applications.');
  }

  return {
    categories,
    totalObtained,
    totalProjected,
    totalApplicableMax,
    normalizedScore,
    projectedNormalizedScore,
    classification: classifyScore(normalizedScore),
    subScores: {
      academicObtained: Number(academicCats.reduce((s, c) => s + c.marksObtained, 0).toFixed(2)),
      academicMax: academicCats.reduce((s, c) => s + c.maxMarks, 0),
      researchObtained: Number(researchCats.reduce((s, c) => s + c.marksObtained, 0).toFixed(2)),
      researchMax: researchCats.reduce((s, c) => s + c.maxMarks, 0),
      englishObtained: cat6.marksObtained,
      englishMax: cat6.applicable ? cat6.maxMarks : 0,
      experienceObtained: cat8.marksObtained,
      experienceMax: cat8.applicable ? cat8.maxMarks : 0,
    },
    experienceSummary: {
      totalMonths: projExp.months,
      verifiedMonths: verExp.months,
      yearsDisplay: formatMonthsAsYears(verExp.months),
    },
    duplicatePublicationIds: Array.from(dupPubIds),
    validationWarnings: Array.from(new Set(validationWarnings)),
    strengths,
    weaknesses,
    recommendations,
    assessedAt: new Date().toISOString(),
  };
}
