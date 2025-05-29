import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface InclusionRequest {
  id: string;
  user_id: string;
  kid_id: string;
  activity_id: string;
  request_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'converted';
  inclusion_details: any;
  admin_notes?: string;
  // Joined data
  kid?: {
    prenom: string;
    nom: string;
  };
  parent?: {
    prenom: string;
    nom: string;
    email: string;
    telephone: string;
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

interface InclusionRequestState {
  requests: InclusionRequest[];
  isLoading: boolean;
  error: string | null;
  fetchRequests: () => Promise<void>;
  createRequest: (kidId: string, activityId: string, inclusionDetails: any) => Promise<void>;
  updateRequestStatus: (id: string, status: 'approved' | 'rejected' | 'converted', adminNotes?: string) => Promise<void>;
  convertToRegistration: (id: string) => Promise<void>;
}

export const useInclusionRequestStore = create<InclusionRequestState>((set, get) => ({
  requests: [],
  isLoading: false,
  error: null,

  fetchRequests: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('inclusion_requests')
        .select(`
          *,
          kid:kid_id(
            prenom,
            nom
          ),
          parent:user_id(
            prenom,
            nom,
            email,
            telephone
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
        .order('request_date', { ascending: false });

      if (error) throw error;
      set({ requests: data || [] });
    } catch (error: any) {
      console.error('Error fetching inclusion requests:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createRequest: async (kidId, activityId, inclusionDetails) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('inclusion_requests')
        .insert({
          user_id: user.id,
          kid_id: kidId,
          activity_id: activityId,
          request_date: new Date().toISOString(),
          status: 'pending',
          inclusion_details: inclusionDetails
        });

      if (error) throw error;
      await get().fetchRequests();
    } catch (error: any) {
      console.error('Error creating inclusion request:', error);
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateRequestStatus: async (id, status, adminNotes) => {
    set({ isLoading: true, error: null });
    try {
      const updates: any = { status };
      if (adminNotes !== undefined) {
        updates.admin_notes = adminNotes;
      }

      const { error } = await supabase
        .from('inclusion_requests')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await get().fetchRequests();
    } catch (error: any) {
      console.error('Error updating inclusion request status:', error);
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  convertToRegistration: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Get the inclusion request
      const { data: request, error: requestError } = await supabase
        .from('inclusion_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (requestError) throw requestError;
      if (!request) throw new Error('Inclusion request not found');

      // Get session details for price
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', request.activity_id)
        .single();

      if (sessionError) throw sessionError;
      if (!session) throw new Error('Session not found');

      // Create registration
      const { error: registrationError } = await supabase
        .from('registrations')
        .insert({
          user_id: request.user_id,
          kid_id: request.kid_id,
          activity_id: request.activity_id,
          payment_status: 'pending',
          amount_paid: session.prix_normal,
          price_type: 'normal',
          reduced_declaration: false
        });

      if (registrationError) throw registrationError;

      // Update request status
      const { error: updateError } = await supabase
        .from('inclusion_requests')
        .update({ status: 'converted' })
        .eq('id', id);

      if (updateError) throw updateError;

      await get().fetchRequests();
    } catch (error: any) {
      console.error('Error converting inclusion request to registration:', error);
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  }
}));