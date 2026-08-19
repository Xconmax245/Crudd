import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { PageHeader, Spinner, Badge } from '../components/ui';
import { formatDate } from '../lib/utils';
import type { DashboardStats, AuditLogDTO } from '../lib/types';

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export default function Overview() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api.get<DashboardStats>('/api/admin/stats') });
  const activity = useQuery({ queryKey: ['activity'], queryFn: () => api.get<AuditLogDTO[]>('/api/admin/activity') });

  return (
    <div>
      <PageHeader title="Overview" subtitle="Content and activity at a glance" />

      {stats.isLoading ? (
        <Spinner />
      ) : stats.data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Question Banks" value={stats.data.totalBanks} />
          <StatCard
            label="Questions"
            value={stats.data.totalQuestions}
            hint={`${stats.data.publishedQuestions} published · ${stats.data.draftQuestions} draft`}
          />
          <StatCard
            label="Challenges"
            value={stats.data.totalChallenges}
            hint={`${stats.data.activeChallenges} active · ${stats.data.finishedChallenges} finished`}
          />
          <StatCard label="Participants" value={stats.data.totalParticipants} />
        </div>
      ) : null}

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent Activity</h2>
          <Link to="/audit" className="text-sm text-brand hover:underline">
            View all
          </Link>
        </div>
        <div className="card divide-y divide-line">
          {activity.isLoading ? (
            <div className="p-5">
              <Spinner />
            </div>
          ) : activity.data && activity.data.length > 0 ? (
            activity.data.map((log) => (
              <div key={log.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <Badge>{log.action}</Badge>
                  <span className="text-muted">{log.entityType}</span>
                  {log.adminEmail && <span className="text-muted">· {log.adminEmail}</span>}
                </div>
                <span className="text-xs text-muted">{formatDate(log.createdAt)}</span>
              </div>
            ))
          ) : (
            <div className="p-5 text-sm text-muted">No activity yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
