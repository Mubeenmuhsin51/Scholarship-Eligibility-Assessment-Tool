import type {
  AiEligibilityReport,
  Candidate,
  CandidateDocument,
  ConsultancySettings,
  DocumentCategory,
  ImprovementPlanResult,
  ScholarshipSearchResult,
  SupervisorMatchResult,
  UserAccount,
  UserRole,
} from '../types/scholarship';

export interface AuthStatusResponse {
  needsAdminSetup: boolean;
  envPasscodeActive: boolean;
  authenticated: boolean;
  user: {
    sub: string;
    email: string;
    name: string;
    role: UserRole;
  } | null;
}

export class ApiClient {
  private token: string | null = null;
  private onUnauthorized?: () => void;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  setUnauthorizedHandler(handler: () => void) {
    this.onUnauthorized = handler;
  }

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 && this.onUnauthorized) {
      this.onUnauthorized();
    }
    if (!res.ok) {
      let msg = `Request failed (${res.status})`;
      try {
        const errBody = (await res.json()) as { error?: string };
        if (errBody.error) msg = errBody.error;
      } catch {
        // ignore JSON parse error
      }
      throw new Error(msg);
    }
    return (await res.json()) as T;
  }

  getAuthStatus() {
    return this.request<AuthStatusResponse>('/api/auth/status');
  }

  setupAdmin(payload: { name: string; email: string; password: string }) {
    return this.request<{ token: string; user: { id: string; name: string; email: string; role: UserRole } }>(
      '/api/auth/setup-admin',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  }

  login(payload: { email: string; password: string }) {
    return this.request<{ token: string; user: { id: string; name: string; email: string; role: UserRole } }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  }

  getUsers() {
    return this.request<{ users: UserAccount[] }>('/api/users');
  }

  createUser(payload: { name: string; email: string; password: string; role: UserRole }) {
    return this.request<{ user: UserAccount }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  deleteUser(id: string) {
    return this.request<{ ok: boolean }>(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  getSettings() {
    return this.request<{ settings: ConsultancySettings }>('/api/settings');
  }

  updateSettings(settings: Partial<ConsultancySettings>) {
    return this.request<{ settings: ConsultancySettings; candidates: Candidate[] }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  getCandidates() {
    return this.request<{ candidates: Candidate[] }>('/api/candidates');
  }

  createCandidate(payload: unknown) {
    return this.request<{ candidate: Candidate }>('/api/candidates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateCandidate(id: string, payload: Partial<Candidate>) {
    return this.request<{ candidate: Candidate }>(`/api/candidates/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteCandidate(id: string) {
    return this.request<{ ok: boolean }>(`/api/candidates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  uploadDocument(candidateId: string, category: DocumentCategory, file: File) {
    const form = new FormData();
    form.append('category', category);
    form.append('file', file);
    return this.request<{ document: CandidateDocument; candidate: Candidate }>(
      `/api/candidates/${encodeURIComponent(candidateId)}/documents`,
      { method: 'POST', body: form }
    );
  }

  deleteDocument(candidateId: string, docId: string) {
    return this.request<{ candidate: Candidate }>(
      `/api/candidates/${encodeURIComponent(candidateId)}/documents/${encodeURIComponent(docId)}`,
      { method: 'DELETE' }
    );
  }

  async downloadDocument(candidateId: string, doc: CandidateDocument): Promise<void> {
    const headers = new Headers();
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    const res = await fetch(
      `/api/candidates/${encodeURIComponent(candidateId)}/documents/${encodeURIComponent(doc.id)}`,
      { headers }
    );
    if (!res.ok) throw new Error('Unable to download secure document.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.originalName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async exportCandidatesJson(): Promise<void> {
    const headers = new Headers();
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    const res = await fetch('/api/export/candidates', { headers });
    if (!res.ok) throw new Error('Export failed or unauthorized.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ubaid-ullah-candidates-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  runAiEligibility(candidateId: string) {
    return this.request<{ candidate: Candidate; eligibility: AiEligibilityReport }>('/api/ai/eligibility', {
      method: 'POST',
      body: JSON.stringify({ candidateId }),
    });
  }

  runAiScholarships(payload: {
    candidateId: string;
    targetCountries?: string[];
    degreeFilter?: string;
    queryFocus?: string;
  }) {
    return this.request<{ candidate: Candidate; scholarshipMatches: ScholarshipSearchResult }>(
      '/api/ai/scholarships',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  runAiSupervisors(payload: { candidateId: string; targetCountries?: string[] }) {
    return this.request<{ candidate: Candidate; supervisorMatches: SupervisorMatchResult }>(
      '/api/ai/supervisors',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  runAiImprovementPlan(candidateId: string) {
    return this.request<{ candidate: Candidate; improvementPlan: ImprovementPlanResult }>(
      '/api/ai/improvement-plan',
      {
        method: 'POST',
        body: JSON.stringify({ candidateId }),
      }
    );
  }

  parseDocumentsWithAi(files: File[]) {
    const form = new FormData();
    for (const file of files) {
      form.append('files', file);
    }
    return this.request<{
      extracted: Record<string, unknown>;
      extractionNotes: string;
      isFallbackMode: boolean;
      fallbackNotice?: string;
    }>('/api/ai/parse-documents', {
      method: 'POST',
      body: form,
    });
  }

  runFullAiAssessment(candidateId: string) {
    return this.request<{ candidate: Candidate; warnings: string[] }>('/api/ai/full-assessment', {
      method: 'POST',
      body: JSON.stringify({ candidateId }),
    });
  }
}

export const apiClient = new ApiClient();
