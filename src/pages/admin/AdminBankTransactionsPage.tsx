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
  Link as LinkIcon,
  Calendar,
  ArrowUpDown,
  Info
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
  account_number: string;
  account_name: string;
  bank_reference: string;
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
  user: {
    prenom: string;
    nom: string;
    email: string;
  };
}

const AdminBankTransactionsPage = () => {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unmatched' | 'matched' | 'partially_matched' | 'overpaid' | 'ignored'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<{start?: string, end?: string}>({});
  const [amountFilter, setAmountFilter] = useState<{min?: number, max?: number}>({});
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isProcessingTransaction, setIsProcessingTransaction] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [sortField, setSortField] = useState<string>('transaction_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [modalInvoiceSearchTerm, setModalInvoiceSearchTerm] = useState('');
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchTransactions();
  }, [filter, currentPage, sortField, sortDirection]);

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
      if (searchTerm) {
        query = query.or(
          `communication.ilike.%${searchTerm}%,account_name.ilike.%${searchTerm}%,counterparty_name.ilike.%${searchTerm}%,extracted_invoice_number.ilike.%${searchTerm}%,movement_number.ilike.%${searchTerm}%`
        );
      }
      
      // Apply date filters if provided
      if (dateFilter.start) {
        query = query.gte('transaction_date', dateFilter.start);
      }
      if (dateFilter.end) {
        query = query.lte('transaction_date', dateFilter.end);
      }
      
      // Apply amount filters if provided
      if (amountFilter.min !== undefined) {
        query = query.gte('amount', amountFilter.min);
      }
      if (amountFilter.max !== undefined) {
        query = query.lte('amount', amountFilter.max);
      }
      
      // Apply sorting
      query = query.order(sortField, { ascending: sortDirection === 'asc' });
      
      // Apply pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
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

  const handleSearch = () => {
    setCurrentPage(1); // Reset to first page when searching
    fetchTransactions();
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleFilter = () => {
    setCurrentPage(1); // Reset to first page when filtering
    fetchTransactions();
  };

  const handleResetFilters = () => {
    setFilter('all');
    setSearchTerm('');
    setDateFilter({});
    setAmountFilter({});
    setCurrentPage(1);
    fetchTransactions();
  };

  const handleViewTransaction = (transaction: BankTransaction) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const fetchModalInvoices = async (transaction: BankTransaction, searchTerm: string = '') => {
    try {
      setIsLoadingInvoices(true);
      
      // Fetch pending invoices
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          status,
          user:user_id(
            prenom,
            nom,
            email
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      let invoicesData = data || [];
      
      // Filter by search term if provided
      if (searchTerm) {
        invoicesData = invoicesData.filter(invoice => 
          invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invoice.user.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invoice.user.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invoice.user.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      // Sort invoices by relevance:
      // 1. Exact amount match first
      // 2. Then by creation date (newest first)
      invoicesData.sort((a, b) => {
        const aExactMatch = Math.abs(a.amount - transaction.amount) < 0.01;
        const bExactMatch = Math.abs(b.amount - transaction.amount) < 0.01;
        
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;
        
        // If both match or both don't match, sort by date (assuming created_at is available)
        return 0; // Default to the original order
      });
      
      setInvoices(invoicesData);
      setFilteredInvoices(invoicesData);
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      toast.error('Erreur lors du chargement des factures');
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const handleMatchTransaction = async (transaction: BankTransaction) => {
    setSelectedTransaction(transaction);
    setIsMatchModalOpen(true);
    setModalInvoiceSearchTerm('');
    
    // Fetch invoices with the transaction amount
    await fetchModalInvoices(transaction);
  };

  const handleModalInvoiceSearch = (searchTerm: string) => {
    setModalInvoiceSearchTerm(searchTerm);
    
    // Filter the already fetched invoices
    if (searchTerm.trim() === '') {
      setFilteredInvoices(invoices);
    } else {
      const filtered = invoices.filter(invoice => 
        invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.user.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.user.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredInvoices(filtered);
    }
  };

  const handleConfirmMatch = async () => {
    if (!selectedTransaction || !selectedInvoice) return;
    
    try {
      setIsProcessingTransaction(true);
      
      // Call the match-transaction-to-invoice edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-transaction-to-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          transaction_id: selectedTransaction.id,
          invoice_id: selectedInvoice
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to match transaction');
      }
      
      const result = await response.json();
      
      toast.success('Transaction associée avec succès');
      setIsMatchModalOpen(false);
      fetchTransactions();
    } catch (err: any) {
      console.error('Error matching transaction:', err);
      toast.error(err.message || 'Erreur lors de l\'association de la transaction');
    } finally {
      setIsProcessingTransaction(false);
    }
  };

  const handleUploadCSV = async () => {
    if (!uploadFile) {
      toast.error('Veuillez sélectionner un fichier');
      return;
    }
    
    try {
      setIsUploading(true);
      
      // First upload the file to storage
      const fileName = `${Date.now()}_${uploadFile.name}`;
      const filePath = `imports/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('csv-files')
        .upload(filePath, uploadFile);
        
      if (uploadError) throw uploadError;
      
      // Then call the process-csv-file edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-csv-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          filePath,
          batchId: `batch-${Date.now()}`
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process CSV file');
      }
      
      const result = await response.json();
      
      toast.success(`${result.transactions} transactions importées avec succès`);
      setIsUploadModalOpen(false);
      setUploadFile(null);
      fetchTransactions();
    } catch (err: any) {
      console.error('Error uploading CSV:', err);
      toast.error(err.message || 'Erreur lors de l\'importation du fichier CSV');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReconcileAll = async () => {
    try {
      setIsLoading(true);
      
      // Instead of calling the non-existent RPC function, let's implement a simpler approach
      // Get all unmatched transactions and pending invoices, then try to match them
      const { data: unmatchedTransactions, error: transError } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('status', 'unmatched')
        .not('extracted_invoice_number', 'is', null);
      
      if (transError) throw transError;
      
      const { data: pendingInvoices, error: invError } = await supabase
        .from('invoices')
        .select('id, invoice_number, amount')
        .eq('status', 'pending');
      
      if (invError) throw invError;
      
      let successCount = 0;
      let errorCount = 0;
      
      // Try to match transactions with invoices based on invoice number and amount
      for (const transaction of unmatchedTransactions || []) {
        if (transaction.extracted_invoice_number) {
          const matchingInvoice = pendingInvoices?.find(inv => 
            inv.invoice_number === transaction.extracted_invoice_number &&
            Math.abs(inv.amount - transaction.amount) < 0.01
          );
          
          if (matchingInvoice) {
            try {
              // Call the match function for this transaction
              const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-transaction-to-invoice`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                },
                body: JSON.stringify({
                  transaction_id: transaction.id,
                  invoice_id: matchingInvoice.id
                })
              });
              
              if (response.ok) {
                successCount++;
              } else {
                errorCount++;
              }
            } catch (err) {
              errorCount++;
            }
          }
        }
      }
      
      toast.success(`Réconciliation terminée: ${successCount} transactions associées, ${errorCount} erreurs`);
      
      // Refresh the transactions list
      fetchTransactions();
    } catch (err: any) {
      console.error('Error reconciling transactions:', err);
      toast.error(`Erreur: ${err.message}`);
    } finally {
      setIsLoading(false);
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
            <AlertCircle className="w-3 h-3 mr-1" />
            Non associée
          </span>
        );
    }
  };

  const exportCSV = () => {
    // Create CSV content
    const headers = [
      'Date',
      'Montant',
      'Devise',
      'Communication',
      'Numéro de compte',
      'Nom du compte',
      'Référence bancaire',
      'Statut',
      'Numéro de mouvement',
      'Contrepartie'
    ];
    
    const rows = transactions.map(t => [
      formatDate(t.transaction_date),
      t.amount,
      t.currency,
      t.communication || '',
      t.account_number || '',
      t.account_name || '',
      t.bank_reference || '',
      t.status,
      t.movement_number || '',
      t.counterparty_name || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_bancaires_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            onClick={exportCSV}
            className="btn-outline flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </button>
          <button
            onClick={handleReconcileAll}
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

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Rechercher par communication, compte, contrepartie..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="unmatched">Non associées</option>
              <option value="matched">Associées</option>
              <option value="partially_matched">Partiellement associées</option>
              <option value="overpaid">Surpayées</option>
              <option value="ignored">Ignorées</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              placeholder="Date début"
              value={dateFilter.start || ''}
              onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-gray-500">à</span>
            <input
              type="date"
              placeholder="Date fin"
              value={dateFilter.end || ''}
              onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="flex justify-between">
          <button
            onClick={handleFilter}
            className="btn-primary"
          >
            Filtrer
          </button>
          
          <button
            onClick={handleResetFilters}
            className="btn-outline"
          >
            Réinitialiser les filtres
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
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
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune transaction trouvée</h3>
            <p className="text-gray-600">
              {searchTerm || filter !== 'all' || dateFilter.start || dateFilter.end || amountFilter.min || amountFilter.max
                ? 'Essayez d\'ajuster vos filtres pour voir plus de résultats.'
                : 'Aucune transaction n\'a été importée. Utilisez le bouton "Importer CSV" pour commencer.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('transaction_date')}
                  >
                    <div className="flex items-center">
                      Date
                      {sortField === 'transaction_date' && (
                        <ArrowUpDown className="ml-1 h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center">
                      Montant
                      {sortField === 'amount' && (
                        <ArrowUpDown className="ml-1 h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Communication
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(transaction.transaction_date)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <span className={transaction.amount >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {formatCurrency(transaction.amount)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {transaction.communication || <span className="italic text-gray-400">-</span>}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.movement_number || <span className="italic text-gray-400">-</span>}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.counterparty_name || <span className="italic text-gray-400">-</span>}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      {getStatusBadge(transaction.status)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleViewTransaction(transaction)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Voir les détails"
                        >
                          <FileText className="w-5 h-5" />
                        </button>
                        {transaction.status === 'unmatched' && (
                          <button
                            onClick={() => handleMatchTransaction(transaction)}
                            className="text-green-600 hover:text-green-900"
                            title="Associer à une facture"
                          >
                            <LinkIcon className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
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

      {/* Transaction Details Modal */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-4xl w-full bg-white rounded-lg shadow-xl">
            {selectedTransaction && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    Détails de la transaction
                  </Dialog.Title>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Date</h3>
                      <p className="mt-1 text-sm text-gray-900">{formatDate(selectedTransaction.transaction_date)}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Montant</h3>
                      <p className={`mt-1 text-sm font-medium ${selectedTransaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(selectedTransaction.amount)}
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Communication</h3>
                      <p className="mt-1 text-sm text-gray-900">{selectedTransaction.communication || '-'}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Numéro de mouvement</h3>
                      <p className="mt-1 text-sm text-gray-900">{selectedTransaction.movement_number || '-'}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Numéro de facture extrait</h3>
                      <p className="mt-1 text-sm text-gray-900">{selectedTransaction.extracted_invoice_number || '-'}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Compte</h3>
                      <p className="mt-1 text-sm text-gray-900">{selectedTransaction.account_name || '-'}</p>
                      <p className="text-xs text-gray-500">{selectedTransaction.account_number || '-'}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Contrepartie</h3>
                      <p className="mt-1 text-sm text-gray-900">{selectedTransaction.counterparty_name || '-'}</p>
                      <p className="text-xs text-gray-500">{selectedTransaction.counterparty_address || '-'}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Statut</h3>
                      <div className="mt-1">
                        {getStatusBadge(selectedTransaction.status)}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Facture associée</h3>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedTransaction.invoice_id ? (
                          <span className="inline-flex items-center text-blue-600">
                            <LinkIcon className="h-4 w-4 mr-1" />
                            Facture associée
                          </span>
                        ) : (
                          <span className="text-gray-500">Aucune facture associée</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Raw data section */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Données brutes</h3>
                  
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-xs font-mono overflow-x-auto">
                    {selectedTransaction.raw_libelles && (
                      <div>
                        <span className="text-gray-500">Libellés:</span>
                        <pre className="mt-1 whitespace-pre-wrap">{selectedTransaction.raw_libelles}</pre>
                      </div>
                    )}
                    
                    {selectedTransaction.raw_details_mouvement && (
                      <div>
                        <span className="text-gray-500">Détails du mouvement:</span>
                        <pre className="mt-1 whitespace-pre-wrap">{selectedTransaction.raw_details_mouvement}</pre>
                      </div>
                    )}
                    
                    {selectedTransaction.raw_file_path && (
                      <div>
                        <span className="text-gray-500">Fichier source:</span>
                        <p className="mt-1">{selectedTransaction.raw_file_path}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  {selectedTransaction.status === 'unmatched' && (
                    <button
                      onClick={() => {
                        setIsModalOpen(false);
                        handleMatchTransaction(selectedTransaction);
                      }}
                      className="btn-primary mr-3"
                    >
                      Associer à une facture
                    </button>
                  )}
                  
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="btn-outline"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Match Transaction Modal */}
      <Dialog open={isMatchModalOpen} onClose={() => setIsMatchModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl">
            {selectedTransaction && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    Associer la transaction à une facture
                  </Dialog.Title>
                  <button
                    onClick={() => setIsMatchModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Détails de la transaction</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Date</p>
                      <p className="text-sm font-medium">{formatDate(selectedTransaction.transaction_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Montant</p>
                      <p className={`text-sm font-medium ${selectedTransaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(selectedTransaction.amount)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Communication</p>
                      <p className="text-sm">{selectedTransaction.communication || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Contrepartie</p>
                      <p className="text-sm">{selectedTransaction.counterparty_name || '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Sélectionner une facture</h3>
                  
                  {/* Search bar for invoices */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Rechercher une facture par numéro, client..."
                      value={modalInvoiceSearchTerm}
                      onChange={(e) => handleModalInvoiceSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  {isLoadingInvoices ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                    </div>
                  ) : filteredInvoices.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-600">Aucune facture en attente trouvée</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {filteredInvoices.map((invoice) => {
                        // Check if this invoice amount matches the transaction amount
                        const isExactMatch = Math.abs(invoice.amount - selectedTransaction.amount) < 0.01;
                        
                        return (
                          <div
                            key={invoice.id}
                            className={clsx(
                              "border rounded-lg p-3 cursor-pointer",
                              selectedInvoice === invoice.id
                                ? "border-primary-500 bg-primary-50"
                                : isExactMatch
                                  ? "border-green-300 bg-green-50 hover:border-green-400"
                                  : "border-gray-200 hover:border-gray-300"
                            )}
                            onClick={() => setSelectedInvoice(invoice.id)}
                          >
                            <div className="flex justify-between">
                              <div>
                                <p className="font-medium">{invoice.invoice_number}</p>
                                <p className="text-sm text-gray-600">
                                  {invoice.user.prenom} {invoice.user.nom}
                                </p>
                                <p className="text-xs text-gray-500">{invoice.user.email}</p>
                              </div>
                              <div className="text-right">
                                <p className={clsx(
                                  "font-medium",
                                  isExactMatch ? "text-green-600" : ""
                                )}>
                                  {formatCurrency(invoice.amount)}
                                  {isExactMatch && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Montant exact
                                    </span>
                                  )}
                                </p>
                                <div className="mt-1">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    <Clock className="h-3 w-3 mr-1" />
                                    En attente
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setIsMatchModalOpen(false)}
                    className="btn-outline"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmMatch}
                    disabled={!selectedInvoice || isProcessingTransaction}
                    className={`btn-primary ${(!selectedInvoice || isProcessingTransaction) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isProcessingTransaction ? (
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
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Upload CSV Modal */}
      <Dialog open={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-lg shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  Importer un fichier CSV
                </Dialog.Title>
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    id="csv-file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="csv-file" className="cursor-pointer">
                    <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-900">
                      {uploadFile ? uploadFile.name : 'Cliquez pour sélectionner un fichier'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Formats acceptés: CSV, TXT
                    </p>
                  </label>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex">
                    <Info className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-700 font-medium">Format attendu</p>
                      <p className="text-xs text-blue-600 mt-1">
                        Le fichier doit contenir les colonnes suivantes: Numéro de compte, Nom du compte, Compte contrepartie, Numéro de mouvement, Date comptable, Date valeur, Montant, Devise, Libellés, Détails du mouvement
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="btn-outline"
                >
                  Annuler
                </button>
                <button
                  onClick={handleUploadCSV}
                  disabled={!uploadFile || isUploading}
                  className={`btn-primary ${(!uploadFile || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
};

export default AdminBankTransactionsPage;