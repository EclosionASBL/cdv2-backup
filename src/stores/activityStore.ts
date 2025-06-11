import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Activity {
  id: string;
  stage: {
    id: string;
    title: string;
    description: string;
    age_min: number;
    age_max: number;
    base_price: number;
    image_url: string | null;
  };
  center: {
    id: string;
    name: string;
    address: string;
    postal_code: string;
    city: string;
  };
  start_date: string;
  end_date: string;
  capacity: number;
  prix_normal: number;
  prix_reduit: number | null;
  prix_local: number | null;
  prix_local_reduit: number | null;
  periode: string;
  semaine: string | null;
  remarques: string | null;
  visible_from: string | null;
  tarif_condition_id: string | null;
  calculated_main_price?: number;
  calculated_reduced_price?: number | null;
  current_registrations: number;
}

interface ActivityFilters {
  kid_id?: string;
  center_id?: string;
  periode?: string;
  minAge?: number;
  maxAge?: number;
  dateStart?: string;
  dateEnd?: string;
  semaine?: string;
}

interface ActivityState {
  activities: Activity[];
  currentActivity: Activity | null;
  filters: ActivityFilters;
  centers: { id: string; name: string }[];
  periodes: string[];
  semaines: string[];
  isLoading: boolean;
  error: string | null;
  fetchActivities: (filters?: ActivityFilters) => Promise<void>;
  fetchActivity: (id: string) => Promise<void>;
  setFilters: (filters: ActivityFilters) => void;
  clearFilters: () => void;
  clearKidFilter: () => void;
  fetchCenters: () => Promise<void>;
  fetchPeriodes: () => Promise<void>;
  fetchSemaines: () => Promise<void>;
  getPrice: (activity: Activity, kid_postal: string | null, kid_school: string | null) => Promise<{
    mainPrice: number;
    reducedPrice: number | null;
  }>;
}

