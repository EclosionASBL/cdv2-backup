import { useEffect, useState } from 'react';
import { useInclusionRequestStore } from '../../stores/inclusionRequestStore';
import { Loader2, AlertCircle, Filter, Search, FileText, CheckCircle, X, Clock, RefreshCw } from 'lucide-react';
import { Dialog } from '@headlessui/react';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

const AdminInclusionRequestsPage = () => {
  const { requests, isLoading, error, fetchRequests, updateRequestStatus, convertToRegistration } = useInclusionRequestStore();
  
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'converted'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);
  
  const handleViewDetails = (requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    if (request) {
      setSelectedRequest(requestId);
      setAdminNotes(request.admin_notes || '');
      setIsDetailsModalOpen(true);
    }
  };
  
  const handleApprove = async () => {
    if (!selectedRequest) return;
    
    try {
      setProcessingRequestId(selectedRequest);
      await updateRequestStatus(selectedRequest, 'approved', adminNotes);
      await convertToRegistration(selectedRequest);
      setIsApproveModalOpen(false);
      toast.success('Demande approuvée et convertie en inscription');
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Une erreur est survenue lors de l\'approbation');
    } finally {
      setProcessingRequestId(null);
    }
  };
  
  const handleReject = async () => {
    if (!selectedRequest) return;
    
    try {
      setProcessingRequestId(selectedRequest);
      await updateRequestStatus(selectedRequest, 'rejected', adminNotes);
      setIsRejectModalOpen(false);
      toast.success('Demande rejetée');
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Une erreur est survenue lors du rejet');
    } finally {
      setProcessingRequestId(null);
    }
  };
  
  const handleSaveNotes = async () => {
    if (!selectedRequest) return;
    
    try {
      setProcessingRequestId(selectedRequest);
      await updateRequestStatus(
        selectedRequest, 
        requests.find(r => r.id === selectedRequest)?.status as any || 'pending', 
        adminNotes
      );
      setIsDetailsModalOpen(false);
      toast.success('Notes enregistrées');
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Une erreur est survenue lors de l\'enregistrement des notes');
    } finally {
      setProcessingRequestId(null);
    }
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
      
      // Unwrap arrays if needed
      const kid = Array.isArray(req.kid) ? req.kid[0] : req.kid;
      const parent = Array.isArray(req.parent) ? req.parent[0] : req.parent;
      const session = Array.isArray(req.session) ? req.session[0] : req.session;
      const stage = session?.stage ? (Array.isArray(session.stage) ? session.stage[0] : session.stage) : null;
      
      return (
        kid?.prenom?.toLowerCase().includes(searchLower) ||
        kid?.nom?.toLowerCase().includes(searchLower) ||
        parent?.prenom?.toLowerCase().includes(searchLower) ||
        parent?.nom?.toLowerCase().includes(searchLower) ||
        parent?.email?.toLowerCase().includes(searchLower) ||
        stage?.title?.toLowerCase().includes(searchLower)
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
            <X className="h-3 w-3 mr-1" />
            Rejetée
          </span>
        );
      case 'converted':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Convertie
          </span>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Demandes d'inclusion</h1>
          <p className="text-gray-600">Gérez les demandes d'inscription pour les enfants à besoins spécifiques</p>
        </div>
        
        <button
          onClick={() => fetchRequests()}
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
            <option value="converted">Converties</option>
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
              : 'Aucune demande d\'inclusion trouvée.'}
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
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map((request) => {
                  // Unwrap arrays if needed
                  const kid = Array.isArray(request.kid) ? request.kid[0] : request.kid;
                  const parent = Array.isArray(request.parent) ? request.parent[0] : request.parent;
                  const session = Array.isArray(request.session) ? request.session[0] : request.session;
                  const stage = session?.stage ? (Array.isArray(session.stage) ? session.stage[0] : session.stage) : null;
                  const center = session?.center ? (Array.isArray(session.center) ? session.center[0] : session.center) : null;
                  
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
                          {kid?.prenom} {kid?.nom}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {parent?.prenom} {parent?.nom}
                        </div>
                        <div className="text-sm text-gray-500">
                          {parent?.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {stage?.title}
                        </div>
                        <div className="text-sm text-gray-500">
                          {center?.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {session?.start_date && new Date(session.start_date).toLocaleDateString('fr-FR')}
                        </div>
                        <div className="text-sm text-gray-500">
                          au {session?.end_date && new Date(session.end_date).toLocaleDateString('fr-FR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(request.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleViewDetails(request.id)}
                            className="text-primary-600 hover:text-primary-900"
                            title="Voir les détails"
                          >
                            <FileText className="h-5 w-5" />
                          </button>
                          
                          {request.status === 'pending' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedRequest(request.id);
                                  setAdminNotes(request.admin_notes || '');
                                  setIsApproveModalOpen(true);
                                }}
                                className="text-green-600 hover:text-green-900"
                                title="Approuver"
                              >
                                <CheckCircle className="h-5 w-5" />
                              </button>
                              
                              <button
                                onClick={() => {
                                  setSelectedRequest(request.id);
                                  setAdminNotes(request.admin_notes || '');
                                  setIsRejectModalOpen(true);
                                }}
                                className="text-red-600 hover:text-red-900"
                                title="Rejeter"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </>
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
              Détails de la demande d'inclusion
            </Dialog.Title>
            
            {selectedRequest && (
              <div className="space-y-6">
                {/* Request Info */}
                {(() => {
                  const request = requests.find(r => r.id === selectedRequest);
                  if (!request) return null;
                  
                  // Unwrap arrays if needed
                  const kid = Array.isArray(request.kid) ? request.kid[0] : request.kid;
                  const parent = Array.isArray(request.parent) ? request.parent[0] : request.parent;
                  const session = Array.isArray(request.session) ? request.session[0] : request.session;
                  const stage = session?.stage ? (Array.isArray(session.stage) ? session.stage[0] : session.stage) : null;
                  
                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Enfant</h3>
                          <p className="mt-1 text-sm text-gray-900">{kid?.prenom} {kid?.nom}</p>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Parent</h3>
                          <p className="mt-1 text-sm text-gray-900">{parent?.prenom} {parent?.nom}</p>
                          <p className="text-sm text-gray-500">{parent?.email}</p>
                          <p className="text-sm text-gray-500">{parent?.telephone}</p>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Activité</h3>
                          <p className="mt-1 text-sm text-gray-900">{stage?.title}</p>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Dates</h3>
                          <p className="mt-1 text-sm text-gray-900">
                            {session?.start_date && new Date(session.start_date).toLocaleDateString('fr-FR')} au {session?.end_date && new Date(session.end_date).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="border-t pt-4">
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Détails d'inclusion</h3>
                        
                        {request.inclusion_details && (
                          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                            {request.inclusion_details.has_needs && (
                              <>
                                {request.inclusion_details.situation_details && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700">Situation</h4>
                                    <p className="text-sm text-gray-600">{request.inclusion_details.situation_details}</p>
                                  </div>
                                )}
                                
                                {request.inclusion_details.impact_details && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700">Impact au quotidien</h4>
                                    <p className="text-sm text-gray-600">{request.inclusion_details.impact_details}</p>
                                  </div>
                                )}
                                
                                {request.inclusion_details.needs_dedicated_staff && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700">Besoin d'accompagnement</h4>
                                    <p className="text-sm text-gray-600">
                                      {request.inclusion_details.needs_dedicated_staff === 'yes' ? 'Oui' : 
                                       request.inclusion_details.needs_dedicated_staff === 'no' ? 'Non' : 'Par moments'}
                                    </p>
                                    {request.inclusion_details.staff_details && (
                                      <p className="text-sm text-gray-600">{request.inclusion_details.staff_details}</p>
                                    )}
                                  </div>
                                )}
                                
                                {request.inclusion_details.strategies && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700">Stratégies</h4>
                                    <p className="text-sm text-gray-600">{request.inclusion_details.strategies}</p>
                                  </div>
                                )}
                                
                                {request.inclusion_details.assistive_devices && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700">Aides techniques</h4>
                                    <p className="text-sm text-gray-600">{request.inclusion_details.assistive_devices}</p>
                                  </div>
                                )}
                                
                                {request.inclusion_details.stress_signals && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700">Signes de stress</h4>
                                    <p className="text-sm text-gray-600">{request.inclusion_details.stress_signals}</p>
                                  </div>
                                )}
                                
                                {request.inclusion_details.strengths && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700">Points forts</h4>
                                    <p className="text-sm text-gray-600">{request.inclusion_details.strengths}</p>
                                  </div>
                                )}
                                
                                {request.inclusion_details.previous_experience && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700">Expériences précédentes</h4>
                                    <p className="text-sm text-gray-600">{request.inclusion_details.previous_experience}</p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
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
                    </>
                  );
                })()}
                
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
                    disabled={processingRequestId === selectedRequest}
                    className="btn-primary"
                  >
                    {processingRequestId === selectedRequest ? (
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
              Approuver la demande d'inclusion
            </Dialog.Title>
            
            <p className="text-gray-600 mb-4">
              Êtes-vous sûr de vouloir approuver cette demande ? L'enfant sera inscrit à l'activité.
            </p>
            
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
                disabled={processingRequestId === selectedRequest}
                className="btn-primary"
              >
                {processingRequestId === selectedRequest ? (
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
              Rejeter la demande d'inclusion
            </Dialog.Title>
            
            <p className="text-gray-600 mb-4">
              Êtes-vous sûr de vouloir rejeter cette demande ? Veuillez fournir une raison pour aider le parent à comprendre.
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
                disabled={processingRequestId === selectedRequest || !adminNotes.trim()}
                className={`btn-primary bg-red-600 hover:bg-red-700 ${(!adminNotes.trim() || processingRequestId === selectedRequest) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {processingRequestId === selectedRequest ? (
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

export default AdminInclusionRequestsPage;