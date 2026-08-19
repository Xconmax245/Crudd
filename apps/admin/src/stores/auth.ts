import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { api, ApiRequestError } from '../lib/api';

export interface AdminMe {
  id: string;
  email: string;
  displayName: string | null;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'MODERATOR';
  isActive: boolean;
}

interface AuthState {
  loading: boolean;
  me: AdminMe | null;
  error: string | null;
  /** Verify the current session against the API's /me endpoint. */
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  loading: true,
  me: null,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        set({ me: null, loading: false });
        return;
      }
      // The API is authoritative: it decides whether this user is an admin.
      const me = await api.get<AdminMe>('/api/admin/me');
      set({ me, loading: false });
    } catch (err) {
      const message =
        err instanceof ApiRequestError && err.status === 403
          ? 'This account does not have admin access.'
          : 'Unable to verify your session.';
      set({ me: null, loading: false, error: message });
    }
  },

  signIn: async (email, password) => {
    set({ error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ error: error.message });
      throw error;
    }
    // Verify admin authorization immediately after sign-in.
    try {
      const me = await api.get<AdminMe>('/api/admin/me');
      set({ me });
    } catch (err) {
      await supabase.auth.signOut();
      const message =
        err instanceof ApiRequestError && err.status === 403
          ? 'This account does not have admin access.'
          : 'Unable to verify admin access.';
      set({ me: null, error: message });
      throw new Error(message);
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ me: null });
  },
}));
