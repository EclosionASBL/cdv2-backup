import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  Loader2, Search, Filter, CheckCircle, Clock, FileText, Download, 
  AlertTriangle, ExternalLink, RefreshCw, Upload, Database, 
  DollarSign, FileUp, ArrowUpDown, Eye, Link2
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';
import { Dialog } from '@headlessui/react';

interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  amount: number;
  status: string;
  due_date: string | null;
  created_at: string;
  paid_at: string | null;
  pdf_url: string | null;
  communication: string;
  registration_ids: string[];
  user: {
    email: string;
    prenom: string;
    nom: string;
  };
  registrations?: Registration[];
  credit_notes?: CreditNote[];
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

interface CreditNote {
  id: string;
  created_at: string;
  credit_note_number: string;
  amount: number;
  pdf_url: string | null;
  status: 'issued' | 'sent';
}

interface BankTransaction {
  id: string;
  transaction_date: string;
  amount: number;
  currency: string;
  communication: string;
  account_number: string;
  account_name: string;
  bank_reference: string;
  status: 'unmatched' | 'matched' | 'partially_matched' | 'overpaid' | 'ignored';
  invoice_id: string | null;
  raw_coda_file_path: string | null;
  import_batch_id: string | null;
  notes: string | null;
  created_at: string;
  invoice?: Invoice;
}

interface ImportResult {
  success: boolean;
  message: string;
  batch_id: string;
  transactions: number;
}

