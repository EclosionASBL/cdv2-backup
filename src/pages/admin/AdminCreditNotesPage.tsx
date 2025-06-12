import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Loader2, AlertCircle, Filter, Search, RefreshCw, 
  FileText, Download, Plus, CreditCard, CheckCircle, 
  X, Calendar, User, ArrowLeft, ArrowRight, ExternalLink
} from 'lucide-react';
import { Dialog } from '@headlessui/react';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  created_at: string;
  due_date: string | null;
  paid_at: string | null;
  user_id: string;
  registration_ids: string[] | null;
  user?: {
    prenom: string;
    nom: string;
    email: string;
  };
  registrations?: Registration[];
  credit_notes?: CreditNote[];
}

interface Registration {
  id: string;
  kid_id: string;
  activity_id: string;
  amount_paid: number;
  payment_status: string;
  price_type: string;
  cancellation_status: string;
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

interface CreditNote {
  id: string;
  credit_note_number: string;
  amount: number;
  created_at: string;
  pdf_url: string | null;
  invoice_id?: string;
  invoice_number?: string;
}

interface CreditNoteFormData {
  invoiceId: string;
  type: 'full' | 'partial' | 'custom';
  registrationIds: string[];
  amount: number;
  cancelRegistrations: boolean;
  adminNotes: string;
}

const AdminCreditNotesPage = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState<CreditNoteFormData>({
    invoiceId: '',
    type: 'full',
    registrationIds: [],
    amount: 0,
    cancelRegistrations: true,
    adminNotes: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchInvoices();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, filter]);

  useEffect(() => {
    fetchInvoices();
  }, [currentPage]);

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Build the base query with pagination
      let query = supabase
        .from('invoices')
        .select(`
          *,
          user:user_id(
            prenom,
            nom,
            email
          )
        `, { count: 'exact' });
      
      // Apply status filter
      if (filter === 'paid') {
        query = query.eq('status', 'paid');
      } else if (filter === 'pending') {
        query = query.eq('status', 'pending');
      }
      
