import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { api, ApiRequestError } from '../lib/api';
import { PageHeader, Spinner, Badge, EmptyState, Th, Td, Pagination } from '../components/ui';
import type { QuestionAdmin, Paginated, ContentStatus, Difficulty } from '../lib/types';

const STATUSES: (ContentStatus | '')[] = ['', 'DRAFT', 'PUBLISHED', 'ARCHIVED'];
const DIFFICULTIES: (Difficulty | '')[] = ['', 'EASY', 'MEDIUM', 'HARD'];

export default function Questions() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ContentStatus | ''>('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ['questions', page, status, difficulty, search],
    queryFn: () =>
      api.get<Paginated<QuestionAdmin>>('/api/admin/questions', {
        page,
        pageSize: 20,
        status: status || undefined,
        difficulty: difficulty || undefined,
        search: search || undefined,
      }),
  });

  const bulkMut = useMutation({
    mutationFn: (action: 'publish' | 'unpublish' | 'archive') =>
      api.post('/api/admin/questions/bulk', { action, questionIds: [...selected] }),
    onSuccess: (res: any) => {
      toast.success(`Updated ${res.updated} question(s)`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['questions'] });
    },
    onError: (err) => toast.error(err instanceof ApiRequestError ? err.message : 'Bulk action failed'),
  });

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <div>
      <PageHeader title="Questions" subtitle="Search and manage questions across all banks" />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search text, source, tag…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <select className="input max-w-[10rem]" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as ContentStatus | ''); }}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s || 'All statuses'}</option>
          ))}
        </select>
        <select className="input max-w-[10rem]" value={difficulty} onChange={(e) => { setPage(1); setDifficulty(e.target.value as Difficulty | ''); }}>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>{d || 'All difficulties'}</option>
          ))}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-paper px-4 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <button className="btn-secondary" disabled={bulkMut.isPending} onClick={() => bulkMut.mutate('publish')}>Publish</button>
            <button className="btn-secondary" disabled={bulkMut.isPending} onClick={() => bulkMut.mutate('unpublish')}>Unpublish</button>
            <button className="btn-danger" disabled={bulkMut.isPending} onClick={() => bulkMut.mutate('archive')}>Archive</button>
          </div>
        </div>
      )}

      {query.isLoading ? (
        <Spinner />
      ) : query.data && query.data.data.length > 0 ? (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-line bg-gray-50">
                <tr>
                  <Th className="w-8" />
                  <Th>Question</Th>
                  <Th>Bank</Th>
                  <Th>Difficulty</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {query.data.data.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <Td>
                      <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q.id)} />
                    </Td>
                    <Td className="max-w-md truncate">{q.questionText}</Td>
                    <Td className="text-muted">
                      <Link to={`/banks/${q.bankId}`} className="hover:text-brand hover:underline">
                        {q.bankTitle ?? 'Bank'}
                      </Link>
                    </Td>
                    <Td>{q.difficulty ? <Badge>{q.difficulty}</Badge> : <span className="text-muted">—</span>}</Td>
                    <Td><Badge status={q.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={query.data.totalPages} onChange={setPage} />
        </>
      ) : (
        <EmptyState title="No questions found" description="Adjust your filters or add questions to a bank." />
      )}
    </div>
  );
}
