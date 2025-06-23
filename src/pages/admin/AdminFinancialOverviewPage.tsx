import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Loader2, 
  AlertCircle, 
  BarChart3, 
  DollarSign, 
  TrendingUp, 
  Filter, 
  RefreshCw,
  Calendar,
  Building2,
  Clock
} from 'lucide-react';
import clsx from 'clsx';

interface FinancialSummary {
  total_invoices: number;
  paid_invoices: number;
  pending_invoices: number;
  cancelled_invoices: number;
  payment_rate: number;
}

interface InvoicesByStatus {
  status: string;
  count: number;
  total_amount: number;
}

interface InvoicesByMonth {
  month: string;
  total_amount: number;
  invoice_count: number;
}

interface RecentInvoice {
  id: string;
  invoice_number: string;
  created_at: string;
  amount: number;
  status: string;
  user_id: string;
  user_name: string;
  user_email: string;
}

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  created_at: string;
  due_date: string;
  amount: number;
  user_id: string;
  user_name: string;
  user_email: string;
  days_overdue: number;
}

interface PaymentsByCenter {
  center_id: string;
  center_name: string;
  total_amount: number;
  invoice_count: number;
}

interface PaymentsByPeriode {
  periode: string;
  total_amount: number;
  invoice_count: number;
}

interface PaymentsBySemaine {
  semaine: string;
  total_amount: number;
  invoice_count: number;
}

interface FinancialDashboardData {
  success: boolean;
  summary: FinancialSummary;
  invoices_by_status: InvoicesByStatus[];
  invoices_by_month: InvoicesByMonth[];
  recent_invoices: RecentInvoice[];
  overdue_invoices: OverdueInvoice[];
  payments_by_center: PaymentsByCenter[];
  payments_by_periode: PaymentsByPeriode[];
  payments_by_semaine: PaymentsBySemaine[];
}

interface Center {
  id: string;
  name: string;
  session_count: number;
}

interface FilterOptions {
  centers: Center[];
  periodes: string[];
  semaines: string[];
}

