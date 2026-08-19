import { motion, useReducedMotion } from 'motion/react';

export default function LoadingBlob({ text = "Loading..." }: { text?: string }) {
  const reduce = useReducedMotion();
  
  return (
    <div className="flex flex-col items-center justify-center py-20 w-full min-h-[50vh]">
      <motion.div
        className="relative flex items-center justify-center mb-10"
        initial={reduce ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
        animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div
          className="relative w-32 h-32 bg-purple border-3 border-ink shadow-hard animate-blob-pulse"
          style={{ borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' }}
        >
          {/* Eyes */}
          <div className="absolute top-[38%] left-[28%] w-5 h-5 bg-cream border-3 border-ink rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-ink rounded-full" />
          </div>
          <div className="absolute top-[38%] right-[28%] w-5 h-5 bg-cream border-3 border-ink rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-ink rounded-full" />
          </div>
          {/* Mouth */}
          <div
            className="absolute bottom-[30%] left-1/2 -translate-x-1/2 w-6 h-3 border-b-3 border-ink"
            style={{ borderRadius: '0 0 20px 20px' }}
          />
        </div>
      </motion.div>
      <div className="font-display font-black text-2xl tracking-widest opacity-70 animate-pulse uppercase">
        {text}
      </div>
    </div>
  );
}
