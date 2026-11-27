import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { evaluateCandidateAssessment } from './src/utils/scoringEngine.ts';
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
} from './src/types/scholarship.ts';

dotenv.config();

interface StoredUser extends UserAccount {
  passwordHash: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  candidates: Candidate[];
  settings: ConsultancySettings;
}

interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  authUser?: SessionPayload;
}

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const DEFAULT_SETTINGS: ConsultancySettings = {
  companyName: 'UBAID ULLAH ENTERPRISES',
  applicationName: 'International Scholarship-Assessment Tool',
  tagline: 'Empowering Global Academic Opportunities',
  strictEvidenceMode: true,
  defaultTargetCountries: ['Germany', 'United Kingdom', 'Netherlands', 'Sweden', 'Australia', 'Canada'],
  customLogoDataUrl: '',
  reportDisclaimer:
    'Disclaimer: This assessment report represents a preliminary academic and research profile evaluation prepared by UBAID ULLAH ENTERPRISES. It does not constitute an official offer of admission, scholarship award, or visa guarantee. Final eligibility decisions rest solely with the admitting universities and funding agencies.',
};

function ensureStorage(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const initial: DatabaseSchema = {
      users: [],
      candidates: [],
      settings: DEFAULT_SETTINGS,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

function readDb(): DatabaseSchema {
  ensureStorage();
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
  };
}

function writeDb(db: DatabaseSchema): void {
  ensureStorage();
  const tmpFile = `${DB_FILE}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derived = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(keyBuf, derived);
}

function constantTimeCompareStrings(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function signToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.sub || !payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
    return;
  }
  req.authUser = payload;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser || req.authUser.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required.' });
    return;
  }
  next();
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractJsonBlock(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const startObj = candidate.indexOf('{');
  const startArr = candidate.indexOf('[');
  let start = -1;
  if (startObj >= 0 && startArr >= 0) start = Math.min(startObj, startArr);
  else start = Math.max(startObj, startArr);
  if (start < 0) throw new Error('No JSON structure returned by model.');
  const slice = candidate.slice(start);
  const lastBrace = Math.max(slice.lastIndexOf('}'), slice.lastIndexOf(']'));
  const clean = lastBrace >= 0 ? slice.slice(0, lastBrace + 1) : slice;
  return JSON.parse(clean);
}

function extractDocxXmlText(buffer: Buffer): string {
  try {
    let offset = 0;
    while (offset + 30 <= buffer.length) {
      if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
      const compression = buffer.readUInt16LE(offset + 8);
      const compSize = buffer.readUInt32LE(offset + 18);
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const nameStart = offset + 30;
      const name = buffer.toString('utf8', nameStart, nameStart + nameLen);
      const dataStart = nameStart + nameLen + extraLen;
      if (dataStart + compSize > buffer.length) break;
      if (name === 'word/document.xml') {
        const compressed = buffer.subarray(dataStart, dataStart + compSize);
        const xmlBuf = compression === 8 ? zlib.inflateRawSync(compressed) : compressed;
        return xmlBuf
          .toString('utf8')
          .replace(/<\/w:p>/g, '\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      offset = dataStart + compSize;
    }
  } catch {
    // Fallback if DOCX uses data descriptor or non-standard layout
  }
  return '';
}

function buildCandidateSummaryForAi(c: Candidate): string {
  return JSON.stringify({
    name: c.personalInfo.fullName,
    nationality: c.personalInfo.nationality,
    countryOfResidence: c.personalInfo.countryOfResidence,
    intendedDegree: c.intendedProgramme.intendedDegree,
    preferredResearchField: c.intendedProgramme.preferredResearchField,
    preferredCountries: c.intendedProgramme.preferredCountries,
    intendedAdmissionYear: c.intendedProgramme.intendedAdmissionYear,
    preferredIntake: c.intendedProgramme.preferredIntake,
    qualifications: c.qualifications,
    englishProficiency: c.englishProficiency,
    publications: c.publications,
    conferences: c.conferences,
    experiences: c.experiences,
    researchProfile: c.researchProfile,
    assessmentSummary: {
      totalObtained: c.assessment.totalObtained,
      totalApplicableMax: c.assessment.totalApplicableMax,
      normalizedScore: c.assessment.normalizedScore,
      classification: c.assessment.classification,
      categories: c.assessment.categories.map((cat) => ({
        name: cat.name,
        marksObtained: cat.marksObtained,
        maxMarks: cat.maxMarks,
        applicable: cat.applicable,
        status: cat.status,
      })),
    },
  });
}

const ALLOWED_EXTS = new Set(['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.webp']);
const ALLOWED_DOC_CATEGORIES = new Set<DocumentCategory>([
  'cv',
  'transcripts',
  'degree_certificates',
  'english_certificates',
  'publications',
  'conference_certificates',
  'research_proposal',
  'experience_certificates',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function buildReferenceCode(count: number): string {
  const year = new Date().getFullYear();
  return `UUE-${year}-${String(count + 1).padStart(4, '0')}`;
}

async function startServer() {
  ensureStorage();
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // --- AUTH ROUTES ---
  app.get('/api/auth/status', (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    const envPasscodeActive = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
    const hasAdminUser = db.users.some((u) => u.role === 'admin');
    const needsAdminSetup = !envPasscodeActive && !hasAdminUser;

    const authHeader = req.headers.authorization;
    let user: SessionPayload | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      user = verifyToken(authHeader.slice(7).trim());
    }

    res.json({
      needsAdminSetup,
      envPasscodeActive,
      authenticated: Boolean(user),
      user,
    });
  });

  app.post('/api/auth/setup-admin', (req: Request, res: Response) => {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode) {
      res.status(403).json({ error: 'Administrator passcode is managed via environment configuration.' });
      return;
    }
    const db = readDb();
    if (db.users.some((u) => u.role === 'admin')) {
      res.status(409).json({ error: 'Initial administrator account has already been claimed.' });
      return;
    }
    const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
    if (!name || !email || !password || password.length < 8) {
      res.status(400).json({ error: 'Provide full name, valid email, and a password of at least 8 characters.' });
      return;
    }

    const adminUser: StoredUser = {
      id: `usr_${crypto.randomUUID().slice(0, 8)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: 'admin',
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    db.users.push(adminUser);
    writeDb(db);

    const payload: SessionPayload = {
      sub: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    };
    res.status(201).json({
      token: signToken(payload),
      user: { id: adminUser.id, name: adminUser.name, email: adminUser.email, role: adminUser.role },
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!password) {
      res.status(400).json({ error: 'Password or administrator passcode is required.' });
      return;
    }

    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode && constantTimeCompareStrings(password, envPasscode)) {
      const payload: SessionPayload = {
        sub: 'env-admin',
        email: (email || 'admin@ubaidullahenterprises.com').trim().toLowerCase(),
        name: 'Principal Administrator',
        role: 'admin',
        exp: Date.now() + 24 * 60 * 60 * 1000,
      };
      res.json({
        token: signToken(payload),
        user: { id: payload.sub, name: payload.name, email: payload.email, role: payload.role },
      });
      return;
    }

    const db = readDb();
    const normEmail = (email || '').trim().toLowerCase();
    const matched = db.users.find((u) => u.email === normEmail);
    if (!matched || !verifyPassword(password, matched.passwordHash)) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const payload: SessionPayload = {
      sub: matched.id,
      email: matched.email,
      name: matched.name,
      role: matched.role,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    };
    res.json({
      token: signToken(payload),
      user: { id: matched.id, name: matched.name, email: matched.email, role: matched.role },
    });
  });

  // --- USER MANAGEMENT (ADMIN ONLY) ---
  app.get('/api/users', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    const safeUsers: UserAccount[] = db.users.map(({ passwordHash: _ph, ...u }) => u);
    res.json({ users: safeUsers });
  });

  app.post('/api/users', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const { name, email, password, role } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: UserRole;
    };
    if (!name || !email || !password || password.length < 8) {
      res.status(400).json({ error: 'Name, email, and password (min 8 chars) are required.' });
      return;
    }
    const cleanRole: UserRole = role === 'admin' ? 'admin' : 'staff';
    const normEmail = email.trim().toLowerCase();
    const db = readDb();
    if (db.users.some((u) => u.email === normEmail)) {
      res.status(409).json({ error: 'A staff or admin account with this email already exists.' });
      return;
    }
    const newUser: StoredUser = {
      id: `usr_${crypto.randomUUID().slice(0, 8)}`,
      name: name.trim(),
      email: normEmail,
      role: cleanRole,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    writeDb(db);
    const { passwordHash: _ph, ...safe } = newUser;
    res.status(201).json({ user: safe });
  });

  app.delete('/api/users/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const targetId = String(req.params.id);
    if (req.authUser?.sub === targetId) {
      res.status(400).json({ error: 'Cannot delete your own active account.' });
      return;
    }
    const db = readDb();
    const idx = db.users.findIndex((u) => u.id === targetId);
    if (idx === -1) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    db.users.splice(idx, 1);
    writeDb(db);
    res.json({ ok: true });
  });

  // --- SETTINGS ---
  app.get('/api/settings', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    res.json({ settings: db.settings });
  });

  app.put('/api/settings', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    const incoming = req.body as Partial<ConsultancySettings>;
    const updated: ConsultancySettings = {
      ...db.settings,
      companyName: typeof incoming.companyName === 'string' && incoming.companyName.trim() ? incoming.companyName.trim() : db.settings.companyName,
      applicationName:
        typeof incoming.applicationName === 'string' && incoming.applicationName.trim()
          ? incoming.applicationName.trim()
          : db.settings.applicationName,
      tagline: typeof incoming.tagline === 'string' && incoming.tagline.trim() ? incoming.tagline.trim() : db.settings.tagline,
      strictEvidenceMode:
        typeof incoming.strictEvidenceMode === 'boolean' ? incoming.strictEvidenceMode : db.settings.strictEvidenceMode,
      defaultTargetCountries: Array.isArray(incoming.defaultTargetCountries)
        ? incoming.defaultTargetCountries.filter((c): c is string => typeof c === 'string').slice(0, 30)
        : db.settings.defaultTargetCountries,
      customLogoDataUrl:
        typeof incoming.customLogoDataUrl === 'string' &&
        (incoming.customLogoDataUrl === '' || incoming.customLogoDataUrl.startsWith('data:image/'))
          ? incoming.customLogoDataUrl
          : db.settings.customLogoDataUrl,
      reportDisclaimer:
        typeof incoming.reportDisclaimer === 'string' && incoming.reportDisclaimer.trim()
          ? incoming.reportDisclaimer.trim()
          : db.settings.reportDisclaimer,
    };
    db.settings = updated;
    // Re-evaluate all candidate scores if strictEvidenceMode changed
    db.candidates = db.candidates.map((c) => ({
      ...c,
      assessment: evaluateCandidateAssessment(c, updated.strictEvidenceMode),
    }));
    writeDb(db);
    res.json({ settings: updated, candidates: db.candidates });
  });

  // --- CANDIDATE CRUD ---
  app.get('/api/candidates', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    res.json({ candidates: db.candidates });
  });

  app.get('/api/candidates/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    const candidate = db.candidates.find((c) => c.id === req.params.id);
    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found.' });
      return;
    }
    res.json({ candidate });
  });

  app.post('/api/candidates', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    const body = req.body as Omit<Candidate, 'id' | 'referenceCode' | 'assessment' | 'createdBy' | 'createdAt' | 'updatedAt'>;
    if (!body?.personalInfo?.fullName || !body?.personalInfo?.email || !body?.intendedProgramme?.intendedDegree) {
      res.status(400).json({ error: 'Full name, email, and intended degree are required.' });
      return;
    }

    const now = new Date().toISOString();
    const id = `cand_${crypto.randomUUID().slice(0, 12)}`;
    const draftCandidate: Candidate = {
      ...body,
      id,
      referenceCode: buildReferenceCode(db.candidates.length),
      documents: Array.isArray(body.documents) ? body.documents : [],
      assessmentStatus: body.assessmentStatus || 'completed',
      adminNotes: body.adminNotes || '',
      createdBy: req.authUser?.email || 'system',
      createdAt: now,
      updatedAt: now,
      assessment: evaluateCandidateAssessment({ ...body, documents: [] }, db.settings.strictEvidenceMode),
    };
    draftCandidate.assessment = evaluateCandidateAssessment(draftCandidate, db.settings.strictEvidenceMode);

    db.candidates.unshift(draftCandidate);
    writeDb(db);
    res.status(201).json({ candidate: draftCandidate });
  });

  app.put('/api/candidates/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    const idx = db.candidates.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Candidate not found.' });
      return;
    }
    const existing = db.candidates[idx];
    const body = req.body as Partial<Candidate>;
    const merged: Candidate = {
      ...existing,
      ...body,
      id: existing.id,
      referenceCode: existing.referenceCode,
      documents: existing.documents,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      assessment: existing.assessment,
    };
    merged.assessment = evaluateCandidateAssessment(merged, db.settings.strictEvidenceMode);
    db.candidates[idx] = merged;
    writeDb(db);
    res.json({ candidate: merged });
  });

  app.delete('/api/candidates/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    const idx = db.candidates.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Candidate not found.' });
      return;
    }
    const safeCandId = sanitizeId(String(req.params.id));
    const candDir = path.resolve(UPLOADS_DIR, safeCandId);
    if (candDir.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(candDir)) {
      fs.rmSync(candDir, { recursive: true, force: true });
    }
    db.candidates.splice(idx, 1);
    writeDb(db);
    res.json({ ok: true });
  });

  // --- SECURE DOCUMENT UPLOAD & ACCESS ---
  app.post(
    '/api/candidates/:id/documents',
    requireAuth,
    upload.single('file'),
    (req: AuthenticatedRequest, res: Response) => {
      const db = readDb();
      const idx = db.candidates.findIndex((c) => c.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Candidate not found.' });
        return;
      }
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file uploaded.' });
        return;
      }
      const category = String(req.body.category || '') as DocumentCategory;
      if (!ALLOWED_DOC_CATEGORIES.has(category)) {
        res.status(400).json({ error: 'Invalid document category.' });
        return;
      }

      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) {
        res.status(400).json({ error: 'Unsupported file format. Allowed: PDF, DOC, DOCX, PNG, JPG, JPEG, WEBP.' });
        return;
      }

      const safeCandId = sanitizeId(String(req.params.id));
      const docId = `doc_${crypto.randomUUID().slice(0, 12)}`;
      const storedFilename = `${docId}${ext}`;
      const candDir = path.resolve(UPLOADS_DIR, safeCandId);
      if (!candDir.startsWith(UPLOADS_DIR + path.sep)) {
        res.status(400).json({ error: 'Invalid storage path.' });
        return;
      }
      fs.mkdirSync(candDir, { recursive: true });
      const resolvedFile = path.resolve(candDir, storedFilename);
      if (!resolvedFile.startsWith(candDir + path.sep)) {
        res.status(400).json({ error: 'Invalid filename path.' });
        return;
      }

      fs.writeFileSync(resolvedFile, file.buffer);

      const newDoc: CandidateDocument = {
        id: docId,
        category,
        originalName: path.basename(file.originalname),
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };

      const candidate = db.candidates[idx];
      candidate.documents = [...candidate.documents, newDoc];
      candidate.updatedAt = new Date().toISOString();
      candidate.assessment = evaluateCandidateAssessment(candidate, db.settings.strictEvidenceMode);
      db.candidates[idx] = candidate;
      writeDb(db);

      res.status(201).json({ document: newDoc, candidate });
    }
  );

  app.get('/api/candidates/:id/documents/:docId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    const candidate = db.candidates.find((c) => c.id === req.params.id);
    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found.' });
      return;
    }
    const docMeta = candidate.documents.find((d) => d.id === req.params.docId);
    if (!docMeta) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    const safeCandId = sanitizeId(candidate.id);
    const safeDocId = sanitizeId(docMeta.id);
    const ext = path.extname(docMeta.originalName).toLowerCase();
    const candDir = path.resolve(UPLOADS_DIR, safeCandId);
    const filePath = path.resolve(candDir, `${safeDocId}${ext}`);
    if (!filePath.startsWith(candDir + path.sep) || !fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Stored file missing.' });
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', docMeta.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${docMeta.originalName.replace(/"/g, '')}"`);
    fs.createReadStream(filePath).pipe(res);
  });

  app.delete('/api/candidates/:id/documents/:docId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    const idx = db.candidates.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Candidate not found.' });
      return;
    }
    const candidate = db.candidates[idx];
    const docMeta = candidate.documents.find((d) => d.id === req.params.docId);
    if (!docMeta) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    const safeCandId = sanitizeId(candidate.id);
    const safeDocId = sanitizeId(docMeta.id);
    const ext = path.extname(docMeta.originalName).toLowerCase();
    const candDir = path.resolve(UPLOADS_DIR, safeCandId);
    const filePath = path.resolve(candDir, `${safeDocId}${ext}`);
    if (filePath.startsWith(candDir + path.sep) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    candidate.documents = candidate.documents.filter((d) => d.id !== docMeta.id);
    candidate.updatedAt = new Date().toISOString();
    candidate.assessment = evaluateCandidateAssessment(candidate, db.settings.strictEvidenceMode);
    db.candidates[idx] = candidate;
    writeDb(db);

    res.json({ candidate });
  });

  // --- AUTHORIZED EXPORT ---
  app.get('/api/export/candidates', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="ubaid-ullah-candidates-export.json"');
    res.send(JSON.stringify({ exportedAt: new Date().toISOString(), count: db.candidates.length, candidates: db.candidates }, null, 2));
  });

  // --- AI ENDPOINTS (SERVER-SIDE @google/genai) ---
  app.post('/api/ai/eligibility', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.body as { candidateId?: string };
    const db = readDb();
    const idx = db.candidates.findIndex((c) => c.id === candidateId);
    if (idx === -1) {
      res.status(404).json({ error: 'Candidate not found.' });
      return;
    }
    const candidate = db.candidates[idx];
    const ai = getGeminiClient();

    if (!ai) {
      const fallback = buildFallbackEligibility(candidate, 'GEMINI_API_KEY is not configured in environment secrets.');
      candidate.aiEligibility = fallback;
      db.candidates[idx] = candidate;
      writeDb(db);
      res.json({ candidate, eligibility: fallback });
      return;
    }

    try {
      const prompt = `Analyze the following scholarship applicant profile for UBAID ULLAH ENTERPRISES.
Independently evaluate suitability across ALL THREE academic pathways:
1. Bachelor's (Undergraduate admissions, Government scholarships, University merit scholarships, Fully funded undergraduate opportunities)
2. Master's / MPhil (Master's admissions, Research-based Master's programmes, Government scholarships, University-funded scholarships, Graduate assistantships)
3. PhD (Doctoral admissions, Fully funded doctoral positions, Research assistantships, University-funded PhD scholarships, Supervisor-funded research opportunities, Government-funded doctoral programmes)

For each pathway and track, assign status strictly as one of:
- "Eligible"
- "Potentially Eligible"
- "Not Currently Eligible"
- "Additional Requirements"

Explain the exact academic, CGPA, English, and research reasons behind every decision based strictly on the candidate data provided. Do NOT mention copyrights, patents, awards, prizes, or previously received scholarships.

Candidate Profile JSON:
${buildCandidateSummaryForAi(candidate)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a senior international academic admissions and scholarship assessor. Base evaluations strictly on verified academic credentials, English proficiency, publications, conferences, and research profile. Never fabricate credentials.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING },
              pathways: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pathway: { type: Type.STRING },
                    overallStatus: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    tracks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          trackName: { type: Type.STRING },
                          status: { type: Type.STRING },
                          reasoning: { type: Type.STRING },
                          requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
                        },
                        required: ['trackName', 'status', 'reasoning', 'requirements'],
                      },
                    },
                  },
                  required: ['pathway', 'overallStatus', 'summary', 'tracks'],
                },
              },
            },
            required: ['executiveSummary', 'pathways'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        executiveSummary: string;
        pathways: AiEligibilityReport['pathways'];
      };

      const report: AiEligibilityReport = {
        generatedAt: new Date().toISOString(),
        model: 'gemini-4-hydrogen',
        isFallbackMode: false,
        executiveSummary: parsed.executiveSummary || 'Eligibility evaluation completed.',
        pathways: Array.isArray(parsed.pathways) ? parsed.pathways : [],
      };

      candidate.aiEligibility = report;
      candidate.updatedAt = new Date().toISOString();
      db.candidates[idx] = candidate;
      writeDb(db);
      res.json({ candidate, eligibility: report });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI eligibility request failed.';
      const fallback = buildFallbackEligibility(candidate, `Live AI evaluation unavailable (${msg}). Showing rule-based fallback assessment.`);
      candidate.aiEligibility = fallback;
      db.candidates[idx] = candidate;
      writeDb(db);
      res.json({ candidate, eligibility: fallback });
    }
  });

  app.post('/api/ai/scholarships', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, targetCountries, degreeFilter, queryFocus } = req.body as {
      candidateId?: string;
      targetCountries?: string[];
      degreeFilter?: string;
      queryFocus?: string;
    };
    const db = readDb();
    const idx = db.candidates.findIndex((c) => c.id === candidateId);
    if (idx === -1) {
      res.status(404).json({ error: 'Candidate not found.' });
      return;
    }
    const candidate = db.candidates[idx];
    const countries =
      Array.isArray(targetCountries) && targetCountries.length > 0
        ? targetCountries
        : candidate.intendedProgramme.preferredCountries.length > 0
        ? candidate.intendedProgramme.preferredCountries
        : db.settings.defaultTargetCountries;

    const ai = getGeminiClient();
    if (!ai) {
      const fallback: ScholarshipSearchResult = {
        generatedAt: new Date().toISOString(),
        isFallbackMode: true,
        fallbackNotice:
          'Live AI web search is currently unavailable because GEMINI_API_KEY is not configured. No unverified or fabricated scholarships are shown as live results. Configure GEMINI_API_KEY in Settings > Secrets to run live Google Search-grounded scholarship verification.',
        groundingSources: [],
        opportunities: [],
      };
      candidate.scholarshipMatches = fallback;
      db.candidates[idx] = candidate;
      writeDb(db);
      res.json({ candidate, scholarshipMatches: fallback });
      return;
    }

    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const degree = degreeFilter || candidate.intendedProgramme.intendedDegree;
      const prompt = `Use Google Search to find REAL, currently documented international scholarships and university programmes matching this candidate profile.
Today's date is ${todayIso}.
Target degree: ${degree}
Research / Study Field: ${candidate.intendedProgramme.preferredResearchField || 'General Academic'}
Target Countries: ${countries.join(', ')}
Additional Search Focus: ${queryFocus || 'Prioritize fully funded government and university scholarships'}
Candidate Nationality: ${candidate.personalInfo.nationality}
Candidate Normalized Assessment Score: ${candidate.assessment.normalizedScore}/100

CRITICAL INTEGRITY RULES:
1. NEVER invent scholarships, universities, deadlines, CGPA cutoffs, or URLs. Only include opportunities confirmed from search results.
2. Prioritize fully funded international opportunities (e.g., DAAD, Erasmus Mundus, Swedish Institute, Chevening, Commonwealth, Fulbright, Vanier, Gates Cambridge, ETH Excellence, Holland/NL Scholarship, MEXT, CSC, GKS, Endeavour/RTP, Swiss Government Excellence, Marie Skłodowska-Curie, university-funded PhD positions, etc. ONLY if relevant to the candidate's degree and countries).
3. For each opportunity, mark "verificationStatus" strictly as "verified" (confirmed current from official search result), "unverified" (mentioned but details/deadline unclear), or "expired" (deadline passed relative to ${todayIso}).
4. Include official URLs directly from search results.

Return ONLY valid JSON matching this exact shape inside a \`\`\`json code block:
{
  "opportunities": [
    {
      "country": "string",
      "university": "string",
      "degreeProgramme": "string",
      "scholarshipName": "string",
      "fundingCoverage": "string",
      "minimumCgpa": "string",
      "englishRequirements": "string",
      "researchRequirements": "string",
      "nationalityRestrictions": "string",
      "applicationDeadline": "string",
      "officialUrl": "https://...",
      "supervisorDetails": "string",
      "verificationStatus": "verified | unverified | expired",
      "matchRationale": "string"
    }
  ]
}

Candidate Summary:
${buildCandidateSummaryForAi(candidate)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const groundingSources = chunks
        .map((ch) => ch.web)
        .filter((w): w is { uri: string; title: string } => Boolean(w?.uri))
        .map((w) => ({ title: w.title || w.uri, uri: w.uri }));

      let parsedOpportunities: Array<Record<string, unknown>> = [];
      try {
        const extracted = extractJsonBlock(response.text ?? '') as { opportunities?: Array<Record<string, unknown>> };
        parsedOpportunities = Array.isArray(extracted.opportunities) ? extracted.opportunities : [];
      } catch {
        parsedOpportunities = [];
      }

      const result: ScholarshipSearchResult = {
        generatedAt: new Date().toISOString(),
        isFallbackMode: false,
        groundingSources,
        opportunities: parsedOpportunities.map((item, idxItem) => ({
          id: `sch_${Date.now()}_${idxItem}`,
          country: String(item.country || 'International'),
          university: String(item.university || 'Participating Institution'),
          degreeProgramme: String(item.degreeProgramme || degree),
          scholarshipName: String(item.scholarshipName || 'Scholarship Programme'),
          fundingCoverage: String(item.fundingCoverage || 'Verify on official portal'),
          minimumCgpa: String(item.minimumCgpa || 'See official criteria'),
          englishRequirements: String(item.englishRequirements || 'See official criteria'),
          researchRequirements: String(item.researchRequirements || 'See official criteria'),
          nationalityRestrictions: String(item.nationalityRestrictions || 'Verify eligibility by nationality'),
          applicationDeadline: String(item.applicationDeadline || 'Verify on official website'),
          officialUrl: String(item.officialUrl || groundingSources[0]?.uri || ''),
          supervisorDetails: String(item.supervisorDetails || 'Not specified'),
          verificationStatus:
            item.verificationStatus === 'verified' || item.verificationStatus === 'expired'
              ? item.verificationStatus
              : 'unverified',
          verificationDate: todayIso,
          matchRationale: String(item.matchRationale || ''),
        })),
      };

      candidate.scholarshipMatches = result;
      candidate.updatedAt = new Date().toISOString();
      db.candidates[idx] = candidate;
      writeDb(db);
      res.json({ candidate, scholarshipMatches: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Live scholarship search failed.';
      res.status(502).json({
        error: `Live scholarship search failed: ${msg}`,
        isFallbackMode: true,
      });
    }
  });

  app.post('/api/ai/supervisors', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, targetCountries } = req.body as { candidateId?: string; targetCountries?: string[] };
    const db = readDb();
    const idx = db.candidates.findIndex((c) => c.id === candidateId);
    if (idx === -1) {
      res.status(404).json({ error: 'Candidate not found.' });
      return;
    }
    const candidate = db.candidates[idx];
    const countries =
      Array.isArray(targetCountries) && targetCountries.length > 0
        ? targetCountries
        : candidate.intendedProgramme.preferredCountries.length > 0
        ? candidate.intendedProgramme.preferredCountries
        : db.settings.defaultTargetCountries;

    const ai = getGeminiClient();
    if (!ai) {
      const fallback: SupervisorMatchResult = {
        generatedAt: new Date().toISOString(),
        isFallbackMode: true,
        fallbackNotice:
          'Live faculty & supervisor search requires GEMINI_API_KEY with Google Search grounding. No faculty members are fabricated in fallback mode.',
        extractedResearchThemes: candidate.researchProfile.researchInterests
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        recommendedDepartments: [],
        groundingSources: [],
        supervisors: [],
      };
      candidate.supervisorMatches = fallback;
      db.candidates[idx] = candidate;
      writeDb(db);
      res.json({ candidate, supervisorMatches: fallback });
      return;
    }

    try {
      const prompt = `Use Google Search to identify REAL university departments, research groups, and faculty supervisors whose published research aligns with this Master's/PhD candidate's thesis and research profile.
Target Countries: ${countries.join(', ')}
Research Field: ${candidate.intendedProgramme.preferredResearchField}
Previous Thesis Title: ${candidate.researchProfile.previousThesisTitle || 'N/A'}
Research Abstract: ${candidate.researchProfile.researchAbstract || 'N/A'}
Research Interests & Techniques: ${candidate.researchProfile.researchInterests}; ${candidate.researchProfile.researchMethodology}; ${candidate.researchProfile.researchTechniques}
Intended Research Topic: ${candidate.researchProfile.intendedResearchTopic || 'N/A'}

CRITICAL INTEGRITY RULES:
1. Only list real professors/researchers found via Google Search with an official university faculty page or lab URL.
2. NEVER invent a professor name, email, or faculty URL.
3. NEVER claim a professor is currently accepting students unless their official page or active PhD/Postdoc ad in search results explicitly states it; otherwise write "Acceptance status not verified — contact directly with research proposal".
4. Explain specifically why each supervisor's publications/research group aligns with the candidate's background.

Return ONLY valid JSON inside a \`\`\`json code block:
{
  "extractedResearchThemes": ["string"],
  "recommendedDepartments": ["string"],
  "supervisors": [
    {
      "professorName": "string",
      "title": "string",
      "university": "string",
      "department": "string",
      "country": "string",
      "researchGroup": "string",
      "researchAreas": ["string"],
      "officialProfileUrl": "https://...",
      "relevanceReason": "string",
      "acceptingStudentsNote": "string",
      "verificationStatus": "verified | unverified"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const groundingSources = chunks
        .map((ch) => ch.web)
        .filter((w): w is { uri: string; title: string } => Boolean(w?.uri))
        .map((w) => ({ title: w.title || w.uri, uri: w.uri }));

      let parsed: Record<string, unknown> = {};
      try {
        parsed = extractJsonBlock(response.text ?? '') as Record<string, unknown>;
      } catch {
        parsed = {};
      }

      const rawSups = Array.isArray(parsed.supervisors) ? (parsed.supervisors as Array<Record<string, unknown>>) : [];

      const result: SupervisorMatchResult = {
        generatedAt: new Date().toISOString(),
        isFallbackMode: false,
        extractedResearchThemes: Array.isArray(parsed.extractedResearchThemes)
          ? (parsed.extractedResearchThemes as string[])
          : [],
        recommendedDepartments: Array.isArray(parsed.recommendedDepartments)
          ? (parsed.recommendedDepartments as string[])
          : [],
        groundingSources,
        supervisors: rawSups.map((s, idxS) => ({
          id: `sup_${Date.now()}_${idxS}`,
          professorName: String(s.professorName || 'Faculty Researcher'),
          title: String(s.title || 'Professor'),
          university: String(s.university || ''),
          department: String(s.department || ''),
          country: String(s.country || ''),
          researchGroup: String(s.researchGroup || ''),
          researchAreas: Array.isArray(s.researchAreas) ? (s.researchAreas as string[]) : [],
          officialProfileUrl: String(s.officialProfileUrl || ''),
          relevanceReason: String(s.relevanceReason || ''),
          acceptingStudentsNote: String(
            s.acceptingStudentsNote || 'Acceptance status not verified — verify on department portal.'
          ),
          verificationStatus: s.verificationStatus === 'verified' ? 'verified' : 'unverified',
        })),
      };

      candidate.supervisorMatches = result;
      candidate.updatedAt = new Date().toISOString();
      db.candidates[idx] = candidate;
      writeDb(db);
      res.json({ candidate, supervisorMatches: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Supervisor matching failed.';
      res.status(502).json({ error: `Supervisor matching failed: ${msg}` });
    }
  });

  app.post('/api/ai/improvement-plan', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.body as { candidateId?: string };
    const db = readDb();
    const idx = db.candidates.findIndex((c) => c.id === candidateId);
    if (idx === -1) {
      res.status(404).json({ error: 'Candidate not found.' });
      return;
    }
    const candidate = db.candidates[idx];
    const ai = getGeminiClient();

    if (!ai) {
      const fallback = buildFallbackImprovementPlan(
        candidate,
        'GEMINI_API_KEY not configured; generated deterministic rubric-based improvement plan.'
      );
      candidate.improvementPlan = fallback;
      db.candidates[idx] = candidate;
      writeDb(db);
      res.json({ candidate, improvementPlan: fallback });
      return;
    }

    try {
      const prompt = `Create a prioritized, actionable international scholarship improvement roadmap for this candidate based on their 100-mark assessment breakdown and intended pathway (${candidate.intendedProgramme.intendedDegree} in ${candidate.intendedProgramme.preferredResearchField || 'their target field'}).
Focus on the lowest-scoring or missing applicable categories first (e.g., IELTS score, Q1/Q2 Scopus/WoS publications, research proposal, lab/technical skills, verified documentation, country targeting, supervisor outreach).
Do NOT reference patents, copyrights, awards, or prior scholarships.

Candidate Profile & Scores:
${buildCandidateSummaryForAi(candidate)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              strategicSummary: { type: Type.STRING },
              recommendedCountries: { type: Type.ARRAY, items: { type: Type.STRING } },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    priority: { type: Type.STRING },
                    category: { type: Type.STRING },
                    actionTitle: { type: Type.STRING },
                    description: { type: Type.STRING },
                    targetMetric: { type: Type.STRING },
                    timeline: { type: Type.STRING },
                  },
                  required: ['priority', 'category', 'actionTitle', 'description', 'targetMetric', 'timeline'],
                },
              },
            },
            required: ['strategicSummary', 'recommendedCountries', 'items'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        strategicSummary: string;
        recommendedCountries: string[];
        items: Array<{
          priority: string;
          category: string;
          actionTitle: string;
          description: string;
          targetMetric: string;
          timeline: string;
        }>;
      };

      const plan: ImprovementPlanResult = {
        generatedAt: new Date().toISOString(),
        isFallbackMode: false,
        strategicSummary: parsed.strategicSummary || '',
        recommendedCountries: Array.isArray(parsed.recommendedCountries) ? parsed.recommendedCountries : [],
        items: (Array.isArray(parsed.items) ? parsed.items : []).map((it, i) => ({
          id: `imp_${Date.now()}_${i}`,
          priority: it.priority === 'Critical' || it.priority === 'High' ? it.priority : 'Medium',
          category: it.category,
          actionTitle: it.actionTitle,
          description: it.description,
          targetMetric: it.targetMetric,
          timeline: it.timeline,
        })),
      };

      candidate.improvementPlan = plan;
      candidate.updatedAt = new Date().toISOString();
      db.candidates[idx] = candidate;
      writeDb(db);
      res.json({ candidate, improvementPlan: plan });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Improvement plan generation failed.';
      const fallback = buildFallbackImprovementPlan(
        candidate,
        `Live AI generation failed (${msg}). Generated deterministic improvement plan.`
      );
      candidate.improvementPlan = fallback;
      db.candidates[idx] = candidate;
      writeDb(db);
      res.json({ candidate, improvementPlan: fallback });
    }
  });

  app.post(
    '/api/ai/parse-documents',
    requireAuth,
    upload.array('files', 6),
    async (req: AuthenticatedRequest, res: Response) => {
      const files = (req.files as Express.Multer.File[] | undefined) || [];
      if (files.length === 0) {
        res.status(400).json({ error: 'Please upload at least one CV, transcript, or research document.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.json({
          extracted: {},
          extractionNotes:
            'AI document extraction requires GEMINI_API_KEY in Settings > Secrets. Your uploaded documents can still be attached to the candidate profile and assessed manually.',
          isFallbackMode: true,
          fallbackNotice: 'GEMINI_API_KEY is not configured; automatic document extraction is unavailable.',
        });
        return;
      }

      try {
        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
          {
            text: `Extract structured candidate academic, research, English proficiency, publication, conference, and experience data from the attached document(s) (CV, transcripts, certificates, or research proposal).
CRITICAL RULES:
1. Only extract facts explicitly present in the documents. Never invent grades, CGPA, DOIs, dates, or publications.
2. For any field not found, omit it or leave empty string.
3. Do NOT extract or score copyrights, patents, awards, prizes, or previously received scholarships.
4. Set evidenceVerified to false (the consultancy verifies originals separately unless uploaded directly as official evidence).
5. Return ONLY valid JSON inside a \`\`\`json code block matching this shape:
{
  "personalInfo": {
    "fullName": "",
    "email": "",
    "contactNumber": "",
    "nationality": "",
    "countryOfResidence": "",
    "dateOfBirth": "YYYY-MM-DD or empty",
    "currentLocation": ""
  },
  "intendedProgramme": {
    "intendedDegree": "Bachelor's | Master's | MS | MPhil | PhD",
    "preferredResearchField": "",
    "preferredCountries": []
  },
  "qualifications": {
    "matriculation": { "status": "completed | not_completed | not_applicable", "institution": "", "obtainedMarks": "", "totalMarks": "", "percentage": "" },
    "intermediate": { "status": "completed | not_completed | not_applicable", "institution": "", "obtainedMarks": "", "totalMarks": "", "percentage": "" },
    "bachelors": { "status": "completed | not_completed | not_applicable", "degreeTitle": "", "university": "", "country": "", "cgpa": "", "totalScale": 4.0, "completionYear": "" },
    "masters": { "status": "completed | not_completed | not_applicable", "degreeTitle": "", "university": "", "country": "", "cgpa": "", "totalScale": 4.0, "completionYear": "" }
  },
  "englishProficiency": {
    "testType": "IELTS | TOEFL | PTE | Duolingo | MOI | None",
    "overallScore": "",
    "testDate": "",
    "validityDate": "",
    "certificateNumber": ""
  },
  "publications": [
    {
      "title": "",
      "journalName": "",
      "publicationYear": "",
      "doiOrUrl": "",
      "indexing": "Scopus | Web of Science | Other indexed journals | Non-indexed publications",
      "quartile": "Q1 | Q2 | Q3 | Q4 | N/A",
      "authorship": "First Author | Corresponding Author | Co-Author",
      "publicationType": "Journal Article | Review Article | Conference Paper | Book Chapter"
    }
  ],
  "conferences": [
    {
      "title": "",
      "scope": "International | National",
      "presentationType": "Oral | Poster",
      "year": ""
    }
  ],
  "experiences": [
    {
      "organization": "",
      "jobTitle": "",
      "experienceType": "Research | Academic / Teaching | Laboratory | Industry / Professional",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "isCurrent": false,
      "responsibilities": "",
      "researchActivities": "",
      "technicalExpertise": "",
      "softwareSkills": ""
    }
  ],
  "researchProfile": {
    "previousThesisTitle": "",
    "researchAbstract": "",
    "researchInterests": "",
    "researchMethodology": "",
    "researchTechniques": "",
    "laboratoryExpertise": "",
    "dataAnalysisSkills": "",
    "scientificSoftware": "",
    "intendedResearchTopic": ""
  },
  "extractionNotes": "Brief summary of what was extracted and any gaps the user should verify."
}`,
          },
        ];

        for (const file of files) {
          const ext = path.extname(file.originalname).toLowerCase();
          if (ext === '.pdf' || ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') {
            parts.push({
              inlineData: {
                mimeType: file.mimetype || (ext === '.pdf' ? 'application/pdf' : 'image/jpeg'),
                data: file.buffer.toString('base64'),
              },
            });
          } else if (ext === '.txt' || ext === '.md' || ext === '.csv') {
            parts.push({
              text: `--- Document: ${file.originalname} ---\n${file.buffer.toString('utf8').slice(0, 40000)}`,
            });
          } else if (ext === '.docx') {
            const docText = extractDocxXmlText(file.buffer);
            if (docText) {
              parts.push({
                text: `--- DOCX Document: ${file.originalname} ---\n${docText.slice(0, 40000)}`,
              });
            }
          }
        }

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: { parts },
        });

        const parsed = extractJsonBlock(response.text ?? '{}') as Record<string, unknown>;
        res.json({
          extracted: parsed,
          extractionNotes: String(parsed.extractionNotes || 'Profile fields extracted from uploaded documents.'),
          isFallbackMode: false,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Document parsing failed.';
        res.status(502).json({ error: `Document extraction failed: ${msg}` });
      }
    }
  );

  app.post('/api/ai/full-assessment', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.body as { candidateId?: string };
    const db = readDb();
    const idx = db.candidates.findIndex((c) => c.id === candidateId);
    if (idx === -1) {
      res.status(404).json({ error: 'Candidate not found.' });
      return;
    }

    const candidate = db.candidates[idx];
    const warnings: string[] = [];
    const authHeader = req.headers.authorization || '';
    const baseUrl = `http://127.0.0.1:${PORT}`;

    const tasks: Array<Promise<{ key: string; ok: boolean; error?: string }>> = [
      fetch(`${baseUrl}/api/ai/eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ candidateId }),
      }).then(async (r) => ({ key: 'Eligibility', ok: r.ok, error: r.ok ? undefined : await r.text() })),
      fetch(`${baseUrl}/api/ai/improvement-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ candidateId }),
      }).then(async (r) => ({ key: 'Improvement Plan', ok: r.ok, error: r.ok ? undefined : await r.text() })),
      fetch(`${baseUrl}/api/ai/scholarships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          candidateId,
          targetCountries:
            candidate.intendedProgramme.preferredCountries.length > 0
              ? candidate.intendedProgramme.preferredCountries
              : db.settings.defaultTargetCountries,
          degreeFilter: candidate.intendedProgramme.intendedDegree,
        }),
      }).then(async (r) => ({ key: 'University & Scholarships', ok: r.ok, error: r.ok ? undefined : await r.text() })),
    ];

    if (candidate.intendedProgramme.intendedDegree !== "Bachelor's") {
      tasks.push(
        fetch(`${baseUrl}/api/ai/supervisors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
          body: JSON.stringify({
            candidateId,
            targetCountries:
              candidate.intendedProgramme.preferredCountries.length > 0
                ? candidate.intendedProgramme.preferredCountries
                : db.settings.defaultTargetCountries,
          }),
        }).then(async (r) => ({ key: 'Supervisor Matching', ok: r.ok, error: r.ok ? undefined : await r.text() }))
      );
    }

    // Run sequentially or gently to avoid writeDb race on db.json!
    for (const task of tasks) {
      try {
        const result = await task;
        if (!result.ok) {
          warnings.push(`${result.key}: ${result.error || 'Unavailable'}`);
        }
      } catch (e) {
        warnings.push(e instanceof Error ? e.message : 'AI step failed.');
      }
    }

    const updatedDb = readDb();
    const updatedCandidate = updatedDb.candidates.find((c) => c.id === candidateId) || candidate;
    res.json({ candidate: updatedCandidate, warnings });
  });

  // --- VITE / STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UBAID ULLAH ENTERPRISES server running at http://0.0.0.0:${PORT}`);
  });
}

