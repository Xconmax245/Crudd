import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createChallengeSchema } from '@crudd/validation';
import type { CreateChallengeInput } from '@crudd/validation';
import type { BankDetail } from '@crudd/shared';
import { toast } from 'sonner';
import { ArrowLeft, Users, Clock, Settings2 } from 'lucide-react';
import { useMemo, useEffect } from 'react';
import { useTitle } from '../hooks/useTitle';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function generateQuestionPresets(bankSize: number): number[] {
  const candidates = [
    Math.round(bankSize * 0.2),
    Math.round(bankSize * 0.4),
    Math.round(bankSize * 0.5),
    Math.round(bankSize * 0.6),
    Math.round(bankSize * 0.8),
    bankSize
  ];
  
  const clamped = candidates.map(n => Math.max(1, Math.min(n, bankSize)));
  const unique = [...new Set(clamped)].sort((a, b) => a - b);
  if (!unique.includes(bankSize)) unique.push(bankSize);
  return unique;
}

import LoadingBlob from '../components/LoadingBlob';

// Generate guest session id (persists per browser session)
function getHostSessionId() {
  let id = sessionStorage.getItem('crudd_session_id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('crudd_session_id', id);
  }
  return id;
}

export default function Configure() {
  useTitle('Configure Challenge');
  const { id } = useParams();
  const navigate = useNavigate();
  const hostSessionId = getHostSessionId();

  const { data: bank, isLoading } = useQuery<BankDetail>({
    queryKey: ['banks', id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/banks/${id}`);
      if (!res.ok) throw new Error('Bank not found');
      return res.json();
    },
  });

  const questionPresets = useMemo(() => {
    if (!bank) return [];
    return generateQuestionPresets(bank.questionCount);
  }, [bank]);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<CreateChallengeInput>({
    resolver: zodResolver(createChallengeSchema),
    defaultValues: {
      bankId: id,
      questionCount: undefined, // Wait for presets
      timerSeconds: 10,
      maxPlayers: 10,
      hostSessionId,
    },
  });

  const currentQCount = watch('questionCount');
  const currentTimer = watch('timerSeconds');
  const currentPlayers = watch('maxPlayers');

  // Set default question count when presets load
  useEffect(() => {
    if (questionPresets.length > 0 && !currentQCount) {
      setValue('questionCount', questionPresets[Math.floor(questionPresets.length / 2)] || questionPresets[0]);
    }
  }, [questionPresets, setValue, currentQCount]);

  const onSubmit = async (data: CreateChallengeInput) => {
    try {
      const res = await fetch(`${API_URL}/api/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create challenge');

      navigate(`/challenge/${json.shareSlug}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) {
    return <LoadingBlob text="Loading Configuration" />;
  }

  if (!bank) return <div className="p-10 text-center text-red-500 font-bold">Bank not found</div>;

  return (
    <div className="min-h-screen pb-20">
      <header className="border-b-3 border-ink bg-cream">
        <div className="container mx-auto px-6 py-4 flex items-center gap-4 max-w-6xl">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-ink/5 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1">Configure Challenge</div>
            <h1 className="font-display font-black text-xl">{bank.title}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 max-w-2xl mt-12">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
          
          {/* Question Count */}
          <section className="bg-white border-3 border-ink p-8 rounded-crudd shadow-hard">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-cyan text-ink flex items-center justify-center border-2 border-ink">
                <Settings2 size={20} />
              </div>
              <h2 className="text-2xl font-display font-bold">How many questions?</h2>
            </div>
            
            <div className="flex flex-wrap gap-3 mb-4">
              {questionPresets.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setValue('questionCount', preset, { shouldValidate: true })}
                  className={`px-5 py-3 rounded-crudd font-bold border-2 transition-all ${
                    currentQCount === preset 
                      ? 'bg-cyan text-ink border-ink shadow-[2px_2px_0px_#0A0A0A] translate-y-[-2px]' 
                      : 'bg-cream text-ink border-ink/20 hover:border-ink hover:bg-ink/5'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <span className="font-medium opacity-70">Or custom:</span>
              <input 
                type="number"
                {...register('questionCount', { valueAsNumber: true })}
                className="w-24 px-4 py-2 border-2 border-ink rounded-crudd font-bold text-center focus:outline-none focus:ring-2 focus:ring-cyan"
              />
              <span className="font-medium opacity-70">/ {bank.questionCount} max</span>
            </div>
            {errors.questionCount && <p className="text-red-500 font-bold mt-2 text-sm">{errors.questionCount.message}</p>}
          </section>

          {/* Players */}
          <section className="bg-white border-3 border-ink p-8 rounded-crudd shadow-hard">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-pink text-ink border-2 border-ink flex items-center justify-center">
                <Users size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-display font-bold">Max Players</h2>
                <p className="text-sm opacity-70 font-medium">Includes you as the host.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {[2, 3, 4, 5, 6, 8, 10].map(players => (
                <button
                  key={players}
                  type="button"
                  onClick={() => setValue('maxPlayers', players)}
                  className={`px-5 py-3 rounded-crudd font-bold border-2 transition-all ${
                    currentPlayers === players 
                      ? 'bg-pink text-ink border-ink shadow-[2px_2px_0px_#0A0A0A] translate-y-[-2px]' 
                      : 'bg-cream text-ink border-ink hover:bg-ink/5'
                  }`}
                >
                  {players}
                </button>
              ))}
            </div>
          </section>

          {/* Timer */}
          <section className="bg-white border-3 border-ink p-8 rounded-crudd shadow-hard">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-yellow text-ink border-2 border-ink flex items-center justify-center">
                <Clock size={20} />
              </div>
              <h2 className="text-2xl font-display font-bold">Timer per question</h2>
            </div>

            <div className="flex flex-wrap gap-3">
              {[5, 10, 15, 20, 30].map(timer => (
                <button
                  key={timer}
                  type="button"
                  onClick={() => setValue('timerSeconds', timer as any)}
                  className={`px-5 py-3 rounded-crudd font-bold border-2 transition-all ${
                    currentTimer === timer 
                      ? 'bg-yellow text-ink border-ink shadow-[2px_2px_0px_#0A0A0A] translate-y-[-2px]' 
                      : 'bg-cream text-ink border-ink hover:bg-ink/5'
                  }`}
                >
                  {timer}s
                </button>
              ))}
            </div>
          </section>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-purple text-cream font-display font-black text-xl py-5 rounded-crudd border-3 border-ink shadow-hard shadow-hard-hover transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Generating Challenge...' : 'Create Challenge'}
          </button>
        </form>
      </main>
    </div>
  );
}
