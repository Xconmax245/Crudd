import { z } from 'zod';

/**
 * Zod schemas for the /api/admin/* boundary (directive #31).
 * Every admin mutation validates its input against one of these.
 */

export const contentStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const difficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD']);

// ---------------------------------------------------------------------------
// Banks
// ---------------------------------------------------------------------------

export const createBankSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  subject: z.string().trim().min(1, 'Subject is required').max(80),
  category: z.string().trim().max(80).optional().nullable(),
  tags: z.array(z.string().trim().min(1)).max(30).optional(),
});
export type CreateBankInput = z.infer<typeof createBankSchema>;

export const updateBankSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).nullable(),
    subject: z.string().trim().min(1).max(80),
    category: z.string().trim().max(80).nullable(),
    tags: z.array(z.string().trim().min(1)).max(30),
    status: contentStatusSchema,
  })
  .partial();
export type UpdateBankInput = z.infer<typeof updateBankSchema>;

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export const createQuestionSchema = z.object({
  questionText: z.string().trim().min(1, 'Question text is required').max(1000),
  options: z.array(z.string().trim().min(1, 'Options cannot be empty')).min(2).max(6),
  correctIndex: z.number().int().nonnegative(),
  explanation: z.string().trim().max(2000).optional().nullable(),
  difficulty: difficultySchema.optional().nullable(),
  tags: z.array(z.string().trim().min(1)).max(30).optional(),
  source: z.string().trim().max(300).optional().nullable(),
  status: contentStatusSchema.optional(),
}).refine((q) => q.correctIndex < q.options.length, {
  message: 'correctIndex must reference an existing option',
  path: ['correctIndex'],
});
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const updateQuestionSchema = z.object({
  questionText: z.string().trim().min(1).max(1000).optional(),
  options: z.array(z.string().trim().min(1)).min(2).max(6).optional(),
  correctIndex: z.number().int().nonnegative().optional(),
  explanation: z.string().trim().max(2000).nullable().optional(),
  difficulty: difficultySchema.nullable().optional(),
  tags: z.array(z.string().trim().min(1)).max(30).optional(),
  source: z.string().trim().max(300).nullable().optional(),
  status: contentStatusSchema.optional(),
});
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;

// ---------------------------------------------------------------------------
// Bulk operations (directive #15)
// ---------------------------------------------------------------------------

export const bulkQuestionActionSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1).max(500),
  action: z.enum(['publish', 'unpublish', 'archive', 'move']),
  targetBankId: z.string().uuid().optional(),
}).refine((v) => v.action !== 'move' || !!v.targetBankId, {
  message: 'targetBankId is required when action is "move"',
  path: ['targetBankId'],
});
export type BulkQuestionActionInput = z.infer<typeof bulkQuestionActionSchema>;

// ---------------------------------------------------------------------------
// Import (directive #16, #36)
// ---------------------------------------------------------------------------

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_IMPORT_ROWS = 1000;

export const importQuestionsSchema = z.object({
  format: z.enum(['csv', 'json']),
  content: z.string().min(1).max(MAX_IMPORT_BYTES, 'File exceeds the 2 MB import limit'),
  defaultStatus: contentStatusSchema.optional(),
});
export type ImportQuestionsInput = z.infer<typeof importQuestionsSchema>;

// ---------------------------------------------------------------------------
// Settings (directive #25)
// ---------------------------------------------------------------------------

export const updateSettingsSchema = z.object({
  platformName: z.string().trim().min(1).max(80),
  publicAppUrl: z.string().url(),
  adminAppUrl: z.string().url(),
  defaultTimerSeconds: z.number().int().refine((v) => [5, 10, 15, 20, 30].includes(v), 'Invalid timer'),
  defaultMaxPlayers: z.number().int().min(2).max(10),
  maxQuestionCount: z.number().int().min(1).max(100),
  minQuestionsForPublication: z.number().int().min(1).max(100),
  requireExplanations: z.boolean(),
  requireSources: z.boolean(),
}).partial();
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// ---------------------------------------------------------------------------
// Common query params
// ---------------------------------------------------------------------------

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const bankListQuerySchema = paginationSchema.extend({
  status: contentStatusSchema.optional(),
  subject: z.string().trim().optional(),
  category: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

export const questionListQuerySchema = paginationSchema.extend({
  bankId: z.string().uuid().optional(),
  status: contentStatusSchema.optional(),
  difficulty: difficultySchema.optional(),
  search: z.string().trim().optional(),
});
