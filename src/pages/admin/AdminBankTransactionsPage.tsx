import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Loader2, AlertCircle, Filter, Search, RefreshCw, 
  Download, Upload, FileText, CheckCircle, Clock, 
  ArrowLeft, ArrowRight, CreditCard, Receipt, 
  ExternalLink, X, Link as LinkIcon
} from 'lucide-react';
import { Dialog } from '@headlessui/react';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

interface BankTransaction {
  id: string;
  transaction_date: string;
  amount: number;
  currency: string;
  communication: string | null;
  account_number: string | null;
  account_name: string | null;
  bank_reference: string | null;
  status: string;
  invoice_id: string | null;
  raw_file_path: string | null;
  import_batch_id: string | null;
  notes: string | null;
  extracted_invoice_number: string | null;
  movement_number: string | null;
  counterparty_address: string | null;
  counterparty_name: string | null;
  raw_libelles: string | null;
  raw_details_mouvement: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  created_at: string;
  user_name: string;
  user_email: string;
}

const AdminBankTransactionsPage = () => {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'matched' | 'unmatched' | 'overpaid'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 20;

  // Association modal state
  const [isAssociationModalOpen, setIsAssociationModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [availableInvoices, setAvailableInvoices] = useState<Invoice[]>([]);
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [includeCancelledInvoices, setIncludeCancelledInvoices] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isAssociating, setIsAssociating] = useState(false);

  // File upload state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, [currentPage, filter, searchTerm]);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let query = supabase
        .from('bank_transactions')
        .select('*', { count: 'exact' });
      
      // Apply status filter
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }
      
      // Apply search filter
      if (searchTerm.trim()) {
        query = query.or(`communication.ilike.%${searchTerm.trim()}%,extracted_invoice_number.ilike.%${searchTerm.trim()}%,counterparty_name.ilike.%${searchTerm.trim()}%,account_name.ilike.%${searchTerm.trim()}%`);
      }
      
      // Apply pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);
      
      // Order by transaction date
      query = query.order('transaction_date', { ascending: false });
      
      const { data, error: fetchError, count } = await query;
      
      if (fetchError) throw fetchError;
      
      setTransactions(data || []);
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setError(err.message || 'Une erreur est survenue lors du chargement des transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const searchInvoices = async (searchTerm: string, includeCancelled: boolean = false) => {
    try {
      setIsLoadingInvoices(true);
      
      let query = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          status,
          created_at,
          user:user_id(
            prenom,
            nom,
            email
          )
        `);
      
      // Apply status filter
      if (includeCancelled) {
        query = query.in('status', ['pending', 'paid', 'cancelled']);
      } else {
        query = query.in('status', ['pending', 'paid']);
      }
      
      // Apply search filter if provided
      if (searchTerm.trim()) {
        // Search by invoice number or user details
        const { data: matchingUsers, error: userError } = await supabase
          .from('users')
          .select('id')
          .or(`email.ilike.%${searchTerm.trim()}%,nom.ilike.%${searchTerm.trim()}%,prenom.ilike.%${searchTerm.trim()}%`);
        
        if (userError) {
          console.error('Error searching users:', userError);
        }
        
        if (matchingUsers && matchingUsers.length > 0) {
          const userIds = matchingUsers.map(u => u.id);
          query = query.or(`user_id.in.(${userIds.join(',')}),invoice_number.ilike.%${searchTerm.trim()}%`);
        } else {
          query = query.ilike('invoice_number', `%${searchTerm.trim()}%`);
        }
      }
      
      query = query.order('created_at', { ascending: false }).limit(20);
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Transform data to include user name
      const invoicesWithUserNames = (data || []).map(invoice => ({
        ...invoice,
        user_name: invoice.user ? `${invoice.user.prenom} ${invoice.user.nom}` : 'Utilisateur inconnu',
        user_email: invoice.user?.email || ''
      }));
      
      setAvailableInvoices(invoicesWithUserNames);
    } catch (err: any) {
      console.error('Error searching invoices:', err);
      toast.error('Erreur lors de la recherche des factures');
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const handleOpenAssociationModal = (transaction: BankTransaction) => {
    setSelectedTransaction(transaction);
    setIsAssociationModalOpen(true);
    setInvoiceSearchTerm('');
    setIncludeCancelledInvoices(false);
    
    // Auto-search based on extracted invoice number
    if (transaction.extracted_invoice_number) {
      setInvoiceSearchTerm(transaction.extracted_invoice_number);
      searchInvoices(transaction.extracted_invoice_number, false);
    } else {
      searchInvoices('', false);
    }
  };

  const handleAssociateTransaction = async (invoiceId: string) => {
    if (!selectedTransaction) return;
    
    try {
      setIsAssociating(true);
      
      const { data, error } = await supabase.functions.invoke('match-transaction-to-invoice', {
        body: {
          transaction_id: selectedTransaction.id,
          invoice_id: invoiceId
        }
      });
      
      if (error) throw error;
      
      toast.success('Transaction associée avec succès');
      setIsAssociationModalOpen(false);
      fetchTransactions();
    } catch (err: any) {
      console.error('Error associating transaction:', err);
      toast.error(err.message || 'Erreur lors de l\'association');
    } finally {
      setIsAssociating(false);
    }
  };

  const handleDisassociateTransaction = async (transactionId: string) => {
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ 
          status: 'unmatched',
          invoice_id: null 
        })
        .eq('id', transactionId);
      
      if (error) throw error;
      
      toast.success('Transaction dissociée avec succès');
      fetchTransactions();
    } catch (err: any) {
      console.error('Error disassociating transaction:', err);
      toast.error('Erreur lors de la dissociation');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Veuillez sélectionner un fichier CSV');
      return;
    }

    try {
      setUploadingFile(true);
      
      // Upload file to storage
      const fileName = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('csv-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Process the CSV file
      const { data, error } = await supabase.functions.invoke('process-csv-file', {
        body: {
          filePath: fileName,
          batchId: `batch-${Date.now()}`
        }
      });

      if (error) throw error;

      toast.success(`Fichier traité avec succès: ${data.transactions} transactions importées`);
      setIsUploadModalOpen(false);
      fetchTransactions();
    } catch (err: any) {
      console.error('Error uploading file:', err);
      toast.error(err.message || 'Erreur lors du traitement du fichier');
    } finally {
      setUploadingFile(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    
    switch (status) {
      case 'matched':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'partially_matched':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'overpaid':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'unmatched':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'matched':
        return <CheckCircle className="w-4 h-4" />;
      case 'partially_matched':
      case 'overpaid':
        return <Clock className="w-4 h-4" />;
      case 'unmatched':
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions bancaires</h1>
          <p className="text-gray-600">Gérez les transactions bancaires et leur association aux factures</p>
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
            <option value="all">Tous les statuts</option>
            <option value="matched">Associées</option>
            <option value="partially_matched">Partiellement associées</option>
            <option value="overpaid">Surpayées</option>
            <option value="unmatched">Non associées</option>
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
              : 'Aucune transaction trouvée.'}
          </p>
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
                    Contrepartie
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Facture associée
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(transaction.transaction_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {transaction.communication || '-'}
                      {transaction.extracted_invoice_number && (
                        <div className="text-xs text-blue-600">
                          Facture détectée: {transaction.extracted_invoice_number}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {transaction.counterparty_name || transaction.account_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusBadge(transaction.status)}>
                        {getStatusIcon(transaction.status)}
                        <span className="ml-1">
                          {transaction.status === 'matched' ? 'Associée' :
                           transaction.status === 'partially_matched' ? 'Partielle' :
                           transaction.status === 'overpaid' ? 'Surpayée' :
                           'Non associée'}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.invoice_id ? (
                        <span className="text-blue-600">Facture associée</span>
                      ) : (
                        <span className="text-gray-400">Aucune</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {transaction.status === 'unmatched' ? (
                          <button
                            onClick={() => handleOpenAssociationModal(transaction)}
                            className="text-primary-600 hover:text-primary-900"
                            title="Associer à une facture"
                          >
                            <LinkIcon className="h-5 w-5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDisassociateTransaction(transaction.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Dissocier de la facture"
                          >
                            <X className="h-5 w-5" />
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

      {/* Association Modal */}
      <Dialog
        open={isAssociationModalOpen}
        onClose={() => setIsAssociationModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <Dialog.Title className="text-lg font-semibold">
                Associer la transaction à une facture
              </Dialog.Title>
              <button
                onClick={() => setIsAssociationModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {selectedTransaction && (
              <div className="space-y-6">
                {/* Transaction Details */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Détails de la transaction</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Date:</span>
                      <div className="font-medium">{formatDate(selectedTransaction.transaction_date)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Montant:</span>
                      <div className="font-medium text-green-600">{formatCurrency(selectedTransaction.amount)}</div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Communication:</span>
                      <div className="font-medium">{selectedTransaction.communication || '-'}</div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Contrepartie:</span>
                      <div className="font-medium">{selectedTransaction.counterparty_name || '-'}</div>
                    </div>
                  </div>
                </div>

                {/* Invoice Search */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Sélectionner une facture</h3>
                  
                  <div className="space-y-4">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Rechercher une facture par numéro, client..."
                        className="form-input pl-10 pr-4 py-2 w-full"
                        value={invoiceSearchTerm}
                        onChange={(e) => {
                          setInvoiceSearchTerm(e.target.value);
                          searchInvoices(e.target.value, includeCancelledInvoices);
                        }}
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="includeCancelled"
                        checked={includeCancelledInvoices}
                        onChange={(e) => {
                          setIncludeCancelledInvoices(e.target.checked);
                          searchInvoices(invoiceSearchTerm, e.target.checked);
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor="includeCancelled" className="ml-2 text-sm text-gray-700">
                        Inclure les factures annulées
                      </label>
                    </div>

                    {includeCancelledInvoices && (
                      <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <div className="flex items-start">
                          <AlertCircle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-amber-700">
                            Lier cette transaction à une facture annulée créera automatiquement une provision pour l'utilisateur.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Invoice List */}
                <div className="max-h-60 overflow-y-auto">
                  {isLoadingInvoices ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                    </div>
                  ) : availableInvoices.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>Aucune facture trouvée</p>
                      {!includeCancelledInvoices && (
                        <p className="text-xs mt-1">Essayez d'inclure les factures annulées</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableInvoices.map((invoice) => (
                        <div
                          key={invoice.id}
                          className={clsx(
                            "p-3 border rounded-lg cursor-pointer hover:bg-gray-50",
                            invoice.status === 'cancelled' && "bg-red-50 border-red-200"
                          )}
                          onClick={() => handleAssociateTransaction(invoice.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium">{invoice.invoice_number}</span>
                                <span className={clsx(
                                  "px-2 py-0.5 rounded-full text-xs font-medium",
                                  invoice.status === 'paid' ? "bg-green-100 text-green-800" :
                                  invoice.status === 'cancelled' ? "bg-red-100 text-red-800" :
                                  "bg-yellow-100 text-yellow-800"
                                )}>
                                  {invoice.status === 'paid' ? 'Payée' :
                                   invoice.status === 'cancelled' ? 'Annulée' :
                                   'En attente'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{invoice.user_name}</p>
                              <p className="text-xs text-gray-500">{invoice.user_email}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatCurrency(invoice.amount)}</p>
                              <p className="text-xs text-gray-500">{formatDate(invoice.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={() => setIsAssociationModalOpen(false)}
                    className="btn-outline"
                    disabled={isAssociating}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      {/* Upload Modal */}
      <Dialog
        open={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Importer un fichier CSV
            </Dialog.Title>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Sélectionnez un fichier CSV contenant les transactions bancaires à importer.
              </p>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csvFile"
                  disabled={uploadingFile}
                />
                <label
                  htmlFor="csvFile"
                  className={`cursor-pointer ${uploadingFile ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    {uploadingFile ? 'Traitement en cours...' : 'Cliquez pour sélectionner un fichier CSV'}
                  </p>
                </label>
              </div>

              {uploadingFile && (
                <div className="flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary-600 mr-2" />
                  <span className="text-sm text-gray-600">Traitement du fichier...</span>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="btn-outline"
                disabled={uploadingFile}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default AdminBankTransactionsPage;