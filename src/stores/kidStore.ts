import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { useAuthStore } from './authStore';

/* ──────────────────────────────────────────────────
   Types provenant de la définition générée par Supabase
   ────────────────────────────────────────────────── */
type Kid            = Database['public']['Tables']['kids']['Row'];
type KidHealth      = Database['public']['Tables']['kid_health']['Row'];
type KidAllergies   = Database['public']['Tables']['kid_allergies']['Row'];
type KidActivities  = Database['public']['Tables']['kid_activities']['Row'];
type KidDeparture   = Database['public']['Tables']['kid_departure']['Row'];
type KidInclusion   = Database['public']['Tables']['kid_inclusion']['Row'];

export interface KidWithDetails extends Kid {
  health?:     KidHealth;
  allergies?:  KidAllergies;
  activities?: KidActivities;
  departure?:  KidDeparture;
  inclusion?:  KidInclusion;
  /** URL signée (60 min) pour la photo privée */
  photo_signed_url?: string | null;
}

interface KidStoreState {
  kids: KidWithDetails[];
  currentKid: KidWithDetails | null;
  isLoading: boolean;
  isUploadingPhoto: boolean;
  error: string | null;

  /* Actions */
  fetchKids: () => Promise<void>;
  fetchKid: (id: string) => Promise<KidWithDetails | null>;
  createKid: (data: Partial<Kid>) => Promise<KidWithDetails>;
  updateKid: (id: string, updates: Partial<Kid>) => Promise<void>;
  deleteKid: (id: string) => Promise<void>;
  getPhotoUrl: (kidId: string) => string | null;
  uploadPhoto: (kidId: string, file: File) => Promise<string | null>;
  refreshPhotoUrl: (kidId: string) => Promise<void>;
}

// Helper function to create signed URL with retries
const createSignedUrlWithRetry = async (path: string, maxRetries = 3, delay = 1000): Promise<string | null> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data: signed, error } = await supabase
        .storage
        .from('kid-photos')
        .createSignedUrl(path, 3600);

      if (error) throw error;
      return signed?.signedUrl || null;
    } catch (err) {
      if (attempt === maxRetries - 1) {
        console.error('Failed to create signed URL after retries:', err);
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
    }
  }
  return null;
};

export const useKidStore = create<KidStoreState>((set, get) => ({
  kids: [],
  currentKid: null,
  isLoading: false,
  isUploadingPhoto: false,
  error: null,

  /* ─────────── READ all kids (with signed URLs) ─────────── */
  fetchKids: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('kids')
        .select(`
          *,
          health:kid_health(*),
          allergies:kid_allergies(*),
          activities:kid_activities(*),
          departure:kid_departure(*),
          inclusion:kid_inclusion(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      /* Add signed URL (1h) for each photo */
      const kids = await Promise.all(
        (data || []).map(async (kid) => {
          if (!kid.photo_url) return kid;
          const signedUrl = await createSignedUrlWithRetry(kid.photo_url);
          return { ...kid, photo_signed_url: signedUrl };
        })
      );

      set({ kids, isLoading: false });
    } catch (err: any) {
      set({ error: err.message ?? 'Unknown error', isLoading: false });
    }
  },

  /* ─────────── READ one kid (with signed URL) ─────────── */
  fetchKid: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('kids')
        .select(`
          *,
          health:kid_health(*),
          allergies:kid_allergies(*),
          activities:kid_activities(*),
          departure:kid_departure(*),
          inclusion:kid_inclusion(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      let photo_signed_url: string | null = null;
      if (data.photo_url) {
        photo_signed_url = await createSignedUrlWithRetry(data.photo_url);
      }

      const kid = { ...data, photo_signed_url } as KidWithDetails;
      set({ currentKid: kid, isLoading: false });
      return kid;
    } catch (err: any) {
      set({ error: err.message ?? 'Unknown error', isLoading: false });
      return null;
    }
  },

  /* ─────────── CREATE ─────────── */
  createKid: async (data) => {
    const { user } = useAuthStore.getState();
    if (!user) throw new Error('User not authenticated');

    set({ isLoading: true, error: null });

    try {
      const { data: inserted, error } = await supabase
        .from('kids')
        .insert([{ ...data, user_id: user.id }])
        .select('*')
        .single();

      if (error) throw error;

      /* Refresh list */
      await get().fetchKids();
      return inserted as KidWithDetails;
    } catch (err: any) {
      set({ error: err.message ?? 'Unknown error' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  /* ─────────── UPDATE ─────────── */
  updateKid: async (id, updates) => {
    set({ isLoading: true, error: null });

    try {
      const { error } = await supabase
        .from('kids')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      /* Refresh */
      await get().fetchKids();
    } catch (err: any) {
      set({ error: err.message ?? 'Unknown error' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  /* ─────────── DELETE ─────────── */
  deleteKid: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const { error } = await supabase
        .from('kids')
        .delete()
        .eq('id', id);

      if (error) throw error;

      /* Refresh */
      await get().fetchKids();
    } catch (err: any) {
      set({ error: err.message ?? 'Unknown error' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  /* ─────────── Get photo URL ─────────── */
  getPhotoUrl: (kidId) => {
    const kid = get().kids.find(k => k.id === kidId);
    return kid?.photo_signed_url || null;
  },

  /* ─────────── Upload photo ─────────── */
  uploadPhoto: async (kidId, file) => {
    set({ isUploadingPhoto: true, error: null });
    const path = `${kidId}.${file.type === 'image/png' ? 'png' : 'jpg'}`;
    
    try {
      // 1. Update photo_url in the database
      const { error: updateError } = await supabase
        .from('kids')
        .update({ photo_url: path })
        .eq('id', kidId);
      
      if (updateError) throw updateError;

      // 2. Upload the file to storage
      const { error: uploadError } = await supabase
        .storage
        .from('kid-photos')
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: '3600'
        });
      
      if (uploadError) throw uploadError;

      // 3. Get a fresh signed URL with retries
      const signedUrl = await createSignedUrlWithRetry(path);

      // 4. Update the store
      const list = get().kids;
      const idx = list.findIndex(k => k.id === kidId);
      if (idx !== -1) {
        const updKid = { ...list[idx], photo_url: path, photo_signed_url: signedUrl };
        const updList = [...list];
        updList[idx] = updKid;
        set({ kids: updList, currentKid: updKid });
      }

      return signedUrl;
    } catch (err: any) {
      set({ error: err.message ?? 'Unknown error' });
      throw err;
    } finally {
      set({ isUploadingPhoto: false });
    }
  },

  /* ─────────── Refresh photo URL ─────────── */
  refreshPhotoUrl: async (kidId: string) => {
    try {
      const kid = get().kids.find(k => k.id === kidId);
      if (!kid?.photo_url) return;

      const signedUrl = await createSignedUrlWithRetry(kid.photo_url);
      if (!signedUrl) return;

      const updatedKid = { ...kid, photo_signed_url: signedUrl };
      const updatedKids = get().kids.map(k => k.id === kidId ? updatedKid : k);
      set({ kids: updatedKids, currentKid: updatedKid });
    } catch (err) {
      console.error('Error refreshing photo URL:', err);
    }
  }
}));