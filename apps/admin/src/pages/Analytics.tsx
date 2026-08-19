import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PageHeader, Spinner, EmptyState, Th, Td } from '../components/ui';
import type { Analytics as AnalyticsData } from '../lib/types';

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold">{value}</div>
    </div>
  );
}

export default function Analytics() {
  const query = useQuery({ queryKey: ['analytics'], queryFn: () => api.get<AnalyticsData>('/api/admin/analytics') });

  if (query.isLoading) return <Spinner />;
  if (!query.data) return <EmptyState title="No analytics available" />;

  const a = query.data;

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Content and engagement metrics" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Total Banks" value={a.totalBanks} />
        <Metric label="Published Banks" value={a.publishedBanks} />
        <Metric label="Total Questions" value={a.totalQuestions} />
        <Metric label="Published Questions" value={a.publishedQuestions} />
        <Metric label="Challenges Created" value={a.challengesCreated} />
        <Metric label="Completed" value={a.challengesCompleted} />
        <Metric label="Cancelled" value={a.challengesCancelled} />
        <Metric label="Avg Players / Challenge" value={a.averagePlayersPerChallenge} />
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Most Popular Banks</h2>
      {a.topBanks.length > 0 ? (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-line bg-gray-50">
              <tr>
                <Th>Bank</Th>
                <Th className="text-right">Challenges</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {a.topBanks.map((b) => (
                <tr key={b.bankId}>
                  <Td className="font-medium">{b.title}</Td>
                  <Td className="text-right">{b.challengeCount}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No challenge data yet" />
      )}
    </div>
  );
}
