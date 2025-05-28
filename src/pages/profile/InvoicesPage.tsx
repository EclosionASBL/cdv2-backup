import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInvoiceStore } from '../../stores/invoiceStore';
import { ArrowLeft, Filter, Search, FileText, Download, CheckCircle, Clock, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

const InvoicesPage = () => {
  const { invoices, isLoading, error, fetchInvoices, downloadInvoice } = useInvoiceStore();
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const getStatusIcon = (status: string) => {
    if (status === 'paid') {
      return <CheckCircle className="h-4 w-4 text-green-500 mr-1" />;
    } else if (status === 'cancelled') {
      return <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />;
    } else {
      // pending
      return <Clock className="h-4 w-4 text-yellow-500 mr-1" />;
    }
  };

  const getStatusText = (status: string) => {
    if (status === 'paid') {
      return 'Payé';
    } else if (status === 'cancelled') {
      return 'Annulé';
    } else {
      // pending
      return 'En attente';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  // Unwrap arrays for nested objects if needed
  const unwrapObject = (obj: any) => {
    if (!obj) return null;
    if (Array.isArray(obj) && obj.length > 0) return obj[0];
    return obj;
  };

  // Filter and search invoices
  const filteredInvoices = invoices
    .filter(inv => {
      if (filter === 'all') return true;
      if (filter === 'paid') return inv.status === 'paid';
      if (filter === 'pending') return inv.status === 'pending';
      return true;
    })
    .filter(inv => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        inv.invoice_number?.toLowerCase().includes(searchLower) ||
        inv.communication?.toLowerCase().includes(searchLower) ||
        (inv.registrations || []).some((reg: any) => {
          const kid = unwrapObject(reg.kid);
          const session = unwrapObject(reg.session);
          const stage = session ? unwrapObject(session.stage) : null;
          
          return (
            kid?.prenom?.toLowerCase().includes(searchLower) ||
            kid?.nom?.toLowerCase().includes(searchLower) ||
            stage?.title?.toLowerCase().includes(searchLower)
          );
        })
      );
    });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  return (
    <div className="container max-w-6xl mx-auto py-12 px-4">
      <Link to="/dashboard" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-5 w-5 mr-2" />
        Retour au tableau de bord
      </Link>
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold">Mes factures</h1>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
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
              <option value="paid">Payées</option>
              <option value="pending">En attente</option>
            </select>
          </div>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <p className="text-gray-600 mb-4">
            {searchTerm || filter !== 'all'
              ? 'Aucune facture ne correspond à vos critères.'
              : 'Vous n\'avez pas encore de factures.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredInvoices.map((invoice) => (
            <div 
              key={invoice.id} 
              className={clsx(
                "bg-white rounded-xl shadow-md overflow-hidden",
                invoice.status === 'paid' && "border-l-4 border-green-500"
              )}
            >
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-primary-600 mr-2" />
                      <h2 className="text-xl font-semibold">Facture {invoice.invoice_number}</h2>
                      <span className={clsx(
                        "ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                        getStatusColor(invoice.status)
                      )}>
                        {getStatusIcon(invoice.status)}
                        {getStatusText(invoice.status)}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-1">
                      Émise le {formatDate(invoice.created_at)}
                      {invoice.status === 'pending' && invoice.due_date && (
                        <> • Échéance: <span className="font-medium">{formatDate(invoice.due_date)}</span></>
                      )}
                      {invoice.status === 'paid' && invoice.paid_at && (
                        <> • Payée le {formatDate(invoice.paid_at)}</>
                      )}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Montant</p>
                      <p className="text-xl font-bold text-primary-600">{invoice.amount} €</p>
                    </div>
                    
                    {invoice.pdf_url && (
                      <div className="flex space-x-2">
                        <a
                          href={invoice.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-outline py-2 flex items-center"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Voir
                        </a>
                        <button
                          onClick={() => downloadInvoice(invoice.pdf_url!, invoice.invoice_number)}
                          className="btn-primary py-2 flex items-center"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Télécharger
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {invoice.status === 'pending' && (
                  <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-yellow-700 font-medium">Paiement en attente</p>
                        <p className="text-yellow-600 text-sm">
                          Veuillez effectuer le paiement par virement bancaire avec la communication structurée suivante:
                        </p>
                        <p className="text-yellow-800 font-mono font-medium mt-1">{invoice.communication}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-4">
                  <h3 className="text-lg font-medium mb-2">Détails</h3>
                  <div className="space-y-3">
                    {(invoice.registrations || []).map((reg: any) => {
                      // Unwrap nested objects if they're arrays
                      const kid = unwrapObject(reg.kid);
                      const session = unwrapObject(reg.session);
                      const stage = session ? unwrapObject(session.stage) : null;
                      const center = session ? unwrapObject(session.center) : null;
                      
                      if (!kid || !session || !stage || !center) return null;
                      
                      return (
                        <div key={reg.id} className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex justify-between">
                            <div>
                              <p className="font-medium">{stage.title}</p>
                              <p className="text-sm text-gray-600">
                                Pour: {kid.prenom} {kid.nom}
                              </p>
                              <p className="text-sm text-gray-600">
                                {new Date(session.start_date).toLocaleDateString('fr-FR')} - {new Date(session.end_date).toLocaleDateString('fr-FR')}
                              </p>
                              <p className="text-sm text-gray-600">
                                Centre: {center.name}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{reg.amount_paid} €</p>
                              {reg.price_type.includes('reduced') && (
                                <span className="inline-block text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                  Tarif réduit
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InvoicesPage;