import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface School {
  id: string;
  name: string;
  code_postal: string;
  active: boolean;
  created_at: string;
}

interface SchoolState {
  schools: School[];
  isLoading: boolean;
  error: string | null;
  fetchSchools: () => Promise<void>;
  createSchool: (school: Omit<School, 'id' | 'created_at' | 'active'>) => Promise<School>;
  updateSchool: (id: string, updates: Partial<School>) => Promise<void>;
  deleteSchool: (id: string) => Promise<void>;
}

export const useSchoolStore = create<SchoolState>((set, get) => ({
  schools: [],
  isLoading: false,
  error: null,

  fetchSchools: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('name');

      if (error) throw error;
      set({ schools: data || [] });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createSchool: async (school) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('schools')
        .insert([{ ...school, active: true }])
        .select()
        .single();

      if (error) throw error;

      set(state => ({
        schools: [...state.schools, data]
      }));

      return data;
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateSchool: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('schools')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        schools: state.schools.map(school =>
          school.id === id ? { ...school, ...updates } : school
        )
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteSchool: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('schools')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        schools: state.schools.filter(school => school.id !== id)
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  }
}));