import { useParams, useNavigate, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { api, ApiRequestError } from '../lib/api';
import { PageHeader, Spinner, Badge, EmptyState, Th, Td } from '../components/ui';
import { formatDate } from '../lib/utils';
import type { ChallengeAdmin, ParticipantAdmin } from '../lib/types';

type ChallengeFull = ChallengeAdmin & { participants: ParticipantAdmin[] };

export default function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const challenge = useQuery({
    queryKey: ['challenge', id],
    queryFn: () => api.get<ChallengeFull>(`/api/admin/challenges/${id}`),
    enabled: !!id,
  });

  const cancelMut = useMutation({
    mutationFn: () => api.post(`/api/admin/challenges/${id}/cancel`),
    onSuccess: () => {
      toast.success('Challenge cancelled');
      qc.invalidateQueries({ queryKey: ['challenge', id] });
      qc.invalidateQueries({ queryKey: ['challenges'] });
    },
    onError: (err) => toast.error(err instanceof ApiRequestError ? err.message : 'Cancel failed'),
  });

  if (challenge.isLoading) return <Spinner />;
  if (!challenge.data) return <EmptyState title="Challenge not found" />;

  const c = challenge.data;
  const leaderboard = [...c.participants].sort((a, b) => b.score - a.score);

  return (
    <div>
      <button onClick={() => navigate('/challenges')} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Back to challenges
      </button>

      <PageHeader
        title={c.bankTitle}
        subtitle={`Slug: ${c.shareSlug}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge status={c.status} />
            {c.status !== 'FINISHED' && c.status !== 'CANCELLED' && (
              <button
                className="btn-danger"
                disabled={cancelMut.isPending}
                onClick={() => {
                  if (confirm('Cancel this challenge?')) cancelMut.mutate();
                }}
              >
                Cancel Challenge
              </button>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Info label="Questions" value={String(c.questionCount)} />
        <Info label="Timer" value={`${c.timerSeconds}s`} />
        <Info label="Players" value={`${c.participantCount} / ${c.maxPlayers}`} />
        <Info label="Created" value={formatDate(c.createdAt)} />
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold">Leaderboard</h2>
      {leaderboard.length > 0 ? (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-line bg-gray-50">
              <tr>
                <Th>#</Th>
                <Th>Player</Th>
                <Th>Role</Th>
                <Th>Score</Th>
                <Th>Joined</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {leaderboard.map((p, i) => (
                <tr key={p.id}>
                  <Td className="font-medium">{i + 1}</Td>
                  <Td>{p.username ?? <span className="text-muted">Anonymous</span>}</Td>
                  <Td className="text-muted">{p.role}</Td>
                  <Td className="font-medium">{p.score}</Td>
                  <Td className="text-muted">{formatDate(p.joinedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No participants yet" />
      )}

      <p className="mt-6 text-sm text-muted">
        Bank:{' '}
        <Link to={`/banks/${c.bankId}`} className="text-brand hover:underline">
          {c.bankTitle}
        </Link>
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-display text-lg font-semibold">{value}</div>
    </div>
  );
}
