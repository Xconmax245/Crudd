import { createClient } from '@supabase/supabase-js';

/**
 * Public Supabase browser client. Used ONLY for admin authentication
 * (email/password sign-in). All authorization is enforced server-side by the
 * API — this client never grants any admin privilege on its own.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
