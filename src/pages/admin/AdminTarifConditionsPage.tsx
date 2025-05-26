import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTarifConditionStore } from '../../stores/tarifConditionStore';
import { useSchoolStore } from '../../stores/schoolStore';
import { Plus, Pencil, Trash2, AlertTriangle, Loader2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';

interface TarifConditionFormData {
  label: string;
  code_postaux_autorises: string;
  school_ids: string[];
}

const AdminTarifConditionsPage = () => {
  const navigate = useNavigate();
  const { conditions, isLoading, error, fetchConditions, createCondition, updateCondition, deleteCondition } = useTarifConditionStore();
  const { schools, fetchSchools } = useSchoolStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCondition, setEditingCondition] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<TarifConditionFormData>();

  useEffect(() => {
    fetchConditions();
    fetchSchools();
  }, [fetchConditions, fetchSchools]);

  const handleOpenModal = (condition?: any) => {
    if (condition) {
      setEditingCondition(condition);
      reset({
        label: condition.label,
        code_postaux_autorises: condition.code_postaux_autorises.join(', '),
        school_ids: condition.school_ids || []
      });
    } else {
      setEditingCondition(null);
      reset({
        label: '',
        code_postaux_autorises: '',
        school_ids: []
      });
    }
    setIsModalOpen(true);
  };

  const onSubmit = async (data: TarifConditionFormData) => {
    try {
      const formattedData = {
        label: data.label,
        code_postaux_autorises: data.code_postaux_autorises.split(',').map(code => code.trim()),
        school_ids: data.school_ids,
        active: true
      };

      if (editingCondition) {
        await updateCondition(editingCondition.id, formattedData);
      } else {
        await createCondition(formattedData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving condition:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCondition(id);
      setDeleteId(null);
    } catch (error) {
      console.error('Error deleting condition:', error);
    }
  };

  const getSchoolNames = (schoolIds: string[]) => {
    return schoolIds
      ?.map(id => {
        const school = schools.find(s => s.id === id);
        return school ? `${school.name} (${school.code_postal})` : '';
      })
      .filter(Boolean)
      .join(', ');
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Conditions tarifaires</h1>
          <p className="text-gray-600 mt-1">Gérez les conditions d'accès aux tarifs spéciaux</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouvelle condition
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-start">
          <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Label
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Codes postaux autorisés
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Écoles autorisées
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {conditions.map((condition) => (
                <tr key={condition.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {condition.label}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {condition.code_postaux_autorises.join(', ')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {getSchoolNames(condition.school_ids || [])}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleOpenModal(condition)}
                      className="text-primary-600 hover:text-primary-900 mr-4"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(condition.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingCondition ? 'Modifier la condition' : 'Nouvelle condition'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Label
                </label>
                <input
                  type="text"
                  className={`mt-1 form-input ${errors.label ? 'border-red-500' : ''}`}
                  placeholder="Ex: Tarif Boitsfort"
                  {...register('label', { required: 'Ce champ est requis' })}
                />
                {errors.label && (
                  <p className="mt-1 text-sm text-red-600">{errors.label.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Codes postaux autorisés
                </label>
                <input
                  type="text"
                  className={`mt-1 form-input ${errors.code_postaux_autorises ? 'border-red-500' : ''}`}
                  placeholder="Ex: 1170, 1160"
                  {...register('code_postaux_autorises', { required: 'Ce champ est requis' })}
                />
                <p className="mt-1 text-xs text-gray-500">Séparez les codes postaux par des virgules</p>
                {errors.code_postaux_autorises && (
                  <p className="mt-1 text-sm text-red-600">{errors.code_postaux_autorises.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Écoles autorisées
                  </label>
                  <Link
                    to="/admin/ecoles"
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    ➕ Créer une nouvelle école
                  </Link>
                </div>
                <select
                  multiple
                  className={`mt-1 form-input ${errors.school_ids ? 'border-red-500' : ''}`}
                  {...register('school_ids')}
                >
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>
                      {school.name} ({school.code_postal})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Maintenez Ctrl (Cmd sur Mac) pour sélectionner plusieurs écoles</p>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-outline"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  {editingCondition ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              Êtes-vous sûr de vouloir supprimer cette condition tarifaire ? Cette action est irréversible.
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
    </div>
  );
};

export default AdminTarifConditionsPage;