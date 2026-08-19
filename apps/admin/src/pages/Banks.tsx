import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { api, ApiRequestError } from '../lib/api';
import { PageHeader, Spinner, Badge, EmptyState, Modal, Th, Td, Pagination } from '../components/ui';
import { formatDate } from '../lib/utils';
import type { BankAdmin, Paginated, ContentStatus } from '../lib/types';

const STATUSES: (ContentStatus | '')[] = ['', 'DRAFT', 'PUBLISHED', 'ARCHIVED'];

export default function Banks() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ContentStatus | ''>('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', subject: '', description: '' });

  const query = useQuery({
    queryKey: ['banks', page, status, search],
    queryFn: () =>
      api.get<Paginated<BankAdmin>>('/api/admin/banks', {
        page,
        pageSize: 20,
        status: status || undefined,
        search: search || undefined,
      }),
  });

  const createMut = useMutation({
    mutationFn: () => api.post<BankAdmin>('/api/admin/banks', form),
    onSuccess: (bank) => {
      toast.success('Bank created');
      setShowCreate(false);
      setForm({ title: '', subject: '', description: '' });
      qc.invalidateQueries({ queryKey: ['banks'] });
      navigate(`/banks/${bank.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiRequestError ? err.message : 'Failed to create bank'),
  });

  return (
    <div>
      <PageHeader
        title="Question Banks"
        subtitle="Create, curate, and publish banks"
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New Bank
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search title, subject, tag…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <select
          className="input max-w-[10rem]"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as ContentStatus | '');
          }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || 'All statuses'}
            </option>
          ))}
        </select>
      </div>

      {query.isLoading ? (
        <Spinner />
      ) : query.data && query.data.data.length > 0 ? (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-line bg-gray-50">
                <tr>
                  <Th>Title</Th>
                  <Th>Subject</Th>
                  <Th>Questions</Th>
                  <Th>Status</Th>
                  <Th>Updated</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {query.data.data.map((bank) => (
                  <tr
                    key={bank.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/banks/${bank.id}`)}
                  >
                    <Td className="font-medium">{bank.title}</Td>
                    <Td className="text-muted">{bank.subject}</Td>
                    <Td>{bank.questionCount}</Td>
                    <Td>
                      <Badge status={bank.status} />
                    </Td>
                    <Td className="text-muted">{formatDate(bank.updatedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={query.data.totalPages} onChange={setPage} />
        </>
      ) : (
        <EmptyState
          title="No banks found"
          description="Create your first question bank to get started."
          action={
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              New Bank
            </button>
          }
        />
      )}

      <Modal
        open={showCreate}
        title="New Question Bank"
        onClose={() => setShowCreate(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={!form.title || !form.subject || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : 'Create'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Subject</label>
            <input
              className="input"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea
              className="input"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
