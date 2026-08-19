import { z } from 'zod';

/**
 * CRUDD content-domain validation.
 *
 * Pure, framework-agnostic logic shared by the Fastify admin API and the admin
 * dashboard UI. Governs the "most important subsystem": the question-bank
 * lifecycle (Create → Edit → Validate → Preview → Import → Health → Publish).
 *
 * No database, no network, no side effects — everything here is deterministic
 * and unit-testable (see directive #57).
 */

// ---------------------------------------------------------------------------
// Constants & shared types
// ---------------------------------------------------------------------------

/** Product constants — locked by the CRUDD master spec, not admin-configurable. */
export const MIN_OPTIONS = 2;
export const PREFERRED_OPTIONS = 4;

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const BANK_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type BankStatus = (typeof BANK_STATUSES)[number];

export type IssueLevel = 'error' | 'warning';

export interface ValidationIssue {
  level: IssueLevel;
  code: string;
  message: string;
  /** Optional field/path the issue relates to (e.g. "options[2]"). */
  path?: string;
}

export interface QuestionInput {
  questionText: string;
  options: string[];
  correctIndex: number;
  difficulty?: string | null;
  tags?: string[] | null;
  explanation?: string | null;
  source?: string | null;
}

/** A question that has passed validation and been normalized for persistence. */
export interface NormalizedQuestion {
  questionText: string;
  options: string[];
  correctIndex: number;
  difficulty: Difficulty | null;
  tags: string[];
  explanation: string | null;
  source: string | null;
}

// ---------------------------------------------------------------------------
// Text normalization (also the basis for duplicate detection — directive #23)
// ---------------------------------------------------------------------------

/** Trim + collapse internal whitespace runs to a single space. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Canonical form used to compare two questions/options for duplication. */
export function duplicationKey(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

/** Normalize a free-form difficulty string into the enum, or null. */
export function normalizeDifficulty(value?: string | null): Difficulty | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return (DIFFICULTIES as readonly string[]).includes(upper) ? (upper as Difficulty) : null;
}

/** Normalize tags: trim, drop empties, de-duplicate case-insensitively, preserve order. */
export function normalizeTags(tags?: string[] | null): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = normalizeWhitespace(raw);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Question validation (directive #15)
// ---------------------------------------------------------------------------

export interface QuestionValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  /** Present only when there are no error-level issues. */
  normalized?: NormalizedQuestion;
}

export function validateQuestion(input: QuestionInput): QuestionValidationResult {
  const issues: ValidationIssue[] = [];

  const questionText = normalizeWhitespace(input.questionText ?? '');
  if (!questionText) {
    issues.push({ level: 'error', code: 'QUESTION_TEXT_REQUIRED', message: 'Question text is required.', path: 'questionText' });
  }

  const rawOptions = Array.isArray(input.options) ? input.options : [];
  const options = rawOptions.map((o) => normalizeWhitespace(o ?? ''));

  if (options.length < MIN_OPTIONS) {
    issues.push({
      level: 'error',
      code: 'TOO_FEW_OPTIONS',
      message: `A question needs at least ${MIN_OPTIONS} options.`,
      path: 'options',
    });
  } else if (options.length < PREFERRED_OPTIONS) {
    issues.push({
      level: 'warning',
      code: 'FEWER_THAN_PREFERRED_OPTIONS',
      message: `CRUDD gameplay prefers ${PREFERRED_OPTIONS} options; this question has ${options.length}.`,
      path: 'options',
    });
  }

  options.forEach((opt, i) => {
    if (!opt) {
      issues.push({ level: 'error', code: 'EMPTY_OPTION', message: `Option ${labelForIndex(i)} is empty.`, path: `options[${i}]` });
    }
  });

  // Duplicate options (case-insensitive, ignore empties already flagged)
  const optionSeen = new Map<string, number>();
  options.forEach((opt, i) => {
    if (!opt) return;
    const key = opt.toLowerCase();
    if (optionSeen.has(key)) {
      issues.push({
        level: 'error',
        code: 'DUPLICATE_OPTION',
        message: `Option ${labelForIndex(i)} duplicates option ${labelForIndex(optionSeen.get(key)!)}.`,
        path: `options[${i}]`,
      });
    } else {
      optionSeen.set(key, i);
    }
  });

  // Correct answer must reference a real option
  if (
    !Number.isInteger(input.correctIndex) ||
    input.correctIndex < 0 ||
    input.correctIndex >= options.length
  ) {
    issues.push({
      level: 'error',
      code: 'INVALID_CORRECT_INDEX',
      message: 'The correct answer must reference one of the provided options.',
      path: 'correctIndex',
    });
  }

  const difficulty = normalizeDifficulty(input.difficulty);
  if (input.difficulty && !difficulty) {
    issues.push({
      level: 'warning',
      code: 'UNKNOWN_DIFFICULTY',
      message: `Difficulty "${input.difficulty}" is not one of ${DIFFICULTIES.join('/')}; it will be ignored.`,
      path: 'difficulty',
    });
  }

  const hasErrors = issues.some((i) => i.level === 'error');
  if (hasErrors) {
    return { valid: false, issues };
  }

  return {
    valid: true,
    issues,
    normalized: {
      questionText,
      options,
      correctIndex: input.correctIndex,
      difficulty,
      tags: normalizeTags(input.tags),
      explanation: input.explanation ? normalizeWhitespace(input.explanation) || null : null,
      source: input.source ? normalizeWhitespace(input.source) || null : null,
    },
  };
}

