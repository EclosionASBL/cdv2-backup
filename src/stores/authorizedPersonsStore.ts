import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface AuthorizedPerson {
  id: string;
  created_at: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  relationship: string;
  photo_url: string | null;
  updated_at: string;
}

interface AuthorizedPersonsState {
  persons: AuthorizedPerson[];
  isLoading: boolean;
  error: string | null;
  fetchPersons: () => Promise<void>;
  addPerson: (person: Omit<AuthorizedPerson, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<AuthorizedPerson>;
  updatePerson: (id: string, updates: Partial<AuthorizedPerson>) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  uploadPhoto: (id: string, file: File) => Promise<string>;
}

export const useAuthorizedPersonsStore = create<AuthorizedPersonsState>((set, get) => ({
  persons: [],
  isLoading: false,
  error: null,

  fetchPersons: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('authorized_persons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ persons: data || [] });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  addPerson: async (person) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('authorized_persons')
        .insert([person])
        .select()
        .single();

      if (error) throw error;

      set(state => ({
        persons: [data, ...state.persons]
      }));

      return data;
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updatePerson: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('authorized_persons')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        persons: state.persons.map(person =>
          person.id === id ? { ...person, ...updates } : person
        )
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deletePerson: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('authorized_persons')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        persons: state.persons.filter(person => person.id !== id)
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  uploadPhoto: async (id, file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}.${fileExt}`;

      // Upload the file to storage
      const { error: uploadError } = await supabase.storage
        .from('authorized-persons-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data } = supabase.storage
        .from('authorized-persons-photos')
        .getPublicUrl(fileName);

      // Update the person record with the photo URL
      await get().updatePerson(id, { photo_url: data.publicUrl });

      return data.publicUrl;
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  }
}));