import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Loader2, 
  AlertCircle, 
  Filter, 
  Search, 
  RefreshCw, 
  Users, 
  Calendar, 
  Building2, 
  Download,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

interface Registration {
  id: string;
  kid_id: string;
  activity_id: string;
  payment_status: string;
  kid: {
    prenom: string;
    nom: string;
    date_naissance: string;
  };
}

interface Session {
  id: string;
  stage_id: string;
  center_id: string;
  start_date: string;
  end_date: string;
  periode: string;
  semaine: string | null;
  capacity: number;
  current_registrations: number;
  stage: {
    title: string;
    age_min: number;
    age_max: number;
  };
  center: {
    name: string;
  };
  registrations: Registration[];
}

const AdminRegistrationsByGroupPage = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  
  // Filters
  const [periodes, setPeriodes] = useState<string[]>([]);
  const [semaines, setSemaines] = useState<string[]>([]);
  const [centers, setCenters] = useState<{id: string, name: string}[]>([]);
  const [stages, setStages] = useState<{id: string, title: string}[]>([]);
  
  const [selectedPeriode, setSelectedPeriode] = useState<string>('');
  const [selectedSemaine, setSelectedSemaine] = useState<string>('');
  const [selectedCenter, setSelectedCenter] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  useEffect(() => {
    fetchFilters();
    fetchSessions();
  }, []);
  
  const fetchFilters = async () => {
    try {
      // Fetch unique periodes
      const { data: periodesData, error: periodesError } = await supabase
        .from('sessions')
        .select('periode')
        .eq('active', true);
      
      if (periodesError) throw periodesError;
      
      const uniquePeriodes = [...new Set(periodesData.map(item => item.periode))];
      setPeriodes(uniquePeriodes);
      
      // Fetch unique semaines
      const { data: semainesData, error: semainesError } = await supabase
        .from('sessions')
        .select('semaine')
        .eq('active', true)
        .not('semaine', 'is', null);
      
      if (semainesError) throw semainesError;
      
      const uniqueSemaines = [...new Set(semainesData.map(item => item.semaine).filter(Boolean))];
      setSemaines(uniqueSemaines);
      
      // Fetch centers
      const { data: centersData, error: centersError } = await supabase
        .from('centers')
        .select('id, name')
        .eq('active', true)
        .order('name');
      
      if (centersError) throw centersError;
      
      setCenters(centersData || []);
      
      // Fetch stages
      const { data: stagesData, error: stagesError } = await supabase
        .from('stages')
        .select('id, title')
        .eq('active', true)
        .order('title');
      
      if (stagesError) throw stagesError;
      
      setStages(stagesData || []);
      
    } catch (err) {
      console.error('Error fetching filters:', err);
      toast.error('Erreur lors du chargement des filtres');
    }
  };
  
  const fetchSessions = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('sessions')
        .select(`
          id,
          stage_id,
          center_id,
          start_date,
          end_date,
          periode,
          semaine,
          capacity,
          current_registrations,
          stage:stages(title, age_min, age_max),
          center:centers(name),
          registrations:registrations(
            id,
            kid_id,
            activity_id,
            payment_status,
            kid:kids(prenom, nom, date_naissance)
          )
        `)
        .eq('active', true);
      
      // Apply filters
      if (selectedPeriode) {
        query = query.eq('periode', selectedPeriode);
      }
      
      if (selectedSemaine) {
        query = query.eq('semaine', selectedSemaine);
      }
      
      if (selectedCenter) {
        query = query.eq('center_id', selectedCenter);
      }
      
      if (selectedStage) {
        query = query.eq('stage_id', selectedStage);
      }
      
      // Order by start date (descending)
      query = query.order('start_date', { ascending: false });
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      // Process the data
      const processedData = data?.map(session => {
        // Filter registrations by search term if provided
        let filteredRegistrations = session.registrations;
        
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          filteredRegistrations = filteredRegistrations.filter(reg => {
            const kid = Array.isArray(reg.kid) ? reg.kid[0] : reg.kid;
            return (
              kid.prenom.toLowerCase().includes(searchLower) ||
              kid.nom.toLowerCase().includes(searchLower)
            );
          });
        }
        
        // Sort registrations by kid name
        filteredRegistrations.sort((a, b) => {
          const kidA = Array.isArray(a.kid) ? a.kid[0] : a.kid;
          const kidB = Array.isArray(b.kid) ? b.kid[0] : b.kid;
          
          return `${kidA.nom} ${kidA.prenom}`.localeCompare(`${kidB.nom} ${kidB.prenom}`);
        });
        
        return {
          ...session,
          registrations: filteredRegistrations
        };
      }) || [];
      
      // Filter out sessions with no matching registrations if search term is provided
      const filteredSessions = searchTerm 
        ? processedData.filter(session => session.registrations.length > 0)
        : processedData;
      
      setSessions(filteredSessions);
    } catch (err: any) {
      console.error('Error fetching sessions:', err);
      setError(err.message || 'Une erreur est survenue lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRefresh = () => {
    fetchSessions();
    toast.success('Données actualisées');
  };
  
  const toggleSessionExpanded = (sessionId: string) => {
    setExpandedSessions(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };
  
  const handleFilterChange = () => {
    fetchSessions();
  };
  
  const handleExportCSV = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    try {
      // Format session data
      const stage = Array.isArray(session.stage) ? session.stage[0] : session.stage;
      const center = Array.isArray(session.center) ? session.center[0] : session.center;
      
      // Format date range
      const startDate = new Date(session.start_date).toLocaleDateString('fr-FR');
      const endDate = new Date(session.end_date).toLocaleDateString('fr-FR');
      
      // Create CSV header
      const headers = [
        'Nom',
        'Prénom',
        'Date de naissance',
        'Âge',
        'Statut de paiement'
      ];
      
      // Create CSV rows
      const rows = session.registrations.map(reg => {
        const kid = Array.isArray(reg.kid) ? reg.kid[0] : reg.kid;
        
        // Calculate age
        const birthDate = new Date(kid.date_naissance);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        return [
          kid.nom,
          kid.prenom,
          new Date(kid.date_naissance).toLocaleDateString('fr-FR'),
          age.toString(),
          reg.payment_status === 'paid' ? 'Payé' : 'En attente'
        ];
      });
      
      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${stage.title}_${startDate}_${center.name}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Export CSV réussi');
    } catch (err) {
      console.error('Error exporting CSV:', err);
      toast.error('Erreur lors de l\'export CSV');
    }
  };
  
  const calculateAgeAtSessionStart = (birthDateStr: string, sessionStartStr: string) => {
    const birthDate = new Date(birthDateStr);
    const sessionStart = new Date(sessionStartStr);
    
    let age = sessionStart.getFullYear() - birthDate.getFullYear();
    const monthDiff = sessionStart.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && sessionStart.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };
  
  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inscriptions par groupe</h1>
          <p className="text-gray-600">Visualisez les enfants inscrits par groupe avec des filtres</p>
        </div>
        
        <button
          onClick={handleRefresh}
          className="btn-primary flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </button>
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
              Stage
            </label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="form-input w-full"
            >
              <option value="">Tous les stages</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.title}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleFilterChange}
              className="btn-primary w-full"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtrer
            </button>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher un enfant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10 w-full"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <AlertCircle className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Sessions List */}
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
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune inscription trouvée</h3>
          <p className="text-gray-600">
            {selectedPeriode || selectedSemaine || selectedCenter || selectedStage || searchTerm
              ? 'Aucune inscription ne correspond à vos critères de recherche.'
              : 'Il n\'y a pas encore d\'inscriptions.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sessions.map((session) => {
            const stage = Array.isArray(session.stage) ? session.stage[0] : session.stage;
            const center = Array.isArray(session.center) ? session.center[0] : session.center;
            const isExpanded = !!expandedSessions[session.id];
            
            return (
              <div key={session.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                <div 
                  className="p-4 bg-gray-50 border-b flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSessionExpanded(session.id)}
                >
                  <div>
                    <div className="flex items-center">
                      <h3 className="font-semibold text-lg">{stage.title}</h3>
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
                        {session.registrations.length} enfants
                      </span>
                      <span className="ml-2 text-sm text-gray-500">
                        ({session.current_registrations}/{session.capacity} places)
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <Calendar className="h-4 w-4 mr-1" />
                      {new Date(session.start_date).toLocaleDateString('fr-FR')} - {new Date(session.end_date).toLocaleDateString('fr-FR')}
                      <span className="mx-2">•</span>
                      <Building2 className="h-4 w-4 mr-1" />
                      {center.name}
                      {session.semaine && (
                        <>
                          <span className="mx-2">•</span>
                          {session.semaine}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportCSV(session.id);
                      }}
                      className="btn-outline py-1 px-2 text-sm mr-4"
                      title="Exporter en CSV"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="p-4">
                    {session.registrations.length === 0 ? (
                      <p className="text-center text-gray-500 py-4">Aucun enfant inscrit</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Nom
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Prénom
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Date de naissance
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Âge
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Statut
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {session.registrations.map((registration) => {
                              const kid = Array.isArray(registration.kid) ? registration.kid[0] : registration.kid;
                              const age = calculateAgeAtSessionStart(kid.date_naissance, session.start_date);
                              
                              return (
                                <tr key={registration.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {kid.nom}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {kid.prenom}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(kid.date_naissance).toLocaleDateString('fr-FR')}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {age} ans
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={clsx(
                                      "px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full",
                                      registration.payment_status === 'paid' 
                                        ? "bg-green-100 text-green-800" 
                                        : "bg-yellow-100 text-yellow-800"
                                    )}>
                                      {registration.payment_status === 'paid' ? 'Payé' : 'En attente'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminRegistrationsByGroupPage;