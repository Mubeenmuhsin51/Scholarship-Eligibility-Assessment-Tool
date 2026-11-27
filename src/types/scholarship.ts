export type UserRole = 'admin' | 'staff';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export type IntendedDegree = "Bachelor's" | "Master's" | 'MS' | 'MPhil' | 'PhD';
export type IntakeTerm = 'Fall' | 'Spring' | 'Summer' | 'Rolling / Flexible';
export type AssessmentStatus = 'draft' | 'in_review' | 'completed';

export interface PersonalInfo {
  fullName: string;
  email: string;
  contactNumber: string;
  nationality: string;
  countryOfResidence: string;
  dateOfBirth: string;
  age?: number;
  gender?: string;
  currentLocation: string;
}

export interface IntendedProgramme {
  intendedDegree: IntendedDegree;
  preferredResearchField: string;
  preferredCountries: string[];
  intendedAdmissionYear: number;
  preferredIntake: IntakeTerm;
}

export interface SchoolQualification {
  status: 'completed' | 'not_completed' | 'not_applicable';
  institution: string;
  obtainedMarks: number | '';
  totalMarks: number | '';
  percentage: number | '';
  evidenceVerified: boolean;
}

export interface HigherQualification {
  status: 'completed' | 'not_completed' | 'not_applicable';
  degreeTitle: string;
  university: string;
  country: string;
  cgpa: number | '';
  totalScale: number | '';
  completionYear: number | '';
  evidenceVerified: boolean;
}

export interface AcademicQualifications {
  matriculation: SchoolQualification;
  intermediate: SchoolQualification;
  bachelors: HigherQualification;
  masters: HigherQualification;
}

export type EnglishTestType =
  | 'IELTS'
  | 'TOEFL'
  | 'PTE'
  | 'Duolingo'
  | 'MOI'
  | 'None';

export interface EnglishProficiency {
  testType: EnglishTestType;
  overallScore: number | '';
  listening?: number | '';
  reading?: number | '';
  writing?: number | '';
  speaking?: number | '';
  testDate: string;
  validityDate: string;
  certificateNumber: string;
  evidenceVerified: boolean;
}

export type IndexingDatabase =
  | 'Scopus'
  | 'Web of Science'
  | 'Other indexed journals'
  | 'Non-indexed publications';

export type JournalQuartile = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'N/A';
export type AuthorshipPosition = 'First Author' | 'Corresponding Author' | 'Co-Author';
export type PublicationType =
  | 'Journal Article'
  | 'Review Article'
  | 'Conference Paper'
  | 'Book Chapter';

export interface PublicationItem {
  id: string;
  title: string;
  journalName: string;
  publicationYear: number | '';
  doiOrUrl: string;
  indexing: IndexingDatabase;
  quartile: JournalQuartile;
  authorship: AuthorshipPosition;
  publicationType: PublicationType;
  relevantToField: boolean;
  evidenceVerified: boolean;
}

export interface ConferenceItem {
  id: string;
  title: string;
  scope: 'International' | 'National';
  presentationType: 'Oral' | 'Poster';
  year: number | '';
  evidenceReference: string;
  evidenceVerified: boolean;
}

export interface ExperienceItem {
  id: string;
  organization: string;
  jobTitle: string;
  experienceType: 'Research' | 'Academic / Teaching' | 'Industry / Professional' | 'Laboratory';
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  responsibilities: string;
  researchActivities: string;
  technicalExpertise: string;
  laboratorySkills: string;
  softwareSkills: string;
  evidenceVerified: boolean;
}

export interface ResearchProfile {
  previousThesisTitle: string;
  researchAbstract: string;
  researchInterests: string;
  researchMethodology: string;
  researchTechniques: string;
  laboratoryExpertise: string;
  dataAnalysisSkills: string;
  scientificSoftware: string;
  researchProposalAvailable: boolean;
  intendedResearchTopic: string;
}

export type DocumentCategory =
  | 'cv'
  | 'transcripts'
  | 'degree_certificates'
  | 'english_certificates'
  | 'publications'
  | 'conference_certificates'
  | 'research_proposal'
  | 'experience_certificates';

