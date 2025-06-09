import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertCircle, Filter, Search, CheckCircle, XCircle, RefreshCw, FileText, Clock, ExternalLink, Download } from 'lucide-react';
import { Dialog } from '@headlessui/react';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

interface CancellationRequest {
  id: string;
  created_at: string;
  user_id: string;
  registration_id: string;
  kid_id: string;
  activity_id: string;
  request_date: string;
  status: 'pending' | 'approved' | 'rejected';
  parent_notes: string | null;
  admin_notes: string | null;
  refund_type: 'full' | 'partial' | 'none' | null;
  credit_note_id: string | null;
  credit_note_url: string | null;
  registration: {
    amount_paid: number;
    payment_status: string;
    invoice_id: string | null;
  };
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
  user: {
    email: string;
    prenom: string;
    nom: string;
    telephone: string;
  };
}

const AdminCancellationRequestsPage = () => {
  const [requests, setRequests] = useState<CancellationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedRequest, setSelectedRequest] = useState<CancellationRequest | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [refundType, setRefundType] = useState<'full' | 'partial' | 'none'>('none');
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  
  useEffect(() => {
    fetchRequests();
  }, []);
  
  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('cancellation_requests')
        .select(`
          *,
          registration:registration_id(
            amount_paid,
            payment_status,
            invoice_id
          ),
          kid:kid_id(
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
          ),
          user:user_id(
            email,
            prenom,
            nom,
            telephone
          )
        `)
        .order('request_date', { ascending: false });
      
      if (error) throw error;
      setRequests(data || []);
    } catch (err: any) {
      console.error('Error fetching cancellation requests:', err);
      setError(err.message || 'Une erreur est survenue lors du chargement des demandes.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleViewDetails = (request: CancellationRequest) => {
    setSelectedRequest(request);
    setAdminNotes(request.admin_notes || '');
    setRefundType(request.refund_type || 'none');
    setIsDetailsModalOpen(true);
  };
  
  const handleApprove = async () => {
    if (!selectedRequest) return;
    
    try {
      setProcessingRequestId(selectedRequest.id);
      
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error('Erreur lors de la récupération de la session: ' + sessionError.message);
      }
      
      if (!session?.access_token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      
      // Call our Edge Function to process the cancellation approval
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-cancellation-approval`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            cancellationRequestId: selectedRequest.id,
            refundType: refundType,
            adminNotes: adminNotes
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Une erreur est survenue lors du traitement de la demande.');
      }
      
      const responseData = await response.json();
      
      toast.success('Demande approuvée et traitement effectué');
      setIsApproveModalOpen(false);
      await fetchRequests();
      
      // If a credit note was created, show additional success message
      if (responseData.creditNoteUrl) {
        toast.success('Note de crédit générée et envoyée par email');
      }
    } catch (error: any) {
      console.error('Error approving cancellation request:', error);
      toast.error('Une erreur est survenue: ' + error.message);
    } finally {
      setProcessingRequestId(null);
    }
  };
  
  const handleReject = async () => {
    if (!selectedRequest) return;
    
    try {
      setProcessingRequestId(selectedRequest.id);
      
      const { error } = await supabase
        .from('cancellation_requests')
        .update({
          status: 'rejected',
          admin_notes: adminNotes
        })
        .eq('id', selectedRequest.id);
      
      if (error) throw error;
      
      toast.success('Demande rejetée');
      setIsRejectModalOpen(false);
      await fetchRequests();
    } catch (error: any) {
      console.error('Error rejecting cancellation request:', error);
      toast.error('Une erreur est survenue: ' + error.message);
    } finally {
      setProcessingRequestId(null);
    }
  };
  
  const handleSaveNotes = async () => {
    if (!selectedRequest) return;
    
    try {
      setProcessingRequestId(selectedRequest.id);
      
      const { error } = await supabase
        .from('cancellation_requests')
        .update({
          admin_notes: adminNotes
        })
        .eq('id', selectedRequest.id);
      
      if (error) throw error;
      
      toast.success('Notes enregistrées');
      setIsDetailsModalOpen(false);
      await fetchRequests();
    } catch (error: any) {
      console.error('Error saving notes:', error);
      toast.error('Une erreur est survenue: ' + error.message);
    } finally {
      setProcessingRequestId(null);
    }
  };
  
  const handleDownloadCreditNote = (url: string, creditNoteId: string) => {
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.download = `note_credit_${creditNoteId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Filter and search requests
  const filteredRequests = requests
    .filter(req => {
      if (filter === 'all') return true;
      return req.status === filter;
    })
    .filter(req => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      
      return (
        req.kid?.prenom?.toLowerCase().includes(searchLower) ||
        req.kid?.nom?.toLowerCase().includes(searchLower) ||
        req.user?.prenom?.toLowerCase().includes(searchLower) ||
        req.user?.nom?.toLowerCase().includes(searchLower) ||
        req.user?.email?.toLowerCase().includes(searchLower) ||
        req.session?.stage?.title?.toLowerCase().includes(searchLower)
      );
    });
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            En attente
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approuvée
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Rejetée
          </span>
        );
      default:
        return null;
    }
  };
  
  const getRefundTypeBadge = (type: string | null) => {
    if (!type) return null;
    
    switch (type) {
      case 'full':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Remboursement complet
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Remboursement partiel
          </span>
        );
      case 'none':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Aucun remboursement
          </span>
        );
      default:
        return null;
    }
  };
  
  // Calculate if a request is within 10 days of the start date
  const isWithin10Days = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = start.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 10;
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Demandes d'annulation</h1>
          <p className="text-gray-600">Gérez les demandes d'annulation d'inscriptions</p>
        </div>
        
        <button
          onClick={fetchRequests}
          className="btn-primary flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </button>
      </div>
      
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
            <option value="all">Toutes</option>
            <option value="pending">En attente</option>
            <option value="approved">Approuvées</option>
            <option value="rejected">Rejetées</option>
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
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <p className="text-gray-600 mb-4">
            {searchTerm || filter !== 'all'
              ? 'Aucune demande ne correspond à vos critères.'
              : 'Aucune demande d\'annulation trouvée.'}
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
                    Enfant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activité
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dates
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map((request) => {
                  const within10Days = isWithin10Days(request.session.start_date);
                  
                  return (
                    <tr key={request.id} className={clsx(
                      "hover:bg-gray-50",
                      request.status === 'pending' && "bg-yellow-50"
                    )}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(request.request_date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {request.kid?.prenom} {request.kid?.nom}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {request.user?.prenom} {request.user?.nom}
                        </div>
                        <div className="text-sm text-gray-500">
                          {request.user?.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {request.session?.stage.title}
                        </div>
                        <div className="text-sm text-gray-500">
                          {request.session?.center.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(request.session.start_date).toLocaleDateString('fr-FR')}
                        </div>
                        <div className="text-sm text-gray-500">
                          au {new Date(request.session.end_date).toLocaleDateString('fr-FR')}
                        </div>
                        {within10Days && (
                          <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                            < 10 jours
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {request.registration.amount_paid} €
                        </div>
                        <div className="text-sm text-gray-500">
                          {request.registration.payment_status === 'paid' ? 'Payé' : 'En attente'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(request.status)}
                        {request.refund_type && (
                          <div className="mt-1">
                            {getRefundTypeBadge(request.refund_type)}
                          </div>
                        )}
                        {request.credit_note_id && (
                          <div className="mt-1 text-xs text-gray-500">
                            Note de crédit: {request.credit_note_id}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleViewDetails(request)}
                            className="text-primary-600 hover:text-primary-900"
                            title="Voir les détails"
                          >
                            <FileText className="h-5 w-5" />
                          </button>
                          
                          {request.status === 'pending' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setAdminNotes(request.admin_notes || '');
                                  setRefundType(request.refund_type || 'none');
                                  setIsApproveModalOpen(true);
                                }}
                                className="text-green-600 hover:text-green-900"
                                title="Approuver"
                              >
                                <CheckCircle className="h-5 w-5" />
                              </button>
                              
                              <button
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setAdminNotes(request.admin_notes || '');
                                  setIsRejectModalOpen(true);
                                }}
                                className="text-red-600 hover:text-red-900"
                                title="Rejeter"
                              >
                                <XCircle className="h-5 w-5" />
                              </button>
                            </>
                          )}
                          
                          {request.credit_note_url && (
                            <div className="flex space-x-2">
                              <a
                                href={request.credit_note_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-900"
                                title="Voir la note de crédit"
                              >
                                <ExternalLink className="h-5 w-5" />
                              </a>
                              <button
                                onClick={() => handleDownloadCreditNote(request.credit_note_url!, request.credit_note_id!)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Télécharger la note de crédit"
                              >
                                <Download className="h-5 w-5" />
                              </button>
                            </div>
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
      
      {/* Details Modal */}
      <Dialog
        open={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />
          
          <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-auto p-6 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Détails de la demande d'annulation
            </Dialog.Title>
            
            {selectedRequest && (
              <div className="space-y-6">
                {/* Request Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Enfant</h3>
                    <p className="mt-1 text-sm text-gray-900">{selectedRequest.kid?.prenom} {selectedRequest.kid?.nom}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Parent</h3>
                    <p className="mt-1 text-sm text-gray-900">{selectedRequest.user?.prenom} {selectedRequest.user?.nom}</p>
                    <p className="text-sm text-gray-500">{selectedRequest.user?.email}</p>
                    <p className="text-sm text-gray-500">{selectedRequest.user?.telephone}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Activité</h3>
                    <p className="mt-1 text-sm text-gray-900">{selectedRequest.session?.stage.title}</p>
                    <p className="text-sm text-gray-500">{selectedRequest.session?.center.name}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Dates</h3>
                    <p className="mt-1 text-sm text-gray-900">
                      {new Date(selectedRequest.session.start_date).toLocaleDateString('fr-FR')} au {new Date(selectedRequest.session.end_date).toLocaleDateString('fr-FR')}
                    </p>
                    
                    {isWithin10Days(selectedRequest.session.start_date) && (
                      <p className="mt-1 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded inline-block">
                        Moins de 10 jours avant le début
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Paiement</h3>
                    <p className="mt-1 text-sm text-gray-900">{selectedRequest.registration.amount_paid} €</p>
                    <p className="text-sm text-gray-500">
                      Statut: {selectedRequest.registration.payment_status === 'paid' ? 'Payé' : 'En attente'}
                    </p>
                    {selectedRequest.registration.invoice_id && (
                      <p className="text-sm text-gray-500">
                        Facture: {selectedRequest.registration.invoice_id}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Statut de la demande</h3>
                    <div className="mt-1">
                      {getStatusBadge(selectedRequest.status)}
                    </div>
                    {selectedRequest.refund_type && (
                      <div className="mt-2">
                        {getRefundTypeBadge(selectedRequest.refund_type)}
                      </div>
                    )}
                    {selectedRequest.credit_note_id && (
                      <div className="mt-2 text-sm">
                        <p>Note de crédit: {selectedRequest.credit_note_id}</p>
                        {selectedRequest.credit_note_url && (
                          <div className="mt-1 flex space-x-2">
                            <a
                              href={selectedRequest.credit_note_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-800 flex items-center text-xs"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Voir
                            </a>
                            <button
                              onClick={() => handleDownloadCreditNote(selectedRequest.credit_note_url!, selectedRequest.credit_note_id!)}
                              className="text-primary-600 hover:text-primary-800 flex items-center text-xs"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Télécharger
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Notes du parent</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-700">
                      {selectedRequest.parent_notes || 'Aucune note fournie'}
                    </p>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Notes administratives</h3>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={4}
                    placeholder="Ajoutez vos notes ici..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setIsDetailsModalOpen(false)}
                    className="btn-outline"
                  >
                    Fermer
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={processingRequestId === selectedRequest.id}
                    className="btn-primary"
                  >
                    {processingRequestId === selectedRequest.id ? (
                      <span className="flex items-center">
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        Enregistrement...
                      </span>
                    ) : (
                      'Enregistrer les notes'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>
      
      {/* Approve Modal */}
      <Dialog
        open={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />
          
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Approuver la demande d'annulation
            </Dialog.Title>
            
            <p className="text-gray-600 mb-4">
              Êtes-vous sûr de vouloir approuver cette demande ? L'inscription sera annulée.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de remboursement
              </label>
              <select
                value={refundType}
                onChange={(e) => setRefundType(e.target.value as any)}
                className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="none">Aucun remboursement</option>
                <option value="partial">Remboursement partiel (50%)</option>
                <option value="full">Remboursement complet</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {refundType === 'full' ? 
                  'Une note de crédit sera générée pour le montant total.' : 
                  refundType === 'partial' ? 
                    'Une note de crédit sera générée pour 50% du montant.' : 
                    'Aucune note de crédit ne sera générée.'}
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optionnel)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                placeholder="Ajoutez vos notes ici..."
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="btn-outline"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={processingRequestId === selectedRequest?.id}
                className="btn-primary"
              >
                {processingRequestId === selectedRequest?.id ? (
                  <span className="flex items-center">
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Traitement...
                  </span>
                ) : (
                  'Approuver'
                )}
              </button>
            </div>
          </div>
        </div>
      </Dialog>
      
      {/* Reject Modal */}
      <Dialog
        open={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />
          
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Rejeter la demande d'annulation
            </Dialog.Title>
            
            <p className="text-gray-600 mb-4">
              Êtes-vous sûr de vouloir rejeter cette demande ? L'inscription restera active.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Raison du rejet
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                placeholder="Expliquez la raison du rejet..."
                required
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="btn-outline"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={processingRequestId === selectedRequest?.id || !adminNotes.trim()}
                className={`btn-primary bg-red-600 hover:bg-red-700 ${(!adminNotes.trim() || processingRequestId === selectedRequest?.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {processingRequestId === selectedRequest?.id ? (
                  <span className="flex items-center">
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Traitement...
                  </span>
                ) : (
                  'Rejeter'
                )}
              </button>
            </div>
          </div>
        </div>
      </Dialog>
      
      <Toaster position="top-right" />
    </div>
  );
};

export default AdminCancellationRequestsPage;