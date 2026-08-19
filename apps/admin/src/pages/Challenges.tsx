import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { PageHeader, Spinner, Badge, EmptyState, Th, Td, Pagination } from '../components/ui';
import { formatDate } from '../lib/utils';
import type { ChallengeAdmin, Paginated, ChallengeStatus } from '../lib/types';

const STATUSES: (ChallengeStatus | '')[] = ['', 'LOBBY', 'ACTIVE', 'FINISHED', 'CANCELLED'];

export default function Challenges() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ChallengeStatus | ''>('');

  const query = useQuery({
    queryKey: ['challenges', page, status],
    queryFn: () =>
      api.get<Paginated<ChallengeAdmin>>('/api/admin/challenges', {
        page,
        pageSize: 20,
        status: status || undefined,
      }),
  });

  return (
    <div>
      <PageHeader title="Challenges" subtitle="Monitor matches created from your banks" />

      <div className="mb-4 flex gap-3">
        <select
          className="input max-w-[10rem]"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as ChallengeStatus | '');
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
                  <Th>Bank</Th>
                  <Th>Slug</Th>
                  <Th>Players</Th>
                  <Th>Questions</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {query.data.data.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/challenges/${c.id}`)}>
                    <Td className="font-medium">{c.bankTitle}</Td>
                    <Td className="font-mono text-xs text-muted">{c.shareSlug}</Td>
                    <Td>{c.participantCount} / {c.maxPlayers}</Td>
                    <Td>{c.questionCount}</Td>
                    <Td><Badge status={c.status} /></Td>
                    <Td className="text-muted">{formatDate(c.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={query.data.totalPages} onChange={setPage} />
        </>
      ) : (
        <EmptyState title="No challenges found" description="Challenges appear here once players create matches." />
      )}
    </div>
  );
}
