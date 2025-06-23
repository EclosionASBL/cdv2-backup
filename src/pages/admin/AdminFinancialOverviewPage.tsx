import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Loader2, 
  AlertCircle, 
  Filter, 
  RefreshCw, 
  Download, 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Building2, 
  Clock, 
  FileText, 
  DollarSign, 
  BarChart4, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight 
} from 'lucide-react';
import clsx from 'clsx';
import toast, { Toaster } from 'react-hot-toast';

interface FinancialSummary {
  total_invoiced: number;
  total_paid: number;
  total_credit_notes: number;
  net_receivable: number;
  overdue_invoices_count: number;
  overdue_invoices_amount: number;
}

interface InvoiceByStatus {
  status: string;
  count: number;
  amount: number;
}

interface InvoiceByMonth {
  month: string;
  count: number;
  amount: number;
  paid_amount: number;
}

interface Invoice {
  invoice_number: string;
  amount: number;
  status: string;
  created_at: string;
  due_date: string | null;
  total_payments: number;
  prenom: string;
  nom: string;
  email: string;
  amount_due?: number;
  days_overdue?: number;
}

interface PaymentByCenter {
  center_name: string;
  invoice_count: number;
  total_amount: number;
  paid_amount: number;
}

interface PaymentByPeriode {
  periode: string;
  invoice_count: number;
  total_amount: number;
  paid_amount: number;
}

interface PaymentBySemaine {
  semaine: string;
  invoice_count: number;
  total_amount: number;
  paid_amount: number;
}

interface FinancialDashboardData {
  success: boolean;
  summary: FinancialSummary;
  invoices_by_status: InvoiceByStatus[];
  invoices_by_month: InvoiceByMonth[];
  recent_invoices: Invoice[];
  overdue_invoices: Invoice[];
  payments_by_center: PaymentByCenter[];
  payments_by_periode: PaymentByPeriode[];
  payments_by_semaine: PaymentBySemaine[];
}

interface FilterOption {
  id: string;
  name: string;
}

const AdminFinancialOverviewPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<FinancialDashboardData | null>(null);
  
  // Filtres
  const [periodes, setPeriodes] = useState<string[]>([]);
  const [centers, setCenters] = useState<FilterOption[]>([]);
  const [semaines, setSemaines] = useState<string[]>([]);
  
  const [selectedPeriode, setSelectedPeriode] = useState<string>('');
  const [selectedCenter, setSelectedCenter] = useState<string>('');
  const [selectedSemaine, setSelectedSemaine] = useState<string>('');
  
  // Onglets
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'centers' | 'periods'>('overview');
  
  useEffect(() => {
    fetchFilters();
    fetchDashboardData();
  }, []);
  
  const fetchFilters = async () => {
    try {
      // Récupérer les périodes disponibles
      const { data: periodesData, error: periodesError } = await supabase.rpc('get_available_periodes');
      
      if (periodesError) throw periodesError;
      if (periodesData.success) {
        setPeriodes(periodesData.periodes || []);
      }
      
      // Récupérer les centres disponibles
      const { data: centersData, error: centersError } = await supabase.rpc('get_available_centers');
      
      if (centersError) throw centersError;
      if (centersData.success) {
        setCenters(centersData.centers || []);
      }
      
      // Récupérer les semaines disponibles
      const { data: semainesData, error: semainesError } = await supabase.rpc('get_available_semaines');
      
      if (semainesError) throw semainesError;
      if (semainesData.success) {
        setSemaines(semainesData.semaines || []);
      }
    } catch (err) {
      console.error('Error fetching filters:', err);
      toast.error('Erreur lors du chargement des filtres');
    }
  };
  
  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.rpc('get_financial_dashboard_data', {
        p_periode: selectedPeriode || null,
        p_center_id: selectedCenter || null,
        p_semaine: selectedSemaine || null
      });
      
      if (error) throw error;
      
      if (data.success) {
        setDashboardData(data);
      } else {
        setError(data.error || 'Une erreur est survenue lors du chargement des données');
      }
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Une erreur est survenue lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFilterChange = () => {
    fetchDashboardData();
  };
  
  const resetFilters = () => {
    setSelectedPeriode('');
    setSelectedCenter('');
    setSelectedSemaine('');
    fetchDashboardData();
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(amount);
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-BE');
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <ArrowUpRight className="h-3 w-3 mr-1" />;
      case 'pending':
        return <Clock className="h-3 w-3 mr-1" />;
      case 'cancelled':
        return <ArrowDownRight className="h-3 w-3 mr-1" />;
      default:
        return <FileText className="h-3 w-3 mr-1" />;
    }
  };
  
  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    
    // Convertir les données en CSV
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(item => 
      Object.values(item)
        .map(value => 
          typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
        )
        .join(',')
    );
    
    const csvContent = [headers, ...rows].join('\n');
    
    // Créer un blob et télécharger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }
  
  if (!dashboardData) {
    return (
      <div className="bg-yellow-50 p-4 rounded-lg">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
          <p className="text-yellow-700">Aucune donnée disponible</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord financier</h1>
          <p className="text-gray-600">Analyse des paiements reçus et à percevoir</p>
        </div>
        
        <button
          onClick={fetchDashboardData}
          className="btn-primary flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </button>
      </div>
      
      {/* Filtres */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-semibold">Filtres</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Période
            </label>
            <select
              value={selectedPeriode}
              onChange={(e) => setSelectedPeriode(e.target.value)}
              className="form-input w-full"
            >
              <option value="">Toutes les périodes</option>
              {periodes.map((periode) => (
                <option key={periode} value={periode}>
                  {periode}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Centre
            </label>
            <select
              value={selectedCenter}
              onChange={(e) => setSelectedCenter(e.target.value)}
              className="form-input w-full"
            >
              <option value="">Tous les centres</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Semaine
            </label>
            <select
              value={selectedSemaine}
              onChange={(e) => setSelectedSemaine(e.target.value)}
              className="form-input w-full"
            >
              <option value="">Toutes les semaines</option>
              {semaines.map((semaine) => (
                <option key={semaine} value={semaine}>
                  {semaine}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex justify-end mt-4 space-x-3">
          <button
            onClick={resetFilters}
            className="btn-outline"
          >
            Réinitialiser
          </button>
          <button
            onClick={handleFilterChange}
            className="btn-primary"
          >
            Appliquer les filtres
          </button>
        </div>
      </div>
      
      {/* Onglets */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="border-b">
          <nav className="flex">
            <button
              className={clsx(
                "px-4 py-3 text-sm font-medium border-b-2 focus:outline-none",
                activeTab === 'overview'
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
              onClick={() => setActiveTab('overview')}
            >
              Vue d'ensemble
            </button>
            <button
              className={clsx(
                "px-4 py-3 text-sm font-medium border-b-2 focus:outline-none",
                activeTab === 'invoices'
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
              onClick={() => setActiveTab('invoices')}
            >
              Factures
            </button>
            <button
              className={clsx(
                "px-4 py-3 text-sm font-medium border-b-2 focus:outline-none",
                activeTab === 'centers'
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
              onClick={() => setActiveTab('centers')}
            >
              Centres
            </button>
            <button
              className={clsx(
                "px-4 py-3 text-sm font-medium border-b-2 focus:outline-none",
                activeTab === 'periods'
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
              onClick={() => setActiveTab('periods')}
            >
              Périodes
            </button>
          </nav>
        </div>
        
        <div className="p-6">
          {/* Vue d'ensemble */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Cartes de résumé */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg mr-3">
                        <CreditCard className="h-6 w-6 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-semibold">Total facturé</h3>
                    </div>
                    <span className="text-2xl font-bold">{formatCurrency(dashboardData.summary.total_invoiced)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Payé: {formatCurrency(dashboardData.summary.total_paid)}</span>
                    <span>Notes de crédit: {formatCurrency(dashboardData.summary.total_credit_notes)}</span>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 rounded-lg mr-3">
                        <TrendingUp className="h-6 w-6 text-green-600" />
                      </div>
                      <h3 className="text-lg font-semibold">Net à percevoir</h3>
                    </div>
                    <span className="text-2xl font-bold">{formatCurrency(dashboardData.summary.net_receivable)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Taux de recouvrement: {dashboardData.summary.total_invoiced > 0 
                      ? Math.round((dashboardData.summary.total_paid / dashboardData.summary.total_invoiced) * 100) 
                      : 0}%</span>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-red-100 rounded-lg mr-3">
                        <TrendingDown className="h-6 w-6 text-red-600" />
                      </div>
                      <h3 className="text-lg font-semibold">Factures en souffrance</h3>
                    </div>
                    <span className="text-2xl font-bold">{formatCurrency(dashboardData.summary.overdue_invoices_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Nombre: {dashboardData.summary.overdue_invoices_count}</span>
                    <span>% du total: {dashboardData.summary.total_invoiced > 0 
                      ? Math.round((dashboardData.summary.overdue_invoices_amount / dashboardData.summary.total_invoiced) * 100) 
                      : 0}%</span>
                  </div>
                </div>
              </div>
              
              {/* Graphiques */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Factures par statut</h3>
                    <button
                      onClick={() => exportToCSV(dashboardData.invoices_by_status, 'factures_par_statut')}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Download className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    {dashboardData.invoices_by_status.map((item) => (
                      <div key={item.status} className="flex items-center">
                        <div className={clsx(
                          "w-3 h-3 rounded-full mr-2",
                          item.status === 'paid' ? "bg-green-500" :
                          item.status === 'pending' ? "bg-yellow-500" :
                          "bg-red-500"
                        )} />
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">
                              {item.status === 'paid' ? 'Payées' :
                               item.status === 'pending' ? 'En attente' :
                               'Annulées'}
                            </span>
                            <span className="text-sm font-medium">{formatCurrency(item.amount)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={clsx(
                                "h-2 rounded-full",
                                item.status === 'paid' ? "bg-green-500" :
                                item.status === 'pending' ? "bg-yellow-500" :
                                "bg-red-500"
                              )}
                              style={{ 
                                width: `${dashboardData.summary.total_invoiced > 0 
                                  ? (item.amount / dashboardData.summary.total_invoiced) * 100 
                                  : 0}%` 
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Factures par mois</h3>
                    <button
                      onClick={() => exportToCSV(dashboardData.invoices_by_month, 'factures_par_mois')}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Download className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    {dashboardData.invoices_by_month.slice(0, 6).map((item) => {
                      const monthDate = new Date(item.month + '-01');
                      const monthName = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                      
                      return (
                        <div key={item.month} className="flex items-center">
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium">{monthName}</span>
                              <span className="text-sm font-medium">{formatCurrency(item.amount)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ 
                                  width: `${item.paid_amount / item.amount * 100}%` 
                                }}
                              />
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-xs text-gray-500">Payé: {formatCurrency(item.paid_amount)}</span>
                              <span className="text-xs text-gray-500">
                                {Math.round((item.paid_amount / item.amount) * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              {/* Factures en souffrance */}
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Factures en souffrance</h3>
                  <button
                    onClick={() => exportToCSV(dashboardData.overdue_invoices, 'factures_en_souffrance')}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </div>
                
                {dashboardData.overdue_invoices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Aucune facture en souffrance
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Facture
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Client
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Montant dû
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Échéance
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Retard (jours)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {dashboardData.overdue_invoices.map((invoice) => (
                          <tr key={invoice.invoice_number} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {invoice.invoice_number}
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatDate(invoice.created_at)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {invoice.prenom} {invoice.nom}
                              </div>
                              <div className="text-sm text-gray-500">
                                {invoice.email}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {formatCurrency(invoice.amount_due || 0)}
                              </div>
                              <div className="text-sm text-gray-500">
                                Total: {formatCurrency(invoice.amount)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {invoice.due_date ? formatDate(invoice.due_date) : '-'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={clsx(
                                "px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full",
                                invoice.days_overdue && invoice.days_overdue > 30 
                                  ? "bg-red-100 text-red-800" 
                                  : invoice.days_overdue && invoice.days_overdue > 15
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-yellow-100 text-yellow-800"
                              )}>
                                {invoice.days_overdue} jours
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Onglet Factures */}
          {activeTab === 'invoices' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Factures récentes</h3>
                  <button
                    onClick={() => exportToCSV(dashboardData.recent_invoices, 'factures_recentes')}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </div>
                
                {dashboardData.recent_invoices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Aucune facture récente
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Facture
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Client
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Montant
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Statut
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Paiements
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {dashboardData.recent_invoices.map((invoice) => (
                          <tr key={invoice.invoice_number} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {invoice.invoice_number}
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatDate(invoice.created_at)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {invoice.prenom} {invoice.nom}
                              </div>
                              <div className="text-sm text-gray-500">
                                {invoice.email}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {formatCurrency(invoice.amount)}
                              </div>
                              {invoice.due_date && (
                                <div className="text-sm text-gray-500">
                                  Échéance: {formatDate(invoice.due_date)}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={clsx(
                                "px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full items-center",
                                getStatusColor(invoice.status)
                              )}>
                                {getStatusIcon(invoice.status)}
                                {invoice.status === 'paid' ? 'Payée' : 
                                 invoice.status === 'pending' ? 'En attente' : 
                                 'Annulée'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {formatCurrency(invoice.total_payments)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {Math.round((invoice.total_payments / invoice.amount) * 100)}% payé
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Factures par mois</h3>
                  <button
                    onClick={() => exportToCSV(dashboardData.invoices_by_month, 'factures_par_mois')}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </div>
                
                {dashboardData.invoices_by_month.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Aucune donnée disponible
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Mois
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Nombre de factures
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Montant total
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Montant payé
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Taux de recouvrement
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {dashboardData.invoices_by_month.map((item) => {
                          const monthDate = new Date(item.month + '-01');
                          const monthName = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                          
                          return (
                            <tr key={item.month} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {monthName}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {item.count}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {formatCurrency(item.amount)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {formatCurrency(item.paid_amount)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                                    <div 
                                      className="bg-green-500 h-2.5 rounded-full" 
                                      style={{ width: `${item.amount > 0 ? (item.paid_amount / item.amount) * 100 : 0}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium">
                                    {item.amount > 0 ? Math.round((item.paid_amount / item.amount) * 100) : 0}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Onglet Centres */}
          {activeTab === 'centers' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Paiements par centre</h3>
                  <button
                    onClick={() => exportToCSV(dashboardData.payments_by_center, 'paiements_par_centre')}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </div>
                
                {dashboardData.payments_by_center.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Aucune donnée disponible
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Centre
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Nombre de factures
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Montant total
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Montant payé
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Taux de recouvrement
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {dashboardData.payments_by_center.map((item) => (
                          <tr key={item.center_name} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                                <div className="text-sm font-medium text-gray-900">
                                  {item.center_name}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {item.invoice_count}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {formatCurrency(item.total_amount)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {formatCurrency(item.paid_amount)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                                  <div 
                                    className="bg-green-500 h-2.5 rounded-full" 
                                    style={{ width: `${item.total_amount > 0 ? (item.paid_amount / item.total_amount) * 100 : 0}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium">
                                  {item.total_amount > 0 ? Math.round((item.paid_amount / item.total_amount) * 100) : 0}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Onglet Périodes */}
          {activeTab === 'periods' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Paiements par période</h3>
                  <button
                    onClick={() => exportToCSV(dashboardData.payments_by_periode, 'paiements_par_periode')}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </div>
                
                {dashboardData.payments_by_periode.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Aucune donnée disponible
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Période
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Nombre de factures
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Montant total
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Montant payé
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Taux de recouvrement
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {dashboardData.payments_by_periode.map((item) => (
                          <tr key={item.periode} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                                <div className="text-sm font-medium text-gray-900">
                                  {item.periode}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {item.invoice_count}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {formatCurrency(item.total_amount)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {formatCurrency(item.paid_amount)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                                  <div 
                                    className="bg-green-500 h-2.5 rounded-full" 
                                    style={{ width: `${item.total_amount > 0 ? (item.paid_amount / item.total_amount) * 100 : 0}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium">
                                  {item.total_amount > 0 ? Math.round((item.paid_amount / item.total_amount) * 100) : 0}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Paiements par semaine</h3>
                  <button
                    onClick={() => exportToCSV(dashboardData.payments_by_semaine, 'paiements_par_semaine')}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </div>
                
                {dashboardData.payments_by_semaine.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Aucune donnée disponible
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Semaine
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Nombre de factures
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Montant total
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Montant payé
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Taux de recouvrement
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {dashboardData.payments_by_semaine.map((item) => (
                          <tr key={item.semaine} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Clock className="h-5 w-5 text-gray-400 mr-2" />
                                <div className="text-sm font-medium text-gray-900">
                                  {item.semaine}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {item.invoice_count}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {formatCurrency(item.total_amount)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {formatCurrency(item.paid_amount)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                                  <div 
                                    className="bg-green-500 h-2.5 rounded-full" 
                                    style={{ width: `${item.total_amount > 0 ? (item.paid_amount / item.total_amount) * 100 : 0}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium">
                                  {item.total_amount > 0 ? Math.round((item.paid_amount / item.total_amount) * 100) : 0}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminFinancialOverviewPage;