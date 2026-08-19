// Client-side view of the admin DTOs returned by the API.

export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type ChallengeStatus = 'LOBBY' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface BankAdmin {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  category: string | null;
  tags: string[];
  status: ContentStatus;
  questionCount: number;
  createdBy: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface BankHealth {
  score: number;
  publishable: boolean;
  totalQuestions: number;
  validQuestions: number;
  checks: { id: string; label: string; severity: 'error' | 'warning'; passed: boolean; count: number }[];
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
  difficulty: Difficulty | null;
  tags: string[];
  source: string | null;
  status: ContentStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChallengeAdmin {
  id: string;
  bankId: string;
  bankTitle: string;
  shareSlug: string;
  status: ChallengeStatus;
  questionCount: number;
  timerSeconds: number;
  maxPlayers: number;
  participantCount: number;
  createdAt: string;
}

export interface ParticipantAdmin {
  id: string;
  challengeId: string;
  challengeSlug?: string;
  username: string | null;
  role: string;
  score: number;
  joinedAt: string;
}

export interface AuditLogDTO {
  id: string;
  adminUserId: string | null;
  adminEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface DashboardStats {
  totalBanks: number;
  totalQuestions: number;
  publishedQuestions: number;
  draftQuestions: number;
  totalChallenges: number;
  activeChallenges: number;
  finishedChallenges: number;
  totalParticipants: number;
}

export interface Analytics {
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

export interface AdminSettings {
  minQuestionsForPublication: number;
  defaultTimerSeconds: number;
  defaultQuestionCount: number;
  maxPlayersPerChallenge: number;
  allowPublicBankBrowsing: boolean;
  maintenanceMode: boolean;
}

export interface ImportPreviewRow {
  index: number;
  status: 'ok' | 'warning' | 'error';
  errors: string[];
  warnings: string[];
  question?: {
    questionText: string;
    options: string[];
    correctIndex: number;
    explanation?: string | null;
    difficulty?: Difficulty | null;
    tags?: string[];
    source?: string | null;
  };
}

export interface ImportPreview {
  detected: number;
  valid: number;
  invalid: number;
  rows: ImportPreviewRow[];
}
