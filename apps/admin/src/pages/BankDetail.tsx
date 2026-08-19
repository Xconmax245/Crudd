import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Upload, Download, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { api, ApiRequestError } from '../lib/api';
import { PageHeader, Spinner, Badge, EmptyState, Th, Td } from '../components/ui';
import QuestionEditor, { serializeDraft } from '../components/QuestionEditor';
import type { BankAdmin, BankStats, BankHealth, QuestionAdmin } from '../lib/types';

type BankWithStats = BankAdmin & { stats: BankStats };

export default function BankDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<QuestionAdmin | undefined>();
  const [showEditor, setShowEditor] = useState(false);

  const bank = useQuery({
    queryKey: ['bank', id],
    queryFn: () => api.get<BankWithStats>(`/api/admin/banks/${id}`),
    enabled: !!id,
  });
  const health = useQuery({
    queryKey: ['bank-health', id],
    queryFn: () => api.get<BankHealth>(`/api/admin/banks/${id}/health`),
    enabled: !!id,
  });
  const questions = useQuery({
    queryKey: ['bank-questions', id],
    queryFn: () => api.get<QuestionAdmin[]>(`/api/admin/banks/${id}/questions`),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bank', id] });
    qc.invalidateQueries({ queryKey: ['bank-health', id] });
    qc.invalidateQueries({ queryKey: ['bank-questions', id] });
  };

  const publishMut = useMutation({
    mutationFn: () => api.post(`/api/admin/banks/${id}/publish`),
    onSuccess: () => {
      toast.success('Bank published');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiRequestError ? err.message : 'Publish failed'),
  });
  const unpublishMut = useMutation({
    mutationFn: () => api.post(`/api/admin/banks/${id}/unpublish`),
    onSuccess: () => {
      toast.success('Bank unpublished');
      invalidate();
    },
  });
  const archiveMut = useMutation({
    mutationFn: () => api.post(`/api/admin/banks/${id}/archive`),
    onSuccess: () => {
      toast.success('Bank archived');
      invalidate();
    },
  });

  const saveQuestionMut = useMutation({
    mutationFn: (payload: ReturnType<typeof serializeDraft>) =>
      editing
        ? api.patch(`/api/admin/questions/${editing.id}`, payload)
        : api.post(`/api/admin/banks/${id}/questions`, payload),
    onSuccess: () => {
      toast.success(editing ? 'Question updated' : 'Question added');
      setShowEditor(false);
      setEditing(undefined);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiRequestError ? err.message : 'Save failed'),
  });

  const archiveQuestionMut = useMutation({
    mutationFn: (qid: string) => api.post(`/api/admin/questions/${qid}/archive`),
    onSuccess: () => {
      toast.success('Question archived');
      invalidate();
    },
  });

  if (bank.isLoading) return <Spinner />;
  if (!bank.data) return <EmptyState title="Bank not found" />;

  const b = bank.data;

  return (
    <div>
      <Link to="/banks" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Back to banks
      </Link>

      <PageHeader
        title={b.title}
        subtitle={b.subject}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={b.status} />
            <a className="btn-secondary" href={`${api.url}/api/admin/banks/${id}/questions/export?format=csv`}>
              <Download className="h-4 w-4" />
              Export
            </a>
            <button className="btn-secondary" onClick={() => navigate(`/banks/${id}/import`)}>
              <Upload className="h-4 w-4" />
              Import
            </button>
            {b.status !== 'PUBLISHED' ? (
              <button
                className="btn-primary"
                disabled={publishMut.isPending || !(health.data?.publishable ?? false)}
                title={!health.data?.publishable ? 'Resolve critical issues first' : undefined}
                onClick={() => publishMut.mutate()}
              >
                Publish
              </button>
            ) : (
              <button className="btn-secondary" disabled={unpublishMut.isPending} onClick={() => unpublishMut.mutate()}>
                Unpublish
              </button>
            )}
            {b.status !== 'ARCHIVED' && (
              <button
                className="btn-danger"
                disabled={archiveMut.isPending}
                onClick={() => {
                  if (confirm('Archive this bank? It will be hidden from players.')) archiveMut.mutate();
                }}
              >
                Archive
              </button>
            )}
          </div>
        }
      />


      {/* Stats + Health */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-3 font-display font-semibold">Content</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <Stat label="Total" value={b.stats.total} />
            <Stat label="Published" value={b.stats.published} />
            <Stat label="Draft" value={b.stats.draft} />
            <Stat label="Easy" value={b.stats.easy} />
            <Stat label="Medium" value={b.stats.medium} />
            <Stat label="Hard" value={b.stats.hard} />
            <Stat label="Missing explanation" value={b.stats.missingExplanation} />
            <Stat label="Missing source" value={b.stats.missingSource} />
            <Stat label="Missing difficulty" value={b.stats.missingDifficulty} />
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 font-display font-semibold">Health</h3>
          {health.isLoading ? (
            <Spinner />
          ) : health.data ? (
            <div>
              <div className="mb-3 flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold">{health.data.score}</span>
                <span className="text-sm text-muted">/ 100</span>
                {health.data.publishable ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" /> Publishable
                  </span>
                ) : (
                  <span className="ml-auto inline-flex items-center gap-1 text-sm text-danger">
                    <XCircle className="h-4 w-4" /> Blocked
                  </span>
                )}
              </div>
              <ul className="space-y-1.5 text-sm">
                {health.data.checks.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    {c.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : c.severity === 'error' ? (
                      <XCircle className="h-4 w-4 text-danger" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    )}
                    <span className={c.passed ? 'text-muted' : ''}>{c.label}</span>
                    {c.count > 0 && !c.passed && <span className="ml-auto text-xs text-muted">{c.count}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {/* Questions */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Questions</h2>
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(undefined);
              setShowEditor(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Question
          </button>
        </div>

        {questions.isLoading ? (
          <Spinner />
        ) : questions.data && questions.data.length > 0 ? (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-line bg-gray-50">
                <tr>
                  <Th>Question</Th>
                  <Th>Difficulty</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {questions.data.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <Td className="max-w-md truncate">{q.questionText}</Td>
                    <Td>{q.difficulty ? <Badge>{q.difficulty}</Badge> : <span className="text-muted">—</span>}</Td>
                    <Td>
                      <Badge status={q.status} />
                    </Td>
                    <Td className="text-right">
                      <button
                        className="text-sm text-brand hover:underline"
                        onClick={() => {
                          setEditing(q);
                          setShowEditor(true);
                        }}
                      >
                        Edit
                      </button>
                      {q.status !== 'ARCHIVED' && (
                        <button
                          className="ml-3 text-sm text-danger hover:underline"
                          onClick={() => archiveQuestionMut.mutate(q.id)}
                        >
                          Archive
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No questions yet" description="Add questions manually or import them in bulk." />
        )}
      </div>

      <QuestionEditor
        open={showEditor}
        initial={editing}
        saving={saveQuestionMut.isPending}
        onClose={() => {
          setShowEditor(false);
          setEditing(undefined);
        }}
        onSave={(draft) => saveQuestionMut.mutate(serializeDraft(draft))}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
