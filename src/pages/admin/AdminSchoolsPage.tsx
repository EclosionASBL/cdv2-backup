import { useEffect, useState } from 'react';
import { useSchoolStore } from '../../stores/schoolStore';
import { Plus, Pencil, Trash2, AlertTriangle, Loader2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';

interface SchoolFormData {
  name: string;
  code_postal: string;
}

const AdminSchoolsPage = () => {
  const { schools, isLoading, error, fetchSchools, createSchool, updateSchool, deleteSchool } = useSchoolStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<SchoolFormData>();

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const handleOpenModal = (school?: any) => {
    if (school) {
      setEditingSchool(school);
      reset({
        name: school.name,
        code_postal: school.code_postal
      });
    } else {
      setEditingSchool(null);
      reset({
        name: '',
        code_postal: ''
      });
    }
    setIsModalOpen(true);
  };

  const onSubmit = async (data: SchoolFormData) => {
    try {
      if (editingSchool) {
        await updateSchool(editingSchool.id, data);
      } else {
        await createSchool(data);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving school:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSchool(id);
      setDeleteId(null);
    } catch (error) {
      console.error('Error deleting school:', error);
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Écoles</h1>
          <p className="text-gray-600 mt-1">Gérez la liste des écoles</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouvelle école
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
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code postal
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {schools.map((school) => (
                <tr key={school.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {school.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {school.code_postal}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleOpenModal(school)}
                      className="text-primary-600 hover:text-primary-900 mr-4"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(school.id)}
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

      {/* School Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingSchool ? 'Modifier l\'école' : 'Nouvelle école'}
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
                  Nom
                </label>
                <input
                  type="text"
                  className={`mt-1 form-input ${errors.name ? 'border-red-500' : ''}`}
                  {...register('name', { required: 'Ce champ est requis' })}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Code postal
                </label>
                <input
                  type="text"
                  className={`mt-1 form-input ${errors.code_postal ? 'border-red-500' : ''}`}
                  {...register('code_postal', { required: 'Ce champ est requis' })}
                />
                {errors.code_postal && (
                  <p className="mt-1 text-sm text-red-600">{errors.code_postal.message}</p>
                )}
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
                  {editingSchool ? 'Mettre à jour' : 'Créer'}
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
              Êtes-vous sûr de vouloir supprimer cette école ? Cette action est irréversible.
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

export default AdminSchoolsPage;