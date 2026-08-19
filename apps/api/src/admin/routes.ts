import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '@crudd/database';
import {
  createBankSchema,
  updateBankSchema,
  createQuestionSchema,
  updateQuestionSchema,
  bulkQuestionActionSchema,
  importQuestionsSchema,
  updateSettingsSchema,
  bankListQuerySchema,
  questionListQuerySchema,
  computeBankHealth,
  buildCsvImportPreview,
  buildJsonImportPreview,
  MAX_IMPORT_ROWS,
  type QuestionInput,
} from '@crudd/validation';
import { requireAdmin } from './auth';
import { ApiError, Errors, sendError } from './errors';
import { recordAudit } from './audit';
import { getSettings, saveSettings } from './settings';
import {
  toBankAdmin,
  toQuestionAdmin,
  toChallengeAdmin,
  toParticipantAdmin,
  toAuditLogDTO,
  toAdminUserDTO,
} from './mappers';

/** Recompute and persist a bank's cached questionCount. */
async function syncBankCount(bankId: string) {
  const count = await db.question.count({ where: { bankId, status: { not: 'ARCHIVED' } } });
  await db.questionBank.update({ where: { id: bankId }, data: { questionCount: count } });
  return count;
}

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Every admin route is authenticated + authorized (directive #26).
  fastify.addHook('preHandler', requireAdmin);

  // Convert thrown ApiErrors into the standard envelope.
  fastify.setErrorHandler((error: any, _request, reply) => {
    if (error instanceof ApiError) return sendError(reply, error);
    if (error?.validation || error?.name === 'ZodError') {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: error?.message ?? 'Invalid request',
          details: error?.validation ?? error?.issues,
        },
      });
    }
    return sendError(reply, error);
  });


  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------
  fastify.get('/api/admin/me', async (request) => {
    const admin = request.admin!;
    await db.adminUser.update({
      where: { id: admin.adminUser.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => undefined);
    return {
      id: admin.adminUser.id,
      email: admin.adminUser.email,
      displayName: admin.adminUser.displayName,
      role: admin.adminUser.role,
      isActive: admin.adminUser.isActive,
    };
  });

  // -------------------------------------------------------------------------
  // Dashboard stats (directive #6)
  // -------------------------------------------------------------------------
  fastify.get('/api/admin/stats', async () => {
    const [
      totalBanks,
      totalQuestions,
      publishedQuestions,
      draftQuestions,
      totalChallenges,
      activeChallenges,
      finishedChallenges,
      totalParticipants,
    ] = await Promise.all([
      db.questionBank.count(),
      db.question.count(),
      db.question.count({ where: { status: 'PUBLISHED' } }),
      db.question.count({ where: { status: 'DRAFT' } }),
      db.challenge.count(),
      db.challenge.count({ where: { status: 'ACTIVE' } }),
      db.challenge.count({ where: { status: 'FINISHED' } }),
      db.matchParticipant.count(),
    ]);
    return {
      totalBanks,
      totalQuestions,
      publishedQuestions,
      draftQuestions,
      totalChallenges,
      activeChallenges,
      finishedChallenges,
      totalParticipants,
    };
  });

  // Recent activity for the overview page.
  fastify.get('/api/admin/activity', async () => {
    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { adminUser: { select: { email: true } } },
    });
    return logs.map(toAuditLogDTO);
  });

  // -------------------------------------------------------------------------
  // Question Banks (directives #7-#10)
  // -------------------------------------------------------------------------
  fastify.get('/api/admin/banks', async (request) => {
    const q = bankListQuerySchema.parse(request.query);
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.subject) where.subject = { equals: q.subject, mode: 'insensitive' };
    if (q.category) where.category = { equals: q.category, mode: 'insensitive' };
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { subject: { contains: q.search, mode: 'insensitive' } },
        { tags: { has: q.search } },
      ];
    }

    const [total, banks] = await Promise.all([
      db.questionBank.count({ where }),
      db.questionBank.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { _count: { select: { questions: true } } },
      }),
    ]);

    return {
      data: banks.map(toBankAdmin),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
    };
  });

  fastify.post('/api/admin/banks', async (request, reply) => {
    const body = createBankSchema.parse(request.body);
    const bank = await db.questionBank.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        subject: body.subject,
        category: body.category ?? null,
        tags: body.tags ?? [],
        status: 'DRAFT',
        questionCount: 0,
        createdBy: request.admin!.adminUser.id,
      },
    });
    await recordAudit({
      adminUserId: request.admin!.adminUser.id,
      action: 'bank.create',
      entityType: 'bank',
      entityId: bank.id,
      metadata: { title: bank.title },
    });
    return reply.status(201).send(toBankAdmin(bank));
  });

  fastify.get('/api/admin/banks/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const bank = await db.questionBank.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });
    if (!bank) throw Errors.notFound('BANK_NOT_FOUND', 'Question bank not found');

    // Bank statistics (directive #10).
    const questions = await db.question.findMany({ where: { bankId: id } });
    const stats = {
      total: questions.length,
      published: questions.filter((x) => x.status === 'PUBLISHED').length,
      draft: questions.filter((x) => x.status === 'DRAFT').length,
      archived: questions.filter((x) => x.status === 'ARCHIVED').length,
      easy: questions.filter((x) => x.difficulty === 'EASY').length,
      medium: questions.filter((x) => x.difficulty === 'MEDIUM').length,
      hard: questions.filter((x) => x.difficulty === 'HARD').length,
      missingExplanation: questions.filter((x) => !x.explanation).length,
      missingSource: questions.filter((x) => !x.source).length,
      missingDifficulty: questions.filter((x) => !x.difficulty).length,
    };

    return { ...toBankAdmin(bank), stats };
  });

  // Bank health (directives #12, #18, #24)
  fastify.get('/api/admin/banks/:id/health', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const bank = await db.questionBank.findUnique({ where: { id } });
    if (!bank) throw Errors.notFound('BANK_NOT_FOUND', 'Question bank not found');

    const questions = await db.question.findMany({
      where: { bankId: id, status: { not: 'ARCHIVED' } },
    });
    const inputs: QuestionInput[] = questions.map((qq) => ({
      questionText: qq.questionText,
      options: qq.options as string[],
      correctIndex: qq.correctIndex,
      difficulty: qq.difficulty,
      tags: qq.tags,
      explanation: qq.explanation,
      source: qq.source,
    }));
    const health = computeBankHealth(inputs);
    const warnings: string[] = [];
    const missingExpl = questions.filter((x) => !x.explanation).length;
    const missingSrc = questions.filter((x) => !x.source).length;
    if (missingExpl) warnings.push(`${missingExpl} question(s) missing explanations`);
    if (missingSrc) warnings.push(`${missingSrc} question(s) missing sources`);

    return {
      score: health.score,
      publishable: health.publishable,
      totalQuestions: health.totalQuestions,
      validQuestions: health.validQuestions,
      checks: health.checks,
      warnings,
    };
  });

  fastify.patch('/api/admin/banks/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = updateBankSchema.parse(request.body);
    const existing = await db.questionBank.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('BANK_NOT_FOUND', 'Question bank not found');

    const bank = await db.questionBank.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.subject !== undefined ? { subject: body.subject } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
      include: { _count: { select: { questions: true } } },
    });
    await recordAudit({
      adminUserId: request.admin!.adminUser.id,
      action: 'bank.update',
      entityType: 'bank',
      entityId: id,
      metadata: { fields: Object.keys(body) },
    });
    return toBankAdmin(bank);
  });

  // Publish a bank (directive #20): requires passing critical health checks.
  fastify.post('/api/admin/banks/:id/publish', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const bank = await db.questionBank.findUnique({ where: { id } });
    if (!bank) throw Errors.notFound('BANK_NOT_FOUND', 'Question bank not found');

    const questions = await db.question.findMany({
      where: { bankId: id, status: { not: 'ARCHIVED' } },
    });
    const inputs: QuestionInput[] = questions.map((qq) => ({
      questionText: qq.questionText,
      options: qq.options as string[],
      correctIndex: qq.correctIndex,
    }));
    const health = computeBankHealth(inputs);
    const settings = await getSettings();
    if (questions.length < settings.minQuestionsForPublication) {
      throw Errors.conflict(
        'NOT_ENOUGH_QUESTIONS',
        `A bank needs at least ${settings.minQuestionsForPublication} question(s) to publish`,
      );
    }
    if (!health.publishable) {
      throw Errors.conflict('BANK_NOT_HEALTHY', 'Resolve critical validation errors before publishing');
    }

    const now = new Date();
    await db.$transaction([
      db.questionBank.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: now } }),
      // Publish all non-archived questions along with the bank.
      db.question.updateMany({
        where: { bankId: id, status: 'DRAFT' },
        data: { status: 'PUBLISHED', publishedAt: now },
      }),
    ]);
    await syncBankCount(id);
    await recordAudit({
      adminUserId: request.admin!.adminUser.id,
      action: 'bank.publish',
      entityType: 'bank',
      entityId: id,
    });
    const updated = await db.questionBank.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });
    return toBankAdmin(updated);
  });

  fastify.post('/api/admin/banks/:id/unpublish', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const bank = await db.questionBank.findUnique({ where: { id } });
    if (!bank) throw Errors.notFound('BANK_NOT_FOUND', 'Question bank not found');
    const updated = await db.questionBank.update({
      where: { id },
      data: { status: 'DRAFT', publishedAt: null },
      include: { _count: { select: { questions: true } } },
    });
    await recordAudit({
      adminUserId: request.admin!.adminUser.id,
      action: 'bank.unpublish',
      entityType: 'bank',
      entityId: id,
    });
    return toBankAdmin(updated);
  });

  // Archive (soft-delete semantics — directive #7).
  fastify.post('/api/admin/banks/:id/archive', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const bank = await db.questionBank.findUnique({ where: { id } });
    if (!bank) throw Errors.notFound('BANK_NOT_FOUND', 'Question bank not found');
    const updated = await db.questionBank.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
      include: { _count: { select: { questions: true } } },
    });
    await recordAudit({
      adminUserId: request.admin!.adminUser.id,
      action: 'bank.archive',
      entityType: 'bank',
      entityId: id,
    });
    return toBankAdmin(updated);
  });

  // Duplicate a bank with its questions (as DRAFT).
  fastify.post('/api/admin/banks/:id/duplicate', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const source = await db.questionBank.findUnique({ where: { id }, include: { questions: true } });
    if (!source) throw Errors.notFound('BANK_NOT_FOUND', 'Question bank not found');

    const copy = await db.questionBank.create({
      data: {
        title: `${source.title} (Copy)`,
        description: source.description,
        subject: source.subject,
        category: source.category,
        tags: source.tags,
        status: 'DRAFT',
        questionCount: source.questions.length,
        createdBy: request.admin!.adminUser.id,
        questions: {
          create: source.questions.map((qq) => ({
            questionText: qq.questionText,
            options: qq.options as any,
            correctIndex: qq.correctIndex,
            explanation: qq.explanation,
            difficulty: qq.difficulty,
            tags: qq.tags,
            source: qq.source,
            status: 'DRAFT',
          })),
        },
      },
      include: { _count: { select: { questions: true } } },
    });
    await recordAudit({
      adminUserId: request.admin!.adminUser.id,
      action: 'bank.duplicate',
      entityType: 'bank',
      entityId: copy.id,
      metadata: { sourceBankId: id },
    });
    return reply.status(201).send(toBankAdmin(copy));
  });

  // -------------------------------------------------------------------------
  // Questions (directives #11-#15)
  // -------------------------------------------------------------------------
  fastify.get('/api/admin/questions', async (request) => {
    const q = questionListQuerySchema.parse(request.query);
    const where: any = {};
    if (q.bankId) where.bankId = q.bankId;
    if (q.status) where.status = q.status;
    if (q.difficulty) where.difficulty = q.difficulty;
    if (q.search) {
      where.OR = [
        { questionText: { contains: q.search, mode: 'insensitive' } },
        { source: { contains: q.search, mode: 'insensitive' } },
        { tags: { has: q.search } },
      ];
    }

    const [total, questions] = await Promise.all([
      db.question.count({ where }),
      db.question.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { bank: { select: { title: true } } },
      }),
    ]);

    return {
      data: questions.map(toQuestionAdmin),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
    };
  });

  fastify.get('/api/admin/banks/:id/questions', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const questions = await db.question.findMany({
      where: { bankId: id },
      orderBy: { createdAt: 'asc' },
    });
    return questions.map(toQuestionAdmin);
  });

  fastify.post('/api/admin/banks/:id/questions', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = createQuestionSchema.parse(request.body);
    const bank = await db.questionBank.findUnique({ where: { id } });
    if (!bank) throw Errors.notFound('BANK_NOT_FOUND', 'Question bank not found');

    const question = await db.question.create({
      data: {
        bankId: id,
        questionText: body.questionText,
        options: body.options as any,
        correctIndex: body.correctIndex,
        explanation: body.explanation ?? null,
        difficulty: body.difficulty ?? null,
        tags: body.tags ?? [],
        source: body.source ?? null,
        status: body.status ?? 'DRAFT',
        publishedAt: body.status === 'PUBLISHED' ? new Date() : null,
      },
    });
    await syncBankCount(id);
    await recordAudit({
      adminUserId: request.admin!.adminUser.id,
      action: 'question.create',
      entityType: 'question',
      entityId: question.id,
      metadata: { bankId: id },
    });
    return reply.status(201).send(toQuestionAdmin(question));
  });

  fastify.patch('/api/admin/questions/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = updateQuestionSchema.parse(request.body);
    const existing = await db.question.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('QUESTION_NOT_FOUND', 'Question not found');

    // Guard correctIndex against the effective option list.
    const options = body.options ?? (existing.options as string[]);
    const correctIndex = body.correctIndex ?? existing.correctIndex;
    if (correctIndex >= options.length) {
      throw Errors.validation('correctIndex must reference an existing option');
    }

    const question = await db.question.update({
      where: { id },
      data: {
        ...(body.questionText !== undefined ? { questionText: body.questionText } : {}),
        ...(body.options !== undefined ? { options: body.options as any } : {}),
        ...(body.correctIndex !== undefined ? { correctIndex: body.correctIndex } : {}),
        ...(body.explanation !== undefined ? { explanation: body.explanation } : {}),
        ...(body.difficulty !== undefined ? { difficulty: body.difficulty } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(body.source !== undefined ? { source: body.source } : {}),
        ...(body.status !== undefined
          ? { status: body.status, publishedAt: body.status === 'PUBLISHED' ? new Date() : existing.publishedAt }
          : {}),
      },
    });
    await recordAudit({
      adminUserId: request.admin!.adminUser.id,
      action: 'question.update',
      entityType: 'question',
      entityId: id,
      metadata: { fields: Object.keys(body) },
    });
    return toQuestionAdmin(question);
  });

  fastify.post('/api/admin/questions/:id/publish', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const existing = await db.question.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('QUESTION_NOT_FOUND', 'Question not found');
    const question = await db.question.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    await recordAudit({
      adminUserId: request.admin!.adminUser.id,
      action: 'question.publish',
      entityType: 'question',
      entityId: id,
    });
    return toQuestionAdmin(question);
  });

  fastify.post('/api/admin/questions/:id/archive', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const existing = await db.question.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('QUESTION_NOT_FOUND', 'Question not found');
    const question = await db.question.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    await syncBankCount(existing.bankId);
    await recordAudit({
      adminUserId: request.admin!.adminUser.id,
      action: 'question.archive',
      entityType: 'question',
      entityId: id,
    });
    return toQuestionAdmin(question);
  });

  // Bulk operations (directive #15)
  fastify.post('/api/admin/questions/bulk', async (request) => {
    const body = bulkQuestionActionSchema.parse(request.body);
    const now = new Date();
    let data: any = {};
    if (body.action === 'publish') data = { status: 'PUBLISHED', publishedAt: now };
    else if (body.action === 'unpublish') data = { status: 'DRAFT', publishedAt: null };
    else if (body.action === 'archive') data = { status: 'ARCHIVED', archivedAt: now };
    else if (body.action === 'move') data = { bankId: body.targetBankId };

    if (body.action === 'move') {
      const target = await db.questionBank.findUnique({ where: { id: body.targetBankId! } });
      if (!target) throw Errors.notFound('BANK_NOT_FOUND', 'Target bank not found');
    }

    // Track affected banks so we can resync counts.
    const affected = await db.question.findMany({
      where: { id: { in: body.questionIds } },
      select: { bankId: true },
    });
    const result = await db.question.updateMany({ where: { id: { in: body.questionIds } }, data });

    const bankIds = new Set<string>(affected.map((a) => a.bankId));
    if (body.action === 'move' && body.targetBankId) bankIds.add(body.targetBankId);
    await Promise.all([...bankIds].map((bid) => syncBankCount(bid)));

    await recordAudit({
      adminUserId: request.admin!.adminUser.id,
      action: `question.bulk.${body.action}`,
      entityType: 'question',
      metadata: { count: result.count, targetBankId: body.targetBankId },
    });
    return { updated: result.count };
  });

  // Duplicate-detection report for a bank (directive #19).
  fastify.get('/api/admin/banks/:id/duplicates', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const questions = await db.question.findMany({ where: { bankId: id } });
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
    const byKey = new Map<string, { id: string; questionText: string }[]>();
    for (const qq of questions) {
      const key = norm(qq.questionText);
      const arr = byKey.get(key) ?? [];
      arr.push({ id: qq.id, questionText: qq.questionText });
      byKey.set(key, arr);
    }
    const groups = [...byKey.values()].filter((arr) => arr.length > 1);
    return { groups };
  });

  // -------------------------------------------------------------------------
  // Import / Export (directives #16, #17, #36)
  // -------------------------------------------------------------------------

  // Stage 1: validate + preview (no writes).
  fastify.post('/api/admin/banks/:id/questions/import/preview', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = importQuestionsSchema.parse(request.body);
    const bank = await db.questionBank.findUnique({ where: { id } });
    if (!bank) throw Errors.notFound('BANK_NOT_FOUND', 'Question bank not found');

    const preview = body.format === 'csv'
      ? buildCsvImportPreview(body.content)
      : buildJsonImportPreview(body.content);

    if (preview.detected > MAX_IMPORT_ROWS) {
      throw Errors.validation(`Import exceeds the ${MAX_IMPORT_ROWS}-row limit`);
    }
    return preview;
  });

  // Stage 2: transactional import of valid rows (directive #16).
  fastify.post('/api/admin/banks/:id/questions/import', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = importQuestionsSchema.parse(request.body);
    const bank = await db.questionBank.findUnique({ where: { id } });
    if (!bank) throw Errors.notFound('BANK_NOT_FOUND', 'Question bank not found');

    const preview = body.format === 'csv'
      ? buildCsvImportPreview(body.content)
      : buildJsonImportPreview(body.content);

    if (preview.detected > MAX_IMPORT_ROWS) {
      throw Errors.validation(`Import exceeds the ${MAX_IMPORT_ROWS}-row limit`);
    }

    const validRows = preview.rows.filter((r) => r.status !== 'error' && r.question);
    const failed = preview.rows.filter((r) => r.status === 'error').length;
    const status = body.defaultStatus ?? 'DRAFT';
    const now = new Date();

    if (validRows.length > 0) {
      await db.$transaction(
        validRows.map((r) =>
          db.question.create({
            data: {
              bankId: id,
              questionText: r.question!.questionText,
              options: r.question!.options as any,
              correctIndex: r.question!.correctIndex,
              explanation: r.question!.explanation,
              difficulty: r.question!.difficulty,
              tags: r.question!.tags,
              source: r.question!.source,
              status,
              publishedAt: status === 'PUBLISHED' ? now : null,
            },
          }),
        ),
      );
    }
    await syncBankCount(id);

    const summary = { imported: validRows.length, skipped: 0, failed };
    await recordAudit({
      adminUserId: request.admin!.adminUser.id,
      action: 'question.import',
      entityType: 'bank',
      entityId: id,
      metadata: { ...summary, format: body.format },
    });
    return summary;
  });

  // Export a bank as JSON or CSV (directive #17).
  fastify.get('/api/admin/banks/:id/questions/export', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { format } = z.object({ format: z.enum(['csv', 'json']).default('json') }).parse(request.query);
    const bank = await db.questionBank.findUnique({ where: { id }, include: { questions: true } });
    if (!bank) throw Errors.notFound('BANK_NOT_FOUND', 'Question bank not found');

    await recordAudit({
      adminUserId: request.admin!.adminUser.id,
      action: 'question.export',
      entityType: 'bank',
      entityId: id,
      metadata: { format, count: bank.questions.length },
    });

    if (format === 'json') {
      return {
        title: bank.title,
        subject: bank.subject,
        questions: bank.questions.map((qq) => ({
          question: qq.questionText,
          options: qq.options,
          correctIndex: qq.correctIndex,
          explanation: qq.explanation ?? undefined,
          difficulty: qq.difficulty ?? undefined,
          tags: qq.tags,
          source: qq.source ?? undefined,
        })),
      };
    }

    // CSV
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = 'question,option_a,option_b,option_c,option_d,correct_answer,difficulty,tags,explanation,source';
    const lines = bank.questions.map((qq) => {
      const opts = qq.options as string[];
      const letter = String.fromCharCode(65 + qq.correctIndex);
      return [
        esc(qq.questionText),
        esc(opts[0]), esc(opts[1]), esc(opts[2]), esc(opts[3]),
        esc(letter),
        esc(qq.difficulty), esc(qq.tags.join(',')), esc(qq.explanation), esc(qq.source),
      ].join(',');
    });
    const csv = [header, ...lines].join('\n');
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="${bank.title.replace(/[^a-z0-9]+/gi, '_')}.csv"`);
    return reply.send(csv);
  });

  // -------------------------------------------------------------------------
  // Challenges (directives #21, #22)
  // -------------------------------------------------------------------------
  fastify.get('/api/admin/challenges', async (request) => {
    const q = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      status: z.enum(['LOBBY', 'ACTIVE', 'FINISHED', 'CANCELLED']).optional(),
      bankId: z.string().uuid().optional(),
    }).parse(request.query);

    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.bankId) where.bankId = q.bankId;

    const [total, challenges] = await Promise.all([
      db.challenge.count({ where }),
      db.challenge.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { bank: { select: { title: true } }, _count: { select: { participants: true } } },
      }),
    ]);

    return {
      data: challenges.map(toChallengeAdmin),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
    };
  });

  fastify.get('/api/admin/challenges/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const challenge = await db.challenge.findUnique({
      where: { id },
      include: {
        bank: { select: { title: true } },
        participants: true,
        _count: { select: { participants: true } },
      },
    });
    if (!challenge) throw Errors.notFound('CHALLENGE_NOT_FOUND', 'Challenge not found');
    return {
      ...toChallengeAdmin(challenge),
      participants: challenge.participants.map((p) => toParticipantAdmin({ ...p, challenge })),
    };
  });

  fastify.post('/api/admin/challenges/:id/cancel', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const challenge = await db.challenge.findUnique({ where: { id } });
    if (!challenge) throw Errors.notFound('CHALLENGE_NOT_FOUND', 'Challenge not found');
    if (challenge.status === 'FINISHED') {
      throw Errors.conflict('CHALLENGE_FINISHED', 'Cannot cancel a finished challenge');
    }
    const updated = await db.challenge.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { bank: { select: { title: true } }, _count: { select: { participants: true } } },
    });
    await recordAudit({
      adminUserId: request.admin!.adminUser.id,
      action: 'challenge.cancel',
      entityType: 'challenge',
      entityId: id,
    });
    return toChallengeAdmin(updated);
  });

  // -------------------------------------------------------------------------
  // Participants (directive #23)
  // -------------------------------------------------------------------------
  fastify.get('/api/admin/participants', async (request) => {
    const q = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      challengeId: z.string().uuid().optional(),
    }).parse(request.query);

    const where: any = {};
    if (q.challengeId) where.challengeId = q.challengeId;

    const [total, participants] = await Promise.all([
      db.matchParticipant.count({ where }),
      db.matchParticipant.findMany({
        where,
        orderBy: { joinedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { challenge: { select: { shareSlug: true } } },
      }),
    ]);

    return {
      data: participants.map(toParticipantAdmin),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
    };
  });

  // -------------------------------------------------------------------------
  // Analytics (directive #24)
  // -------------------------------------------------------------------------
  fastify.get('/api/admin/analytics', async () => {
    const [
      totalBanks,
      publishedBanks,
      totalQuestions,
      publishedQuestions,
      challengesCreated,
      challengesCompleted,
      challengesCancelled,
      participantCount,
    ] = await Promise.all([
      db.questionBank.count(),
      db.questionBank.count({ where: { status: 'PUBLISHED' } }),
      db.question.count(),
      db.question.count({ where: { status: 'PUBLISHED' } }),
      db.challenge.count(),
      db.challenge.count({ where: { status: 'FINISHED' } }),
      db.challenge.count({ where: { status: 'CANCELLED' } }),
      db.matchParticipant.count(),
    ]);

    const grouped = await db.challenge.groupBy({
      by: ['bankId'],
      _count: { bankId: true },
      orderBy: { _count: { bankId: 'desc' } },
      take: 5,
    });
    const bankTitles = await db.questionBank.findMany({
      where: { id: { in: grouped.map((g) => g.bankId) } },
      select: { id: true, title: true },
    });
    const titleMap = new Map(bankTitles.map((b) => [b.id, b.title]));
    const topBanks = grouped.map((g) => ({
      bankId: g.bankId,
      title: titleMap.get(g.bankId) ?? 'Unknown',
      challengeCount: g._count.bankId,
    }));

    return {
      totalBanks,
      publishedBanks,
      totalQuestions,
      publishedQuestions,
      challengesCreated,
      challengesCompleted,
      challengesCancelled,
      participantCount,
      averagePlayersPerChallenge: challengesCreated ? Number((participantCount / challengesCreated).toFixed(2)) : 0,
      topBanks,
    };
  });

  // -------------------------------------------------------------------------
  // Settings (directive #25)
  // -------------------------------------------------------------------------
  fastify.get('/api/admin/settings', async () => getSettings());

  fastify.patch('/api/admin/settings', async (request) => {
    const body = updateSettingsSchema.parse(request.body);
    const next = await saveSettings(body);
    await recordAudit({
      adminUserId: request.admin!.adminUser.id,
      action: 'settings.update',
      entityType: 'settings',
      metadata: { fields: Object.keys(body) },
    });
    return next;
  });

  // -------------------------------------------------------------------------
  // Audit log (directive #27)
  // -------------------------------------------------------------------------
  fastify.get('/api/admin/audit', async (request) => {
    const q = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(30),
      action: z.string().optional(),
      entityType: z.string().optional(),
    }).parse(request.query);

    const where: any = {};
    if (q.action) where.action = q.action;
    if (q.entityType) where.entityType = q.entityType;

    const [total, logs] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { adminUser: { select: { email: true } } },
      }),
    ]);

    return {
      data: logs.map(toAuditLogDTO),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
    };
  });

  // Admin user directory (SUPER_ADMIN oversight).
  fastify.get('/api/admin/admins', async () => {
    const admins = await db.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
    return admins.map(toAdminUserDTO);
  });
};
