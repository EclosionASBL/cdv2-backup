import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useWaitingListStore } from '../../stores/waitingListStore';
import { Loader2, AlertCircle, Filter, Search, CheckCircle, XCircle, RefreshCw, FileText, Clock, ExternalLink, Download, Users, Link as LinkIcon } from 'lucide-react';
import { Dialog } from '@headlessui/react';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import WaitingListModal from '../../components/admin/WaitingListModal';

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
  registration?: {
    amount_paid: number;
    payment_status: string;
    invoice_id: string | null;
  } | null;
  kid?: {
    prenom: string;
    nom: string;
  } | null;
  session?: {
    stage: {
      title: string;
    };
    start_date: string;
    end_date: string;
    center: {
      name: string;
    };
  } | null;
  user?: {
    email: string;
    prenom: string;
    nom: string;
    telephone: string;
    adresse: string;
    cpostal: string;
    localite: string;
  } | null;
}

const AdminCancellationRequestsPage = () => {
  const [requests, setRequests] = useState<CancellationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<CancellationRequest | null>(null);
  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showWaitingListModal, setShowWaitingListModal] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  
  const { waitingListCounts, fetchWaitingListCount } = useWaitingListStore();

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('cancellation_requests')
        .select(`
          *,
          registration:registrations(amount_paid, payment_status, invoice_id),
          kid:kids(
            prenom, 
            nom
          ),
          session:sessions(
            stage:stages(title),
            start_date,
            end_date,
            center:centers(name)
          ),
          user:users(
            email, 
            prenom, 
            nom, 
            telephone, 
            adresse, 
            cpostal, 
            localite
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRequests(data || []);
      
      // Fetch waiting list counts for all unique activity IDs
      const activityIds = [...new Set(data?.map(req => req.activity_id) || [])];
      for (const activityId of activityIds) {
        await fetchWaitingListCount(activityId);
      }
    } catch (err) {
      console.error('Error fetching cancellation requests:', err);
      setError('Erreur lors du chargement des demandes d\'annulation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (request: CancellationRequest, refundType: 'full' | 'partial' | 'none', adminNotes?: string) => {
    try {
      setProcessing(true);

      // Update the cancellation request
      const { error: updateError } = await supabase
        .from('cancellation_requests')
        .update({
          status: 'approved',
          refund_type: refundType,
          admin_notes: adminNotes || null
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // Update the registration status
      const { error: regError } = await supabase
        .from('registrations')
        .update({ status: 'cancelled' })
        .eq('id', request.registration_id);

      if (regError) throw regError;

      toast.success('Demande d\'annulation approuvée avec succès');
      await fetchRequests();
      setSelectedRequest(null);
    } catch (err) {
      console.error('Error approving request:', err);
      toast.error('Erreur lors de l\'approbation de la demande');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (request: CancellationRequest, adminNotes: string) => {
    try {
      setProcessing(true);

      const { error } = await supabase
        .from('cancellation_requests')
        .update({
          status: 'rejected',
          admin_notes: adminNotes
        })
        .eq('id', request.id);

      if (error) throw error;

      toast.success('Demande d\'annulation rejetée');
      await fetchRequests();
      setSelectedRequest(null);
    } catch (err) {
      console.error('Error rejecting request:', err);
      toast.error('Erreur lors du rejet de la demande');
    } finally {
      setProcessing(false);
    }
  };

  const handleViewWaitingList = (activityId: string) => {
    setSelectedActivityId(activityId);
    setShowWaitingListModal(true);
  };

  const filteredRequests = requests.filter(request => {
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesSearch = !searchTerm || 
      request.kid?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.kid?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.session?.stage?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            En attente
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approuvée
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Rejetée
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchRequests}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Toaster position="top-right" />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Demandes d'annulation
        </h1>
        <p className="text-gray-600">
          Gérez les demandes d'annulation des inscriptions
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Rechercher par nom d'enfant, email parent ou activité..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="approved">Approuvées</option>
              <option value="rejected">Rejetées</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Aucune demande d'annulation trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Enfant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activité
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date demande
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Liste d'attente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {request.kid?.prenom} {request.kid?.nom}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {request.session?.stage?.title}
                      </div>
                      <div className="text-sm text-gray-500">
                        {request.session?.center?.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {request.session?.start_date && new Date(request.session.start_date).toLocaleDateString('fr-FR')} - {request.session?.end_date && new Date(request.session.end_date).toLocaleDateString('fr-FR')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {request.user?.prenom} {request.user?.nom}
                      </div>
                      <div className="text-sm text-gray-500">
                        {request.user?.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(request.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(request.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleViewWaitingList(request.activity_id)}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100"
                      >
                        <Users className="w-3 h-3 mr-1" />
                        {waitingListCounts[request.activity_id] || 0} en attente
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedRequest(request)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Voir détails
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Request Details Modal */}
      {selectedRequest && (
        <CancellationRequestModal
          request={selectedRequest}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setSelectedRequest(null)}
          processing={processing}
          waitingListCount={waitingListCounts[selectedRequest.activity_id] || 0}
          activityId={selectedRequest.activity_id}
          onViewWaitingList={() => handleViewWaitingList(selectedRequest.activity_id)}
        />
      )}

      {/* Waiting List Modal */}
      {showWaitingListModal && (
        <WaitingListModal
          activityId={selectedActivityId}
          onClose={() => setShowWaitingListModal(false)}
        />
      )}
    </div>
  );
};

// Modal Component for Request Details
const CancellationRequestModal = ({
  request,
  onApprove,
  onReject,
  onClose,
  processing,
  waitingListCount,
  activityId,
  onViewWaitingList
}: {
  request: CancellationRequest;
  onApprove: (request: CancellationRequest, refundType: 'full' | 'partial' | 'none', adminNotes?: string) => void;
  onReject: (request: CancellationRequest, adminNotes: string) => void;
  onClose: () => void;
  processing: boolean;
  waitingListCount: number;
  activityId: string;
  onViewWaitingList: () => void;
}) => {
  const [refundType, setRefundType] = useState<'full' | 'partial' | 'none'>('full');
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleApprove = () => {
    onApprove(request, refundType, adminNotes || undefined);
  };

  const handleReject = () => {
    if (!rejectNotes.trim()) {
      toast.error('Veuillez saisir une raison pour le rejet');
      return;
    }
    onReject(request, rejectNotes);
  };

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-4xl w-full bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <Dialog.Title className="text-xl font-semibold text-gray-900">
                Détails de la demande d'annulation
              </Dialog.Title>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Request Info */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Informations de la demande</h3>
                  
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-500">Statut:</span>
                      <div className="mt-1">
                        {request.status === 'pending' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock className="w-3 h-3 mr-1" />
                            En attente
                          </span>
                        )}
                        {request.status === 'approved' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Approuvée
                          </span>
                        )}
                        {request.status === 'rejected' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3 mr-1" />
                            Rejetée
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium text-gray-500">Date de demande:</span>
                      <p className="text-sm text-gray-900 mt-1">
                        {new Date(request.created_at).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>

                    {request.parent_notes && (
                      <div>
                        <span className="text-sm font-medium text-gray-500">Notes du parent:</span>
                        <p className="text-sm text-gray-900 mt-1 bg-white p-3 rounded border">
                          {request.parent_notes}
                        </p>
                      </div>
                    )}

                    {request.admin_notes && (
                      <div>
                        <span className="text-sm font-medium text-gray-500">Notes administrateur:</span>
                        <p className="text-sm text-gray-900 mt-1 bg-white p-3 rounded border">
                          {request.admin_notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Child Info */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Enfant</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm">
                      <span className="font-medium text-gray-500">Nom:</span> {request.kid?.prenom} {request.kid?.nom}
                    </p>
                  </div>
                </div>

                {/* Activity Info */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Activité</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <p className="text-sm">
                      <span className="font-medium text-gray-500">Stage:</span> {request.session?.stage?.title}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium text-gray-500">Centre:</span> {request.session?.center?.name}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium text-gray-500">Dates:</span> {' '}
                      {request.session?.start_date && new Date(request.session.start_date).toLocaleDateString('fr-FR')} - {' '}
                      {request.session?.end_date && new Date(request.session.end_date).toLocaleDateString('fr-FR')}
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={onViewWaitingList}
                        className="inline-flex items-center px-3 py-1 text-sm font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100"
                      >
                        <Users className="w-4 h-4 mr-1" />
                        {waitingListCount} en liste d'attente
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Parent & Payment Info */}
              <div className="space-y-6">
                {/* Parent Info */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Parent</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <p className="text-sm">
                      <span className="font-medium text-gray-500">Nom:</span> {request.user?.prenom} {request.user?.nom}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium text-gray-500">Email:</span> {request.user?.email}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium text-gray-500">Téléphone:</span> {request.user?.telephone}
                    </p>
                    {request.user?.adresse && (
                      <div className="text-sm">
                        <span className="font-medium text-gray-500">Adresse:</span>
                        <div className="mt-1">
                          {request.user.adresse}<br />
                          {request.user.cpostal} {request.user.localite}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Info */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Informations de paiement</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <p className="text-sm">
                      <span className="font-medium text-gray-500">Montant payé:</span> {' '}
                      {request.registration?.amount_paid ? `${request.registration.amount_paid}€` : 'N/A'}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium text-gray-500">Statut paiement:</span> {' '}
                      <span className={clsx(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        request.registration?.payment_status === 'paid' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      )}>
                        {request.registration?.payment_status === 'paid' ? 'Payé' : 'En attente'}
                      </span>
                    </p>
                    {request.registration?.invoice_id && (
                      <p className="text-sm">
                        <span className="font-medium text-gray-500">Facture:</span> {' '}
                        <Link 
                          to={`/admin/invoices/${request.registration.invoice_id}`}
                          className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                        >
                          Voir la facture
                          <LinkIcon className="w-3 h-3 ml-1" />
                        </Link>
                      </p>
                    )}
                    
                    {request.status === 'approved' && request.refund_type && (
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-sm">
                          <span className="font-medium text-gray-500">Type de remboursement:</span> {' '}
                          <span className={clsx(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            request.refund_type === 'full' ? 'bg-green-100 text-green-800' :
                            request.refund_type === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          )}>
                            {request.refund_type === 'full' ? 'Remboursement complet' :
                             request.refund_type === 'partial' ? 'Remboursement partiel' :
                             'Aucun remboursement'}
                          </span>
                        </p>
                        
                        {request.credit_note_url && (
                          <p className="text-sm mt-2">
                            <span className="font-medium text-gray-500">Avoir:</span> {' '}
                            <a 
                              href={request.credit_note_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                            >
                              Télécharger l'avoir
                              <Download className="w-3 h-3 ml-1" />
                            </a>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {request.status === 'pending' && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Actions</h3>
                    
                    {!showRejectForm ? (
                      <div className="space-y-4">
                        {/* Approve Form */}
                        <div className="bg-green-50 rounded-lg p-4">
                          <h4 className="font-medium text-green-900 mb-3">Approuver la demande</h4>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Type de remboursement
                              </label>
                              <select
                                value={refundType}
                                onChange={(e) => setRefundType(e.target.value as any)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              >
                                <option value="full">Remboursement complet</option>
                                <option value="partial">Remboursement partiel</option>
                                <option value="none">Aucun remboursement</option>
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Notes administrateur (optionnel)
                              </label>
                              <textarea
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                rows={3}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="Notes internes..."
                              />
                            </div>
                            
                            <button
                              onClick={handleApprove}
                              disabled={processing}
                              className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                              {processing ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <CheckCircle className="w-4 h-4 mr-2" />
                              )}
                              Approuver la demande
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => setShowRejectForm(true)}
                          className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center justify-center"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Rejeter la demande
                        </button>
                      </div>
                    ) : (
                      <div className="bg-red-50 rounded-lg p-4">
                        <h4 className="font-medium text-red-900 mb-3">Rejeter la demande</h4>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Raison du rejet *
                            </label>
                            <textarea
                              value={rejectNotes}
                              onChange={(e) => setRejectNotes(e.target.value)}
                              rows={3}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                              placeholder="Expliquez pourquoi cette demande est rejetée..."
                              required
                            />
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={handleReject}
                              disabled={processing || !rejectNotes.trim()}
                              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                              {processing ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <XCircle className="w-4 h-4 mr-2" />
                              )}
                              Confirmer le rejet
                            </button>
                            <button
                              onClick={() => setShowRejectForm(false)}
                              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default AdminCancellationRequestsPage;