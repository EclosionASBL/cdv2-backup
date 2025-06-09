import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface CancellationRequest {
  id: string;
  created_at: string;
  user_id: string;
  registration_id: string;
  kid_id: string;
  activity_id: string;
  request_date: string;
  status: 'pending' | 'approved' | 'rejected';
  parent_notes: string | null;
  admin_notes: string | null;
  refund_type: 'full' | 'partial' | 'none' | null;
  credit_note_id: string | null;
  credit_note_url: string | null;
  // Joined data
  registration?: {
    amount_paid: number;
    payment_status: string;
    invoice_id: string | null;
  };
  kid?: {
    prenom: string;
    nom: string;
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
  };
}

interface CancellationRequestState {
  requests: CancellationRequest[];
  isLoading: boolean;
  error: string | null;
  fetchRequests: () => Promise<void>;
  createRequest: (registrationId: string, kidId: string, activityId: string, parentNotes: string) => Promise<void>;
  checkExistingRequest: (registrationId: string) => Promise<boolean>;
}

export const useCancellationRequestStore = create<CancellationRequestState>((set, get) => ({
  requests: [],
  isLoading: false,
  error: null,

  fetchRequests: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('cancellation_requests')
        .select(`
          *,
          registration:registration_id(
            amount_paid,
            payment_status,
            invoice_id
          ),
          kid:kid_id(
            prenom,
            nom
          ),
          session:activity_id(
            stage:stage_id(
              title
            ),
            start_date,
            end_date,
            center:center_id(
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ requests: data || [] });
    } catch (error: any) {
      console.error('Error fetching cancellation requests:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createRequest: async (registrationId, kidId, activityId, parentNotes) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check if a request already exists for this registration
      const existingRequest = await get().checkExistingRequest(registrationId);
      if (existingRequest) {
        throw new Error('Une demande d\'annulation existe déjà pour cette inscription');
      }

      const { error } = await supabase
        .from('cancellation_requests')
        .insert({
          user_id: user.id,
          registration_id: registrationId,
          kid_id: kidId,
          activity_id: activityId,
          parent_notes: parentNotes || null
        });

      if (error) throw error;
      await get().fetchRequests();
    } catch (error: any) {
      console.error('Error creating cancellation request:', error);
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  checkExistingRequest: async (registrationId) => {
    try {
      const { data, error } = await supabase
        .from('cancellation_requests')
        .select('id')
        .eq('registration_id', registrationId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Error checking existing cancellation request:', error);
      return false;
    }
  }
}));