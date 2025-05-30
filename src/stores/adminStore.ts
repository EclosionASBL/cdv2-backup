import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface Center {
  id: string;
  name: string;
  address: string;
  postal_code: string;
  city: string;
  tag: string;
  active: boolean;
}

interface Stage {
  id: string;
  title: string;
  description: string;
  age_min: number;
  age_max: number;
  base_price: number;
  image_url: string | null;
  active: boolean;
}

interface Session {
  id: string;
  stage_id: string;
  center_id: string;
  periode: string;
  start_date: string;
  end_date: string;
  capacity: number;
  active: boolean;
  stage?: Stage;
  center?: Center;
  nombre_jours?: number;
  prix_normal: number;
  prix_reduit?: number;
  prix_local?: number;
  prix_local_reduit?: number;
  remarques?: string;
  tarif_condition_id?: string;
  visible_from?: string;
  current_registrations: number;
}

interface AdminState {
  centers: Center[];
  stages: Stage[];
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  fetchCenters: () => Promise<void>;
  fetchStages: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  createCenter: (center: Omit<Center, 'id' | 'created_at'>) => Promise<void>;
  updateCenter: (id: string, updates: Partial<Center>) => Promise<void>;
  deleteCenter: (id: string) => Promise<void>;
  createStage: (stage: Omit<Stage, 'id' | 'created_at'>) => Promise<void>;
  updateStage: (id: string, updates: Partial<Stage>) => Promise<void>;
  deleteStage: (id: string) => Promise<void>;
  createSession: (session: Omit<Session, 'id' | 'created_at'>) => Promise<void>;
  updateSession: (id: string, updates: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  centers: [],
  stages: [],
  sessions: [],
  isLoading: false,
  error: null,

  fetchCenters: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('centers')
        .select('*')
        .order('name');

      if (error) throw error;
      set({ centers: data || [] });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchStages: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('stages')
        .select('*')
        .order('title');

      if (error) throw error;
      set({ stages: data || [] });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          stage_id,
          center_id,
          periode,
          start_date,
          end_date,
          capacity,
          prix_normal,
          prix_reduit,
          tarif_condition_id,
          prix_local,
          nombre_jours,
          prix_local_reduit,
          remarques,
          active,
          visible_from,
          semaine,
          current_registrations,
          stage:stages(*),
          center:centers(*)
        `)
        .order('start_date');

      if (error) throw error;
      
      set({ sessions: data || [] });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createCenter: async (center) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('centers')
        .insert([center]);

      if (error) throw error;
      await get().fetchCenters();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  updateCenter: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('centers')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await get().fetchCenters();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteCenter: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('centers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await get().fetchCenters();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createStage: async (stage) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('stages')
        .insert([stage]);

      if (error) throw error;
      await get().fetchStages();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  updateStage: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('stages')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await get().fetchStages();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteStage: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('stages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await get().fetchStages();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createSession: async (session) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('sessions')
        .insert([session]);

      if (error) throw error;
      await get().fetchSessions();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  updateSession: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await get().fetchSessions();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteSession: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await get().fetchSessions();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },
}));