export interface CandidateDocument {
  id: string;
  category: DocumentCategory;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export type CategoryStatus = 'verified' | 'unverified' | 'missing' | 'not_applicable';

export interface CategoryScore {
  id: number;
  key: string;
  name: string;
  marksObtained: number;
  projectedMarks: number;
  maxMarks: number;
  applicable: boolean;
  status: CategoryStatus;
  explanation: string;
  details: string[];
}

export type CompetitivenessClass =
  | 'Excellent'
  | 'Very Good'
  | 'Good'
  | 'Average'
  | 'Needs Improvement';

export interface AssessmentBreakdown {
  categories: CategoryScore[];
  totalObtained: number;
  totalProjected: number;
  totalApplicableMax: number;
  normalizedScore: number;
  projectedNormalizedScore: number;
  classification: CompetitivenessClass;
  subScores: {
    academicObtained: number;
    academicMax: number;
    researchObtained: number;
    researchMax: number;
    englishObtained: number;
    englishMax: number;
    experienceObtained: number;
    experienceMax: number;
  };
  experienceSummary: {
    totalMonths: number;
    verifiedMonths: number;
    yearsDisplay: string;
  };
  duplicatePublicationIds: string[];
  validationWarnings: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  assessedAt: string;
}

export type EligibilityStatus =
  | 'Eligible'
  | 'Potentially Eligible'
  | 'Not Currently Eligible'
  | 'Additional Requirements';

export interface PathwayEligibility {
  pathway: "Bachelor's" | "Master's / MPhil" | 'PhD';
  overallStatus: EligibilityStatus;
  summary: string;
  tracks: {
    trackName: string;
    status: EligibilityStatus;
    reasoning: string;
    requirements: string[];
  }[];
}

export interface AiEligibilityReport {
  generatedAt: string;
  model: string;
  isFallbackMode: boolean;
  fallbackNotice?: string;
  executiveSummary: string;
  pathways: PathwayEligibility[];
}

export type VerificationLabel = 'verified' | 'unverified' | 'expired';

export interface ScholarshipOpportunity {
  id: string;
  country: string;
  university: string;
  degreeProgramme: string;
  scholarshipName: string;
  fundingCoverage: string;
  minimumCgpa: string;
  englishRequirements: string;
  researchRequirements: string;
  nationalityRestrictions: string;
  applicationDeadline: string;
  officialUrl: string;
  supervisorDetails: string;
  verificationStatus: VerificationLabel;
  verificationDate: string;
  matchRationale: string;
  isFallbackData?: boolean;
}

export interface ScholarshipSearchResult {
  generatedAt: string;
  isFallbackMode: boolean;
  fallbackNotice?: string;
  groundingSources: { title: string; uri: string }[];
  opportunities: ScholarshipOpportunity[];
}

export interface SupervisorMatch {
  id: string;
  professorName: string;
  title: string;
  university: string;
  department: string;
  country: string;
  researchGroup: string;
  researchAreas: string[];
  officialProfileUrl: string;
  relevanceReason: string;
  acceptingStudentsNote: string;
  verificationStatus: VerificationLabel;
}

export interface SupervisorMatchResult {
  generatedAt: string;
  isFallbackMode: boolean;
  fallbackNotice?: string;
  extractedResearchThemes: string[];
  recommendedDepartments: string[];
  groundingSources: { title: string; uri: string }[];
  supervisors: SupervisorMatch[];
}

export interface ImprovementPlanItem {
  id: string;
  priority: 'Critical' | 'High' | 'Medium';
  category: string;
  actionTitle: string;
  description: string;
  targetMetric: string;
  timeline: string;
}

export interface ImprovementPlanResult {
  generatedAt: string;
  isFallbackMode: boolean;
  fallbackNotice?: string;
  strategicSummary: string;
  recommendedCountries: string[];
  items: ImprovementPlanItem[];
}

export interface Candidate {
  id: string;
  referenceCode: string;
  personalInfo: PersonalInfo;
  intendedProgramme: IntendedProgramme;
  qualifications: AcademicQualifications;
  englishProficiency: EnglishProficiency;
  publications: PublicationItem[];
  conferences: ConferenceItem[];
  experiences: ExperienceItem[];
  researchProfile: ResearchProfile;
  documents: CandidateDocument[];
  assessmentStatus: AssessmentStatus;
  assessment: AssessmentBreakdown;
  aiEligibility?: AiEligibilityReport | null;
  scholarshipMatches?: ScholarshipSearchResult | null;
  supervisorMatches?: SupervisorMatchResult | null;
  improvementPlan?: ImprovementPlanResult | null;
  adminNotes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsultancySettings {
  companyName: string;
  applicationName: string;
  tagline: string;
  strictEvidenceMode: boolean;
  defaultTargetCountries: string[];
  customLogoDataUrl: string;
  reportDisclaimer: string;
}

export const SUPPORTED_COUNTRIES = [
  'Germany',
  'Netherlands',
  'Sweden',
  'Denmark',
  'Norway',
  'Finland',
  'Ireland',
  'Belgium',
  'Austria',
  'Switzerland',
  'France',
  'Italy',
  'Spain',
  'United Kingdom',
  'United States',
  'Canada',
  'Australia',
  'New Zealand',
  'China',
  'Japan',
  'South Korea',
  'Malaysia',
  'Singapore',
  'Turkey',
  'Saudi Arabia',
] as const;

export const DOCUMENT_CATEGORIES: { key: DocumentCategory; label: string; accept: string }[] = [
  { key: 'cv', label: 'Curriculum Vitae (CV / Resume)', accept: '.pdf,.doc,.docx' },
  { key: 'transcripts', label: 'Academic Transcripts', accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png' },
  { key: 'degree_certificates', label: 'Degree Certificates', accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png' },
  { key: 'english_certificates', label: 'English Test Certificates', accept: '.pdf,.jpg,.jpeg,.png' },
  { key: 'publications', label: 'Research Publications (PDFs)', accept: '.pdf,.doc,.docx' },
  { key: 'conference_certificates', label: 'Conference Certificates', accept: '.pdf,.jpg,.jpeg,.png' },
  { key: 'research_proposal', label: 'Research Proposal', accept: '.pdf,.doc,.docx' },
  { key: 'experience_certificates', label: 'Experience Certificates', accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png' },
];
