import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiRequestError } from '../lib/api';
import { PageHeader, Spinner } from '../components/ui';
import type { AdminSettings } from '../lib/types';

export default function Settings() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['settings'], queryFn: () => api.get<AdminSettings>('/api/admin/settings') });
  const [form, setForm] = useState<AdminSettings | null>(null);

  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);

  const saveMut = useMutation({
    mutationFn: (payload: AdminSettings) => api.patch<AdminSettings>('/api/admin/settings', payload),
    onSuccess: () => {
      toast.success('Settings saved');
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => toast.error(err instanceof ApiRequestError ? err.message : 'Save failed'),
  });

  if (query.isLoading || !form) return <Spinner />;

  const num = (key: keyof AdminSettings, label: string, min = 1) => (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        min={min}
        className="input"
        value={form[key] as number}
        onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
      />
    </div>
  );

  const toggle = (key: keyof AdminSettings, label: string, hint: string) => (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        className="mt-1"
        checked={form[key] as boolean}
        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Platform defaults and publication policy"
        actions={
          <button className="btn-primary" disabled={saveMut.isPending} onClick={() => saveMut.mutate(form)}>
            {saveMut.isPending ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : 'Save changes'}
          </button>
        }
      />

      <div className="card space-y-5 p-6">
        <h3 className="font-display font-semibold">Publication</h3>
        <div className="grid grid-cols-2 gap-4">
          {num('minQuestionsForPublication', 'Min questions to publish a bank')}
        </div>

        <hr className="border-line" />

        <h3 className="font-display font-semibold">Challenge Defaults</h3>
        <div className="grid grid-cols-2 gap-4">
          {num('defaultQuestionCount', 'Default question count')}
          {num('defaultTimerSeconds', 'Default timer (seconds)', 5)}
          {num('maxPlayersPerChallenge', 'Max players per challenge')}
        </div>

        <hr className="border-line" />

        <h3 className="font-display font-semibold">Platform</h3>
        <div className="space-y-3">
          {toggle('allowPublicBankBrowsing', 'Allow public bank browsing', 'Let players browse published banks on the site.')}
          {toggle('maintenanceMode', 'Maintenance mode', 'Temporarily disable new challenge creation.')}
        </div>
      </div>
    </div>
  );
}