function buildFallbackEligibility(candidate: Candidate, notice: string): AiEligibilityReport {
  const { assessment, qualifications, englishProficiency } = candidate;
  const engCat = assessment.categories.find((c) => c.key === 'english');
  const bachCat = assessment.categories.find((c) => c.key === 'bachelors');
  const mastCat = assessment.categories.find((c) => c.key === 'masters');
  const pubCat = assessment.categories.find((c) => c.key === 'publications');

  const engOk = (engCat?.marksObtained ?? 0) >= 6;
  const interOk = (assessment.categories.find((c) => c.key === 'intermediate')?.marksObtained ?? 0) >= 6;
  const bachCompleted = qualifications.bachelors.status === 'completed';
  const mastCompleted = qualifications.masters.status === 'completed';

  return {
    generatedAt: new Date().toISOString(),
    model: 'rule-based-fallback',
    isFallbackMode: true,
    fallbackNotice: notice,
    executiveSummary: `Preliminary deterministic screening indicates a normalized score of ${assessment.normalizedScore}/100 (${assessment.classification}).`,
    pathways: [
      {
        pathway: "Bachelor's",
        overallStatus: interOk && engOk ? 'Eligible' : interOk ? 'Additional Requirements' : 'Potentially Eligible',
        summary: interOk
          ? 'Secondary school qualifications meet baseline undergraduate entry benchmarks.'
          : 'Strengthen Intermediate/FSc grades or verify official transcripts.',
        tracks: [
          {
            trackName: 'Undergraduate Admissions & Merit Scholarships',
            status: interOk && engOk ? 'Eligible' : 'Additional Requirements',
            reasoning: `Intermediate score ${assessment.categories[2].marksObtained}/10; English ${engCat?.marksObtained ?? 0}/10 (${englishProficiency.testType}).`,
            requirements: ['Verified Matric & Intermediate transcripts', 'Valid English test (IELTS 6.0+ recommended)'],
          },
          {
            trackName: 'Fully Funded Government Undergraduate Scholarships',
            status: (assessment.categories[2].marksObtained ?? 0) >= 8 && engOk ? 'Potentially Eligible' : 'Not Currently Eligible',
            reasoning: 'Competitive fully funded undergraduate awards generally require >=80% secondary marks and strong English proficiency.',
            requirements: ['>=80% Intermediate/FSc', 'IELTS 6.5–7.0+'],
          },
        ],
      },
      {
        pathway: "Master's / MPhil",
        overallStatus: bachCompleted && (bachCat?.marksObtained ?? 0) >= 7 && engOk ? 'Eligible' : bachCompleted ? 'Additional Requirements' : 'Not Currently Eligible',
        summary: bachCompleted
          ? "Completed Bachelor's qualification evaluated for Master's/MPhil pathways."
          : "Bachelor's degree must be completed (or near completion) for Master's/MPhil admissions.",
        tracks: [
          {
            trackName: "Master's / Research-Based Master's Programmes",
            status: bachCompleted && engOk ? 'Eligible' : bachCompleted ? 'Additional Requirements' : 'Not Currently Eligible',
            reasoning: `Bachelor's category score: ${bachCat?.marksObtained ?? 0}/10; English: ${engCat?.marksObtained ?? 0}/10.`,
            requirements: ["Verified Bachelor's transcript & degree", 'Statement of research/study purpose'],
          },
          {
            trackName: 'Government Scholarships & Graduate Assistantships',
            status: bachCompleted && (bachCat?.marksObtained ?? 0) >= 7 && engOk ? 'Potentially Eligible' : 'Additional Requirements',
            reasoning: 'Requires strong CGPA (>=3.0/4.0), verified English proficiency, and relevant academic background.',
            requirements: ['CGPA >=3.0/4.0 equivalent', 'IELTS 6.5–7.0+ or TOEFL 90+'],
          },
        ],
      },
      {
        pathway: 'PhD',
        overallStatus:
          mastCompleted && (mastCat?.marksObtained ?? 0) >= 7 && engOk && (pubCat?.marksObtained ?? 0) >= 2
            ? 'Eligible'
            : mastCompleted
            ? 'Potentially Eligible'
            : 'Not Currently Eligible',
        summary: mastCompleted
          ? "Postgraduate qualification recorded; competitiveness depends on indexed publications, research proposal, and supervisor alignment."
          : 'PhD admissions normally require a completed Master’s/MPhil qualification.',
        tracks: [
          {
            trackName: 'Doctoral Admissions & Fully Funded PhD Positions',
            status: mastCompleted && engOk ? 'Potentially Eligible' : 'Not Currently Eligible',
            reasoning: `Master's score: ${mastCat?.marksObtained ?? 0}/10; Publications: ${pubCat?.marksObtained ?? 0}/10.`,
            requirements: ['Completed MS/MPhil degree', 'Research proposal', 'Supervisor alignment'],
          },
          {
            trackName: 'Supervisor-Funded & Government Doctoral Programmes',
            status: mastCompleted && (pubCat?.marksObtained ?? 0) >= 3 && engOk ? 'Eligible' : 'Additional Requirements',
            reasoning: 'Competitive doctoral funding favors candidates with verified Q1/Q2 Scopus/WoS publications and IELTS >=6.5–7.0.',
            requirements: ['Indexed Q1/Q2 publications', 'Detailed PhD research proposal', 'Formal supervisor endorsement'],
          },
        ],
      },
    ],
  };
}

