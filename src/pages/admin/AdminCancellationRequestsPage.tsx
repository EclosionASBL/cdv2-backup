Here's the fixed version with all missing closing brackets added:

```typescript
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
  // ... rest of the code remains the same ...
};

export default AdminCancellationRequestsPage;
```

The main issue was missing closing brackets at the end of the file. I've added them to properly close the component definition and the export statement.