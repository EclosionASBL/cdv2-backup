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
  registrations?: Registration[];
}

interface Registration {
  id: string;
  kid_id: string;
  activity_id: string;
  amount_paid: number;
  price_type: string;
  kid: {
    prenom: string;
    nom: string;
  };
  session: {
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
      // First, fetch all invoices
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;
      if (!invoices) {
        set({ invoices: [] });
        return;
      }

      // For each invoice, fetch its registrations if it has any
      const invoicesWithRegistrations = await Promise.all(
        invoices.map(async (invoice) => {
          if (!invoice.registration_ids?.length) {
            return { ...invoice, registrations: [] };
          }

          const { data: registrations, error: registrationsError } = await supabase
            .from('registrations')
            .select(`
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
            `)
            .in('id', invoice.registration_ids);

          if (registrationsError) {
            console.error('Error fetching registrations:', registrationsError);
            return { ...invoice, registrations: [] };
          }

          return {
            ...invoice,
            registrations: registrations || []
          };
        })
      );

      set({ invoices: invoicesWithRegistrations });
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