import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Invoice {
  id: string;
  created_at: string;
  user_id: string;
  invoice_number: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  due_date: string | null;
  paid_at: string | null;
  pdf_url: string | null;
  communication: string;
  registration_ids: string[];
}

interface InvoiceState {
  invoices: Invoice[];
  isLoading: boolean;
  error: string | null;
  fetchInvoices: () => Promise<void>;
  downloadInvoice: (pdfUrl: string, invoiceNumber: string) => void;
}

export const useInvoiceStore = create<InvoiceState>((set) => ({
  invoices: [],
  isLoading: false,
  error: null,

  fetchInvoices: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          registrations:registration_ids(
            id,
            kid_id,
            activity_id,
            amount_paid,
            price_type,
            kid:kids(
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
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ invoices: data || [] });
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  downloadInvoice: (pdfUrl: string, invoiceNumber: string) => {
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.target = '_blank';
    link.download = `facture_${invoiceNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}));