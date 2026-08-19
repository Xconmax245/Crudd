import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PageHeader, Spinner, EmptyState, Th, Td, Pagination } from '../components/ui';
import { formatDate } from '../lib/utils';
import type { ParticipantAdmin, Paginated } from '../lib/types';

export default function Participants() {
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['participants', page],
    queryFn: () => api.get<Paginated<ParticipantAdmin>>('/api/admin/participants', { page, pageSize: 25 }),
  });

  return (
    <div>
      <PageHeader title="Participants" subtitle="Everyone who has joined a challenge" />

      {query.isLoading ? (
        <Spinner />
      ) : query.data && query.data.data.length > 0 ? (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-line bg-gray-50">
                <tr>
                  <Th>Player</Th>
                  <Th>Challenge</Th>
                  <Th>Role</Th>
                  <Th>Score</Th>
                  <Th>Joined</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {query.data.data.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <Td>{p.username ?? <span className="text-muted">Anonymous</span>}</Td>
                    <Td className="font-mono text-xs text-muted">{p.challengeSlug ?? p.challengeId}</Td>
                    <Td className="text-muted">{p.role}</Td>
                    <Td className="font-medium">{p.score}</Td>
                    <Td className="text-muted">{formatDate(p.joinedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={query.data.totalPages} onChange={setPage} />
        </>
      ) : (
        <EmptyState title="No participants yet" />
      )}
    </div>
  );
}
