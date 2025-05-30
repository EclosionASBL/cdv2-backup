import { useEffect, useState } from 'react';
import { useAdminStore } from '../../stores/adminStore';
import { useTarifConditionStore } from '../../stores/tarifConditionStore';
import { useWaitingListStore } from '../../stores/waitingListStore';
import { Plus, AlertTriangle, Loader2, List as ListWait, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';

// New Components
import SessionFilters from './components/SessionFilters';
import SessionTable from './components/SessionTable';
import SessionFormModal from './components/SessionFormModal';

interface SessionFormData {
  stage_id: string;
  center_id: string;
  periode: 'Détente' | 'Printemps' | 'Été' | 'Automne' | 'Hiver';
  semaine?: string;
  start_date: string;
  end_date: string;
  nombre_jours?: number;
  capacity: number;
  prix_normal: number;
  prix_reduit?: number;
  prix_local?: number;
  prix_local_reduit?: number;
  remarques?: string;
  tarif_condition_id?: string;
  visible_from?: string;
}

const PERIODES = ['Détente', 'Printemps', 'Été', 'Automne', 'Hiver'] as const;

const AdminSessionsPage = () => {
  const { sessions, stages, centers, isLoading, error, fetchSessions, fetchStages, fetchCenters, createSession, updateSession, deleteSession } = useAdminStore();
  const { conditions, fetchConditions } = useTarifConditionStore();
  const { entries: waitingListEntries, fetchWaitingList } = useWaitingListStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [formData, setFormData] = useState<SessionFormData>({
    stage_id: '',
    center_id: '',
    periode: 'Été',
    semaine: '',
    start_date: '',
    end_date: '',
    capacity: 0,
    prix_normal: 0,
    prix_reduit: 0
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filter state
  const [selectedCenter, setSelectedCenter] = useState<string | null>(null);
  const [selectedPeriode, setSelectedPeriode] = useState<string | null>(null);
  const [selectedSemaine, setSelectedSemaine] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const handleDuplicate = (session: Session) => {
    setEditingSession(null);
    setFormData({
      stage_id: session.stage_id,
      center_id: session.center_id,
      periode: session.periode,
      semaine: session.semaine,
      start_date: session.start_date,
      end_date: session.end_date,
      nombre_jours: session.nombre_jours,
      capacity: session.capacity,
      prix_normal: session.prix_normal,
      prix_reduit: session.prix_reduit || undefined,
      prix_local: session.prix_local || undefined,
      prix_local_reduit: session.prix_local_reduit || undefined,
      remarques: session.remarques || '',
      tarif_condition_id: session.tarif_condition_id || undefined,
      visible_from: session.visible_from
    });
    setIsModalOpen(true);
  };

  useEffect(() => {
    fetchSessions();
    fetchStages();
    fetchCenters();
    fetchConditions();
    fetchWaitingList();
  }, [fetchSessions, fetchStages, fetchCenters, fetchConditions, fetchWaitingList]);

  const handleOpenModal = (session?: any) => {
    if (session) {
      setEditingSession(session);
      setFormData({
        stage_id: session.stage_id,
        center_id: session.center_id,
        periode: session.periode,
        semaine: session.semaine,
        start_date: session.start_date,
        end_date: session.end_date,
        nombre_jours: session.nombre_jours,
        capacity: session.capacity,
        prix_normal: session.prix_normal,
        prix_reduit: session.prix_reduit,
        prix_local: session.prix_local,
        prix_local_reduit: session.prix_local_reduit,
        remarques: session.remarques,
        tarif_condition_id: session.tarif_condition_id,
        visible_from: session.visible_from
      });
    } else {
      setEditingSession(null);
      setFormData({
        stage_id: '',
        center_id: '',
        periode: 'Été',
        semaine: '',
        start_date: '',
        end_date: '',
        capacity: 0,
        prix_normal: 0,
        prix_reduit: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sessionData = {
        stage_id: formData.stage_id,
        center_id: formData.center_id,
        semaine: formData.semaine,
        periode: formData.periode,
        start_date: formData.start_date,
        end_date: formData.end_date,
        nombre_jours: formData.nombre_jours,
        capacity: parseInt(formData.capacity.toString()),
        prix_normal: parseFloat(formData.prix_normal.toString()),
        prix_reduit: formData.prix_reduit ? parseFloat(formData.prix_reduit.toString()) : null,
        prix_local: formData.prix_local ? parseFloat(formData.prix_local.toString()) : null,
        prix_local_reduit: formData.prix_local_reduit ? parseFloat(formData.prix_local_reduit.toString()) : null,
        remarques: formData.remarques,
        tarif_condition_id: formData.tarif_condition_id,
        visible_from: formData.visible_from,
        active: true
      };

      if (editingSession) {
        await updateSession(editingSession.id, sessionData);
      } else {
        await createSession(sessionData);
      }
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error saving session:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSession(id);
      setDeleteId(null);
    } catch (error: any) {
      console.error('Error deleting session:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchSessions();
      toast.success('Données actualisées');
    } catch (error) {
      toast.error('Erreur lors de l\'actualisation');
      console.error('Error refreshing sessions:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredSessions = sessions.filter((s) =>
    (!selectedCenter || s.center_id === selectedCenter) &&
    (!selectedPeriode || s.periode === selectedPeriode) &&
    (!selectedSemaine || s.semaine === selectedSemaine) &&
    (!selectedStage || s.stage_id === selectedStage)
  );

  // Count waiting list entries for each session
  const waitingListCounts = waitingListEntries.reduce((acc, entry) => {
    if (!acc[entry.activity_id]) {
      acc[entry.activity_id] = 0;
    }
    if (entry.status === 'waiting' || entry.status === 'invited') {
      acc[entry.activity_id]++;
    }
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programmation des stages</h1>
          <p className="text-gray-600 mt-1">Gérez les sessions de stages et leur planification</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn-outline flex items-center"
          >
            <RefreshCw className={`h-5 w-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <Link
            to="/admin/waiting-list"
            className="btn-outline flex items-center"
          >
            <ListWait className="h-5 w-5 mr-2" />
            Liste d'attente
          </Link>
          <button
            onClick={() => handleOpenModal()}
            className="btn-primary flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nouvelle session
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-start">
          <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <SessionFilters
        selectedCenter={selectedCenter}
        selectedPeriode={selectedPeriode}
        selectedSemaine={selectedSemaine}
        selectedStage={selectedStage}
        onCenterChange={setSelectedCenter}
        onPeriodeChange={setSelectedPeriode}
        onSemaineChange={setSelectedSemaine}
        onStageChange={setSelectedStage}
        centers={centers}
        stages={stages}
        periodes={PERIODES}
      />

      <SessionTable
        sessions={filteredSessions}
        stages={stages}
        centers={centers}
        handleOpenModal={handleOpenModal}
        handleDuplicate={handleDuplicate}
        setDeleteId={setDeleteId}
        waitingListCounts={waitingListCounts}
      />

      <SessionFormModal
        isModalOpen={isModalOpen}
        editingSession={editingSession}
        formData={formData}
        setFormData={setFormData}
        handleSubmit={handleSubmit}
        setIsModalOpen={setIsModalOpen}
        stages={stages}
        centers={centers}
        conditions={conditions}
      />

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="bg-red-100 rounded-full p-2 mr-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Confirmer la suppression
              </h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer cette session ? Cette action est irréversible.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteId(null)}
                className="btn-outline"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="btn-primary bg-red-600 hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
      <Toaster position="top-right" />
    </div>
  );
};

export default AdminSessionsPage;