function labelForIndex(i: number): string {
  // 0 -> A, 1 -> B, ...
  return String.fromCharCode(65 + i);
}

/** Parse an option label ("A".."Z") or a 1-based number ("1".."n") to a 0-based index. */
export function parseAnswerLabel(value: string, optionCount: number): number | null {
  const v = value.trim();
  if (!v) return null;
  // Letter form
  if (/^[A-Za-z]$/.test(v)) {
    const idx = v.toUpperCase().charCodeAt(0) - 65;
    return idx >= 0 && idx < optionCount ? idx : null;
  }
  // Numeric form (1-based)
  if (/^\d+$/.test(v)) {
    const idx = parseInt(v, 10) - 1;
    return idx >= 0 && idx < optionCount ? idx : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Duplicate detection across a set of questions (directive #23)
// ---------------------------------------------------------------------------

export interface DuplicateGroup {
  key: string;
  indexes: number[];
}

export function findDuplicateQuestions(questions: Pick<QuestionInput, 'questionText'>[]): DuplicateGroup[] {
  const byKey = new Map<string, number[]>();
  questions.forEach((q, i) => {
    const key = duplicationKey(q.questionText ?? '');
    if (!key) return;
    const arr = byKey.get(key);
    if (arr) arr.push(i);
    else byKey.set(key, [i]);
  });
  return [...byKey.entries()]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([key, indexes]) => ({ key, indexes }));
}

// ---------------------------------------------------------------------------
// Bank health & publishability (directives #12, #24)
// ---------------------------------------------------------------------------

export interface BankHealthCheck {
  code: string;
  label: string;
  passed: boolean;
  /** true => failing this blocks publishing */
  critical: boolean;
  detail?: string;
}

export interface BankHealth {
  score: number; // 0..100
  publishable: boolean;
  totalQuestions: number;
  validQuestions: number;
  invalidQuestions: number;
  duplicateQuestions: number;
  checks: BankHealthCheck[];
}

/**
 * Compute a bank's health from its questions. A bank is publishable only when
 * every critical check passes (directive #12: "A bank should not be publishable
 * if critical validation errors exist").
 */
export function computeBankHealth(questions: QuestionInput[]): BankHealth {
  const total = questions.length;
  const results = questions.map(validateQuestion);
  const validCount = results.filter((r) => r.valid).length;
  const invalidCount = total - validCount;

  const duplicates = findDuplicateQuestions(questions);
  const duplicateQuestionCount = duplicates.reduce((n, g) => n + g.indexes.length, 0);

  const everyHasText = questions.every((q) => normalizeWhitespace(q.questionText ?? '').length > 0);
  const everyHasEnoughOptions = questions.every(
    (q) => Array.isArray(q.options) && q.options.filter((o) => normalizeWhitespace(o ?? '')).length >= MIN_OPTIONS,
  );
  const everyHasValidCorrect = results.every(
    (r) => !r.issues.some((i) => i.code === 'INVALID_CORRECT_INDEX'),
  );
  const noEmptyOptions = !results.some((r) => r.issues.some((i) => i.code === 'EMPTY_OPTION'));
  const noDuplicateOptions = !results.some((r) => r.issues.some((i) => i.code === 'DUPLICATE_OPTION'));

  const checks: BankHealthCheck[] = [
    { code: 'HAS_QUESTIONS', label: 'Has at least one question', passed: total >= 1, critical: true },
    { code: 'ALL_HAVE_TEXT', label: 'Every question has text', passed: everyHasText, critical: true },
    { code: 'ALL_HAVE_OPTIONS', label: `Every question has ≥ ${MIN_OPTIONS} options`, passed: everyHasEnoughOptions, critical: true },
    { code: 'ALL_HAVE_CORRECT', label: 'Every question has a valid correct answer', passed: everyHasValidCorrect, critical: true },
    { code: 'NO_EMPTY_OPTIONS', label: 'No empty options', passed: noEmptyOptions, critical: true },
    { code: 'NO_DUPLICATE_OPTIONS', label: 'No duplicate options within a question', passed: noDuplicateOptions, critical: true },
    {
      code: 'NO_DUPLICATE_QUESTIONS',
      label: 'No duplicated questions',
      passed: duplicates.length === 0,
      critical: false,
      detail: duplicates.length ? `${duplicates.length} duplicate group(s)` : undefined,
    },
  ];

  const publishable = total >= 1 && checks.filter((c) => c.critical).every((c) => c.passed);
  const score = total === 0 ? 0 : Math.round((validCount / total) * 100);

  return {
    score,
    publishable,
    totalQuestions: total,
    validQuestions: validCount,
    invalidQuestions: invalidCount,
    duplicateQuestions: duplicateQuestionCount,
    checks,
  };
}

// ---------------------------------------------------------------------------
// JSON import (directive #19)
// ---------------------------------------------------------------------------

export const jsonImportQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(1),
  correctIndex: z.number().int().nonnegative().optional(),
  correctAnswer: z.string().optional(),
  difficulty: z.string().optional(),
  tags: z.array(z.string()).optional(),
  explanation: z.string().optional(),
  source: z.string().optional(),
});

