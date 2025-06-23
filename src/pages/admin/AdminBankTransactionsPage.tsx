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
  Pencil
} from 'lucide-react';
import { Dialog } from '@headlessui/react';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';
import { Link } from 'react-router-dom';

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
  status: string;
  invoice_id: string | null;
  raw_file_path: string | null;
  import_batch_id: string | null;
  notes: string | null;
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
  user: {
    email: string;
    prenom: string;
    nom: string;
  };
}

const AdminBankTransactionsPage = () => {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unmatched' | 'matched' | 'partially_matched' | 'overpaid' | 'ignored'>('unmatched');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;

  // Invoice matching modal
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [matchInvoiceNumber, setMatchInvoiceNumber] = useState('');
  const [matchedInvoice, setMatchedInvoice] = useState<Invoice | null>(null);
  const [isSearchingInvoice, setIsSearchingInvoice] = useState(false);

  // Notes modal
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedTransactionForNotes, setSelectedTransactionForNotes] = useState<BankTransaction | null>(null);
  const [transactionNotes, setTransactionNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

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
        .select('*', { count: 'exact' });
      
      // Apply status filter
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }
      
      // Apply search filter if provided
      if (searchTerm.trim()) {
        query = query.or(
          `communication.ilike.%${searchTerm.trim()}%,` +
          `account_name.ilike.%${searchTerm.trim()}%,` +
          `counterparty_name.ilike.%${searchTerm.trim()}%,` +
          `extracted_invoice_number.ilike.%${searchTerm.trim()}%,` +
          `movement_number.ilike.%${searchTerm.trim()}%`
        );
      }
      
      // Apply pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);
      
      // Order by transaction_date
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

  const handleSearch = () => {
    setCurrentPage(1);
    fetchTransactions();
  };

  const handleExportCSV = () => {
    try {
      // Filter transactions based on current filter
      const filteredData = transactions.filter(tx => {
        if (filter === 'all') return true;
        return tx.status === filter;
      });
      
      // Create CSV content
      const headers = [
        'Date',
        'Montant',
        'Communication',
        'Compte',
        'Référence',
        'Statut',
        'Notes'
      ];
      
      const rows = filteredData.map(tx => [
        new Date(tx.transaction_date).toLocaleDateString('fr-FR'),
        tx.amount.toString(),
        tx.communication || '',
        tx.account_name || '',
        tx.movement_number || '',
        tx.status,
        tx.notes || ''
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
      link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Export CSV réussi');
    } catch (err: any) {
      console.error('Error exporting CSV:', err);
      toast.error('Erreur lors de l\'export CSV');
    }
  };

  const handleReconcileAllTransactions = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.rpc('reconcile_all_pending_invoices');
      
      if (error) throw error;
      
      toast.success(`Réconciliation terminée: ${data.success_count} factures traitées, ${data.error_count} erreurs`);
      
      // Refresh the transactions list
      fetchTransactions();
    } catch (err: any) {
      console.error('Error reconciling transactions:', err);
      toast.error(`Erreur: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMatchTransaction = async () => {
    if (!selectedTransaction || !matchInvoiceNumber) {
      toast.error('Veuillez sélectionner une facture');
      return;
    }

    try {
      setIsLoading(true);
      
      // Call the edge function to match the transaction to the invoice
      const { data, error } = await supabase.functions.invoke('match-transaction-to-invoice', {
        body: {
          transaction_id: selectedTransaction.id,
          invoice_id: matchInvoiceNumber
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to match transaction to invoice');
      }

      toast.success('Transaction associée à la facture avec succès');
      setIsMatchModalOpen(false);
      setSelectedTransaction(null);
      setMatchInvoiceNumber('');
      setMatchedInvoice(null);
      
      // Refresh the transactions list
      fetchTransactions();
    } catch (error: any) {
      console.error('Error matching transaction:', error);
      toast.error(error.message || 'Failed to match transaction to invoice');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchInvoice = async () => {
    if (!matchInvoiceNumber) return;
    
    try {
      setIsSearchingInvoice(true);
      
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          status,
          user:user_id(
            email,
            prenom,
            nom
          )
        `)
        .eq('invoice_number', matchInvoiceNumber)
        .single();
        
      if (error) throw error;
      
      setMatchedInvoice(data);
    } catch (error) {
      console.error('Error searching invoice:', error);
      setMatchedInvoice(null);
      toast.error('Facture non trouvée');
    } finally {
      setIsSearchingInvoice(false);
    }
  };

  const handleOpenNotesModal = (transaction: BankTransaction) => {
    setSelectedTransactionForNotes(transaction);
    setTransactionNotes(transaction.notes || '');
    setIsNotesModalOpen(true);
  };

  const handleSaveNotes = async () => {
    if (!selectedTransactionForNotes) return;

    try {
      setIsSavingNotes(true);
      
      const { error } = await supabase
        .from('bank_transactions')
        .update({ notes: transactionNotes })
        .eq('id', selectedTransactionForNotes.id);
        
      if (error) throw error;
      
      toast.success('Notes enregistrées avec succès');
      setIsNotesModalOpen(false);
      
      // Update the transaction in the local state
      setTransactions(prevTransactions => 
        prevTransactions.map(tx => 
          tx.id === selectedTransactionForNotes.id 
            ? { ...tx, notes: transactionNotes } 
            : tx
        )
      );
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Erreur lors de l\'enregistrement des notes');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
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
            <CreditCard className="w-3 h-3 mr-1" />
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
            <AlertCircle className="w-3 h-3 mr-1" />
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
            onClick={handleExportCSV}
            className="btn-outline flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </button>
          <button
            onClick={handleReconcileAllTransactions}
            disabled={isLoading}
            className="btn-outline flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
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
            placeholder="Rechercher une transaction (communication, compte, référence)..."
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
            <option value="all">Toutes les transactions</option>
            <option value="unmatched">Non associées</option>
            <option value="matched">Associées</option>
            <option value="partially_matched">Partielles</option>
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
              : 'Aucune transaction trouvée. Importez des transactions pour commencer.'}
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
                    Compte
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Référence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(transaction.transaction_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={clsx(
                        "text-sm font-medium",
                        transaction.amount > 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(transaction.amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                      {transaction.communication || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.counterparty_name || transaction.account_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.movement_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(transaction.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.notes ? (
                        <div className="max-w-xs truncate">{transaction.notes}</div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleOpenNotesModal(transaction)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Ajouter/modifier des notes"
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                        {transaction.status === 'unmatched' && (
                          <button
                            onClick={() => {
                              setSelectedTransaction(transaction);
                              setMatchInvoiceNumber(transaction.extracted_invoice_number || '');
                              setMatchedInvoice(null);
                              setIsMatchModalOpen(true);
                            }}
                            className="text-primary-600 hover:text-primary-900"
                            title="Associer à une facture"
                          >
                            <FileText className="h-5 w-5" />
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

      {/* Match Transaction Modal */}
      <Dialog
        open={isMatchModalOpen}
        onClose={() => setIsMatchModalOpen(false)}
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
                onClick={() => setIsMatchModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {selectedTransaction && (
              <div className="space-y-6">
                {/* Transaction Details */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-700 mb-2">Détails de la transaction</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Date</p>
                      <p className="font-medium">{formatDate(selectedTransaction.transaction_date)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Montant</p>
                      <p className="font-medium">{formatCurrency(selectedTransaction.amount)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-500">Communication</p>
                      <p className="font-medium">{selectedTransaction.communication || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Invoice Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Numéro de facture
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={matchInvoiceNumber}
                      onChange={(e) => setMatchInvoiceNumber(e.target.value)}
                      className="form-input flex-grow"
                      placeholder="Ex: CDV-250530-00010"
                    />
                    <button
                      onClick={handleSearchInvoice}
                      disabled={isSearchingInvoice || !matchInvoiceNumber}
                      className="btn-outline py-2 px-3"
                    >
                      {isSearchingInvoice ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Search className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Matched Invoice Details */}
                {matchedInvoice && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-medium text-green-800 mb-2">Facture trouvée</h3>
                    <div className="space-y-2">
                      <p><span className="font-medium">Numéro:</span> {matchedInvoice.invoice_number}</p>
                      <p><span className="font-medium">Montant:</span> {formatCurrency(matchedInvoice.amount)}</p>
                      <p><span className="font-medium">Client:</span> {matchedInvoice.user.prenom} {matchedInvoice.user.nom}</p>
                      <p><span className="font-medium">Email:</span> {matchedInvoice.user.email}</p>
                      <p><span className="font-medium">Statut:</span> {matchedInvoice.status}</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setIsMatchModalOpen(false)}
                    className="btn-outline"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleMatchTransaction}
                    disabled={!matchedInvoice || isLoading}
                    className={`btn-primary ${(!matchedInvoice || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isLoading ? (
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

      {/* Notes Modal */}
      <Dialog
        open={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <Dialog.Title className="text-lg font-semibold">
                Ajouter/Modifier des notes
              </Dialog.Title>
              <button
                onClick={() => setIsNotesModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {selectedTransactionForNotes && (
              <div className="space-y-6">
                {/* Transaction Details */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-700 mb-2">Détails de la transaction</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Date</p>
                      <p className="font-medium">{formatDate(selectedTransactionForNotes.transaction_date)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Montant</p>
                      <p className="font-medium">{formatCurrency(selectedTransactionForNotes.amount)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-500">Communication</p>
                      <p className="font-medium">{selectedTransactionForNotes.communication || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-500">Statut</p>
                      <div>{getStatusBadge(selectedTransactionForNotes.status)}</div>
                    </div>
                  </div>
                </div>

                {/* Notes Textarea */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={transactionNotes}
                    onChange={(e) => setTransactionNotes(e.target.value)}
                    className="form-input w-full"
                    rows={5}
                    placeholder="Ajoutez vos notes ici..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setIsNotesModalOpen(false)}
                    className="btn-outline"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="btn-primary"
                  >
                    {isSavingNotes ? (
                      <span className="flex items-center">
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        Enregistrement...
                      </span>
                    ) : (
                      'Enregistrer'
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

export default AdminBankTransactionsPage;