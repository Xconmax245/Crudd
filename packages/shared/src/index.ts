export type ChallengeStatus = 'LOBBY' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
export type ParticipantRole = 'HOST' | 'PLAYER';

// Phase 2 — real-time match engine contract
export * from './match';

export interface QuestionBank {
  id: string;
  title: string;
  subject: string;
  questionCount: number;
  createdAt: Date;
}

export interface BankDetail {
  id: string;
  title: string;
  subject: string;
  questionCount: number;
  createdAt: Date;
}

export interface ChallengePreview {
  id: string;
  bankTitle: string;
  questionCount: number;
  timerSeconds: number;
  maxPlayers: number;
  status: ChallengeStatus;
  shareSlug: string;
}

// Phase 2 placeholders
export interface MatchParticipant {
  id: string;
  challengeId: string;
  sessionId: string;
  username: string | null;
  role: ParticipantRole;
  score: number;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface MatchAnswer {
  id: string;
  challengeId: string;
  questionId: string;
  participantId: string;
  selectedIndex: number;
  isCorrect: boolean;
  responseMs: number;
  pointsAwarded: number;
  answeredAt: Date;
}

// ===========================================================================
// Admin DTOs (Phase 1.5)
// These are the public API contract shapes returned by /api/admin/*.
// They are intentionally decoupled from internal Prisma entities.
// ===========================================================================

export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'MODERATOR';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

// Consistent API error envelope (directive #37).
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminUserDTO {
  id: string;
  email: string;
  displayName: string | null;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminStats {
  totalBanks: number;
  totalQuestions: number;
  publishedQuestions: number;
  draftQuestions: number;
  totalChallenges: number;
  activeChallenges: number;
  finishedChallenges: number;
  totalParticipants: number;
}

export interface QuestionBankAdmin {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  category: string | null;
  tags: string[];
  status: ContentStatus;
  questionCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
}

export interface BankStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
  easy: number;
  medium: number;
  hard: number;
  missingExplanation: number;
  missingSource: number;
  missingDifficulty: number;
}

export interface BankHealthCheckDTO {
  code: string;
  label: string;
  passed: boolean;
  critical: boolean;
  detail?: string;
}

export interface BankHealthDTO {
  score: number;
  publishable: boolean;
  totalQuestions: number;
  validQuestions: number;
  checks: BankHealthCheckDTO[];
  warnings: string[];
}

export interface QuestionAdmin {
  id: string;
  bankId: string;
  bankTitle?: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  difficulty: string | null;
  tags: string[];
  source: string | null;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface ChallengeAdmin {
  id: string;
  shareSlug: string;
  bankId: string;
  bankTitle: string;
  questionCount: number;
  maxPlayers: number;
  timerSeconds: number;
  status: ChallengeStatus;
  participantCount: number;
  createdAt: string;
}

export interface ParticipantAdmin {
  id: string;
  challengeId: string;
  challengeSlug: string;
  username: string | null;
  role: ParticipantRole;
  score: number;
  joinedAt: string;
  leftAt: string | null;
}

export interface AuditLogDTO {
  id: string;
  adminUserId: string | null;
  adminEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AnalyticsDTO {
  totalBanks: number;
  publishedBanks: number;
  totalQuestions: number;
  publishedQuestions: number;
  challengesCreated: number;
  challengesCompleted: number;
  challengesCancelled: number;
  participantCount: number;
  averagePlayersPerChallenge: number;
  topBanks: { bankId: string; title: string; challengeCount: number }[];
}

export interface PlatformSettings {
  platformName: string;
  publicAppUrl: string;
  adminAppUrl: string;
  defaultTimerSeconds: number;
  defaultMaxPlayers: number;
  maxQuestionCount: number;
  minQuestionsForPublication: number;
  requireExplanations: boolean;
  requireSources: boolean;
}

export interface ImportSummaryDTO {
  imported: number;
  skipped: number;
  failed: number;
}

