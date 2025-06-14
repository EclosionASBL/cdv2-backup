import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  Loader2, 
  AlertCircle, 
  Filter, 
  Search, 
  RefreshCw, 
  Download, 
  FileText, 
  CheckCircle, 
  Clock, 
  ArrowLeft, 
  ArrowRight,
  CreditCard,
  Receipt
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

interface Invoice {
  id: string;
  created_at: string;
  user_id: string;
  invoice_number: string;
  amount: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  pdf_url: string | null;
  communication: string;
  registration_ids: string[];
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
}

const AdminPaymentsPage = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
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
      
      // Apply search filter if provided
      if (searchTerm.trim()) {
        // First, try to find users matching the search term
        const { data: matchingUsers, error: userError } = await supabase
          .from('users')
          .select('id')
          .or(`email.ilike.%${searchTerm.trim()}%,nom.ilike.%${searchTerm.trim()}%,prenom.ilike.%${searchTerm.trim()}%`);
        
        if (userError) {
          console.error('Error searching users:', userError);
        }
        
        // If we found matching users, filter invoices by those user IDs or invoice number
        if (matchingUsers && matchingUsers.length > 0) {
          const userIds = matchingUsers.map(u => u.id);
          query = query.or(`user_id.in.(${userIds.join(',')}),invoice_number.ilike.%${searchTerm.trim()}%`);
        } else {
          // If no matching users, just search by invoice number
          query = query.ilike('invoice_number', `%${searchTerm.trim()}%`);
        }
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

      // Collect all registration IDs from filtered invoices
      const allRegistrationIds = invoicesData
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
        .or(`invoice_id.in.(${invoicesData.map(inv => inv.id).join(',')}),invoice_number.in.(${invoicesData.map(inv => `"${inv.invoice_number}"`).join(',')})`);

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
      const invoicesWithDetails = invoicesData.map(invoice => {
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

  const handleExportCSV = () => {
    try {
      // Filter invoices based on current filter
      const filteredData = invoices.filter(inv => {
        if (filter === 'all') return true;
        return inv.status === filter;
      });
      
      // Create CSV content
      const headers = [
        'Numéro de facture',
        'Date',
        'Client',
        'Email',
        'Montant',
        'Statut',
        'Date d\'échéance',
        'Date de paiement'
      ];
      
      const rows = filteredData.map(inv => [
        inv.invoice_number,
        new Date(inv.created_at).toLocaleDateString('fr-FR'),
        `${inv.user?.prenom || ''} ${inv.user?.nom || ''}`,
        inv.user?.email || '',
        inv.amount.toString(),
        inv.status === 'paid' ? 'Payé' : inv.status === 'pending' ? 'En attente' : 'Annulé',
        inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '',
        inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('fr-FR') : ''
      ]);
      
      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `factures_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Export CSV réussi');
    } catch (err: any) {
      console.error('Error exporting CSV:', err);
      toast.error('Erreur lors de l\'export CSV');
    }
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
          <h1 className="text-2xl font-bold">Gestion des paiements</h1>
          <p className="text-gray-600">Suivez et gérez les paiements des inscriptions</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={handleExportCSV}
            className="btn-outline flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </button>
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
                {invoices.map((invoice) => {
                  // Check if there are any credit notes for this invoice
                  const hasCreditNotes = invoice.credit_notes && invoice.credit_notes.length > 0;
                  const totalCreditAmount = hasCreditNotes 
                    ? invoice.credit_notes.reduce((sum, note) => sum + note.amount, 0) 
                    : 0;
                  const adjustedAmount = invoice.amount - totalCreditAmount;
                  
                  return (
                    <tr key={invoice.id} className={clsx(
                      "hover:bg-gray-50",
                      invoice.status === 'paid' && "border-l-4 border-green-500"
                    )}>
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
                          {formatCurrency(adjustedAmount)}
                        </div>
                        {hasCreditNotes && (
                          <div className="text-xs text-blue-600">
                            {formatCurrency(totalCreditAmount)} en notes de crédit
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
                          {invoice.status === 'paid' ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Payée</>
                          ) : invoice.status === 'cancelled' ? (
                            'Annulée'
                          ) : (
                            <><Clock className="h-3 w-3 mr-1" /> En attente</>
                          )}
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
                        <div className="flex justify-end space-x-2">
                          {invoice.pdf_url && (
                            <a 
                              href={invoice.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-900"
                              title="Voir la facture"
                            >
                              <FileText className="h-5 w-5" />
                            </a>
                          )}
                          <Link
                            to={`/admin/credit-notes?invoice=${invoice.id}`}
                            className="text-blue-600 hover:text-blue-900"
                            title="Créer une note de crédit"
                          >
                            <Receipt className="h-5 w-5" />
                          </Link>
                          {invoice.status === 'pending' && (
                            <button
                              onClick={() => {
                                // Implement mark as paid functionality
                                toast.success('Fonctionnalité à implémenter');
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="Marquer comme payée"
                            >
                              <CreditCard className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
    </div>
  );
};

export default AdminPaymentsPage;