const AdminPaymentsPage = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  
  // Bank transactions state
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'unmatched' | 'matched' | 'partially_matched'>('all');
  const [transactionSearchTerm, setTransactionSearchTerm] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'invoices' | 'transactions'>('invoices');
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [isTransactionDetailModalOpen, setIsTransactionDetailModalOpen] = useState(false);
  const [suggestedInvoices, setSuggestedInvoices] = useState<Invoice[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [transactionNotes, setTransactionNotes] = useState('');

  useEffect(() => {
    if (activeTab === 'invoices') {
      fetchInvoices();
    } else {
      fetchTransactions();
    }
  }, [activeTab]);

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First get all invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;

      // Then get user details for each invoice
      const invoicesWithUserDetails = await Promise.all(
        (invoicesData || []).map(async (invoice) => {
          try {
            // Get user details from users table using maybeSingle() instead of single()
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('email, prenom, nom')
              .eq('id', invoice.user_id)
              .maybeSingle();

            // If there's an error or no user found, return a default user object
            if (userError || !userData) {
              console.warn(`User not found for invoice ${invoice.invoice_number}:`, userError);
              return {
                ...invoice,
                user: {
                  email: 'Utilisateur supprimé',
                  prenom: 'Compte',
                  nom: 'Supprimé'
                }
              };
            }

            return {
              ...invoice,
              user: userData
            };
          } catch (err) {
            console.error('Error processing user data for invoice:', err);
            return {
              ...invoice,
              user: {
                email: 'Erreur',
                prenom: 'Erreur',
                nom: 'Erreur'
              }
            };
          }
        })
      );

      // For each invoice, get the registrations
      const invoicesWithRegistrations = await Promise.all(
        invoicesWithUserDetails.map(async (invoice) => {
          try {
            const { data: registrationsData, error: registrationsError } = await supabase
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
              .in('id', invoice.registration_ids || []);

            if (registrationsError) {
              console.error('Error fetching registrations for invoice:', registrationsError);
              return {
                ...invoice,
                registrations: []
              };
            }

            return {
              ...invoice,
              registrations: registrationsData || []
            };
          } catch (err) {
            console.error('Error processing registrations for invoice:', err);
            return {
              ...invoice,
              registrations: []
            };
          }
        })
      );

      setInvoices(invoicesWithRegistrations);
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Une erreur est survenue lors du chargement des factures.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      setIsLoadingTransactions(true);
      
      const { data, error } = await supabase
        .from('bank_transactions')
        .select(`
          *,
          invoice:invoice_id(
            invoice_number,
            amount,
            status,
            user_id,
            user:user_id(
              prenom,
              nom,
              email
            )
          )
        `)
        .order('transaction_date', { ascending: false });
        
      if (error) throw error;
      
      setTransactions(data || []);
    } catch (err: any) {
      console.error('Error fetching bank transactions:', err);
      toast.error('Erreur lors du chargement des transactions bancaires');
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const handleMarkAsPaid = async (invoiceNumber: string) => {
    try {
      setIsProcessing(invoiceNumber);
      
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error('Erreur lors de la récupération de la session: ' + sessionError.message);
      }
      
      if (!session?.access_token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      
      // Call our Supabase Edge Function to update invoice status
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-invoice-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            invoice_number: invoiceNumber,
            status: 'paid',
            api_key: 'your-api-key' // This should be a proper API key in production
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Une erreur est survenue lors de la mise à jour du statut.');
      }
      
      // Update local state
      setInvoices(prev => 
        prev.map(inv => 
          inv.invoice_number === invoiceNumber 
            ? { ...inv, status: 'paid', paid_at: new Date().toISOString() } 
            : inv
        )
      );
      
      toast.success('Paiement marqué comme reçu');
    } catch (error: any) {
      console.error('Error marking as paid:', error);
      toast.error('Erreur lors de la mise à jour du statut');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleGeneratePdf = async (invoiceNumber: string) => {
    try {
      setIsProcessing(invoiceNumber);
      
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error('Erreur lors de la récupération de la session: ' + sessionError.message);
      }
      
      if (!session?.access_token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      
      // Call our Supabase Edge Function to generate PDF
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-invoice-pdf`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            invoice_number: invoiceNumber,
            api_key: 'your-api-key' // This should be a proper API key in production
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Une erreur est survenue lors de la génération du PDF.');
      }
      
      const { pdf_url } = await response.json();
      
      // Update local state
      setInvoices(prev => 
        prev.map(inv => 
          inv.invoice_number === invoiceNumber 
            ? { ...inv, pdf_url } 
            : inv
        )
      );
      
      // Open PDF in new tab
      window.open(pdf_url, '_blank');
      
      toast.success('PDF généré avec succès');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleExportCSV = () => {
    try {
      setIsExporting(true);
      
      // Filter invoices based on current filter
      const filteredData = invoices.filter(inv => {
        if (filter === 'all') return true;
        if (filter === 'paid') return inv.status === 'paid';
        if (filter === 'pending') return inv.status === 'pending';
        return true;
      });
      
      // Create CSV content
      const headers = [
        'Numéro de facture',
        'Date de création',
        'Client',
        'Email',
        'Montant',
        'Statut',
        'Date d\'échéance',
        'Date de paiement',
        'Communication'
      ];
      
      const rows = filteredData.map(inv => [
        inv.invoice_number,
        new Date(inv.created_at).toLocaleDateString('fr-FR'),
        `${inv.user.prenom} ${inv.user.nom}`,
        inv.user.email,
        `${inv.amount} €`,
        inv.status === 'paid' ? 'Payé' : inv.status === 'cancelled' ? 'Annulé' : 'En attente',
        inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '-',
        inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('fr-FR') : '-',
        inv.communication
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
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImportFile = async () => {
    if (!selectedFile) {
      toast.error('Veuillez sélectionner un fichier');
      return;
    }

    try {
      setIsImporting(true);
      setImportResult(null);

      // 1. Upload the file to Supabase Storage
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const filePath = `imports/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('coda-files')
        .upload(filePath, selectedFile);
        
      if (uploadError) {
        throw new Error(`Erreur lors du téléversement: ${uploadError.message}`);
      }
      
      // 2. Call the Edge Function to process the file
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-coda-file`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            filePath,
            batchId: `batch-${Date.now()}`
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors du traitement du fichier');
      }
      
      const result = await response.json();
      setImportResult(result);
      
      // Refresh transactions list
      fetchTransactions();
      
      toast.success(`Importation réussie: ${result.message}`);
    } catch (error: any) {
      console.error('Error importing file:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleViewTransactionDetails = async (transaction: BankTransaction) => {
    setSelectedTransaction(transaction);
    setTransactionNotes(transaction.notes || '');
    setIsTransactionDetailModalOpen(true);
    
    // Find suggested invoices
    try {
      setIsLoadingSuggestions(true);
      
      // Look for invoices with similar communication or amount
      const { data, error } = await supabase
        .from('invoices')
        .select('*, user:user_id(prenom, nom, email)')
        .or(`status.eq.pending,amount.eq.${transaction.amount}`)
        .limit(5);
        
      if (error) throw error;
      
      setSuggestedInvoices(data || []);
    } catch (err) {
      console.error('Error fetching suggested invoices:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleLinkToInvoice = async (transactionId: string, invoiceId: string) => {
    try {
      // Call the match function
      const { data, error } = await supabase.rpc(
        'match_transaction_to_invoice',
        { transaction_id: transactionId }
      );
      
      if (error) throw error;
      
      // Refresh transactions
      fetchTransactions();
      
      // Refresh invoices if we're on that tab
      if (activeTab === 'invoices') {
        fetchInvoices();
      }
      
      toast.success('Transaction liée à la facture avec succès');
      setIsTransactionDetailModalOpen(false);
    } catch (err: any) {
      console.error('Error linking transaction to invoice:', err);
      toast.error(`Erreur: ${err.message}`);
    }
  };

  const handleUpdateTransactionStatus = async (status: 'ignored' | 'unmatched') => {
    if (!selectedTransaction) return;
    
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ 
          status,
          notes: transactionNotes
        })
        .eq('id', selectedTransaction.id);
        
      if (error) throw error;
      
      // Refresh transactions
      fetchTransactions();
      
      toast.success(`Statut mis à jour: ${status}`);
      setIsTransactionDetailModalOpen(false);
    } catch (err: any) {
      console.error('Error updating transaction status:', err);
      toast.error(`Erreur: ${err.message}`);
    }
  };

  const handleRunAutoMatch = async () => {
    try {
      setIsLoadingTransactions(true);
      
      // Call the function to match all unmatched transactions
      const { data, error } = await supabase.rpc('match_all_unmatched_transactions');
      
      if (error) throw error;
      
      // Refresh data
      fetchTransactions();
      if (activeTab === 'invoices') {
        fetchInvoices();
      }
      
      toast.success(`${data} transactions ont été automatiquement associées`);
    } catch (err: any) {
      console.error('Error running auto-match:', err);
      toast.error(`Erreur: ${err.message}`);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const getStatusIcon = (status: string, invoiceId: string | null) => {
    if (status === 'paid') {
      return <CheckCircle className="h-4 w-4 text-green-500 mr-1" />;
    } else if (status === 'cancelled') {
      return <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />;
    } else if (status === 'refunded') {
      return <RefreshCw className="h-4 w-4 text-blue-500 mr-1" />;
    } else {
      // pending
      return invoiceId ? 
        <FileText className="h-4 w-4 text-yellow-500 mr-1" /> : 
        <Clock className="h-4 w-4 text-yellow-500 mr-1" />;
    }
  };

  const getStatusText = (status: string, invoiceId: string | null) => {
    if (status === 'paid') {
      return 'Payé';
    } else if (status === 'cancelled') {
      return 'Annulé';
    } else if (status === 'refunded') {
      return 'Remboursé';
    } else {
      // pending
      return invoiceId ? 'Facture en attente' : 'Paiement en attente';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getTransactionStatusColor = (status: string) => {
    switch (status) {
      case 'matched':
        return 'bg-green-100 text-green-800';
      case 'partially_matched':
        return 'bg-yellow-100 text-yellow-800';
      case 'overpaid':
        return 'bg-blue-100 text-blue-800';
      case 'ignored':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  const getTransactionStatusText = (status: string) => {
    switch (status) {
      case 'matched':
        return 'Associée';
      case 'partially_matched':
        return 'Partiellement associée';
      case 'overpaid':
        return 'Surpayée';
      case 'ignored':
        return 'Ignorée';
      default:
        return 'Non associée';
    }
  };

  // Filter and search invoices
  const filteredInvoices = invoices
    .filter(inv => {
      if (filter === 'all') return true;
      if (filter === 'paid') return inv.status === 'paid';
      if (filter === 'pending') return inv.status === 'pending';
      return true;
    })
    .filter(inv => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        inv.invoice_number?.toLowerCase().includes(searchLower) ||
        inv.user?.email?.toLowerCase().includes(searchLower) ||
        inv.user?.prenom?.toLowerCase().includes(searchLower) ||
        inv.user?.nom?.toLowerCase().includes(searchLower) ||
        (inv.registrations || []).some((reg: any) => 
          reg.kid?.prenom?.toLowerCase().includes(searchLower) ||
          reg.kid?.nom?.toLowerCase().includes(searchLower) ||
          reg.session?.stage?.title?.toLowerCase().includes(searchLower)
        )
      );
    });

  // Filter and search transactions
  const filteredTransactions = transactions
    .filter(tx => {
      if (transactionFilter === 'all') return true;
      return tx.status === transactionFilter;
    })
    .filter(tx => {
      if (!transactionSearchTerm) return true;
      const searchLower = transactionSearchTerm.toLowerCase();
      return (
        tx.communication?.toLowerCase().includes(searchLower) ||
        tx.account_name?.toLowerCase().includes(searchLower) ||
        tx.account_number?.toLowerCase().includes(searchLower) ||
        tx.bank_reference?.toLowerCase().includes(searchLower) ||
        tx.amount.toString().includes(searchLower) ||
        tx.invoice?.invoice_number?.toLowerCase().includes(searchLower) ||
        tx.invoice?.user?.email?.toLowerCase().includes(searchLower) ||
        tx.invoice?.user?.prenom?.toLowerCase().includes(searchLower) ||
        tx.invoice?.user?.nom?.toLowerCase().includes(searchLower)
      );
    });

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des paiements</h1>
          <p className="text-gray-600">Suivez et gérez les paiements des inscriptions</p>
        </div>
        
        <div className="flex space-x-3">
          {activeTab === 'invoices' && (
            <>
              <button
                onClick={handleExportCSV}
                disabled={isExporting}
                className="btn-outline flex items-center"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Exporter CSV
              </button>
              <button
                onClick={fetchInvoices}
                className="btn-primary flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </button>
            </>
          )}
          
          {activeTab === 'transactions' && (
            <>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="btn-outline flex items-center"
              >
                <Upload className="h-4 w-4 mr-2" />
                Importer CODA
              </button>
              <button
                onClick={handleRunAutoMatch}
                disabled={isLoadingTransactions}
                className="btn-outline flex items-center"
              >
                <Link2 className="h-4 w-4 mr-2" />
                Association auto
              </button>
              <button
                onClick={fetchTransactions}
                disabled={isLoadingTransactions}
                className="btn-primary flex items-center"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingTransactions ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1">
        <div className="flex">
          <button
            onClick={() => setActiveTab('invoices')}
            className={clsx(
              "flex-1 py-2 px-4 text-sm font-medium rounded-md",
              activeTab === 'invoices' 
                ? "bg-primary-100 text-primary-800" 
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            )}
          >
            <div className="flex items-center justify-center">
              <FileText className="h-4 w-4 mr-2" />
              Factures
            </div>
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={clsx(
              "flex-1 py-2 px-4 text-sm font-medium rounded-md",
              activeTab === 'transactions' 
                ? "bg-primary-100 text-primary-800" 
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            )}
          >
            <div className="flex items-center justify-center">
              <Database className="h-4 w-4 mr-2" />
              Transactions bancaires
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'invoices' && (
        <>
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Rechercher..."
                className="form-input pl-10 pr-4 py-2 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
                <option value="all">Tous</option>
                <option value="paid">Payés</option>
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
                <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <p className="text-gray-600 mb-4">
                {searchTerm || filter !== 'all'
                  ? 'Aucune facture ne correspond à vos critères.'
                  : 'Aucune facture trouvée.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Facture
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Inscriptions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Montant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Échéance
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredInvoices.map((invoice) => {
                      // Check if due date is passed
                      const isDueDatePassed = invoice.due_date && new Date(invoice.due_date) < new Date();
                      
                      return (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {invoice.invoice_number}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {new Date(invoice.created_at).toLocaleDateString('fr-FR')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {invoice.user.prenom} {invoice.user.nom}
                            </div>
                            <div className="text-sm text-gray-500">
                              {invoice.user.email}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {(invoice.registrations || []).map((reg, index) => (
                                <div key={reg.id} className={index > 0 ? 'mt-1' : ''}>
                                  {reg.session.stage.title} ({reg.kid.prenom})
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {invoice.amount} €
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              getStatusColor(invoice.status)
                            }`}>
                              {getStatusIcon(invoice.status, invoice.invoice_number)}
                              {getStatusText(invoice.status, invoice.invoice_number)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {invoice.due_date ? (
                              <div className={`text-sm ${isDueDatePassed ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                {new Date(invoice.due_date).toLocaleDateString('fr-FR')}
                                {isDueDatePassed && ' (dépassée)'}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">-</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              {invoice.status !== 'paid' && (
                                <button
                                  onClick={() => handleMarkAsPaid(invoice.invoice_number)}
                                  disabled={isProcessing === invoice.invoice_number}
                                  className="text-green-600 hover:text-green-900"
                                  title="Marquer comme payé"
                                >
                                  {isProcessing === invoice.invoice_number ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                  ) : (
                                    <CheckCircle className="h-5 w-5" />
                                  )}
                                </button>
                              )}
                              
                              <button
                                onClick={() => handleGeneratePdf(invoice.invoice_number)}
                                disabled={isProcessing === invoice.invoice_number}
                                className="text-blue-600 hover:text-blue-900"
                                title="Générer PDF"
                              >
                                {isProcessing === invoice.invoice_number ? (
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                  <FileText className="h-5 w-5" />
                                )}
                              </button>
                              
                              {invoice.pdf_url && (
                                <a
                                  href={invoice.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-600 hover:text-primary-900"
                                  title="Voir PDF"
                                >
                                  <ExternalLink className="h-5 w-5" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'transactions' && (
        <>
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Rechercher une transaction..."
                className="form-input pl-10 pr-4 py-2 w-full"
                value={transactionSearchTerm}
                onChange={(e) => setTransactionSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-500" />
              <select
                className="form-input py-2"
                value={transactionFilter}
                onChange={(e) => setTransactionFilter(e.target.value as any)}
              >
                <option value="all">Toutes</option>
                <option value="unmatched">Non associées</option>
                <option value="matched">Associées</option>
                <option value="partially_matched">Partiellement associées</option>
              </select>
            </div>
          </div>
          
          {isLoadingTransactions ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <p className="text-gray-600 mb-4">
                {transactionSearchTerm || transactionFilter !== 'all'
                  ? 'Aucune transaction ne correspond à vos critères.'
                  : 'Aucune transaction bancaire trouvée.'}
              </p>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="btn-primary inline-flex items-center"
              >
                <Upload className="h-4 w-4 mr-2" />
                Importer un fichier CODA
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Montant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Communication
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Compte
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Facture liée
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTransactions.map((transaction) => (
                      <tr key={transaction.id} className={clsx(
                        "hover:bg-gray-50",
                        transaction.status === 'unmatched' && "bg-red-50"
                      )}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(transaction.transaction_date).toLocaleDateString('fr-FR')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={clsx(
                            "text-sm font-medium",
                            transaction.amount >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {transaction.amount} {transaction.currency}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate" title={transaction.communication}>
                            {transaction.communication || <span className="text-gray-400 italic">Aucune communication</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {transaction.account_name || <span className="text-gray-400 italic">Inconnu</span>}
                          </div>
                          <div className="text-xs text-gray-500">
                            {transaction.account_number}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            getTransactionStatusColor(transaction.status)
                          }`}>
                            {getTransactionStatusText(transaction.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {transaction.invoice ? (
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                {transaction.invoice.invoice_number}
                              </div>
                              <div className="text-xs text-gray-500">
                                {transaction.invoice.user?.prenom} {transaction.invoice.user?.nom}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400 italic">Non liée</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleViewTransactionDetails(transaction)}
                            className="text-primary-600 hover:text-primary-900"
                            title="Voir les détails"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Import CODA File Modal */}
      <Dialog
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Importer un fichier CODA
            </Dialog.Title>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Sélectionnez un fichier CODA (.BC2) à importer. Le système tentera d'associer automatiquement les transactions aux factures.
              </p>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".BC2,.bc2"
                  onChange={handleFileChange}
                  className="hidden"
                  id="coda-file-input"
                />
                <label
                  htmlFor="coda-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center"
                >
                  <FileUp className="h-10 w-10 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedFile ? selectedFile.name : "Cliquez pour sélectionner un fichier"}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {selectedFile ? `${(selectedFile.size / 1024).toFixed(2)} KB` : "Format .BC2"}
                  </span>
                </label>
              </div>

              {importResult && (
                <div className={clsx(
                  "p-4 rounded-lg text-sm",
                  importResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                )}>
                  <p className="font-medium">{importResult.success ? "Importation réussie" : "Échec de l'importation"}</p>
                  <p>{importResult.message}</p>
                  {importResult.success && (
                    <p className="mt-1">
                      Batch ID: {importResult.batch_id}<br />
                      Transactions: {importResult.transactions}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="btn-outline"
                  disabled={isImporting}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleImportFile}
                  disabled={!selectedFile || isImporting}
                  className={clsx(
                    "btn-primary",
                    (!selectedFile || isImporting) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isImporting ? (
                    <span className="flex items-center">
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                      Importation...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Upload className="h-4 w-4 mr-2" />
                      Importer
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Transaction Detail Modal */}
      <Dialog
        open={isTransactionDetailModalOpen}
        onClose={() => setIsTransactionDetailModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

          <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full mx-auto p-6">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Détails de la transaction
            </Dialog.Title>

            {selectedTransaction && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Date</h3>
                    <p className="mt-1 text-sm text-gray-900">
                      {new Date(selectedTransaction.transaction_date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Montant</h3>
                    <p className={clsx(
                      "mt-1 text-sm font-medium",
                      selectedTransaction.amount >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {selectedTransaction.amount} {selectedTransaction.currency}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Communication</h3>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedTransaction.communication || <span className="italic text-gray-400">Aucune communication</span>}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Compte</h3>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedTransaction.account_name || <span className="italic text-gray-400">Nom inconnu</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedTransaction.account_number || <span className="italic">Numéro inconnu</span>}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Référence bancaire</h3>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedTransaction.bank_reference || <span className="italic text-gray-400">Aucune référence</span>}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Statut</h3>
                    <p className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        getTransactionStatusColor(selectedTransaction.status)
                      }`}>
                        {getTransactionStatusText(selectedTransaction.status)}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Linked invoice */}
                {selectedTransaction.invoice && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Facture associée</h3>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">{selectedTransaction.invoice.invoice_number}</p>
                        <p className="text-xs text-gray-500">
                          {selectedTransaction.invoice.user?.prenom} {selectedTransaction.invoice.user?.nom}
                        </p>
                        <p className="text-xs text-gray-500">{selectedTransaction.invoice.user?.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{selectedTransaction.invoice.amount} €</p>
                        <p className="text-xs">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            getStatusColor(selectedTransaction.invoice.status)
                          }`}>
                            {getStatusText(selectedTransaction.invoice.status, selectedTransaction.invoice.invoice_number)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={transactionNotes}
                    onChange={(e) => setTransactionNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    rows={3}
                    placeholder="Ajouter des notes sur cette transaction..."
                  />
                </div>

                {/* Suggested invoices */}
                {selectedTransaction.status === 'unmatched' && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Factures suggérées</h3>
                    
                    {isLoadingSuggestions ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
                      </div>
                    ) : suggestedInvoices.length === 0 ? (
                      <p className="text-sm text-gray-500 py-2">Aucune suggestion disponible</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {suggestedInvoices.map(invoice => (
                          <div key={invoice.id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-medium">{invoice.invoice_number}</p>
                                <p className="text-xs text-gray-500">
                                  {invoice.user?.prenom} {invoice.user?.nom}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">{invoice.amount} €</p>
                                <button
                                  onClick={() => handleLinkToInvoice(selectedTransaction.id, invoice.id)}
                                  className="text-xs text-primary-600 hover:text-primary-800"
                                >
                                  Associer
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setIsTransactionDetailModalOpen(false)}
                    className="btn-outline"
                  >
                    Fermer
                  </button>
                  
                  {selectedTransaction.status === 'unmatched' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateTransactionStatus('ignored')}
                      className="btn-outline text-gray-600"
                    >
                      Ignorer
                    </button>
                  )}
                  
                  {selectedTransaction.status !== 'unmatched' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateTransactionStatus('unmatched')}
                      className="btn-outline text-yellow-600"
                    >
                      Marquer comme non associé
                    </button>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => {
                      // Save notes
                      supabase
                        .from('bank_transactions')
                        .update({ notes: transactionNotes })
                        .eq('id', selectedTransaction.id)
                        .then(() => {
                          toast.success('Notes enregistrées');
                          setIsTransactionDetailModalOpen(false);
                          fetchTransactions();
                        })
                        .catch(err => {
                          console.error('Error saving notes:', err);
                          toast.error('Erreur lors de l\'enregistrement des notes');
                        });
                    }}
                    className="btn-primary"
                  >
                    Enregistrer
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

export default AdminPaymentsPage;