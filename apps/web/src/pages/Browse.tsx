import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import type { QuestionBank } from '@crudd/shared';
import { ArrowRight, ArrowLeft } from 'lucide-react';

import LoadingBlob from '../components/LoadingBlob';

import { useTitle } from '../hooks/useTitle';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Browse() {
  useTitle('Question Banks');
  const navigate = useNavigate();
  const { data: banks, isLoading, isError } = useQuery<QuestionBank[]>({
    queryKey: ['banks'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/banks`);
      if (!res.ok) throw new Error('Failed to fetch banks');
      return res.json();
    },
  });

  return (
    <div className="min-h-screen pb-20">
      <header className="border-b-3 border-ink bg-cream sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center max-w-6xl">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-ink/5 rounded-full transition-colors">
              <ArrowLeft size={24} />
            </button>
            <div className="font-display font-black text-2xl tracking-tight">CRUDD</div>
          </div>
          <div className="text-sm font-bold opacity-50">Choose a bank to start</div>
        </div>
      </header>

      <main className="container mx-auto px-6 max-w-6xl mt-12">
        <div className="text-center mb-16 space-y-4">
          <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight">What are we playing?</h1>
          <p className="text-xl max-w-2xl mx-auto opacity-70">
            Select a question bank to configure your challenge and invite friends.
          </p>
        </div>

        {isLoading ? (
          <LoadingBlob text="Loading Banks" />
        ) : isError ? (
          <div className="text-center text-red-500 font-bold p-8 border-3 border-red-500 rounded-crudd bg-red-50">
            Failed to load question banks. Make sure the API and database are running.
          </div>
        ) : banks?.length === 0 ? (
          <div className="text-center font-bold text-lg opacity-60 p-16 border-4 border-ink border-dashed rounded-crudd max-w-3xl mx-auto">
            No question banks found. Please run the seed script.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {banks?.map((bank) => (
              <Link
                key={bank.id}
                to={`/banks/${bank.id}/configure`}
                className="group block border-3 border-ink rounded-crudd bg-white p-6 shadow-hard shadow-hard-hover transition-all duration-200"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="inline-block px-3 py-1 bg-lime text-ink text-xs font-bold uppercase tracking-wider rounded-crudd border-2 border-ink">
                    {bank.subject}
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-ink bg-purple/10 flex items-center justify-center group-hover:bg-purple group-hover:text-cream transition-colors">
                    <ArrowRight size={20} className="relative left-[-1px] group-hover:left-[1px] transition-all" />
                  </div>
                </div>
                <h3 className="text-xl font-bold font-display mb-2">{bank.title}</h3>
                <p className="opacity-70 font-medium">{bank.questionCount} questions available</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
