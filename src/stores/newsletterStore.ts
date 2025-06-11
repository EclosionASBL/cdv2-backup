import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface NewsletterState {
  isSubscribing: boolean;
  isUnsubscribing: boolean;
  error: string | null;
  success: string | null;
  subscribe: (email: string) => Promise<void>;
  unsubscribe: (email: string) => Promise<void>;
  clearMessages: () => void;
}

export const useNewsletterStore = create<NewsletterState>((set) => ({
  isSubscribing: false,
  isUnsubscribing: false,
  error: null,
  success: null,
  
  subscribe: async (email: string) => {
    set({ isSubscribing: true, error: null, success: null });
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscribe-newsletter`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token 
              ? { 'Authorization': `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      set({ 
        success: data.message || 'Vous êtes maintenant inscrit à notre newsletter',
        isSubscribing: false 
      });
    } catch (err) {
      console.error('Error subscribing to newsletter:', err);
      set({ 
        error: err instanceof Error ? err.message : 'Une erreur est survenue',
        isSubscribing: false 
      });
    }
  },
  
  unsubscribe: async (email: string) => {
    set({ isUnsubscribing: true, error: null, success: null });
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unsubscribe-newsletter`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token 
              ? { 'Authorization': `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      set({ 
        success: data.message || 'Vous avez été désinscrit de notre newsletter',
        isUnsubscribing: false 
      });
    } catch (err) {
      console.error('Error unsubscribing from newsletter:', err);
      set({ 
        error: err instanceof Error ? err.message : 'Une erreur est survenue',
        isUnsubscribing: false 
      });
    }
  },
  
  clearMessages: () => {
    set({ error: null, success: null });
  }
}));