import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PageHeader, Spinner, Badge, EmptyState, Th, Td, Pagination } from '../components/ui';
import { formatDate } from '../lib/utils';
import type { AuditLogDTO, Paginated } from '../lib/types';

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');

  const query = useQuery({
    queryKey: ['audit', page, entityType],
    queryFn: () =>
      api.get<Paginated<AuditLogDTO>>('/api/admin/audit', {
        page,
        pageSize: 30,
        entityType: entityType || undefined,
      }),
  });

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="A record of every administrative action" />

      <div className="mb-4 flex gap-3">
        <select
          className="input max-w-[12rem]"
          value={entityType}
          onChange={(e) => {
            setPage(1);
            setEntityType(e.target.value);
          }}
        >
          <option value="">All entities</option>
          <option value="bank">Bank</option>
          <option value="question">Question</option>
          <option value="challenge">Challenge</option>
          <option value="settings">Settings</option>
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
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Admin</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {query.data.data.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <Td>
                      <Badge>{log.action}</Badge>
                    </Td>
                    <Td className="text-muted">
                      {log.entityType}
                      {log.entityId ? <span className="ml-1 font-mono text-xs">#{log.entityId.slice(0, 8)}</span> : null}
                    </Td>
                    <Td className="text-muted">{log.adminEmail ?? '—'}</Td>
                    <Td className="text-muted">{formatDate(log.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={query.data.totalPages} onChange={setPage} />
        </>
      ) : (
        <EmptyState title="No audit entries" description="Administrative actions will be recorded here." />
      )}
    </div>
  );
}
