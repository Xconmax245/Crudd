import { useEffect } from 'react';

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `CRUDD — ${title}` : 'CRUDD — Prove You Know It';
  }, [title]);
}
