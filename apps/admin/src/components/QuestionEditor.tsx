import { useState } from 'react';

import { Trash2, Plus } from 'lucide-react';
import { Modal, Spinner } from './ui';
import type { QuestionAdmin, Difficulty } from '../lib/types';

export interface QuestionDraft {
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: Difficulty | '';
  tags: string;
  source: string;
}

function toDraft(q?: QuestionAdmin): QuestionDraft {
  return {
    questionText: q?.questionText ?? '',
    options: q?.options ?? ['', '', '', ''],
    correctIndex: q?.correctIndex ?? 0,
    explanation: q?.explanation ?? '',
    difficulty: q?.difficulty ?? '',
    tags: q?.tags?.join(', ') ?? '',
    source: q?.source ?? '',
  };
}

export function serializeDraft(d: QuestionDraft) {
  return {
    questionText: d.questionText.trim(),
    options: d.options.map((o) => o.trim()),
    correctIndex: d.correctIndex,
    explanation: d.explanation.trim() || undefined,
    difficulty: d.difficulty || undefined,
    tags: d.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    source: d.source.trim() || undefined,
  };
}

export default function QuestionEditor({
  open,
  initial,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: QuestionAdmin;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: QuestionDraft) => void;
}) {
  const [draft, setDraft] = useState<QuestionDraft>(toDraft(initial));

  // Re-seed the form whenever a different question is opened.
  const [seededId, setSeededId] = useState(initial?.id);
  if (open && initial?.id !== seededId) {
    setSeededId(initial?.id);
    setDraft(toDraft(initial));
  }

  const setOption = (i: number, value: string) => {
    const options = [...draft.options];
    options[i] = value;
    setDraft({ ...draft, options });
  };

  const addOption = () => {
    if (draft.options.length >= 6) return;
    setDraft({ ...draft, options: [...draft.options, ''] });
  };

  const removeOption = (i: number) => {
    if (draft.options.length <= 2) return;
    const options = draft.options.filter((_, idx) => idx !== i);
    const correctIndex = draft.correctIndex >= options.length ? 0 : draft.correctIndex;
    setDraft({ ...draft, options, correctIndex });
  };

  const canSave =
    draft.questionText.trim().length > 0 &&
    draft.options.filter((o) => o.trim()).length >= 2 &&
    draft.options[draft.correctIndex]?.trim();

  return (
    <Modal
      open={open}
      title={initial ? 'Edit Question' : 'New Question'}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!canSave || saving} onClick={() => onSave(draft)}>
            {saving ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Question</label>
          <textarea
            className="input"
            rows={3}
            value={draft.questionText}
            onChange={(e) => setDraft({ ...draft, questionText: e.target.value })}
          />
        </div>

        <div>
          <label className="label">Options (select the correct one)</label>
          <div className="space-y-2">
            {draft.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={draft.correctIndex === i}
                  onChange={() => setDraft({ ...draft, correctIndex: i })}
                />
                <input className="input" value={opt} onChange={(e) => setOption(i, e.target.value)} />
                <button
                  className="btn-secondary px-2"
                  onClick={() => removeOption(i)}
                  disabled={draft.options.length <= 2}
                  aria-label="Remove option"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {draft.options.length < 6 && (
            <button className="btn-secondary mt-2" onClick={addOption}>
              <Plus className="h-4 w-4" />
              Add option
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Difficulty</label>
            <select
              className="input"
              value={draft.difficulty}
              onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as Difficulty | '' })}
            >
              <option value="">—</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
          <div>
            <label className="label">Tags (comma-separated)</label>
            <input className="input" value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="label">Explanation (optional)</label>
          <textarea
            className="input"
            rows={2}
            value={draft.explanation}
            onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
          />
        </div>

        <div>
          <label className="label">Source (optional)</label>
          <input className="input" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}
