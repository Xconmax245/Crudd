import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { api, ApiRequestError } from '../lib/api';
import { PageHeader } from '../components/ui';
import type { ImportPreview } from '../lib/types';

const CSV_TEMPLATE = `question,option_a,option_b,option_c,option_d,correct_answer,difficulty,tags,explanation,source
"What is 2+2?","3","4","5","6","B","EASY","math","Basic arithmetic","Textbook"`;

export default function ImportQuestions() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const previewMut = useMutation({
    mutationFn: () => api.post<ImportPreview>(`/api/admin/banks/${id}/questions/import/preview`, { format, content }),
    onSuccess: (data) => setPreview(data),
    onError: (err) => toast.error(err instanceof ApiRequestError ? err.message : 'Preview failed'),
  });

  const importMut = useMutation({
    mutationFn: () => api.post<{ imported: number; failed: number }>(`/api/admin/banks/${id}/questions/import`, { format, content }),
    onSuccess: (res) => {
      toast.success(`Imported ${res.imported} question(s)${res.failed ? `, ${res.failed} failed` : ''}`);
      qc.invalidateQueries({ queryKey: ['bank-questions', id] });
      qc.invalidateQueries({ queryKey: ['bank', id] });
      navigate(`/banks/${id}`);
    },
    onError: (err) => toast.error(err instanceof ApiRequestError ? err.message : 'Import failed'),
  });

  return (
    <div>
      <Link to={`/banks/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Back to bank
      </Link>
      <PageHeader title="Import Questions" subtitle="Validate a CSV or JSON file, then import valid rows" />

      <div className="card p-5">
        <div className="mb-4 flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={format === 'csv'} onChange={() => setFormat('csv')} /> CSV
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={format === 'json'} onChange={() => setFormat('json')} /> JSON
          </label>
        </div>

        <textarea
          className="input font-mono text-xs"
          rows={10}
          placeholder={format === 'csv' ? CSV_TEMPLATE : '[{ "question": "…", "options": ["A","B"], "correctIndex": 0 }]'}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setPreview(null);
          }}
        />

        <div className="mt-4 flex gap-2">
          <button
            className="btn-secondary"
            disabled={!content.trim() || previewMut.isPending}
            onClick={() => previewMut.mutate()}
          >
            Validate & Preview
          </button>
          <button
            className="btn-primary"
            disabled={!preview || preview.valid === 0 || importMut.isPending}
            onClick={() => importMut.mutate()}
          >
            Import {preview ? `${preview.valid} valid` : ''}
          </button>
        </div>
      </div>

      {preview && (
        <div className="mt-6">
          <div className="mb-3 flex gap-4 text-sm">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-success" /> {preview.valid} valid
            </span>
            <span className="inline-flex items-center gap-1">
              <XCircle className="h-4 w-4 text-danger" /> {preview.invalid} errors
            </span>
            <span className="text-muted">{preview.detected} detected</span>
          </div>

          <div className="card divide-y divide-line">
            {preview.rows.map((row) => {
              const errors = row.errors || [];
              const warnings = row.warnings || [];
              
              return (
                <div key={row.index} className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    {row.status === 'ok' ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : row.status === 'warning' ? (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    ) : (
                      <XCircle className="h-4 w-4 text-danger" />
                    )}
                    <span className="font-medium">Row {row.index}</span>
                    <span className="truncate text-muted">{row.question?.questionText}</span>
                  </div>
                  {errors.length > 0 && (
                    <ul className="ml-6 mt-1 list-disc text-danger">
                      {errors.map((e: string, i: number) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
                  {warnings.length > 0 && (
                    <ul className="ml-6 mt-1 list-disc text-warning">
                      {warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
