import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type AccountType = 'parent' | 'organisation' | 'other';

interface UserProfile {
  id: string;
  nom: string | null;
  prenom: string | null;
  adresse: string | null;
  cpostal: string | null;
  localite: string | null;
  telephone: string | null;
  telephone2: string | null;
  nnational: string | null;
  newsletter: boolean;
  avatar_url: string | null;
  role: string;
  account_type: AccountType;
  organisation_name: string | null;
  company_number: string | null;
  is_legal_guardian: boolean;
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string, options?: { redirectTo?: string }) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: false,
  error: null,
  
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  
  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user }, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });

      if (error) throw error;
      
      // Get user profile and role
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        set({ error: profileError.message });
        return { error: new Error(profileError.message) };
      }

      // Clean nnational field from sentinel values
      if (profileData && profileData.nnational) {
        if (['EMPTY', '000', 'NULL'].includes(profileData.nnational)) {
          profileData.nnational = null;
        }
      }

      set({ user, profile: profileData });
      return { error: null };
    } catch (error: any) {
      set({ error: error.message });
      return { error };
    } finally {
      set({ isLoading: false });
    }
  },
  
  signUp: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      });
      if (error) throw error;
      
      // Fetch profile after successful sign up
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        set({ user });
        await get().fetchProfile();
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      // First check if we have a session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // If no session, just clear local state
        set({ user: null, profile: null });
        return;
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ user: null, profile: null });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  resetPassword: async (email, options = {}) => {
    set({ isLoading: true, error: null });
    try {
      const redirectTo = options.redirectTo || `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  updatePassword: async (password) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchProfile: async () => {
    const { user } = get();
    if (!user) {
      set({ profile: null });
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (error) throw error;

      // Clean nnational field from sentinel values
      if (data && data.nnational) {
        if (['EMPTY', '000', 'NULL'].includes(data.nnational)) {
          data.nnational = null;
        }
      }

      set({ profile: data });
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },
  
  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return;
    
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);
        
      if (error) throw error;
      
      // Refresh profile data
      await get().fetchProfile();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  isAdmin: () => {
    const { profile } = get();
    return profile?.role === 'admin';
  }
}));