function buildFallbackImprovementPlan(candidate: Candidate, notice: string): ImprovementPlanResult {
  const weakCats = candidate.assessment.categories
    .filter((c) => c.applicable && (c.status === 'missing' || c.status === 'unverified' || c.marksObtained < 6))
    .sort((a, b) => a.marksObtained - b.marksObtained);

  return {
    generatedAt: new Date().toISOString(),
    isFallbackMode: true,
    fallbackNotice: notice,
    strategicSummary: `Prioritized improvement roadmap targeting ${weakCats.length} growth area(s) to raise normalized competitiveness from ${candidate.assessment.normalizedScore}/100 toward 85+ (Excellent).`,
    recommendedCountries:
      candidate.intendedProgramme.preferredCountries.length > 0
        ? candidate.intendedProgramme.preferredCountries
        : ['Germany', 'Netherlands', 'Sweden', 'United Kingdom', 'Australia'],
    items: weakCats.slice(0, 6).map((c, idx) => ({
      id: `imp_fb_${idx}`,
      priority: c.marksObtained <= 2 ? 'Critical' : c.marksObtained < 5 ? 'High' : 'Medium',
      category: c.name,
      actionTitle:
        c.status === 'unverified'
          ? `Verify & Upload Documentation for ${c.name}`
          : `Strengthen ${c.name}`,
      description: c.explanation,
      targetMetric: `Increase ${c.name} from ${c.marksObtained}/10 to >= 7/10`,
      timeline: idx < 2 ? 'Immediate (2–4 weeks)' : 'Short-term (1–3 months)',
    })),
  };
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
