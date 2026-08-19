import { describe, it, expect } from 'vitest';
import {
  validateQuestion,
  computeBankHealth,
  findDuplicateQuestions,
  normalizeTags,
  parseAnswerLabel,
  buildCsvImportPreview,
  buildJsonImportPreview,
  type QuestionInput,
} from './content';

const goodQuestion: QuestionInput = {
  questionText: 'What organ pumps blood?',
  options: ['Heart', 'Liver', 'Kidney', 'Lung'],
  correctIndex: 0,
  explanation: 'The heart pumps blood.',
};

describe('validateQuestion', () => {
  it('accepts a well-formed question', () => {
    const r = validateQuestion(goodQuestion);
    expect(r.valid).toBe(true);
    expect(r.normalized?.questionText).toBe('What organ pumps blood?');
  });

  it('rejects missing question text', () => {
    const r = validateQuestion({ ...goodQuestion, questionText: '   ' });
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.code === 'QUESTION_TEXT_REQUIRED')).toBe(true);
  });

  it('rejects an empty option', () => {
    const r = validateQuestion({ ...goodQuestion, options: ['Heart', '', 'Kidney', 'Lung'] });
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.code === 'EMPTY_OPTION')).toBe(true);
  });

  it('rejects duplicate options (case-insensitive)', () => {
    const r = validateQuestion({ ...goodQuestion, options: ['Heart', 'heart', 'Kidney', 'Lung'] });
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.code === 'DUPLICATE_OPTION')).toBe(true);
  });

  it('rejects an out-of-range correct index', () => {
    const r = validateQuestion({ ...goodQuestion, correctIndex: 9 });
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.code === 'INVALID_CORRECT_INDEX')).toBe(true);
  });

  it('warns (not errors) when fewer than preferred options', () => {
    const r = validateQuestion({ questionText: 'True or false?', options: ['True', 'False'], correctIndex: 1 });
    expect(r.valid).toBe(true);
    expect(r.issues.some((i) => i.code === 'FEWER_THAN_PREFERRED_OPTIONS' && i.level === 'warning')).toBe(true);
  });

  it('errors when there are too few options', () => {
    const r = validateQuestion({ questionText: 'Only one?', options: ['Yes'], correctIndex: 0 });
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.code === 'TOO_FEW_OPTIONS')).toBe(true);
  });
});

describe('normalizeTags', () => {
  it('trims, drops empties, and de-duplicates case-insensitively', () => {
    expect(normalizeTags([' Biology ', 'biology', '', 'Cells'])).toEqual(['Biology', 'Cells']);
  });
});

describe('parseAnswerLabel', () => {
  it('parses letters', () => {
    expect(parseAnswerLabel('A', 4)).toBe(0);
    expect(parseAnswerLabel('c', 4)).toBe(2);
  });
  it('parses 1-based numbers', () => {
    expect(parseAnswerLabel('2', 4)).toBe(1);
  });
  it('rejects out-of-range', () => {
    expect(parseAnswerLabel('E', 4)).toBeNull();
    expect(parseAnswerLabel('5', 4)).toBeNull();
  });
});

describe('findDuplicateQuestions', () => {
  it('detects normalized duplicates', () => {
    const groups = findDuplicateQuestions([
      { questionText: 'What  organ pumps blood?' },
      { questionText: 'what organ pumps  blood?' },
      { questionText: 'Something else' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].indexes).toEqual([0, 1]);
  });
});

describe('computeBankHealth', () => {
  it('reports an empty bank as not publishable', () => {
    const h = computeBankHealth([]);
    expect(h.publishable).toBe(false);
    expect(h.score).toBe(0);
  });

  it('reports a fully-valid bank as publishable with 100 score', () => {
    const h = computeBankHealth([goodQuestion, { ...goodQuestion, questionText: 'Largest organ?', options: ['Skin', 'Liver', 'Brain', 'Heart'], correctIndex: 0 }]);
    expect(h.publishable).toBe(true);
    expect(h.score).toBe(100);
    expect(h.validQuestions).toBe(2);
  });

  it('blocks publishing when a critical check fails', () => {
    const h = computeBankHealth([{ ...goodQuestion, correctIndex: 9 }]);
    expect(h.publishable).toBe(false);
    expect(h.checks.find((c) => c.code === 'ALL_HAVE_CORRECT')?.passed).toBe(false);
  });
});

describe('CSV import', () => {
  const header = 'question,option_a,option_b,option_c,option_d,correct_answer,difficulty,tags,explanation,source';

  it('parses and validates a good CSV', () => {
    const csv = `${header}\n"What is 2+2?","3","4","5","6","B","EASY","math,arithmetic","Basic addition",""`;
    const preview = buildCsvImportPreview(csv);
    expect(preview.detected).toBe(1);
    expect(preview.errors).toBe(0);
    expect(preview.importable).toBe(true);
    expect(preview.rows[0].question?.correctIndex).toBe(1);
  });

  it('flags an invalid correct answer as an error', () => {
    const csv = `${header}\n"What is 2+2?","3","4","5","6","E","EASY","","",""`;
    const preview = buildCsvImportPreview(csv);
    expect(preview.errors).toBe(1);
    expect(preview.importable).toBe(false);
  });

  it('is all-or-nothing across mixed rows', () => {
    const csv = `${header}\n"Q1","a","b","c","d","A","","","",""\n"Q2","a","b","c","d","Z","","","",""`;
    const preview = buildCsvImportPreview(csv);
    expect(preview.detected).toBe(2);
    expect(preview.errors).toBe(1);
    expect(preview.importable).toBe(false);
  });

  it('detects duplicate questions as a warning', () => {
    const csv = `${header}\n"Same Q","a","b","c","d","A","","","",""\n"same q","a","b","c","d","A","","","",""`;
    const preview = buildCsvImportPreview(csv);
    expect(preview.warnings).toBeGreaterThanOrEqual(1);
    // Duplicates are warnings, not errors → still importable.
    expect(preview.importable).toBe(true);
  });
});

describe('JSON import', () => {
  it('parses a good JSON document', () => {
    const doc = {
      title: 'Human Biology',
      subject: 'Science',
      questions: [
        { question: 'What organ pumps blood?', options: ['Heart', 'Liver', 'Kidney', 'Lung'], correctIndex: 0, explanation: 'heart' },
      ],
    };
    const preview = buildJsonImportPreview(JSON.stringify(doc));
    expect(preview.errors).toBe(0);
    expect(preview.importable).toBe(true);
    expect(preview.meta?.title).toBe('Human Biology');
  });

  it('rejects malformed JSON', () => {
    const preview = buildJsonImportPreview('{ not json');
    expect(preview.importable).toBe(false);
    expect(preview.rows[0].issues[0].code).toBe('INVALID_JSON');
  });

  it('resolves correctAnswer letter when correctIndex is absent', () => {
    const doc = {
      questions: [{ question: 'Pick B', options: ['a', 'b', 'c', 'd'], correctAnswer: 'B' }],
    };
    const preview = buildJsonImportPreview(JSON.stringify(doc));
    expect(preview.rows[0].question?.correctIndex).toBe(1);
    expect(preview.errors).toBe(0);
  });
});