export const jsonImportDocumentSchema = z.object({
  title: z.string().optional(),
  subject: z.string().optional(),
  questions: z.array(jsonImportQuestionSchema).min(1),
});

export type JsonImportDocument = z.infer<typeof jsonImportDocumentSchema>;

// ---------------------------------------------------------------------------
// CSV import (directive #18)
// ---------------------------------------------------------------------------

export const CSV_COLUMNS = [
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_answer',
  'difficulty',
  'tags',
  'explanation',
  'source',
] as const;

/**
 * Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas,
 * escaped quotes ("") and CRLF/LF line endings. Returns an array of rows,
 * each a string[].
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char === '\r') {
      // swallow — handled by the following \n (or EOF below)
    } else {
      field += char;
    }
  }
  // flush trailing field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // drop fully-empty trailing rows
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/** Convert one CSV data row (keyed by header) into a QuestionInput. */
function csvRowToQuestion(record: Record<string, string>): QuestionInput {
  const options = [record.option_a, record.option_b, record.option_c, record.option_d]
    .map((o) => (o ?? '').trim())
    .filter((o) => o.length > 0);

  const answerRaw = (record.correct_answer ?? '').trim();
  let correctIndex = parseAnswerLabel(answerRaw, options.length);
  if (correctIndex === null) {
    // Try exact option-text match
    const idx = options.findIndex((o) => o.toLowerCase() === answerRaw.toLowerCase());
    correctIndex = idx >= 0 ? idx : -1;
  }

  const tags = (record.tags ?? '')
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    questionText: record.question ?? '',
    options,
    correctIndex,
    difficulty: record.difficulty || null,
    tags,
    explanation: record.explanation || null,
    source: record.source || null,
  };
}

// ---------------------------------------------------------------------------
// Staged import: parse → validate → preview (directives #20, #21)
// ---------------------------------------------------------------------------

export type ImportFormat = 'csv' | 'json';

export interface ImportRowResult {
  /** 1-based row number as the admin would see it. */
  row: number;
  status: 'valid' | 'warning' | 'error';
  issues: ValidationIssue[];
  question?: NormalizedQuestion;
}

