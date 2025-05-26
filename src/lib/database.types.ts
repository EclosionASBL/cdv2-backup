export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          created_at: string
          email: string
          nom: string | null
          prenom: string | null
          adresse: string | null
          cpostal: string | null
          localite: string | null
          telephone: string | null
          nnational: string | null
          photo_url: string | null
          newsletter: boolean
          telephone2: string | null
          avatar_url: string | null
          role: string
          account_type: 'parent' | 'organisation' | 'other'
          organisation_name: string | null
          company_number: string | null
          is_legal_guardian: boolean
        }
        Insert: {
          id: string
          created_at?: string
          email: string
          nom?: string | null
          prenom?: string | null
          adresse?: string | null
          cpostal?: string | null
          localite?: string | null
          telephone?: string | null
          nnational?: string | null
          photo_url?: string | null
          newsletter?: boolean
          telephone2?: string | null
          avatar_url?: string | null
          role?: string
          account_type?: 'parent' | 'organisation' | 'other'
          organisation_name?: string | null
          company_number?: string | null
          is_legal_guardian?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          email?: string
          nom?: string | null
          prenom?: string | null
          adresse?: string | null
          cpostal?: string | null
          localite?: string | null
          telephone?: string | null
          nnational?: string | null
          photo_url?: string | null
          newsletter?: boolean
          telephone2?: string | null
          avatar_url?: string | null
          role?: string
          account_type?: 'parent' | 'organisation' | 'other'
          organisation_name?: string | null
          company_number?: string | null
          is_legal_guardian?: boolean
        }
      }
      kids: {
        Row: {
          id: string
          created_at: string
          user_id: string
          nom: string
          prenom: string
          date_naissance: string
          n_national: string | null
          photo_url: string | null
          adresse: string | null
          cpostal: string | null
          localite: string | null
          ecole: string | null
          is_national_number_valid: boolean
          photo_consent: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          nom: string
          prenom: string
          date_naissance: string
          n_national?: string | null
          photo_url?: string | null
          adresse?: string | null
          cpostal?: string | null
          localite?: string | null
          ecole?: string | null
          is_national_number_valid?: boolean
          photo_consent?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          nom?: string
          prenom?: string
          date_naissance?: string
          n_national?: string | null
          photo_url?: string | null
          adresse?: string | null
          cpostal?: string | null
          localite?: string | null
          ecole?: string | null
          is_national_number_valid?: boolean
          photo_consent?: boolean
        }
      }
      kid_health: {
        Row: {
          id: string
          kid_id: string
          specific_medical: string | null
          medication_details: string | null
          medication_autonomy: boolean
          tetanus: boolean
          doctor_name: string | null
          doctor_phone: string | null
          created_at: string
          updated_at: string
          past_medical: string | null
          medication_form_sent: boolean
          parental_consent: boolean
          medication: boolean
        }
        Insert: {
          id?: string
          kid_id: string
          specific_medical?: string | null
          medication_details?: string | null
          medication_autonomy?: boolean
          tetanus?: boolean
          doctor_name?: string | null
          doctor_phone?: string | null
          created_at?: string
          updated_at?: string
          past_medical?: string | null
          medication_form_sent?: boolean
          parental_consent?: boolean
          medication?: boolean
        }
        Update: {
          id?: string
          kid_id?: string
          specific_medical?: string | null
          medication_details?: string | null
          medication_autonomy?: boolean
          tetanus?: boolean
          doctor_name?: string | null
          doctor_phone?: string | null
          created_at?: string
          updated_at?: string
          past_medical?: string | null
          medication_form_sent?: boolean
          parental_consent?: boolean
          medication?: boolean
        }
      }
      kid_allergies: {
        Row: {
          id: string
          kid_id: string
          has_allergies: boolean
          allergies_details: string | null
          allergies_consequences: string | null
          special_diet: boolean
          diet_details: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          kid_id: string
          has_allergies?: boolean
          allergies_details?: string | null
          allergies_consequences?: string | null
          special_diet?: boolean
          diet_details?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          kid_id?: string
          has_allergies?: boolean
          allergies_details?: string | null
          allergies_consequences?: string | null
          special_diet?: boolean
          diet_details?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      kid_activities: {
        Row: {
          id: string
          kid_id: string
          can_participate: boolean
          restriction_details: string | null
          can_swim: boolean
          water_fear: boolean
          other_info: string | null
          created_at: string
          updated_at: string
          swim_level: string | null
        }
        Insert: {
          id?: string
          kid_id: string
          can_participate?: boolean
          restriction_details?: string | null
          can_swim?: boolean
          water_fear?: boolean
          other_info?: string | null
          created_at?: string
          updated_at?: string
          swim_level?: string | null
        }
        Update: {
          id?: string
          kid_id?: string
          can_participate?: boolean
          restriction_details?: string | null
          can_swim?: boolean
          water_fear?: boolean
          other_info?: string | null
          created_at?: string
          updated_at?: string
          swim_level?: string | null
        }
      }
      kid_departure: {
        Row: {
          id: string
          kid_id: string
          leaves_alone: boolean
          departure_time: string | null
          pickup_people: Json | null
          created_at: string
          updated_at: string
          pickup_people_ids: string[]
        }
        Insert: {
          id?: string
          kid_id: string
          leaves_alone?: boolean
          departure_time?: string | null
          pickup_people?: Json | null
          created_at?: string
          updated_at?: string
          pickup_people_ids?: string[]
        }
        Update: {
          id?: string
          kid_id?: string
          leaves_alone?: boolean
          departure_time?: string | null
          pickup_people?: Json | null
          created_at?: string
          updated_at?: string
          pickup_people_ids?: string[]
        }
      }
      kid_inclusion: {
        Row: {
          id: string
          kid_id: string
          has_needs: boolean
          created_at: string
          updated_at: string
          situation_details: string | null
          impact_details: string | null
          needs_dedicated_staff: string | null
          staff_details: string | null
          strategies: string | null
          assistive_devices: string | null
          stress_signals: string | null
          strengths: string | null
          previous_experience: string | null
        }
        Insert: {
          id?: string
          kid_id: string
          has_needs?: boolean
          created_at?: string
          updated_at?: string
          situation_details?: string | null
          impact_details?: string | null
          needs_dedicated_staff?: string | null
          staff_details?: string | null
          strategies?: string | null
          assistive_devices?: string | null
          stress_signals?: string | null
          strengths?: string | null
          previous_experience?: string | null
        }
        Update: {
          id?: string
          kid_id?: string
          has_needs?: boolean
          created_at?: string
          updated_at?: string
          situation_details?: string | null
          impact_details?: string | null
          needs_dedicated_staff?: string | null
          staff_details?: string | null
          strategies?: string | null
          assistive_devices?: string | null
          stress_signals?: string | null
          strengths?: string | null
          previous_experience?: string | null
        }
      }
      waiting_list: {
        Row: {
          id: string
          activity_id: string
          kid_id: string
          user_id: string
          created_at: string
          invited_at: string | null
          expires_at: string | null
          status: string
        }
        Insert: {
          id?: string
          activity_id: string
          kid_id: string
          user_id: string
          created_at?: string
          invited_at?: string | null
          expires_at?: string | null
          status?: string
        }
        Update: {
          id?: string
          activity_id?: string
          kid_id?: string
          user_id?: string
          created_at?: string
          invited_at?: string | null
          expires_at?: string | null
          status?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}