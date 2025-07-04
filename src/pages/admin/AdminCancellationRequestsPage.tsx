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
  // ... rest of the code remains the same ...
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
  // ... rest of the modal component code remains the same ...
};

export default AdminCancellationRequestsPage;