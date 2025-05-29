import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface TarifCondition {
  id: string;
  label: string;
  code_postaux_autorises: string[];
  ecoles_autorisees: string[];
  active: boolean;
  created_at: string;
}

interface TarifConditionState {
  conditions: TarifCondition[];
  isLoading: boolean;
  error: string | null;
  fetchConditions: () => Promise<void>;
  createCondition: (condition: Omit<TarifCondition, 'id' | 'created_at'>) => Promise<void>;
  updateCondition: (id: string, updates: Partial<TarifCondition>) => Promise<void>;
  deleteCondition: (id: string) => Promise<void>;
}

export const useTarifConditionStore = create<TarifConditionState>((set, get) => ({
  conditions: [],
  isLoading: false,
  error: null,

  fetchConditions: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('tarif_conditions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ conditions: data || [] });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createCondition: async (condition) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('tarif_conditions')
        .insert([condition]);

      if (error) throw error;
      await get().fetchConditions();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  updateCondition: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('tarif_conditions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await get().fetchConditions();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteCondition: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Instead of deleting the record, mark it as inactive
      const { error } = await supabase
        .from('tarif_conditions')
        .update({ active: false })
        .eq('id', id);

      if (error) throw error;
      await get().fetchConditions();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  }
}));