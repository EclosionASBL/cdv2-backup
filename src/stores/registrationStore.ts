import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface SimpleRegistration {
  id: string;
  kid_id: string;
  activity_id: string;
  payment_status: string;
}

interface RegistrationState {
  registrations: SimpleRegistration[];
  isLoading: boolean;
  error: string | null;
  fetchRegistrations: () => Promise<void>;
  isKidRegistered: (kidId: string, activityId: string) => boolean;
}

export const useRegistrationStore = create<RegistrationState>((set, get) => ({
  registrations: [],
  isLoading: false,
  error: null,

  fetchRegistrations: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('id, kid_id, activity_id, payment_status')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ registrations: data || [] });
    } catch (error: any) {
      console.error('Error fetching registrations:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  isKidRegistered: (kidId: string, activityId: string) => {
    return get().registrations.some(
      reg => reg.kid_id === kidId && 
             reg.activity_id === activityId && 
             reg.payment_status !== 'cancelled'
    );
  }
}));