      // Apply search filter - only search on invoice_number directly
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase().trim();
        query = query.ilike('invoice_number', `%${searchLower}%`);
      }
      
      // Apply pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);
      
      // Order by created_at
      query = query.order('created_at', { ascending: false });
      
      const { data: invoicesData, error: invoicesError, count } = await query;
      
      if (invoicesError) throw invoicesError;

      // Update pagination info
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));

      if (!invoicesData || invoicesData.length === 0) {
        setInvoices([]);
        return;
      }

      // If there's a search term, also filter client-side by user details
      let filteredInvoices = invoicesData;
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase().trim();
        filteredInvoices = invoicesData.filter(invoice => {
          const matchesInvoiceNumber = invoice.invoice_number.toLowerCase().includes(searchLower);
          const matchesUserEmail = invoice.user?.email?.toLowerCase().includes(searchLower);
          const matchesUserName = invoice.user?.nom?.toLowerCase().includes(searchLower) || 
                                  invoice.user?.prenom?.toLowerCase().includes(searchLower);
          
          return matchesInvoiceNumber || matchesUserEmail || matchesUserName;
        });
      }

      // Collect all registration IDs from filtered invoices
      const allRegistrationIds = filteredInvoices
        .filter(invoice => invoice.registration_ids && invoice.registration_ids.length > 0)
        .flatMap(invoice => invoice.registration_ids || []);

      // Fetch all registrations in one query if there are any
      let registrationsMap = new Map<string, Registration>();
      if (allRegistrationIds.length > 0) {
        const { data: registrationsData, error: registrationsError } = await supabase
          .from('registrations')
          .select(`
            id,
            kid_id,
            activity_id,
            amount_paid,
            payment_status,
            price_type,
            cancellation_status,
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
          .in('id', allRegistrationIds);

        if (registrationsError) {
          console.error('Error fetching registrations:', registrationsError);
        } else if (registrationsData) {
          registrationsData.forEach(reg => {
            registrationsMap.set(reg.id, reg);
          });
        }
      }

      // Fetch all credit notes in one query
      const { data: creditNotesData, error: creditNotesError } = await supabase
        .from('credit_notes')
        .select('*')
        .or(`invoice_id.in.(${filteredInvoices.map(inv => inv.id).join(',')}),invoice_number.in.(${filteredInvoices.map(inv => `"${inv.invoice_number}"`).join(',')})`);

      if (creditNotesError) {
        console.error('Error fetching credit notes:', creditNotesError);
      }

      // Create credit notes map
      const creditNotesMap = new Map<string, CreditNote[]>();
      if (creditNotesData) {
        creditNotesData.forEach(note => {
          const key = note.invoice_id || note.invoice_number;
          if (key) {
            if (!creditNotesMap.has(key)) {
              creditNotesMap.set(key, []);
            }
            creditNotesMap.get(key)!.push(note);
          }
        });
      }

      // Combine all data
      const invoicesWithDetails = filteredInvoices.map(invoice => {
        const registrations = invoice.registration_ids 
          ? invoice.registration_ids.map(id => registrationsMap.get(id)).filter(Boolean) as Registration[]
          : [];
        
        const creditNotes = creditNotesMap.get(invoice.id) || creditNotesMap.get(invoice.invoice_number) || [];

        return {
          ...invoice,
          registrations,
          credit_notes: creditNotes
        };
      });
      
      setInvoices(invoicesWithDetails);
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Une erreur est survenue lors du chargement des factures');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchInvoices();
  };

  const handleCreateCreditNote = async () => {
    if (!selectedInvoice) return;
    
    try {
      setIsProcessing(true);
      
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      
      // Call the Edge Function to create the credit note
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-credit-note`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            invoiceId: formData.invoiceId,
            type: formData.type,
            registrationIds: formData.registrationIds,
            amount: formData.amount,
            cancelRegistrations: formData.cancelRegistrations,
            adminNotes: formData.adminNotes
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création de la note de crédit');
      }
      
      const result = await response.json();
      
      toast.success('Note de crédit créée avec succès');
      setIsCreateModalOpen(false);
      fetchInvoices();
    } catch (error: any) {
      console.error('Error creating credit note:', error);
      toast.error(error.message || 'Erreur lors de la création de la note de crédit');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInvoiceSelect = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setFormData({
      invoiceId: invoice.id,
      type: 'full',
      registrationIds: invoice.registrations?.map(reg => reg.id) || [],
      amount: invoice.amount,
      cancelRegistrations: true,
      adminNotes: ''
    });
    setIsCreateModalOpen(true);
  };

  const handleTypeChange = (type: 'full' | 'partial' | 'custom') => {
    if (!selectedInvoice) return;
    
    let amount = 0;
    let registrationIds: string[] = [];
    
    if (type === 'full') {
      // Full refund - all registrations, full amount
      amount = selectedInvoice.amount;
      registrationIds = selectedInvoice.registrations?.map(reg => reg.id) || [];
    } else if (type === 'partial') {
      // Partial refund - no registrations selected by default
      amount = 0;
      registrationIds = [];
    } else if (type === 'custom') {
      // Custom amount - no registrations selected by default
      amount = 0;
      registrationIds = [];
    }
    
    setFormData({
      ...formData,
      type,
      amount,
      registrationIds
    });
  };

  const handleRegistrationToggle = (registrationId: string, amount: number) => {
    const newRegistrationIds = [...formData.registrationIds];
    let newAmount = formData.amount;
    
    if (newRegistrationIds.includes(registrationId)) {
      // Remove registration
      newRegistrationIds.splice(newRegistrationIds.indexOf(registrationId), 1);
      newAmount -= amount;
    } else {
      // Add registration
      newRegistrationIds.push(registrationId);
      newAmount += amount;
    }
    
    setFormData({
      ...formData,
      registrationIds: newRegistrationIds,
      amount: formData.type === 'custom' ? formData.amount : newAmount
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notes de crédit</h1>
          <p className="text-gray-600">Gérez les remboursements et les notes de crédit</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={fetchInvoices}
            disabled={isLoading}
            className="btn-primary flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
        <div className="relative flex-grow">
          <input
            type="text"
            placeholder="Rechercher une facture (numéro, nom, email)..."
            className="form-input pl-10 pr-4 py-2 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
        </div>
        
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-gray-500" />
          <select
            className="form-input py-2"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="all">Toutes les factures</option>
            <option value="paid">Payées</option>
            <option value="pending">En attente</option>
          </select>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <p className="text-gray-600 mb-4">
            {searchTerm || filter !== 'all'
              ? 'Aucune facture ne correspond à vos critères.'
              : 'Aucune facture trouvée. Utilisez la recherche pour trouver des factures.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Numéro
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes de crédit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {invoice.invoice_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {invoice.user?.prenom} {invoice.user?.nom}
                      </div>
                      <div className="text-sm text-gray-500">
                        {invoice.user?.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(invoice.created_at)}
                      </div>
                      {invoice.due_date && (
                        <div className="text-xs text-gray-500">
                          Échéance: {formatDate(invoice.due_date)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(invoice.amount)}
                      </div>
                      {invoice.credit_notes && invoice.credit_notes.length > 0 && (
                        <div className="text-xs text-blue-600">
                          {formatCurrency(invoice.credit_notes.reduce((sum, note) => sum + note.amount, 0))} en notes de crédit
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx(
                        "px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full",
                        invoice.status === 'paid' ? "bg-green-100 text-green-800" : 
                        invoice.status === 'cancelled' ? "bg-red-100 text-red-800" : 
                        "bg-yellow-100 text-yellow-800"
                      )}>
                        {invoice.status === 'paid' ? 'Payée' : 
                         invoice.status === 'cancelled' ? 'Annulée' : 
                         'En attente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {invoice.credit_notes && invoice.credit_notes.length > 0 ? (
                          <div className="space-y-1">
                            {invoice.credit_notes.map(note => (
                              <div key={note.id} className="flex items-center">
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                  {note.credit_note_number}
                                </span>
                                {note.pdf_url && (
                                  <a 
                                    href={note.pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-2 text-primary-600 hover:text-primary-800"
                                  >
                                    <Download className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">Aucune</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleInvoiceSelect(invoice)}
                        className="text-primary-600 hover:text-primary-900"
                        disabled={invoice.status === 'cancelled'}
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                    currentPage === 1 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Précédent
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                    currentPage === totalPages 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Suivant
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Affichage de <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> à{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * itemsPerPage, totalCount)}
                    </span>{' '}
                    sur <span className="font-medium">{totalCount}</span> résultats
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                        currentPage === 1 
                          ? 'text-gray-300 cursor-not-allowed' 
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">Précédent</span>
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    
                    {/* Page numbers */}
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let page;
                      if (totalPages <= 5) {
                        page = i + 1;
                      } else if (currentPage <= 3) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i;
                      } else {
                        page = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === page
                              ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                        currentPage === totalPages 
                          ? 'text-gray-300 cursor-not-allowed' 
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">Suivant</span>
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Credit Note Modal */}
      <Dialog
        open={isCreateModalOpen}
        onClose={() => !isProcessing && setIsCreateModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

          <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-auto p-6 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-semibold mb-4 flex items-center">
              <FileText className="h-5 w-5 text-primary-600 mr-2" />
              Créer une note de crédit
            </Dialog.Title>

            {selectedInvoice && (
              <div className="space-y-6">
                {/* Invoice Details */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-700 mb-2">Détails de la facture</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Numéro de facture</p>
                      <p className="font-medium">{selectedInvoice.invoice_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Client</p>
                      <p className="font-medium">{selectedInvoice.user?.prenom} {selectedInvoice.user?.nom}</p>
                      <p className="text-sm text-gray-500">{selectedInvoice.user?.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Montant</p>
                      <p className="font-medium">{formatCurrency(selectedInvoice.amount)}</p>
                    </div>
                  </div>
                </div>

                {/* Credit Note Type */}
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Type de note de crédit</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div 
                      className={clsx(
                        "border rounded-lg p-4 cursor-pointer",
                        formData.type === 'full' 
                          ? "border-primary-500 bg-primary-50" 
                          : "border-gray-200 hover:border-gray-300"
                      )}
                      onClick={() => handleTypeChange('full')}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">Remboursement total</h4>
                        {formData.type === 'full' && (
                          <CheckCircle className="h-5 w-5 text-primary-600" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Annule la totalité de la facture et crée une note de crédit pour le montant total.
                      </p>
                    </div>
                    
                    <div 
                      className={clsx(
                        "border rounded-lg p-4 cursor-pointer",
                        formData.type === 'partial' 
                          ? "border-primary-500 bg-primary-50" 
                          : "border-gray-200 hover:border-gray-300"
                      )}
                      onClick={() => handleTypeChange('partial')}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">Remboursement partiel</h4>
                        {formData.type === 'partial' && (
                          <CheckCircle className="h-5 w-5 text-primary-600" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Annule certaines inscriptions spécifiques et crée une note de crédit pour le montant correspondant.
                      </p>
                    </div>
                    
                    <div 
                      className={clsx(
                        "border rounded-lg p-4 cursor-pointer",
                        formData.type === 'custom' 
                          ? "border-primary-500 bg-primary-50" 
                          : "border-gray-200 hover:border-gray-300"
                      )}
                      onClick={() => handleTypeChange('custom')}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">Montant personnalisé</h4>
                        {formData.type === 'custom' && (
                          <CheckCircle className="h-5 w-5 text-primary-600" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Spécifiez un montant libre pour la note de crédit (ex: remboursement partiel pour jours d'absence).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Registrations Selection */}
                {(formData.type === 'partial' || formData.type === 'custom') && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">
                      {formData.type === 'partial' 
                        ? 'Sélectionnez les inscriptions à rembourser' 
                        : 'Sélectionnez une inscription pour le remboursement personnalisé'}
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedInvoice.registrations?.map((registration) => {
                        const isSelected = formData.registrationIds.includes(registration.id);
                        const isDisabled = formData.type === 'custom' && formData.registrationIds.length > 0 && !isSelected;
                        const isCancelled = registration.cancellation_status !== 'none';
                        
                        return (
                          <div 
                            key={registration.id}
                            className={clsx(
                              "border rounded-lg p-3",
                              isSelected ? "border-primary-500 bg-primary-50" : "border-gray-200",
                              (isDisabled || isCancelled) ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-gray-300"
                            )}
                            onClick={() => {
                              if (!isDisabled && !isCancelled) {
                                handleRegistrationToggle(registration.id, registration.amount_paid);
                              }
                            }}
                          >
                            <div className="flex justify-between">
                              <div>
                                <p className="font-medium">{registration.session.stage.title}</p>
                                <p className="text-sm text-gray-600">
                                  Pour: {registration.kid.prenom} {registration.kid.nom}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {formatDate(registration.session.start_date)} - {formatDate(registration.session.end_date)}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Centre: {registration.session.center.name}
                                </p>
                                {isCancelled && (
                                  <span className="inline-block mt-1 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                                    Déjà annulée
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{formatCurrency(registration.amount_paid)}</p>
                                {isSelected && (
                                  <CheckCircle className="h-5 w-5 text-primary-600 ml-auto mt-2" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Custom Amount */}
                {formData.type === 'custom' && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Montant personnalisé</h3>
                    <div className="flex items-center">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({
                          ...formData,
                          amount: parseFloat(e.target.value) || 0
                        })}
                        className="form-input w-40"
                      />
                      <span className="ml-2">€</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Entrez le montant exact à rembourser.
                    </p>
                  </div>
                )}

                {/* Cancel Registrations Option */}
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.cancelRegistrations}
                      onChange={(e) => setFormData({
                        ...formData,
                        cancelRegistrations: e.target.checked
                      })}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Annuler les inscriptions associées
                    </span>
                  </label>
                  <p className="text-sm text-gray-500 mt-1 ml-6">
                    Si cette option est cochée, les inscriptions sélectionnées seront marquées comme annulées.
                  </p>
                </div>

                {/* Admin Notes */}
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Notes administratives</h3>
                  <textarea
                    value={formData.adminNotes}
                    onChange={(e) => setFormData({
                      ...formData,
                      adminNotes: e.target.value
                    })}
                    className="form-input w-full"
                    rows={3}
                    placeholder="Ajoutez des notes ou commentaires (optionnel)"
                  />
                </div>

                {/* Summary */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-700 mb-2">Récapitulatif</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Type de remboursement</p>
                      <p className="font-medium">
                        {formData.type === 'full' ? 'Remboursement total' : 
                         formData.type === 'partial' ? 'Remboursement partiel' : 
                         'Montant personnalisé'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Montant à rembourser</p>
                      <p className="font-medium">{formatCurrency(formData.amount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Inscriptions sélectionnées</p>
                      <p className="font-medium">{formData.registrationIds.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Annulation des inscriptions</p>
                      <p className="font-medium">{formData.cancelRegistrations ? 'Oui' : 'Non'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="btn-outline"
                    disabled={isProcessing}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateCreditNote}
                    disabled={isProcessing || formData.amount <= 0 || (formData.type !== 'full' && formData.registrationIds.length === 0)}
                    className={clsx(
                      "btn-primary",
                      (isProcessing || formData.amount <= 0 || (formData.type !== 'full' && formData.registrationIds.length === 0)) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isProcessing ? (
                      <span className="flex items-center">
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        Traitement en cours...
                      </span>
                    ) : (
                      'Créer la note de crédit'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default AdminCreditNotesPage;