import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Loader2, 
  AlertCircle, 
  Filter, 
  Search, 
  RefreshCw, 
  FileText, 
  Download, 
  Link as LinkIcon,
  Check,
  X,
  Calendar,
  CreditCard,
  ArrowLeft,
  ArrowRight,
  Upload,
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
  raw_libelles: string | null;
  raw_details_mouvement: string | null;
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
  user_id: string;
  user?: {
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
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchTransactions();
  }, [filter, currentPage]);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Build the base query with pagination
      let query = supabase
        .from('bank_transactions')
        .select(`
          *,
          invoice:invoices!bank_transactions_invoice_id_fkey(
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
        query = query.or(`communication.ilike.%${searchTerm.trim()}%,counterparty_name.ilike.%${searchTerm.trim()}%,extracted_invoice_number.ilike.%${searchTerm.trim()}%`);
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
      setError(err.message || 'An error occurred while fetching transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          status,
          user_id,
          user:users!invoices_user_id_fkey(
            prenom,
            nom,
            email
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPendingInvoices(data || []);
    } catch (err: any) {
      console.error('Error fetching pending invoices:', err);
      toast.error('Failed to fetch pending invoices');
    }
  };

  const handleViewDetails = (transaction: BankTransaction) => {
    setSelectedTransaction(transaction);
    setIsDetailsModalOpen(true);
  };

  const handleLinkToInvoice = async (transaction: BankTransaction) => {
    setSelectedTransaction(transaction);
    await fetchPendingInvoices();
    setIsLinkModalOpen(true);
  };

  const handleConfirmLink = async () => {
    if (!selectedTransaction || !selectedInvoiceId) return;
    
    setIsProcessing(true);
    
    try {
      // Call the match_transaction_to_invoice function
      const { data, error } = await supabase.rpc('match_transaction_to_invoice', {
        transaction_id: selectedTransaction.id,
        invoice_id: selectedInvoiceId
      });
      
      if (error) throw error;
      
      toast.success('Transaction linked to invoice successfully');
      setIsLinkModalOpen(false);
      fetchTransactions();
    } catch (err: any) {
      console.error('Error linking transaction to invoice:', err);
      toast.error('Failed to link transaction to invoice');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleIgnoreTransaction = async (transaction: BankTransaction) => {
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ status: 'ignored' })
        .eq('id', transaction.id);
      
      if (error) throw error;
      
      toast.success('Transaction marked as ignored');
      fetchTransactions();
    } catch (err: any) {
      console.error('Error ignoring transaction:', err);
      toast.error('Failed to ignore transaction');
    }
  };

  const handleUnignoreTransaction = async (transaction: BankTransaction) => {
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ status: 'unmatched' })
        .eq('id', transaction.id);
      
      if (error) throw error;
      
      toast.success('Transaction unmarked as ignored');
      fetchTransactions();
    } catch (err: any) {
      console.error('Error unignoring transaction:', err);
      toast.error('Failed to unignore transaction');
    }
  };

  const handleUploadCSV = async () => {
    if (!uploadFile) {
      toast.error('Please select a file to upload');
      return;
    }
    
    setIsUploading(true);
    
    try {
      // First upload the file to storage
      const fileName = `${Date.now()}_${uploadFile.name}`;
      const filePath = `imports/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('csv-files')
        .upload(filePath, uploadFile);
      
      if (uploadError) throw uploadError;
      
      // Then call the process-csv-file function
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No active session');
      }
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-csv-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ filePath })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process CSV file');
      }
      
      const result = await response.json();
      
      toast.success(`Processed ${result.transactions} transactions successfully`);
      setIsUploadModalOpen(false);
      setUploadFile(null);
      fetchTransactions();
    } catch (err: any) {
      console.error('Error uploading CSV file:', err);
      toast.error(err.message || 'Failed to upload CSV file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchTransactions();
  };

  const handleReconcileAll = async () => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.rpc('reconcile_all_pending_invoices');
      
      if (error) throw error;
      
      toast.success(`Reconciliation completed: ${data.success_count} invoices processed, ${data.error_count} errors`);
      fetchTransactions();
    } catch (err: any) {
      console.error('Error reconciling invoices:', err);
      toast.error('Failed to reconcile invoices');
    } finally {
      setIsProcessing(false);
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
            <Check className="h-3 w-3 mr-1" />
            Matched
          </span>
        );
      case 'partially_matched':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Partially Matched
          </span>
        );
      case 'overpaid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Info className="h-3 w-3 mr-1" />
            Overpaid
          </span>
        );
      case 'ignored':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <X className="h-3 w-3 mr-1" />
            Ignored
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Unmatched
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bank Transactions</h1>
          <p className="text-gray-600">Manage and reconcile bank transactions with invoices</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="btn-outline flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
          </button>
          <button
            onClick={handleReconcileAll}
            disabled={isProcessing}
            className="btn-outline flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
            Reconcile All
          </button>
          <button
            onClick={fetchTransactions}
            disabled={isLoading}
            className="btn-primary flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
        <div className="relative flex-grow">
          <input
            type="text"
            placeholder="Search by communication, counterparty, or invoice number..."
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
            <option value="all">All Transactions</option>
            <option value="unmatched">Unmatched</option>
            <option value="matched">Matched</option>
            <option value="partially_matched">Partially Matched</option>
            <option value="overpaid">Overpaid</option>
            <option value="ignored">Ignored</option>
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
              ? 'No transactions match your search criteria.'
              : 'No transactions found. Upload a CSV file to import transactions.'}
          </p>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="btn-primary inline-flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
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
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Communication
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Counterparty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className={clsx(
                    "hover:bg-gray-50",
                    transaction.status === 'matched' && "bg-green-50",
                    transaction.status === 'partially_matched' && "bg-yellow-50",
                    transaction.status === 'overpaid' && "bg-blue-50",
                    transaction.status === 'ignored' && "bg-gray-50"
                  )}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(transaction.transaction_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={clsx(
                        "text-sm font-medium",
                        transaction.amount > 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(transaction.amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {transaction.communication || 
                         (transaction.extracted_invoice_number && 
                          <span className="text-blue-600">{transaction.extracted_invoice_number}</span>) || 
                         <span className="text-gray-400 italic">No communication</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {transaction.counterparty_name || <span className="text-gray-400 italic">Unknown</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(transaction.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {transaction.invoice ? (
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {transaction.invoice.invoice_number}
                          </div>
                          <div className="text-gray-500">
                            {formatCurrency(transaction.invoice.amount)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Not linked</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleViewDetails(transaction)}
                          className="text-primary-600 hover:text-primary-900"
                          title="View Details"
                        >
                          <FileText className="h-5 w-5" />
                        </button>
                        
                        {transaction.status === 'unmatched' && (
                          <>
                            <button
                              onClick={() => handleLinkToInvoice(transaction)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Link to Invoice"
                            >
                              <LinkIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleIgnoreTransaction(transaction)}
                              className="text-gray-600 hover:text-gray-900"
                              title="Ignore Transaction"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </>
                        )}
                        
                        {transaction.status === 'ignored' && (
                          <button
                            onClick={() => handleUnignoreTransaction(transaction)}
                            className="text-green-600 hover:text-green-900"
                            title="Unignore Transaction"
                          >
                            <Check className="h-5 w-5" />
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
                  Previous
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
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * itemsPerPage, totalCount)}
                    </span>{' '}
                    of <span className="font-medium">{totalCount}</span> results
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
                      <span className="sr-only">Previous</span>
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
                      <span className="sr-only">Next</span>
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
        open={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

          <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-auto p-6">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Transaction Details
            </Dialog.Title>

            {selectedTransaction && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Transaction Information</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Date</p>
                          <p className="font-medium">{formatDate(selectedTransaction.transaction_date)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Amount</p>
                          <p className={clsx(
                            "font-medium",
                            selectedTransaction.amount > 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {formatCurrency(selectedTransaction.amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Status</p>
                          <div>{getStatusBadge(selectedTransaction.status)}</div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Movement Number</p>
                          <p className="font-medium">{selectedTransaction.movement_number || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Counterparty Information</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-500">Name</p>
                          <p className="font-medium">{selectedTransaction.counterparty_name || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Account</p>
                          <p className="font-medium">{selectedTransaction.account_number || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Address</p>
                          <p className="font-medium">{selectedTransaction.counterparty_address || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Communication</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium break-words">{selectedTransaction.communication || '-'}</p>
                    {selectedTransaction.extracted_invoice_number && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500">Extracted Invoice Number</p>
                        <p className="font-medium text-blue-600">{selectedTransaction.extracted_invoice_number}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {selectedTransaction.invoice && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Linked Invoice</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Invoice Number</p>
                          <p className="font-medium">{selectedTransaction.invoice.invoice_number}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Amount</p>
                          <p className="font-medium">{formatCurrency(selectedTransaction.invoice.amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Status</p>
                          <p className="font-medium">{selectedTransaction.invoice.status}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Difference</p>
                          <p className={clsx(
                            "font-medium",
                            selectedTransaction.amount - selectedTransaction.invoice.amount > 0 
                              ? "text-green-600" 
                              : selectedTransaction.amount - selectedTransaction.invoice.amount < 0
                              ? "text-red-600"
                              : "text-gray-900"
                          )}>
                            {formatCurrency(selectedTransaction.amount - selectedTransaction.invoice.amount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedTransaction.raw_libelles && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Raw Transaction Data</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-500">Libellés</p>
                          <p className="text-sm break-words">{selectedTransaction.raw_libelles}</p>
                        </div>
                        {selectedTransaction.raw_details_mouvement && (
                          <div>
                            <p className="text-xs text-gray-500">Détails du mouvement</p>
                            <p className="text-sm break-words">{selectedTransaction.raw_details_mouvement}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={() => setIsDetailsModalOpen(false)}
                    className="btn-outline"
                  >
                    Close
                  </button>
                  
                  {selectedTransaction.status === 'unmatched' && (
                    <>
                      <button
                        onClick={() => {
                          setIsDetailsModalOpen(false);
                          handleLinkToInvoice(selectedTransaction);
                        }}
                        className="btn-primary"
                      >
                        Link to Invoice
                      </button>
                      <button
                        onClick={() => {
                          handleIgnoreTransaction(selectedTransaction);
                          setIsDetailsModalOpen(false);
                        }}
                        className="btn-outline bg-gray-100"
                      >
                        Ignore
                      </button>
                    </>
                  )}
                  
                  {selectedTransaction.status === 'ignored' && (
                    <button
                      onClick={() => {
                        handleUnignoreTransaction(selectedTransaction);
                        setIsDetailsModalOpen(false);
                      }}
                      className="btn-primary"
                    >
                      Unignore
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      {/* Link to Invoice Modal */}
      <Dialog
        open={isLinkModalOpen}
        onClose={() => !isProcessing && setIsLinkModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-auto p-6">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Link Transaction to Invoice
            </Dialog.Title>

            {selectedTransaction && (
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Date</p>
                      <p className="font-medium">{formatDate(selectedTransaction.transaction_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Amount</p>
                      <p className={clsx(
                        "font-medium",
                        selectedTransaction.amount > 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(selectedTransaction.amount)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Communication</p>
                      <p className="font-medium break-words">{selectedTransaction.communication || '-'}</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Invoice
                  </label>
                  <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md">
                    {pendingInvoices.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        No pending invoices found
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {pendingInvoices.map((invoice) => (
                          <div
                            key={invoice.id}
                            className={clsx(
                              "p-3 cursor-pointer hover:bg-gray-50",
                              selectedInvoiceId === invoice.id && "bg-primary-50 border-l-4 border-primary-500"
                            )}
                            onClick={() => setSelectedInvoiceId(invoice.id)}
                          >
                            <div className="flex justify-between">
                              <div>
                                <p className="font-medium">{invoice.invoice_number}</p>
                                <p className="text-sm text-gray-600">
                                  {invoice.user?.prenom} {invoice.user?.nom}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{formatCurrency(invoice.amount)}</p>
                                <p className={clsx(
                                  "text-sm",
                                  selectedTransaction.amount - invoice.amount > 0 
                                    ? "text-green-600" 
                                    : selectedTransaction.amount - invoice.amount < 0
                                    ? "text-red-600"
                                    : "text-gray-600"
                                )}>
                                  Difference: {formatCurrency(selectedTransaction.amount - invoice.amount)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={() => setIsLinkModalOpen(false)}
                    className="btn-outline"
                    disabled={isProcessing}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmLink}
                    disabled={!selectedInvoiceId || isProcessing}
                    className={clsx(
                      "btn-primary",
                      (!selectedInvoiceId || isProcessing) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isProcessing ? (
                      <span className="flex items-center">
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        Processing...
                      </span>
                    ) : (
                      'Link to Invoice'
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
            <Dialog.Title className="text-lg font-semibold mb-4">
              Upload CSV File
            </Dialog.Title>

            <div className="space-y-4">
              <p className="text-gray-600">
                Upload a CSV file containing bank transactions. The file should be in the format exported from your bank.
              </p>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer flex flex-col items-center justify-center"
                >
                  <Upload className="h-10 w-10 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700">
                    {uploadFile ? uploadFile.name : 'Click to select a file'}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    CSV or TXT file, max 10MB
                  </span>
                </label>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setUploadFile(null);
                  }}
                  className="btn-outline"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadCSV}
                  disabled={!uploadFile || isUploading}
                  className={clsx(
                    "btn-primary",
                    (!uploadFile || isUploading) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isUploading ? (
                    <span className="flex items-center">
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                      Uploading...
                    </span>
                  ) : (
                    'Upload'
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