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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<CancellationRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { entries: waitingListEntries, fetchWaitingList, isLoading: isWaitingListLoading } = useWaitingListStore();
  const [waitingListCounts, setWaitingListCounts] = useState<Record<string, number>>({});
  const [isWaitingListModalOpen, setIsWaitingListModalOpen] = useState(false);
  const [selectedActivityForWaitingList, setSelectedActivityForWaitingList] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
    fetchWaitingList();
  }, []);

  useEffect(() => {
    // Calculate waiting list counts for each activity
    if (waitingListEntries.length > 0) {
      const counts: Record<string, number> = {};
      waitingListEntries.forEach(entry => {
        if (entry.status === 'waiting' || entry.status === 'invited') {
          counts[entry.activity_id] = (counts[entry.activity_id] || 0) + 1;
        }
      });
      setWaitingListCounts(counts);
    }
  }, [waitingListEntries]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cancellation_requests')
        .select(`
          *,
          registration:registrations(amount_paid, payment_status, invoice_id),
          kid:kids(prenom, nom),
          session:sessions(
            stage:stages(title),
            start_date,
            end_date,
            center:centers(name)
          ),
          user:users(email, prenom, nom, telephone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching cancellation requests:', err);
      setError('Failed to load cancellation requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: CancellationRequest, refundType: 'full' | 'partial' | 'none', adminNotes?: string) => {
    try {
      setProcessing(true);
      
      // Call the edge function to process the approval
      const { data, error } = await supabase.functions.invoke('process-cancellation-approval', {
        body: {
          requestId: request.id,
          refundType,
          adminNotes
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to process cancellation approval');
      }

      toast.success('Cancellation request approved successfully');
      await fetchRequests();
      setIsModalOpen(false);
      setSelectedRequest(null);
    } catch (err: any) {
      console.error('Error approving cancellation:', err);
      toast.error(err.message || 'Failed to approve cancellation request');
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

      toast.success('Cancellation request rejected');
      await fetchRequests();
      setIsModalOpen(false);
      setSelectedRequest(null);
    } catch (error) {
      console.error('Error rejecting cancellation:', error);
      toast.error('Failed to reject cancellation request');
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenWaitingListModal = (activityId: string) => {
    setSelectedActivityForWaitingList(activityId);
    setIsWaitingListModalOpen(true);
  };

  const filteredRequests = requests.filter(request => {
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesSearch = searchTerm === '' || 
      request.kid.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.kid.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.session.stage.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    
    switch (status) {
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'approved':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'rejected':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchRequests}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Toaster position="top-right" />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Cancellation Requests</h1>
        <p className="text-gray-600">Manage registration cancellation requests from parents</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by child name, parent email, or activity..."
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
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No cancellation requests found</h3>
            <p className="text-gray-600">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters to see more results.'
                : 'No cancellation requests have been submitted yet.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Request Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Child & Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Waiting List
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
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {new Date(request.request_date).toLocaleDateString()}
                        </div>
                        <div className="text-gray-500">
                          {new Date(request.request_date).toLocaleTimeString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {request.kid.prenom} {request.kid.nom}
                        </div>
                        <div className="text-gray-500">
                          {request.session.stage.title}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {new Date(request.session.start_date).toLocaleDateString()} - {new Date(request.session.end_date).toLocaleDateString()}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {request.session.center.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {request.user.prenom} {request.user.nom}
                        </div>
                        <div className="text-gray-500">
                          {request.user.email}
                        </div>
                        {request.user.telephone && (
                          <div className="text-gray-500 text-xs">
                            {request.user.telephone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        €{request.registration.amount_paid.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {request.registration.payment_status}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(request.status)}
                        <span className={getStatusBadge(request.status)}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </div>
                      {request.refund_type && (
                        <div className="text-xs text-gray-500 mt-1">
                          Refund: {request.refund_type}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {waitingListCounts[request.activity_id] ? (
                        <Link 
                          to={`/admin/waiting-list?activity=${request.activity_id}`}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200"
                        >
                          <Users className="h-3 w-3 mr-1" />
                          {waitingListCounts[request.activity_id]} {waitingListCounts[request.activity_id] === 1 ? 'enfant' : 'enfants'}
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-xs">Aucune attente</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedRequest(request);
                            setIsModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Details
                        </button>
                        {request.credit_note_url && (
                          <a
                            href={request.credit_note_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:text-green-900 flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            Credit Note
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Request Details Modal */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl">
            {selectedRequest && (
              <CancellationRequestModal
                request={selectedRequest}
                onApprove={handleApprove}
                onReject={handleReject}
                onClose={() => setIsModalOpen(false)}
                processing={processing}
                waitingListCount={waitingListCounts[selectedRequest.activity_id] || 0}
                activityId={selectedRequest.activity_id}
                onViewWaitingList={() => {
                  setIsModalOpen(false);
                  setSelectedActivityForWaitingList(selectedRequest.activity_id);
                  setIsWaitingListModalOpen(true);
                }}
              />
            )}
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Waiting List Modal */}
      {selectedActivityForWaitingList && (
        <WaitingListModal
          isOpen={isWaitingListModalOpen}
          onClose={() => setIsWaitingListModalOpen(false)}
          activityId={selectedActivityForWaitingList}
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
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || '');
  const [refundType, setRefundType] = useState<'full' | 'partial' | 'none'>('full');

  // Calculate days until start date
  const daysUntilStart = Math.ceil(
    (new Date(request.session.start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const isLessThan10Days = daysUntilStart < 10;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <Dialog.Title className="text-lg font-semibold text-gray-900">
          Cancellation Request Details
        </Dialog.Title>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <XCircle className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-6">
        {/* Request Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-3">Request Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Request Date:</span>
              <div className="font-medium">{new Date(request.request_date).toLocaleString()}</div>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <div className="font-medium">{request.status}</div>
            </div>
          </div>
        </div>

        {/* Child & Activity Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-3">Child & Activity</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500">Child:</span>
              <div className="font-medium">{request.kid.prenom} {request.kid.nom}</div>
            </div>
            <div>
              <span className="text-gray-500">Activity:</span>
              <div className="font-medium">{request.session.stage.title}</div>
            </div>
            <div>
              <span className="text-gray-500">Dates:</span>
              <div className="font-medium">
                {new Date(request.session.start_date).toLocaleDateString()} - {new Date(request.session.end_date).toLocaleDateString()}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Center:</span>
              <div className="font-medium">{request.session.center.name}</div>
            </div>
          </div>
        </div>

        {/* Payment Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-3">Payment Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Amount Paid:</span>
              <div className="font-medium">€{request.registration.amount_paid.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-gray-500">Payment Status:</span>
              <div className="font-medium">{request.registration.payment_status}</div>
            </div>
            {request.registration.invoice_id && (
              <div className="col-span-2">
                <span className="text-gray-500">Invoice:</span>
                <div className="font-medium">{request.registration.invoice_id}</div>
              </div>
            )}
          </div>
        </div>

        {/* Waiting List Info */}
        {waitingListCount > 0 && (
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-amber-800 flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Liste d'attente: {waitingListCount} {waitingListCount === 1 ? 'enfant' : 'enfants'}
              </h3>
              <button
                onClick={onViewWaitingList}
                className="text-amber-700 hover:text-amber-900 text-sm font-medium flex items-center"
              >
                <LinkIcon className="h-3 w-3 mr-1" />
                Voir la liste
              </button>
            </div>
            <p className="text-sm text-amber-700">
              Il y a des enfants en liste d'attente pour cette activité. Veuillez considérer d'offrir la place à l'un d'entre eux avant d'approuver l'annulation.
            </p>
          </div>
        )}

        {/* Parent Notes */}
        {request.parent_notes && (
          <div className="bg-blue-50 p-4 rounded-lg mb-4">
            <h3 className="font-medium text-gray-700 mb-2">Parent's Reason</h3>
            <p className="text-sm text-gray-600">{request.parent_notes}</p>
          </div>
        )}

        {/* Admin Notes */}
        <div>
          <label htmlFor="adminNotes" className="block text-sm font-medium text-gray-700 mb-1">
            Admin Notes
          </label>
          <textarea
            id="adminNotes"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={3}
            placeholder="Add notes about this cancellation request..."
            disabled={processing}
          />
        </div>

        {/* Refund Type Section */}
        {request.status === 'pending' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Refund Type
            </label>
            <select
              value={refundType}
              onChange={(e) => setRefundType(e.target.value as 'full' | 'partial' | 'none')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={processing}
            >
              <option value="full">Full Refund</option>
              <option value="partial">Partial Refund</option>
              <option value="none">No Refund</option>
            </select>
          </div>
        )}

        {/* Credit Note Info */}
        {request.credit_note_id && (
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Credit Note</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Credit Note ID: {request.credit_note_id}</span>
              {request.credit_note_url && (
                <a 
                  href={request.credit_note_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {request.status === 'pending' && (
        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onReject(request, adminNotes)}
            disabled={processing}
            className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Reject
          </button>
          <button
            onClick={() => onApprove(request, refundType, adminNotes)}
            disabled={processing}
            className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Approve
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminCancellationRequestsPage;