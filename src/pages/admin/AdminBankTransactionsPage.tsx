import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  Loader2, AlertCircle, Filter, Search, CheckCircle, Clock, 
  Download, RefreshCw, Upload, Database, Link2, X, 
  FileText, ExternalLink
} from 'lucide-react';
import { Dialog } from '@headlessui/react';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

interface Transaction {
  id: string;
  transaction_date: string;
  amount: number;
  currency: string;
  bank_reference: string;
  communication: string;
  extracted_invoice_number: string | null;
  account_number: string;
  account_name: string;
  movement_number: string;
  counterparty_address: string;
  counterparty_name: string | null;
  status: 'unmatched' | 'matched' | 'partially_matched' | 'overpaid' | 'ignored';
  invoice_id: string | null;
  raw_file_path: string | null;
  import_batch_id: string | null;
  notes?: string;
  invoice?: {
    invoice_number: string;
    amount: number;
    status: string;
    user_id: string;
    user?: {
      prenom: string;
      nom: string;
      email: string;
    };
  };
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  user_id: string;
  user: {
    prenom: string;
    nom: string;
    email: string;
  };
}

interface ImportResult {
  success: boolean;
  message: string;
  batch_id: string;
  transactions: number;
}

const AdminBankTransactionsPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unmatched' | 'matched' | 'partially_matched' | 'ignored'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isTransactionDetailModalOpen, setIsTransactionDetailModalOpen] = useState(false);
  const [suggestedInvoices, setSuggestedInvoices] = useState<Invoice[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [transactionNotes, setTransactionNotes] = useState('');
  const [batches, setBatches] = useState<string[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [isConfirmLinkModalOpen, setIsConfirmLinkModalOpen] = useState(false);
  const [selectedInvoiceForLink, setSelectedInvoiceForLink] = useState<Invoice | null>(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [isSearchingInvoices, setIsSearchingInvoices] = useState(false);

  useEffect(() => {
    fetchTransactions();
    fetchBatches();
  }, []);

  // Effect to handle modal search term changes
  useEffect(() => {
    if (!modalSearchTerm || !selectedTransaction) return;
    
    const searchInvoices = async () => {
      setIsSearchingInvoices(true);
      try {
        // Search for invoices matching the search term
        const { data, error } = await supabase
          .from('invoices')
          .select('*, user:user_id(prenom, nom, email)')
          .or(`invoice_number.ilike.%${modalSearchTerm}%,communication.ilike.%${modalSearchTerm}%`)
          .eq('status', 'pending')
          .limit(10);
        
        if (error) throw error;
        
        // If no results by invoice number, try searching by user details
        if (!data || data.length === 0) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .or(`prenom.ilike.%${modalSearchTerm}%,nom.ilike.%${modalSearchTerm}%,email.ilike.%${modalSearchTerm}%`)
            .limit(10);
          
          if (userError) throw userError;
          
          if (userData && userData.length > 0) {
            const userIds = userData.map(u => u.id);
            const { data: invoicesByUser, error: invoiceError } = await supabase
              .from('invoices')
              .select('*, user:user_id(prenom, nom, email)')
              .in('user_id', userIds)
              .eq('status', 'pending')
              .limit(10);
            
            if (invoiceError) throw invoiceError;
            
            setSuggestedInvoices(invoicesByUser || []);
          } else {
            setSuggestedInvoices([]);
          }
        } else {
          setSuggestedInvoices(data);
        }
      } catch (error) {
        console.error('Error searching invoices:', error);
        toast.error('Erreur lors de la recherche de factures');
      } finally {
        setIsSearchingInvoices(false);
      }
    };
    
    const timeoutId = setTimeout(() => {
      searchInvoices();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [modalSearchTerm, selectedTransaction]);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let query = supabase
        .from('bank_transactions')
        .select(`
          *,
          invoice:invoice_id(
            invoice_number,
            amount,
            status,
            user_id
          )
        `)
        .order('transaction_date', { ascending: false });
        
      // Apply batch filter if selected
      if (selectedBatch) {
        query = query.eq('import_batch_id', selectedBatch);
      }
        
      const { data, error } = await query;
        
      if (error) throw error;
      
      // For each transaction with an invoice, fetch the user details separately
      const transactionsWithUserDetails = await Promise.all((data || []).map(async (transaction) => {
        if (transaction.invoice && transaction.invoice.user_id) {
          try {
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('prenom, nom, email')
              .eq('id', transaction.invoice.user_id)
              .single();
              
            if (!userError && userData) {
              return {
                ...transaction,
                invoice: {
                  ...transaction.invoice,
                  user: userData
                }
              };
            }
          } catch (err) {
            console.error('Error fetching user details:', err);
          }
        }
        return transaction;
      }));
      
      setTransactions(transactionsWithUserDetails);
    } catch (err: any) {
      console.error('Error fetching bank transactions:', err);
      setError(err.message || 'Une erreur est survenue lors du chargement des transactions.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBatches = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('import_batch_id')
        .not('import_batch_id', 'is', null)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      // Get unique batch IDs
      const uniqueBatches = [...new Set(data?.map(tx => tx.import_batch_id).filter(Boolean))];
      setBatches(uniqueBatches as string[]);
    } catch (err) {
      console.error('Error fetching batches:', err);
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
        .from('csv-files')
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-csv-file`,
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
      
      // Refresh transactions list and batches
      fetchTransactions();
      fetchBatches();
      
      // Close the modal automatically after successful import
      setIsImportModalOpen(false);
      
      // Show success toast with transaction count
      toast.success(`Importation réussie: ${result.transactions} transactions importées`);
    } catch (error: any) {
      console.error('Error importing file:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleViewTransactionDetails = async (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setTransactionNotes(transaction.notes || '');
    setIsTransactionDetailModalOpen(true);
    setModalSearchTerm('');
    
    // Find suggested invoices
    try {
      setIsLoadingSuggestions(true);
      
      // Look for invoices with similar communication, amount, or extracted invoice number
      let query = supabase
        .from('invoices')
        .select('*, user:user_id(prenom, nom, email)')
        .eq('status', 'pending');
      
      // If we have an extracted invoice number, prioritize that match
      if (transaction.extracted_invoice_number) {
        query = query.or(`invoice_number.eq.${transaction.extracted_invoice_number},amount.eq.${transaction.amount}`);
      } 
      // Otherwise try to match by amount or communication
      else {
        query = query.or(`amount.eq.${transaction.amount},communication.ilike.%${transaction.communication}%,invoice_number.ilike.%${transaction.communication}%`);
      }
      
      // Limit results
      query = query.limit(10);
      
      const { data, error } = await query;
        
      if (error) throw error;
      
      setSuggestedInvoices(data || []);
    } catch (err) {
      console.error('Error fetching suggested invoices:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleConfirmLinkToInvoice = (invoice: Invoice) => {
    setSelectedInvoiceForLink(invoice);
    setIsConfirmLinkModalOpen(true);
  };

  const handleLinkToInvoice = async () => {
    if (!selectedTransaction || !selectedInvoiceForLink) return;
    
    try {
      // First update the transaction to link it to the invoice
      const { error: updateError } = await supabase
        .from('bank_transactions')
        .update({ 
          invoice_id: selectedInvoiceForLink.id,
          status: 'matched',
          notes: transactionNotes || 'Manually linked by admin'
        })
        .eq('id', selectedTransaction.id);

      if (updateError) throw updateError;
      
      // Then update the invoice status to paid
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ 
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', selectedInvoiceForLink.id);

      if (invoiceError) throw invoiceError;
      
      // Finally update all registrations linked to this invoice
      const { error: registrationError } = await supabase
        .from('registrations')
        .update({ payment_status: 'paid' })
        .eq('invoice_id', selectedInvoiceForLink.invoice_number);

      if (registrationError) throw registrationError;
      
      toast.success('Transaction liée à la facture avec succès');
      setIsConfirmLinkModalOpen(false);
      setIsTransactionDetailModalOpen(false);
      fetchTransactions();
    } catch (error: any) {
      console.error('Error linking transaction to invoice:', error);
      toast.error(`Erreur: ${error.message}`);
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
      setIsLoading(true);
      
      // Call the function to match all unmatched transactions
      const { data, error } = await supabase.rpc('match_all_unmatched_transactions');
      
      if (error) throw error;
      
      // Refresh data
      fetchTransactions();
      
      toast.success(`${data} transactions ont été automatiquement associées`);
    } catch (err: any) {
      console.error('Error running auto-match:', err);
      toast.error(`Erreur: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
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
        'Devise',
        'Communication',
        'Numéro de facture',
        'Numéro de mouvement',
        'Compte',
        'Nom du compte',
        'Contrepartie',
        'Adresse contrepartie',
        'Référence',
        'Statut',
        'Facture liée',
        'Notes'
      ];
      
      const rows = filteredData.map(tx => [
        new Date(tx.transaction_date).toLocaleDateString('fr-FR'),
        tx.amount,
        tx.currency,
        `"${tx.communication?.replace(/"/g, '""') || ''}"`,
        `"${tx.extracted_invoice_number?.replace(/"/g, '""') || ''}"`,
        `"${tx.movement_number?.replace(/"/g, '""') || ''}"`,
        `"${tx.account_number?.replace(/"/g, '""') || ''}"`,
        `"${tx.account_name?.replace(/"/g, '""') || ''}"`,
        `"${tx.counterparty_name?.replace(/"/g, '""') || ''}"`,
        `"${tx.counterparty_address?.replace(/"/g, '""') || ''}"`,
        `"${tx.bank_reference?.replace(/"/g, '""') || ''}"`,
        tx.status,
        tx.invoice?.invoice_number || '',
        `"${tx.notes?.replace(/"/g, '""') || ''}"`
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

  // Filter and search transactions
  const filteredTransactions = transactions
    .filter(tx => {
      if (filter === 'all') return true;
      return tx.status === filter;
    })
    .filter(tx => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        tx.communication?.toLowerCase().includes(searchLower) ||
        tx.extracted_invoice_number?.toLowerCase().includes(searchLower) ||
        tx.account_name?.toLowerCase().includes(searchLower) ||
        tx.counterparty_name?.toLowerCase().includes(searchLower) ||
        tx.account_number?.toLowerCase().includes(searchLower) ||
        tx.bank_reference?.toLowerCase().includes(searchLower) ||
        tx.movement_number?.toLowerCase().includes(searchLower) ||
        tx.counterparty_address?.toLowerCase().includes(searchLower) ||
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
            onClick={() => setIsImportModalOpen(true)}
            className="btn-outline flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importer CSV
          </button>
          <button
            onClick={handleRunAutoMatch}
            disabled={isLoading}
            className="btn-outline flex items-center"
          >
            <Link2 className="h-4 w-4 mr-2" />
            Association auto
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
            <option value="unmatched">Non associées</option>
            <option value="matched">Associées</option>
            <option value="partially_matched">Partiellement associées</option>
            <option value="ignored">Ignorées</option>
          </select>
        </div>
        
        {batches.length > 0 && (
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-gray-500" />
            <select
              className="form-input py-2"
              value={selectedBatch || ''}
              onChange={(e) => {
                setSelectedBatch(e.target.value || null);
                // Refresh transactions when batch changes
                setTimeout(() => fetchTransactions(), 100);
              }}
            >
              <option value="">Tous les lots</option>
              {batches.map(batch => (
                <option key={batch} value={batch}>
                  {batch.replace('batch-', 'Lot ')}
                </option>
              ))}
            </select>
          </div>
        )}
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
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <p className="text-gray-600 mb-4">
            {searchTerm || filter !== 'all' || selectedBatch
              ? 'Aucune transaction ne correspond à vos critères.'
              : 'Aucune transaction bancaire trouvée.'}
          </p>
          <button
            onClick={() => setIsImportModalOpen(true)}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Numéro de facture
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Communication
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Numéro de mouvement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Compte contrepartie
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {transaction.extracted_invoice_number || 
                          <span className="text-gray-400 italic">Non extrait</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={transaction.communication}>
                        {transaction.communication || <span className="text-gray-400 italic">Aucune communication</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {transaction.movement_number || <span className="text-gray-400 italic">-</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {transaction.counterparty_name || <span className="text-gray-400 italic">Inconnu</span>}
                      </div>
                      <div className="text-xs text-gray-500">
                        {transaction.counterparty_address || <span className="text-gray-400 italic">-</span>}
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
                        <FileText className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import CSV File Modal */}
      <Dialog
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
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
                Sélectionnez un fichier CSV à importer. Le système tentera d'associer automatiquement les transactions aux factures.
              </p>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-file-input"
                />
                <label
                  htmlFor="csv-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center"
                >
                  <Upload className="h-10 w-10 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedFile ? selectedFile.name : "Cliquez pour sélectionner un fichier"}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {selectedFile ? `${(selectedFile.size / 1024).toFixed(2)} KB` : "Format .CSV"}
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
                    <h3 className="text-sm font-medium text-gray-500">Numéro de facture extrait</h3>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedTransaction.extracted_invoice_number || 
                        <span className="italic text-gray-400">Non extrait</span>}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Communication</h3>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedTransaction.communication || <span className="italic text-gray-400">Aucune communication</span>}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Numéro de mouvement</h3>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedTransaction.movement_number || <span className="italic text-gray-400">Non renseigné</span>}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Notre compte</h3>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedTransaction.account_name || <span className="italic text-gray-400">Nom inconnu</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedTransaction.account_number || <span className="italic">Numéro inconnu</span>}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Compte contrepartie</h3>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedTransaction.counterparty_address || <span className="italic text-gray-400">Non renseignée</span>}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Contrepartie</h3>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedTransaction.counterparty_name || <span className="italic text-gray-400">Non renseigné</span>}
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
                        <p className="font-medium">{selectedTransaction.invoice.invoice_number}</p>
                        <p className="text-sm text-gray-600">
                          {selectedTransaction.invoice.user?.prenom} {selectedTransaction.invoice.user?.nom}
                        </p>
                        <p className="text-sm text-gray-600">{selectedTransaction.invoice.user?.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{selectedTransaction.invoice.amount} €</p>
                        <p className="text-xs">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            selectedTransaction.invoice.status === 'paid' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {selectedTransaction.invoice.status === 'paid' ? 'Payée' : 'En attente'}
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
                    
                    {/* Search input for invoices */}
                    <div className="relative mb-4">
                      <input
                        type="text"
                        placeholder="Rechercher une facture..."
                        value={modalSearchTerm}
                        onChange={(e) => setModalSearchTerm(e.target.value)}
                        className="form-input pl-10 w-full"
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                    </div>
                    
                    {isLoadingSuggestions || isSearchingInvoices ? (
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
                                <p className="text-xs text-gray-500">
                                  {invoice.user?.email}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">{invoice.amount} €</p>
                                <button
                                  onClick={() => handleConfirmLinkToInvoice(invoice)}
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

      {/* Confirm Link Modal */}
      <Dialog
        open={isConfirmLinkModalOpen}
        onClose={() => setIsConfirmLinkModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Confirmer l'association
            </Dialog.Title>

            {selectedTransaction && selectedInvoiceForLink && (
              <div className="space-y-4">
                <p className="text-gray-600">
                  Êtes-vous sûr de vouloir associer cette transaction à la facture suivante ?
                </p>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Transaction</p>
                      <p className="font-medium">{selectedTransaction.amount} €</p>
                      <p className="text-sm text-gray-600">
                        {new Date(selectedTransaction.transaction_date).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Facture</p>
                      <p className="font-medium">{selectedInvoiceForLink.invoice_number}</p>
                      <p className="text-sm text-gray-600">{selectedInvoiceForLink.amount} €</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-yellow-700 font-medium">Important</p>
                      <p className="text-sm text-yellow-600">
                        Cette action marquera la facture comme payée et mettra à jour toutes les inscriptions associées.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsConfirmLinkModalOpen(false)}
                    className="btn-outline"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleLinkToInvoice}
                    className="btn-primary"
                  >
                    Confirmer l'association
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