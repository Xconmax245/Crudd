import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import type { QuestionBank } from '@crudd/shared';
import { ArrowRight, ArrowLeft, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import LoadingBlob from '../components/LoadingBlob';

import { useTitle } from '../hooks/useTitle';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Browse() {
  useTitle('Question Banks');
  const { data: banks, isLoading, isError } = useQuery<QuestionBank[]>({
    queryKey: ['banks'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/banks`);
      if (!res.ok) throw new Error('Failed to fetch banks');
      return res.json();
    },
  });

  // EGG 5: Idle on Browse Page
  const [isIdle, setIsIdle] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('crudd_idle_found')) return;

    let timeout: ReturnType<typeof setTimeout>;
    let resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsIdle(true);
        sessionStorage.setItem('crudd_idle_found', 'true');
        
        // Hide fake card after 2 seconds
        setTimeout(() => {
          setIsIdle(false);
        }, 2000);
      }, 30000);
    };

    resetTimer();

    const events = ['mousemove', 'keydown', 'touchstart'];
    const handleActivity = () => {
      if (!isIdle) resetTimer();
    };

    events.forEach(e => window.addEventListener(e, handleActivity));

    return () => {
      clearTimeout(timeout);
      events.forEach(e => window.removeEventListener(e, handleActivity));
    };
  }, [isIdle]);

  return (
    <div className="min-h-screen pb-20">
      <header className="border-b-3 border-ink bg-cream sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center max-w-6xl">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                const landingUrl = import.meta.env.VITE_LANDING_URL || 'https://crudd-landing.vercel.app/';
                window.location.href = landingUrl;
              }} 
              className="p-2 hover:bg-ink/5 rounded-full transition-colors"
            >
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            {isIdle && banks && banks.length > 0 && (
              <div 
                className="absolute top-0 left-0 w-full md:w-[calc(50%-0.75rem)] h-full z-10 cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  setIsIdle(false);
                  setShowModal(true);
                }}
              >
                <div className="block border-3 border-ink rounded-crudd bg-yellow p-6 shadow-hard animate-pulse h-full">
                  <div className="flex justify-between items-start mb-6">
                    <div className="inline-block px-3 py-1 bg-white text-ink text-xs font-bold uppercase tracking-wider rounded-crudd border-2 border-ink">
                      Mystery
                    </div>
                  </div>
                  <h3 className="text-xl font-bold font-display mb-2">Who Made This?</h3>
                  <p className="opacity-70 font-medium">1 question · Tap to find out</p>
                </div>
              </div>
            )}
            
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

      {/* Egg 5 Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-cream border-3 border-ink rounded-crudd shadow-[8px_8px_0px_#0A0A0A] p-8 max-w-sm w-full text-center relative"
            >
              <button 
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-ink/10 rounded-crudd transition-colors"
              >
                <X size={24} />
              </button>
              <div className="text-4xl mb-4">👋</div>
              <h3 className="text-2xl font-black font-display mb-2">Hey.</h3>
              <p className="font-bold text-lg mb-6">
                Ademola built this.
              </p>
              <a 
                href="https://x.com/rynyxxx" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block w-full bg-cyan text-ink font-bold py-3 rounded-crudd border-3 border-ink shadow-[4px_4px_0px_#0A0A0A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#0A0A0A] transition-all"
              >
                @rynyxxx on X
              </a>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