function calculateAgeAtDate(birthDate: string, referenceDate: string): number {
  const birth = new Date(birthDate);
  const ref = new Date(referenceDate);
  
  let years = ref.getFullYear() - birth.getFullYear();
  let months = ref.getMonth() - birth.getMonth();
  
  // Adjust years based on months
  if (months < 0 || (months === 0 && ref.getDate() < birth.getDate())) {
    years--;
    months += 12;
  }
  
  // Return age with decimal for months (1 month = 0.0833 years)
  return parseFloat((years + (months / 12)).toFixed(1));
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: [],
  currentActivity: null,
  filters: {},
  centers: [],
  periodes: [],
  semaines: [],
  isLoading: false,
  error: null,
  
  fetchActivities: async (filters = {}) => {
    set({ isLoading: true, error: null });
    try {
      let query = supabase
        .from('sessions')
        .select(`
          *,
          stage:stages(*),
          center:centers(*)
        `)
        .eq('active', true)
        .order('start_date');
      
      const activeFilters = { ...get().filters, ...filters };
      
      // Apply filters if provided
      if (activeFilters.center_id) {
        query = query.eq('center_id', activeFilters.center_id);
      }
      
      if (activeFilters.periode) {
        query = query.eq('periode', activeFilters.periode);
      }
      
      if (activeFilters.semaine) {
        query = query.eq('semaine', activeFilters.semaine);
      }

      // Only show sessions that are either visible now or have no visibility date set
      const now = new Date().toISOString();
      query = query.or(`visible_from.is.null,visible_from.lte.${now}`);
      
      // Only show future sessions
      query = query.gte('start_date', new Date().toISOString().split('T')[0]);
      
      const { data, error } = await query;
      
      if (error) throw error;

      // If kid_id is provided, get kid's data for age filtering
      let kidData = null;
      if (activeFilters.kid_id) {
        const { data: kidResult } = await supabase
          .from('kids')
          .select('date_naissance, cpostal, ecole')
          .eq('id', activeFilters.kid_id)
          .single();

        if (kidResult) {
          kidData = kidResult;
        }
      }

      // Filter and process activities
      let filteredData = data || [];
      
      // Apply age filter if provided
      if (activeFilters.minAge !== undefined || activeFilters.maxAge !== undefined) {
        filteredData = filteredData.filter(session => {
          const stageMinAge = session.stage.age_min;
          const stageMaxAge = session.stage.age_max;
          
          if (activeFilters.minAge !== undefined && stageMaxAge < activeFilters.minAge) {
            return false;
          }
          
          if (activeFilters.maxAge !== undefined && stageMinAge > activeFilters.maxAge) {
            return false;
          }
          
          return true;
        });
      }
      
      // If kid data is available, filter by age
      if (kidData) {
        filteredData = filteredData.filter(session => {
          const ageAtStart = calculateAgeAtDate(kidData.date_naissance, session.start_date);
          return ageAtStart >= session.stage.age_min && ageAtStart < session.stage.age_max + 1;
        });
      }

      // Calculate prices for each activity
      const activitiesWithPrices = await Promise.all(filteredData.map(async (session) => {
        let mainPrice = session.prix_normal;
        let reducedPrice = session.prix_reduit;
        
        if (kidData && session.tarif_condition_id) {
          const { mainPrice: calculatedMainPrice, reducedPrice: calculatedReducedPrice } = 
            await get().getPrice(session, kidData.cpostal, kidData.ecole);
          
          return {
            ...session,
            calculated_main_price: calculatedMainPrice,
            calculated_reduced_price: calculatedReducedPrice,
            current_registrations: session.current_registrations || 0
          };
        }
        
        return {
          ...session,
          calculated_main_price: mainPrice,
          calculated_reduced_price: reducedPrice,
          current_registrations: session.current_registrations || 0
        };
      }));

      set({ activities: activitiesWithPrices });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchActivity: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          stage:stages(*),
          center:centers(*)
        `)
        .eq('id', id)
        .single();
        
      if (error) throw error;

      const activityWithCount = {
        ...data,
        current_registrations: data.current_registrations || 0
      };

      set({ currentActivity: activityWithCount });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },
  
  setFilters: (filters) => {
    set({ filters: { ...get().filters, ...filters } });
    get().fetchActivities(filters);
  },
  
  clearFilters: () => {
    set({ filters: {} });
    get().fetchActivities({});
  },
  
  clearKidFilter: () => {
    set(state => ({ 
      filters: { 
        ...state.filters, 
        kid_id: undefined 
      } 
    }));
  },
  
  fetchCenters: async () => {
    try {
      const { data, error } = await supabase
        .from('centers')
        .select('id, name')
        .eq('active', true)
        .order('name');
        
      if (error) throw error;
      set({ centers: data || [] });
    } catch (error: any) {
      set({ error: error.message });
    }
  },
  
  fetchPeriodes: async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('periode')
        .eq('active', true)
        .order('periode');
        
      if (error) throw error;
      
      // Get unique periods
      const uniquePeriodes = [...new Set(data?.map(item => item.periode))];
      set({ periodes: uniquePeriodes });
    } catch (error: any) {
      set({ error: error.message });
    }
  },
  
  fetchSemaines: async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('semaine')
        .eq('active', true)
        .is('semaine', 'not.null')
        .order('semaine');
        
      if (error) throw error;
      
      // Get unique semaines and filter out null values
      const uniqueSemaines = [...new Set(data?.map(item => item.semaine).filter(Boolean))];
      set({ semaines: uniqueSemaines });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  getPrice: async (activity, kid_postal, kid_school) => {
    let mainPrice = activity.prix_normal;
    let reducedPrice = activity.prix_reduit;

    if (activity.tarif_condition_id) {
      try {
        const { data: condition, error } = await supabase
          .from('tarif_conditions')
          .select('*')
          .eq('id', activity.tarif_condition_id)
          .single();

        if (error) throw error;

        if (condition) {
          // Use arrays directly from condition
          const postalMatch = kid_postal && condition.code_postaux_autorises?.includes(kid_postal);
          const schoolMatch = kid_school && condition.school_ids?.includes(kid_school);

          if (postalMatch || schoolMatch) {
            mainPrice = activity.prix_local || activity.prix_normal;
            reducedPrice = activity.prix_local_reduit || activity.prix_reduit;
          }
        }
      } catch (error) {
        console.error('Error checking tarif conditions:', error);
      }
    }

    return {
      mainPrice,
      reducedPrice
    };
  }
}));