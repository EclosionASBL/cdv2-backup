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

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('cancellation_requests')
        .select(`
          *,
          registration:registrations(amount_paid, payment_status, invoice_id),
          kid:kids(prenom, nom),
          session:sessions(
            start_date,
            end_date,
            stage:stages(title),
            center:centers(name)
          ),
          user:users(email, prenom, nom, telephone, adresse, cpostal, localite)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRequests(data || []);
      
      // Fetch waiting list counts for unique activity IDs
      const uniqueActivityIds = [...new Set(data?.map(req => req.activity_id) || [])];
      for (const activityId of uniqueActivityIds) {
        await fetchWaitingListCount(activityId);
      }
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

      const { error } = await supabase
        .from('cancellation_requests')
        .update({
          status: 'approved',
          refund_type: refundType,
          admin_notes: adminNotes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (error) throw error;

      toast.success('Cancellation request approved');
      await fetchRequests();
      setSelectedRequest(null);
    } catch (err) {
      console.error('Error approving request:', err);
      toast.error('Failed to approve request');
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
          admin_notes: adminNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (error) throw error;

      toast.success('Cancellation request rejected');
      await fetchRequests();
      setSelectedRequest(null);
    } catch (err) {
      console.error('Error rejecting request:', err);
      toast.error('Failed to reject request');
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
      request.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.kid?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.kid?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.session?.stage?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Requests</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchRequests}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
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
        <p className="text-gray-600">Manage cancellation requests from parents</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="flex items-center space-x-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email, child name, or activity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={fetchRequests}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Requests Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Request Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Child
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Adresse
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(request.request_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {request.kid?.prenom} {request.kid?.nom}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {request.session?.stage?.title}
                    </div>
                    <div className="text-sm text-gray-500">
                      {request.session?.center?.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {request.session?.start_date && new Date(request.session.start_date).toLocaleDateString()} - 
                      {request.session?.end_date && new Date(request.session.end_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {request.user?.prenom} {request.user?.nom}
                    </div>
                    <div className="text-sm text-gray-500">
                      {request.user?.telephone}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {request.user?.email || 'No email'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {request.user?.adresse ? (
                      <>
                        <div>{request.user.adresse}</div>
                        <div>{request.user.cpostal} {request.user.localite}</div>
                      </>
                    ) : (
                      '-'
                    )}
                    {/* Add console.log to debug user data */}
                    {console.log('User data:', request.user)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      €{request.registration?.amount_paid?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {request.registration?.payment_status}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(request.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleViewWaitingList(request.activity_id)}
                      className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Users className="w-3 h-3 mr-1" />
                      {waitingListCounts[request.activity_id] || 0}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      View Details
                    </button>
                    {request.credit_note_url && (
                      <a
                        href={request.credit_note_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-900 inline-flex items-center"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Credit Note
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRequests.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No requests found</h3>
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters to see more results.'
                : 'No cancellation requests have been submitted yet.'
              }
            </p>
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
      {showWaitingListModal && selectedActivityId && (
        <WaitingListModal
          activityId={selectedActivityId}
          onClose={() => {
            setShowWaitingListModal(false);
            setSelectedActivityId('');
          }}
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
      toast.error('Please provide a reason for rejection');
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
              <Dialog.Title className="text-lg font-medium text-gray-900">
                Cancellation Request Details
              </Dialog.Title>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Request Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 border-b pb-2">Request Information</h3>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Request Date</label>
                  <p className="text-sm text-gray-900">{new Date(request.request_date).toLocaleDateString()}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    {request.status === 'pending' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </span>
                    )}
                    {request.status === 'approved' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Approved
                      </span>
                    )}
                    {request.status === 'rejected' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircle className="w-3 h-3 mr-1" />
                        Rejected
                      </span>
                    )}
                  </div>
                </div>

                {request.parent_notes && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Parent Notes</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">{request.parent_notes}</p>
                  </div>
                )}

                {request.admin_notes && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Admin Notes</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">{request.admin_notes}</p>
                  </div>
                )}

                {request.refund_type && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Refund Type</label>
                    <p className="text-sm text-gray-900 capitalize">{request.refund_type}</p>
                  </div>
                )}
              </div>

              {/* Child & Activity Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 border-b pb-2">Child & Activity</h3>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Child</label>
                  <p className="text-sm text-gray-900">{request.kid?.prenom} {request.kid?.nom}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Activity</label>
                  <p className="text-sm text-gray-900">{request.session?.stage?.title}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Center</label>
                  <p className="text-sm text-gray-900">{request.session?.center?.name}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Session Dates</label>
                  <p className="text-sm text-gray-900">
                    {request.session?.start_date && new Date(request.session.start_date).toLocaleDateString()} - 
                    {request.session?.end_date && new Date(request.session.end_date).toLocaleDateString()}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Amount Paid</label>
                  <p className="text-sm text-gray-900">€{request.registration?.amount_paid?.toFixed(2) || '0.00'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Payment Status</label>
                  <p className="text-sm text-gray-900">{request.registration?.payment_status}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Waiting List</label>
                    <p className="text-sm text-gray-900">{waitingListCount} people waiting</p>
                  </div>
                  <button
                    onClick={onViewWaitingList}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Users className="w-3 h-3 mr-1" />
                    View List
                  </button>
                </div>
              </div>
            </div>

            {/* Parent Information */}
            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-medium text-gray-900 border-b pb-2">Parent Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Name</label>
                  <p className="text-sm text-gray-900">{request.user?.prenom} {request.user?.nom}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-sm text-gray-900">{request.user?.email}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Phone</label>
                  <p className="text-sm text-gray-900">{request.user?.telephone}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Address</label>
                  <p className="text-sm text-gray-900">
                    {request.user?.adresse}<br />
                    {request.user?.cpostal} {request.user?.localite}
                  </p>
                </div>
              </div>
            </div>

            {/* Credit Note Information */}
            {request.credit_note_url && (
              <div className="mt-6 p-4 bg-green-50 rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-green-800">Credit Note Available</h4>
                    <p className="text-sm text-green-600">A credit note has been generated for this cancellation.</p>
                  </div>
                  <a
                    href={request.credit_note_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-2 border border-green-300 rounded-md text-sm font-medium text-green-700 bg-white hover:bg-green-50"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </a>
                </div>
              </div>
            )}

            {/* Actions */}
            {request.status === 'pending' && (
              <div className="mt-6 border-t pt-6">
                {!showRejectForm ? (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-900">Approve Request</h3>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700">Refund Type</label>
                      <select
                        value={refundType}
                        onChange={(e) => setRefundType(e.target.value as any)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="full">Full Refund</option>
                        <option value="partial">Partial Refund</option>
                        <option value="none">No Refund</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700">Admin Notes (Optional)</label>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows={3}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Add any notes about this approval..."
                      />
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={handleApprove}
                        disabled={processing}
                        className={clsx(
                          "inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white",
                          processing
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-green-600 hover:bg-green-700"
                        )}
                      >
                        {processing ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Approve Request
                      </button>

                      <button
                        onClick={() => setShowRejectForm(true)}
                        disabled={processing}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject Request
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-900">Reject Request</h3>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700">Reason for Rejection *</label>
                      <textarea
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                        rows={3}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Please provide a reason for rejecting this request..."
                        required
                      />
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={handleReject}
                        disabled={processing || !rejectNotes.trim()}
                        className={clsx(
                          "inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white",
                          processing || !rejectNotes.trim()
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-red-600 hover:bg-red-700"
                        )}
                      >
                        {processing ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4 mr-2" />
                        )}
                        Reject Request
                      </button>

                      <button
                        onClick={() => {
                          setShowRejectForm(false);
                          setRejectNotes('');
                        }}
                        disabled={processing}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default AdminCancellationRequestsPage;