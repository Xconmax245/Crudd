import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { joinChallengeSchema } from '@crudd/validation';
import type { JoinChallengeInput } from '@crudd/validation';
import type { ChallengePreview } from '@crudd/shared';
import { toast } from 'sonner';
import { Copy, Check, Users, Clock, HelpCircle, ArrowLeft, Send, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { setUsername } from '../lib/session';
import { useTitle } from '../hooks/useTitle';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

import LoadingBlob from '../components/LoadingBlob';

export default function Challenge() {
  useTitle('Challenge Lobby');
  const { slug } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { data: challenge, isLoading } = useQuery<ChallengePreview>({
    queryKey: ['challenges', slug],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/challenges/${slug}`);
      if (!res.ok) throw new Error('Challenge not found');
      return res.json();
    },
  });

  const { register, handleSubmit, formState: { errors } } = useForm<JoinChallengeInput>({
    resolver: zodResolver(joinChallengeSchema),
  });

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const onSubmit = (data: JoinChallengeInput) => {
    setUsername(data.username);
    navigate(`/challenge/${slug}/play`);
  };

  if (isLoading) return <LoadingBlob text="Loading Challenge" />;
  if (!challenge) return <div className="min-h-screen flex flex-col items-center justify-center font-bold text-red-500 font-display text-2xl">Challenge not found</div>;

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="border-b-4 border-ink bg-white relative z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between max-w-5xl">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2 px-4 py-2 hover:bg-ink/5 rounded-crudd transition-colors font-bold text-ink border-2 border-transparent hover:border-ink/20"
          >
            <ArrowLeft size={20} />
            Back to Browse
          </button>
          <div className="font-display font-black text-3xl tracking-tight text-ink">CRUDD</div>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="container mx-auto px-4 max-w-3xl mt-8 mb-20 flex-1 flex flex-col justify-center">
        <div className="bg-white border-4 border-ink rounded-crudd shadow-[8px_8px_0px_#16161D] overflow-hidden transition-all duration-300">
          {/* Header */}
          <div className="bg-ink text-cream p-10 text-center relative overflow-hidden border-b-4 border-ink">
            <div className="relative z-10 flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-4 py-1 bg-lime text-ink text-xs font-black uppercase tracking-widest rounded-crudd border-2 border-ink mb-6">
                Challenge Ready
              </div>
              
              <h1 className="text-4xl md:text-5xl font-display font-black mb-8 leading-tight">
                {challenge.bankTitle}
              </h1>
              
              {/* Stats Bar */}
              <div className="flex flex-wrap justify-center gap-6 text-cream/90 pt-6 border-t-2 border-ink/20 w-full">
                <div className="flex items-center gap-2 font-bold px-4 py-2 bg-cream/10 rounded-crudd">
                  <HelpCircle size={18} className="text-yellow" /> 
                  <span>{challenge.questionCount} Qs</span>
                </div>
                <div className="flex items-center gap-2 font-bold px-4 py-2 bg-cream/10 rounded-crudd">
                  <Clock size={18} className="text-cyan" /> 
                  <span>{challenge.timerSeconds}s</span>
                </div>
                <div className="flex items-center gap-2 font-bold px-4 py-2 bg-cream/10 rounded-crudd">
                  <Users size={18} className="text-pink" /> 
                  <span>{challenge.maxPlayers} max</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNjY2NjY2MiLz48L3N2Zz4=')]">
            <div className="grid md:grid-cols-2 gap-10">
              {/* Left Column: Share */}
              <div className="flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-crudd bg-pink text-ink flex items-center justify-center border-2 border-ink shadow-sm">
                    <Copy size={20} />
                  </div>
                  <h2 className="text-2xl font-display font-black text-ink">Invite Players</h2>
                </div>
                
                <p className="text-ink/70 font-medium mb-4">
                  Share this link with your friends so they can join the lobby before you start.
                </p>
                
                <div className="mt-auto bg-white p-5 border-3 border-ink rounded-crudd shadow-[4px_4px_0px_#16161D]">
                  <div className="flex flex-col gap-3">
                    <input 
                      type="text" 
                      readOnly 
                      value={window.location.href} 
                      className="w-full bg-cream border-2 border-ink/20 rounded-crudd px-4 py-3 font-medium outline-none text-ink text-sm selection:bg-pink/30 truncate"
                    />
                    <button 
                      onClick={copyLink}
                      className="w-full bg-pink text-ink border-2 border-ink rounded-crudd px-6 py-3 font-black uppercase tracking-wider hover:bg-pink/90 hover:-translate-y-0.5 active:translate-y-0 shadow-[2px_2px_0px_#16161D] transition-all flex items-center justify-center gap-2"
                    >
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                      {copied ? 'Copied to Clipboard!' : 'Copy Invite Link'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Join */}
              <div className="flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-crudd bg-cyan text-ink flex items-center justify-center border-2 border-ink shadow-sm">
                    <Users size={20} />
                  </div>
                  <h2 className="text-2xl font-display font-black text-ink">Join Match</h2>
                </div>
                
                <p className="text-ink/70 font-medium mb-4">
                  Enter your display name to jump into the lobby and wait for the host.
                </p>
                
                <form onSubmit={handleSubmit(onSubmit)} className="mt-auto bg-cyan/10 p-6 border-3 border-ink rounded-crudd shadow-[4px_4px_0px_#16161D] flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-black uppercase tracking-wider mb-2 text-ink">Display Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. TriviaMaster99" 
                      {...register('username')}
                      className="w-full px-5 py-3 border-3 border-ink bg-white text-ink rounded-crudd font-bold focus:outline-none focus:ring-4 focus:ring-cyan/30 text-lg placeholder:text-ink/30 transition-shadow"
                      autoComplete="off"
                    />
                    {errors.username && <p className="text-red-600 font-bold mt-2 text-sm flex items-center gap-1"><AlertCircle size={16}/>{errors.username.message}</p>}
                  </div>
                  
                  <button 
                    type="submit" 
                    className="w-full bg-lime text-ink font-display font-black text-xl py-4 rounded-crudd border-3 border-ink shadow-[4px_4px_0px_#0A0A0A] hover:-translate-y-1 hover:shadow-[6px_6px_0px_#0A0A0A] active:translate-y-0 active:shadow-[2px_2px_0px_#0A0A0A] transition-all flex items-center justify-center gap-3 mt-2 group"
                  >
                    Enter Lobby <Send size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
