import { useEffect, useState } from 'react';
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
  Receipt,
  ExternalLink,
  X,
  Upload,
  Link as LinkIcon
} from 'lucide-react';
import { Dialog } from '@headlessui/react';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

interface BankTransaction {
  id: string;
  transaction_date: string;
  amount: number;
  currency: string;
  communication: string;
  extracted_invoice_number: string | null;
  account_number: string;
  account_name: string;
  bank_reference: string;
  movement_number: string;
  counterparty_address: string;
  counterparty_name: string | null;
  status: 'unmatched' | 'matched' | 'partially_matched' | 'overpaid' | 'ignored';
  invoice_id: string | null;
  raw_file_path: string | null;
  import_batch_id: string | null;
  notes: string | null;
  raw_libelles: string;
  raw_details_mouvement: string;
  invoice?: {
    invoice_number: string;
    amount: number;
    status: string;
  };
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  communication: string;
}

const AdminBankTransactionsPage = () => {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unmatched' | 'matched' | 'partially_matched' | 'overpaid' | 'ignored'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [matchInvoiceId, setMatchInvoiceId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchTransactions();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, filter]);

  useEffect(() => {
    fetchTransactions();
  }, [currentPage]);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Build the base query with pagination
      let query = supabase
        .from('bank_transactions')
        .select(`
          *,
          invoice:invoice_id(
            invoice_number,
            amount,
            status
          )
        `, { count: 'exact' });
      
      // Apply status filter
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }
      
      // Apply search filter if provided
      if (searchTerm.trim()) {
        query = query.or(
          `communication.ilike.%${searchTerm.trim()}%,` +
          `extracted_invoice_number.ilike.%${searchTerm.trim()}%,` +
          `account_name.ilike.%${searchTerm.trim()}%,` +
          `counterparty_name.ilike.%${searchTerm.trim()}%,` +
          `movement_number.ilike.%${searchTerm.trim()}%`
        );
      }
      
      // Apply pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);
      
      // Order by transaction_date (most recent first)
      query = query.order('transaction_date', { ascending: false });
      
      const { data, error: fetchError, count } = await query;
      
      if (fetchError) throw fetchError;

      // Update pagination info
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
      
      setTransactions(data || []);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setError(err.message || 'Une erreur est survenue lors du chargement des transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, amount, status, communication')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setInvoices(data || []);
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      toast.error('Erreur lors du chargement des factures');
    }
  };

  const handleViewDetails = (transaction: BankTransaction) => {
    setSelectedTransaction(transaction);
    setIsDetailModalOpen(true);
  };

  const handleMatchTransaction = async (transaction: BankTransaction) => {
    setSelectedTransaction(transaction);
    setMatchInvoiceId('');
    await fetchPendingInvoices();
    setIsMatchModalOpen(true);
  };

  const handleConfirmMatch = async () => {
    if (!selectedTransaction || !matchInvoiceId) {
      toast.error('Veuillez sélectionner une facture');
      return;
    }

    try {
      setIsProcessing(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-transaction-to-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          transaction_id: selectedTransaction.id,
          invoice_id: matchInvoiceId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'association');
      }
      
      const result = await response.json();
      
      toast.success('Transaction associée avec succès');
      setIsMatchModalOpen(false);
      fetchTransactions();
    } catch (error: any) {
      console.error('Error matching transaction:', error);
      toast.error(error.message || 'Erreur lors de l\'association');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadCSV = async () => {
    if (!uploadFile) {
      toast.error('Veuillez sélectionner un fichier');
      return;
    }

    try {
      setIsUploading(true);
      
      // 1. Upload the file to storage
      const fileName = `${Date.now()}_${uploadFile.name}`;
      const filePath = `imports/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('csv-files')
        .upload(filePath, uploadFile);
        
      if (uploadError) throw uploadError;
      
      // 2. Process the file
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-csv-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          filePath,
          batchId: `batch-${Date.now()}`
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors du traitement du fichier');
      }
      
      const result = await response.json();
      
      toast.success(`${result.transactions} transactions importées avec succès`);
      setIsUploadModalOpen(false);
      setUploadFile(null);
      fetchTransactions();
    } catch (error: any) {
      console.error('Error uploading CSV:', error);
      toast.error(error.message || 'Erreur lors de l\'importation');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReconcileAll = async () => {
    try {
      setIsProcessing(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reconcile-all-pending-invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la réconciliation');
      }
      
      const result = await response.json();
      
      toast.success(`Réconciliation terminée: ${result.success_count} factures traitées, ${result.error_count} erreurs`);
      fetchTransactions();
    } catch (error: any) {
      console.error('Error reconciling invoices:', error);
      toast.error(error.message || 'Erreur lors de la réconciliation');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-BE');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Associée
          </span>
        );
      case 'partially_matched':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Partielle
          </span>
        );
      case 'overpaid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Surpayée
          </span>
        );
      case 'ignored':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <X className="w-3 h-3 mr-1" />
            Ignorée
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <Clock className="w-3 h-3 mr-1" />
            Non associée
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions bancaires</h1>
          <p className="text-gray-600">Gérez les transactions bancaires et associez-les aux factures</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="btn-outline flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importer CSV
          </button>
          <button
            onClick={handleReconcileAll}
            disabled={isProcessing}
            className="btn-outline flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
            Réconcilier tout
          </button>
          <button
            onClick={fetchTransactions}
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
            placeholder="Rechercher une transaction..."
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
            <option value="all">Toutes les transactions</option>
            <option value="unmatched">Non associées</option>
            <option value="matched">Associées</option>
            <option value="partially_matched">Partiellement associées</option>
            <option value="overpaid">Surpayées</option>
            <option value="ignored">Ignorées</option>
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
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <p className="text-gray-600 mb-4">
            {searchTerm || filter !== 'all'
              ? 'Aucune transaction ne correspond à vos critères.'
              : 'Aucune transaction trouvée. Importez un fichier CSV pour commencer.'}
          </p>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="btn-primary inline-flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importer un fichier CSV
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Communication
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    N° Facture
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    N° Mouvement
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contrepartie
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(transaction.transaction_date)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={clsx(
                        "font-medium",
                        transaction.amount > 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(transaction.amount)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                      {transaction.communication || '-'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                      {transaction.extracted_invoice_number || 
                       (transaction.invoice && transaction.invoice.invoice_number) || 
                       '-'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                      {transaction.movement_number || '-'}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500 max-w-[150px] truncate">
                      {transaction.counterparty_name || transaction.account_name || '-'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {getStatusBadge(transaction.status)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleViewDetails(transaction)}
                          className="text-primary-600 hover:text-primary-900"
                          title="Voir les détails"
                        >
                          <FileText className="h-5 w-5" />
                        </button>
                        
                        {transaction.status === 'unmatched' && (
                          <button
                            onClick={() => handleMatchTransaction(transaction)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Associer à une facture"
                          >
                            <LinkIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>
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

      {/* Transaction Details Modal */}
      <Dialog
        open={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />
          
          <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <Dialog.Title className="text-lg font-semibold">
                Détails de la transaction
              </Dialog.Title>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {selectedTransaction && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-700 mb-3">Informations de base</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Date:</span>
                        <span className="font-medium">{formatDate(selectedTransaction.transaction_date)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Montant:</span>
                        <span className={`font-medium ${selectedTransaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(selectedTransaction.amount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Statut:</span>
                        <span>{getStatusBadge(selectedTransaction.status)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">N° Mouvement:</span>
                        <span className="font-medium">{selectedTransaction.movement_number || '-'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-700 mb-3">Contrepartie</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Nom:</span>
                        <span className="font-medium">{selectedTransaction.counterparty_name || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Compte:</span>
                        <span className="font-medium">{selectedTransaction.account_name || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">N° Compte:</span>
                        <span className="font-medium">{selectedTransaction.account_number || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Adresse:</span>
                        <span className="font-medium">{selectedTransaction.counterparty_address || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-700 mb-3">Communication</h3>
                  <p className="text-gray-800 break-words">{selectedTransaction.communication || '-'}</p>
                </div>
                
                {selectedTransaction.invoice && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="font-medium text-blue-800 mb-3">Facture associée</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-blue-700">N° Facture:</span>
                        <span className="font-medium">{selectedTransaction.invoice.invoice_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">Montant:</span>
                        <span className="font-medium">{formatCurrency(selectedTransaction.invoice.amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">Statut:</span>
                        <span className={`font-medium ${
                          selectedTransaction.invoice.status === 'paid' ? 'text-green-600' : 
                          selectedTransaction.invoice.status === 'cancelled' ? 'text-red-600' : 
                          'text-yellow-600'
                        }`}>
                          {selectedTransaction.invoice.status}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-700 mb-3">Détails bruts</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-500 block">Libellés:</span>
                      <p className="text-gray-800 text-sm mt-1 break-words">{selectedTransaction.raw_libelles || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Détails du mouvement:</span>
                      <p className="text-gray-800 text-sm mt-1 break-words">{selectedTransaction.raw_details_mouvement || '-'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="btn-outline"
                  >
                    Fermer
                  </button>
                  {selectedTransaction.status === 'unmatched' && (
                    <button
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        handleMatchTransaction(selectedTransaction);
                      }}
                      className="btn-primary"
                    >
                      Associer à une facture
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      {/* Match Transaction Modal */}
      <Dialog
        open={isMatchModalOpen}
        onClose={() => !isProcessing && setIsMatchModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />
          
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <Dialog.Title className="text-lg font-semibold">
                Associer la transaction à une facture
              </Dialog.Title>
              <button
                onClick={() => !isProcessing && setIsMatchModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={isProcessing}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {selectedTransaction && (
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-700 mb-3">Transaction</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date:</span>
                      <span className="font-medium">{formatDate(selectedTransaction.transaction_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Montant:</span>
                      <span className={`font-medium ${selectedTransaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(selectedTransaction.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Communication:</span>
                      <span className="font-medium">{selectedTransaction.communication || '-'}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sélectionner une facture
                  </label>
                  <select
                    value={matchInvoiceId}
                    onChange={(e) => setMatchInvoiceId(e.target.value)}
                    className="form-input"
                    disabled={isProcessing}
                  >
                    <option value="">Sélectionner une facture</option>
                    {invoices.map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} - {formatCurrency(invoice.amount)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={() => !isProcessing && setIsMatchModalOpen(false)}
                    className="btn-outline"
                    disabled={isProcessing}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmMatch}
                    className="btn-primary"
                    disabled={isProcessing || !matchInvoiceId}
                  >
                    {isProcessing ? (
                      <span className="flex items-center">
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        Association...
                      </span>
                    ) : (
                      'Associer'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      {/* Upload CSV Modal */}
      <Dialog
        open={isUploadModalOpen}
        onClose={() => !isUploading && setIsUploadModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />
          
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <Dialog.Title className="text-lg font-semibold">
                Importer un fichier CSV
              </Dialog.Title>
              <button
                onClick={() => !isUploading && setIsUploadModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={isUploading}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-700">
                  Importez un fichier CSV contenant des transactions bancaires. Le fichier doit être au format CSV avec les colonnes suivantes:
                </p>
                <ul className="text-sm text-blue-700 list-disc list-inside mt-2">
                  <li>Numéro de compte</li>
                  <li>Nom du compte</li>
                  <li>Compte contrepartie</li>
                  <li>Numéro de mouvement</li>
                  <li>Date comptable</li>
                  <li>Date valeur</li>
                  <li>Montant</li>
                  <li>Devise</li>
                  <li>Libellés</li>
                  <li>Détails du mouvement</li>
                </ul>
              </div>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  id="csv-file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  disabled={isUploading}
                />
                <label
                  htmlFor="csv-file"
                  className="cursor-pointer flex flex-col items-center justify-center"
                >
                  <Upload className="h-10 w-10 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700">
                    {uploadFile ? uploadFile.name : 'Cliquez pour sélectionner un fichier'}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {uploadFile ? `${(uploadFile.size / 1024).toFixed(2)} KB` : 'CSV, TXT jusqu\'à 10MB'}
                  </span>
                </label>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => !isUploading && setIsUploadModalOpen(false)}
                  className="btn-outline"
                  disabled={isUploading}
                >
                  Annuler
                </button>
                <button
                  onClick={handleUploadCSV}
                  className="btn-primary"
                  disabled={isUploading || !uploadFile}
                >
                  {isUploading ? (
                    <span className="flex items-center">
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                      Importation...
                    </span>
                  ) : (
                    'Importer'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default AdminBankTransactionsPage;