export interface ImportPreview {
  format: ImportFormat;
  detected: number;
  valid: number;
  warnings: number;
  errors: number;
  /** All-or-nothing: safe to import only when there are zero errors. */
  importable: boolean;
  rows: ImportRowResult[];
  /** Optional bank metadata (JSON imports may carry it). */
  meta?: { title?: string; subject?: string };
}

function buildPreview(format: ImportFormat, inputs: QuestionInput[], meta?: { title?: string; subject?: string }): ImportPreview {
  // Cross-row duplicate detection (warning-level).
  const duplicateGroups = findDuplicateQuestions(inputs);
  const duplicateIndexes = new Set<number>();
  for (const g of duplicateGroups) {
    // flag all but the first occurrence
    g.indexes.slice(1).forEach((i) => duplicateIndexes.add(i));
  }

  const rows: ImportRowResult[] = inputs.map((input, i) => {
    const result = validateQuestion(input);
    const issues = [...result.issues];
    if (duplicateIndexes.has(i)) {
      issues.push({ level: 'warning', code: 'DUPLICATE_QUESTION', message: 'Duplicate question detected in this import.' });
    }
    if (!result.normalized?.explanation) {
      issues.push({ level: 'warning', code: 'MISSING_EXPLANATION', message: 'Missing explanation (optional).' });
    }
    const hasError = issues.some((x) => x.level === 'error');
    const hasWarning = issues.some((x) => x.level === 'warning');
    return {
      row: i + 1,
      status: hasError ? 'error' : hasWarning ? 'warning' : 'valid',
      issues,
      question: result.normalized,
    };
  });

  const errors = rows.filter((r) => r.status === 'error').length;
  const warnings = rows.filter((r) => r.status === 'warning').length;
  const valid = rows.filter((r) => r.status === 'valid').length;

  return {
    format,
    detected: rows.length,
    valid,
    warnings,
    errors,
    importable: rows.length > 0 && errors === 0,
    rows,
    meta,
  };
}

/** Parse + validate a CSV document into a staged import preview. */
export function buildCsvImportPreview(text: string): ImportPreview {
  const matrix = parseCsv(text);
  if (matrix.length === 0) {
    return { format: 'csv', detected: 0, valid: 0, warnings: 0, errors: 0, importable: false, rows: [] };
  }
  const header = matrix[0].map((h) => h.trim().toLowerCase());
  const dataRows = matrix.slice(1);
  const inputs = dataRows.map((cols) => {
    const record: Record<string, string> = {};
    header.forEach((key, idx) => {
      record[key] = cols[idx] ?? '';
    });
    return csvRowToQuestion(record);
  });
  return buildPreview('csv', inputs);
}

/** Parse + validate a JSON document (string or object) into a staged import preview. */
export function buildJsonImportPreview(raw: string | unknown): ImportPreview {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        format: 'json',
        detected: 0,
        valid: 0,
        warnings: 0,
        errors: 1,
        importable: false,
        rows: [{ row: 0, status: 'error', issues: [{ level: 'error', code: 'INVALID_JSON', message: 'File is not valid JSON.' }] }],
      };
    }
  }

  // Handle direct array of questions instead of requiring `{ "questions": [...] }`
  if (Array.isArray(parsed)) {
    parsed = { questions: parsed };
  }

  const doc = jsonImportDocumentSchema.safeParse(parsed);
  if (!doc.success) {
    return {
      format: 'json',
      detected: 0,
      valid: 0,
      warnings: 0,
      errors: 1,
      importable: false,
      rows: [{ row: 0, status: 'error', issues: [{ level: 'error', code: 'INVALID_SHAPE', message: doc.error.issues[0]?.message ?? 'Document does not match the expected shape.' }] }],
    };
  }

  const inputs: QuestionInput[] = doc.data.questions.map((q) => {
    let correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : -1;
    if (correctIndex < 0 && q.correctAnswer) {
      const byLabel = parseAnswerLabel(q.correctAnswer, q.options.length);
      correctIndex =
        byLabel ?? q.options.findIndex((o) => o.trim().toLowerCase() === q.correctAnswer!.trim().toLowerCase());
    }
    return {
      questionText: q.question,
      options: q.options,
      correctIndex,
      difficulty: q.difficulty ?? null,
      tags: q.tags ?? null,
      explanation: q.explanation ?? null,
      source: q.source ?? null,
    };
  });

  return buildPreview('json', inputs, { title: doc.data.title, subject: doc.data.subject });
}
