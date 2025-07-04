import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

export interface WaitingListEntry {
  id: string;
  activity_id: string;
  kid_id: string;
  user_id: string;
  created_at: string;
  invited_at: string | null;
  expires_at: string | null;
  status: 'waiting' | 'invited' | 'converted' | 'cancelled';
  // Joined data
  kid?: {
    prenom: string;
    nom: string;
    cpostal: string;
    ecole: string;
  };
  parent?: {
    prenom: string;
    nom: string;
    email: string;
    telephone: string;
    adresse: string;
    cpostal: string;
    localite: string;
  };
  session?: {
    stage: {
      title: string;
    };
    start_date: string;
    end_date: string;
    center: {
      name: string;
    };
    prix_normal: number;
    prix_reduit: number | null;
    prix_local: number | null;
    prix_local_reduit: number | null;
    tarif_condition_id: string | null;
  };
}

interface WaitingListState {
  entries: WaitingListEntry[];
  isLoading: boolean;
  error: string | null;
  fetchWaitingList: () => Promise<void>;
  addToWaitingList: (activityId: string, kidId: string) => Promise<void>;
  removeFromWaitingList: (id: string) => Promise<void>;
  offerSeat: (id: string) => Promise<void>;
  markEntryConverted: (id: string) => Promise<void>;
  cancelWaitingListEntry: (id: string) => Promise<void>;
  isOnWaitingList: (activityId: string, kidId: string) => boolean;
}

export const useWaitingListStore = create<WaitingListState>((set, get) => ({
  entries: [],
  isLoading: false,
  error: null,

  fetchWaitingList: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    set({ isLoading: true, error: null });
    try {
      // Check if user is admin
      const { data: userData, error: roleError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (roleError) {
        console.error('Error checking role:', roleError);
      }
      
      const isAdmin = userData?.role === 'admin';
      console.log('isAdmin', isAdmin, 'userData:', userData);
      
      let query = supabase
        .from('waiting_list as wl')
        .select(`
          wl.id,
          wl.activity_id,
          wl.kid_id,
          wl.user_id,
          wl.created_at,
          wl.invited_at,
          wl.expires_at,
          wl.status,
          kid:kid_id(
            prenom,
            nom,
            cpostal,
            ecole
          ),
          parent:user_id(
            email,
            prenom,
            nom,
            telephone,
            adresse,
            cpostal,
            localite
          ),
          session:activity_id(
            stage:stage_id(title),
            start_date,
            end_date,
            center:center_id(name),
            prix_normal,
            prix_reduit,
            prix_local,
            prix_local_reduit,
            tarif_condition_id
          )
        `);
      
      // If not admin, filter by user_id
      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }
      
      query = query.order('created_at', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;
      console.log('Fetched waiting list entries:', data);
      set({ entries: data || [] });
    } catch (error: any) {
      console.error('Error fetching waiting list:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  addToWaitingList: async (activityId, kidId) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    set({ isLoading: true, error: null });
    try {
      // First check if an entry already exists
      const { data: existingEntry, error: checkError } = await supabase
        .from('waiting_list')
        .select('id, status')
        .eq('activity_id', activityId)
        .eq('kid_id', kidId)
        .maybeSingle();
        
      if (checkError) throw checkError;
      
      // If entry exists but was cancelled, update it instead of creating a new one
      if (existingEntry) {
        if (existingEntry.status === 'cancelled') {
          const { error: updateError } = await supabase
            .from('waiting_list')
            .update({ status: 'waiting' })
            .eq('id', existingEntry.id);
            
          if (updateError) throw updateError;
        } else {
          throw new Error('Vous êtes déjà sur la liste d\'attente pour cette activité');
        }
      } else {
        // Create new entry
        const { error } = await supabase
          .from('waiting_list')
          .insert({
            activity_id: activityId,
            kid_id: kidId,
            user_id: user.id,
            status: 'waiting'
          });

        if (error) throw error;
      }
      
      await get().fetchWaitingList();
    } catch (error: any) {
      console.error('Error adding to waiting list:', error);
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  removeFromWaitingList: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('waiting_list')
        .delete()
        .eq('id', id);

      if (error) throw error;
      set(state => ({
        entries: state.entries.filter(entry => entry.id !== id)
      }));
    } catch (error: any) {
      console.error('Error removing from waiting list:', error);
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  offerSeat: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Calculate expiration date (48 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      // First get the waiting list entry to get the user_id
      const { data: waitingListEntry, error: getError } = await supabase
        .from('waiting_list')
        .select('user_id')
        .eq('id', id)
        .single();

      if (getError) throw getError;
      
      // Update waiting list entry status to 'invited'
      const { error } = await supabase
        .from('waiting_list')
        .update({
          status: 'invited',
          invited_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      // Call the notify-waiting-list edge function
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No active session');
        }
        
        const response = await fetch(`${supabaseUrl}/functions/v1/notify-waiting-list`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ waitingListId: id })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.warn('Warning: Email notification may not have been sent:', errorData);
          // Continue with the process even if email notification fails
        }
      } catch (notifyError) {
        console.warn('Warning: Failed to send email notification:', notifyError);
        // Continue with the process even if email notification fails
      }
      
      await get().fetchWaitingList();
    } catch (error: any) {
      console.error('Error offering seat:', error);
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  markEntryConverted: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Update waiting list entry status to 'converted'
      const { error: updateError } = await supabase
        .from('waiting_list')
        .update({ status: 'converted' })
        .eq('id', id);

      if (updateError) throw updateError;

      await get().fetchWaitingList();
    } catch (error: any) {
      console.error('Error marking waiting list entry as converted:', error);
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  cancelWaitingListEntry: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('waiting_list')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
      await get().fetchWaitingList();
    } catch (error: any) {
      console.error('Error cancelling waiting list entry:', error);
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  isOnWaitingList: (activityId, kidId) => {
    return get().entries.some(
      entry => 
        entry.activity_id === activityId && 
        entry.kid_id === kidId && 
        ['waiting', 'invited'].includes(entry.status)
    );
  }
}));