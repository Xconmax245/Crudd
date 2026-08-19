import { useEffect, useState } from 'react';

const KONAMI_CODE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'b', 'a'
];

export function useKonamiCode() {
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    // Only fire once per session
    if (sessionStorage.getItem('crudd_konami_found')) {
      return;
    }

    let inputSequence: string[] = [];

    const handleKeyDown = (e: KeyboardEvent) => {
      // Add key to sequence
      inputSequence.push(e.key);

      // Keep sequence to the length of the Konami code
      if (inputSequence.length > KONAMI_CODE.length) {
        inputSequence = inputSequence.slice(1);
      }

      // Check if sequence matches
      const isMatch = inputSequence.every(
        (key, index) => key.toLowerCase() === KONAMI_CODE[index]?.toLowerCase()
      );

      if (isMatch) {
        setTriggered(true);
        sessionStorage.setItem('crudd_konami_found', 'true');
        // Reset sequence so it doesn't trigger repeatedly
        inputSequence = [];
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return triggered;
}