const AdminFinancialOverviewPage = () => {
  const [dashboardData, setDashboardData] = useState<FinancialDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    centers: [],
    periodes: [],
    semaines: []
  });
  const [selectedPeriode, setSelectedPeriode] = useState<string>('');
  const [selectedCenter, setSelectedCenter] = useState<string>('');
  const [selectedSemaine, setSelectedSemaine] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchFilters();
    fetchDashboardData();
  }, []);

  const fetchFilters = async () => {
    try {
      // Fetch available centers
      const { data: centersData, error: centersError } = await supabase.rpc('get_available_centers');
      
      if (centersError) {
        console.error('Error fetching centers:', centersError);
        throw new Error('Error fetching filters: ' + centersError.message);
      }

      // Fetch available periodes
      const { data: periodesData, error: periodesError } = await supabase.rpc('get_available_periodes');
      
      if (periodesError) {
        console.error('Error fetching periodes:', periodesError);
        throw new Error('Error fetching filters: ' + periodesError.message);
      }

      // Fetch available semaines
      const { data: semainesData, error: semainesError } = await supabase.rpc('get_available_semaines');
      
      if (semainesError) {
        console.error('Error fetching semaines:', semainesError);
        throw new Error('Error fetching filters: ' + semainesError.message);
      }

      setFilterOptions({
        centers: centersData || [],
        periodes: periodesData?.periodes || [],
        semaines: semainesData?.semaines || []
      });
    } catch (err: any) {
      console.error('Error fetching filters:', err);
      setError(err.message || 'Une erreur est survenue lors du chargement des filtres');
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
      
      if (error) {
        console.error('Error fetching dashboard data:', error);
        throw new Error('Une erreur est survenue lors du chargement des données');
      }
      
      if (!data || !data.success) {
        throw new Error('Aucune donnée disponible');
      }
      
      setDashboardData(data);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Une erreur est survenue lors du chargement des données');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleFilterChange = () => {
    fetchDashboardData();
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatMonth = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tableau financier</h1>
          <p className="text-gray-600">Vue d'ensemble des finances et des paiements</p>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn-primary flex items-center"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-semibold">Filtres</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              {filterOptions.centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name} ({center.session_count} sessions)
                </option>
              ))}
            </select>
          </div>
          
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
              {filterOptions.periodes.map((periode) => (
                <option key={periode} value={periode}>
                  {periode}
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
              {filterOptions.semaines.map((semaine) => (
                <option key={semaine} value={semaine}>
                  {semaine}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleFilterChange}
            className="btn-primary"
          >
            Appliquer les filtres
          </button>
        </div>
      </div>

      {dashboardData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-3xl font-bold">{dashboardData.summary.total_invoices}</span>
              </div>
              <p className="text-gray-600 font-medium">Factures totales</p>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <span className="text-3xl font-bold">{dashboardData.summary.paid_invoices}</span>
              </div>
              <p className="text-gray-600 font-medium">Factures payées</p>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <span className="text-3xl font-bold">{dashboardData.summary.pending_invoices}</span>
              </div>
              <p className="text-gray-600 font-medium">Factures en attente</p>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <span className="text-3xl font-bold">{dashboardData.summary.payment_rate.toFixed(2)}%</span>
              </div>
              <p className="text-gray-600 font-medium">Taux de paiement</p>
            </div>
          </div>

          {/* Invoices by Status */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Factures par statut</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nombre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Montant total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dashboardData.invoices_by_status.map((item) => (
                      <tr key={item.status} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={clsx(
                            "px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full",
                            item.status === 'paid' ? "bg-green-100 text-green-800" : 
                            item.status === 'cancelled' ? "bg-red-100 text-red-800" : 
                            "bg-yellow-100 text-yellow-800"
                          )}>
                            {item.status === 'paid' ? 'Payée' : 
                             item.status === 'cancelled' ? 'Annulée' : 
                             'En attente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(item.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Monthly Invoices */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Factures par mois</h2>
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
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dashboardData.invoices_by_month.map((item) => (
                      <tr key={item.month} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatMonth(item.month)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.invoice_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(item.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Factures récentes</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Numéro
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
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
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dashboardData.recent_invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {invoice.invoice_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(invoice.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{invoice.user_name}</div>
                          <div className="text-sm text-gray-500">{invoice.user_email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(invoice.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={clsx(
                            "px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full",
                            invoice.status === 'paid' ? "bg-green-100 text-green-800" : 
                            invoice.status === 'cancelled' ? "bg-red-100 text-red-800" : 
                            "bg-yellow-100 text-yellow-800"
                          )}>
                            {invoice.status === 'paid' ? 'Payée' : 
                             invoice.status === 'cancelled' ? 'Annulée' : 
                             'En attente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Overdue Invoices */}
          {dashboardData.overdue_invoices.length > 0 && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">Factures en retard</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Numéro
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Client
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date d'échéance
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Jours de retard
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Montant
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dashboardData.overdue_invoices.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {invoice.invoice_number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{invoice.user_name}</div>
                            <div className="text-sm text-gray-500">{invoice.user_email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(invoice.due_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={clsx(
                              "px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full",
                              invoice.days_overdue > 30 ? "bg-red-100 text-red-800" : 
                              invoice.days_overdue > 15 ? "bg-orange-100 text-orange-800" : 
                              "bg-yellow-100 text-yellow-800"
                            )}>
                              {invoice.days_overdue} jours
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(invoice.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Payments by Center */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <Building2 className="h-5 w-5 text-gray-500 mr-2" />
                  <h2 className="text-lg font-semibold">Paiements par centre</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Centre
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Factures
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Montant
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dashboardData.payments_by_center.map((item) => (
                        <tr key={item.center_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.center_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.invoice_count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(item.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Payments by Periode */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <Calendar className="h-5 w-5 text-gray-500 mr-2" />
                  <h2 className="text-lg font-semibold">Paiements par période</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Période
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Factures
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Montant
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dashboardData.payments_by_periode.map((item) => (
                        <tr key={item.periode} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.periode}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.invoice_count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(item.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Payments by Semaine */}
          {dashboardData.payments_by_semaine.length > 0 && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <Clock className="h-5 w-5 text-gray-500 mr-2" />
                  <h2 className="text-lg font-semibold">Paiements par semaine</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Semaine
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Factures
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Montant
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dashboardData.payments_by_semaine.map((item) => (
                        <tr key={item.semaine} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.semaine}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.invoice_count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(item.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminFinancialOverviewPage;