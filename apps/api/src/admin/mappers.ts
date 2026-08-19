import type {
  QuestionBankAdmin,
  QuestionAdmin,
  ChallengeAdmin,
  ParticipantAdmin,
  AuditLogDTO,
  AdminUserDTO,
} from '@crudd/shared';

/**
 * Prisma entity -> public DTO mappers (directive #30).
 * Keeps internal DB shapes from leaking directly out of the API.
 */

const iso = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

export function toBankAdmin(bank: any): QuestionBankAdmin {
  return {
    id: bank.id,
    title: bank.title,
    description: bank.description ?? null,
    subject: bank.subject,
    category: bank.category ?? null,
    tags: bank.tags ?? [],
    status: bank.status,
    questionCount: bank._count?.questions ?? bank.questionCount ?? 0,
    createdBy: bank.createdBy ?? null,
    createdAt: new Date(bank.createdAt).toISOString(),
    updatedAt: new Date(bank.updatedAt ?? bank.createdAt).toISOString(),
    publishedAt: iso(bank.publishedAt),
    archivedAt: iso(bank.archivedAt),
  };
}

export function toQuestionAdmin(q: any): QuestionAdmin {
  return {
    id: q.id,
    bankId: q.bankId,
    bankTitle: q.bank?.title,
    questionText: q.questionText,
    options: (q.options as string[]) ?? [],
    correctIndex: q.correctIndex,
    explanation: q.explanation ?? null,
    difficulty: q.difficulty ?? null,
    tags: q.tags ?? [],
    source: q.source ?? null,
    status: q.status,
    createdAt: new Date(q.createdAt).toISOString(),
    updatedAt: new Date(q.updatedAt ?? q.createdAt).toISOString(),
    publishedAt: iso(q.publishedAt),
  };
}

export function toChallengeAdmin(c: any): ChallengeAdmin {
  return {
    id: c.id,
    shareSlug: c.shareSlug,
    bankId: c.bankId,
    bankTitle: c.bank?.title ?? '',
    questionCount: c.questionCount,
    maxPlayers: c.maxPlayers,
    timerSeconds: c.timerSeconds,
    status: c.status,
    participantCount: c._count?.participants ?? c.participants?.length ?? 0,
    createdAt: new Date(c.createdAt).toISOString(),
  };
}

export function toParticipantAdmin(p: any): ParticipantAdmin {
  return {
    id: p.id,
    challengeId: p.challengeId,
    challengeSlug: p.challenge?.shareSlug ?? '',
    username: p.username ?? null,
    role: p.role,
    score: p.score,
    joinedAt: new Date(p.joinedAt).toISOString(),
    leftAt: iso(p.leftAt),
  };
}

export function toAuditLogDTO(log: any): AuditLogDTO {
  return {
    id: log.id,
    adminUserId: log.adminUserId ?? null,
    adminEmail: log.adminUser?.email ?? null,
    action: log.action,
    entityType: log.entityType ?? null,
    entityId: log.entityId ?? null,
    metadata: (log.metadata as Record<string, unknown>) ?? null,
    createdAt: new Date(log.createdAt).toISOString(),
  };
}

export function toAdminUserDTO(u: any): AdminUserDTO {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName ?? null,
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: iso(u.lastLoginAt),
    createdAt: new Date(u.createdAt).toISOString(),
  };
}
