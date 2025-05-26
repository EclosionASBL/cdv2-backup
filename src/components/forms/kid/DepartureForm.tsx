import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Dialog } from '@headlessui/react';
import { Plus, Trash2, X, Pencil, Clock, User, AlertTriangle } from 'lucide-react';
import { useAuthorizedPersonsStore } from '../../../stores/authorizedPersonsStore';
import AuthorizedPersonForm from '../AuthorizedPersonForm';
import clsx from 'clsx';

interface DepartureFormData {
  isSoloDeparture: boolean;
  soloDepartureTime?: string;
  authorized_person_ids?: string[];
}

interface DepartureFormProps {
  onComplete: (data: DepartureFormData) => void;
  initialData?: DepartureFormData;
}

const DepartureForm = ({ onComplete, initialData }: DepartureFormProps) => {
  const navigate = useNavigate();
  const { persons, fetchPersons, deletePerson } = useAuthorizedPersonsStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<DepartureFormData>({
    defaultValues: {
      isSoloDeparture: initialData?.isSoloDeparture || false,
      soloDepartureTime: initialData?.soloDepartureTime || '',
      authorized_person_ids: initialData?.authorized_person_ids || []
    }
  });

  const isSoloDeparture = watch('isSoloDeparture');
  const selectedPersonIds = watch('authorized_person_ids') || [];

  useEffect(() => {
    fetchPersons();
  }, [fetchPersons]);

  const handlePersonSelect = (personId: string) => {
    const currentIds = selectedPersonIds;
    const newIds = currentIds.includes(personId)
      ? currentIds.filter(id => id !== personId)
      : [...currentIds, personId];
    setValue('authorized_person_ids', newIds);
  };

  const handleDeletePerson = async (id: string) => {
    try {
      await deletePerson(id);
      // Remove from selected ids if present
      if (selectedPersonIds.includes(id)) {
        setValue('authorized_person_ids', selectedPersonIds.filter(pid => pid !== id));
      }
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Error deleting person:', error);
    }
  };

  const onSubmit = (data: DepartureFormData) => {
    const isValid = data.isSoloDeparture
      ? !!data.soloDepartureTime
      : (data.authorized_person_ids?.length || 0) > 0;

    if (!isValid) {
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    onComplete(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Autorisations de sortie</h2>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="isSoloDeparture"
              {...register('isSoloDeparture')}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
            />
            <label htmlFor="isSoloDeparture" className="text-sm font-medium text-gray-700">
              L'enfant peut partir seul
            </label>
          </div>

          {isSoloDeparture && (
            <div className="ml-7">
              <label htmlFor="soloDepartureTime" className="block text-sm font-medium text-gray-700">
                Heure de départ autorisée
              </label>
              <div className="mt-1 relative">
                <input
                  type="time"
                  id="soloDepartureTime"
                  {...register('soloDepartureTime', {
                    required: isSoloDeparture ? 'Ce champ est requis' : false
                  })}
                  className={clsx(
                    'form-input pl-10',
                    errors.soloDepartureTime && 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  )}
                />
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
              {errors.soloDepartureTime && (
                <p className="mt-1 text-sm text-red-600">{errors.soloDepartureTime.message}</p>
              )}
            </div>
          )}
        </div>

        {!isSoloDeparture && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Personnes autorisées à venir chercher l'enfant</h3>
              <button
                type="button"
                onClick={() => {
                  setEditingPerson(null);
                  setIsModalOpen(true);
                }}
                className="btn-primary flex items-center text-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </button>
            </div>

            {persons.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <User className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune personne autorisée</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Commencez par ajouter une personne autorisée à venir chercher l'enfant.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {persons.map((person) => (
                  <div
                    key={person.id}
                    className={clsx(
                      'bg-white border rounded-lg p-4 transition-colors',
                      selectedPersonIds.includes(person.id)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedPersonIds.includes(person.id)}
                        onChange={() => handlePersonSelect(person.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="ml-3 flex-grow">
                        <p className="text-sm font-medium text-gray-900">
                          {person.first_name} {person.last_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {person.relationship} • {person.phone_number}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPerson(person.id);
                            setIsModalOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-500"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(person.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isSoloDeparture && selectedPersonIds.length === 0 && (
              <p className="text-sm text-red-600">
                Veuillez sélectionner au moins une personne autorisée
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between mt-6 pt-6 border-t">
        <button
          type="button"
          onClick={() => navigate('/kids')}
          className="btn-outline"
        >
          Annuler
        </button>
        <button type="submit" className="btn-primary">
          Suivant
        </button>
      </div>

      {/* Add/Edit Person Modal */}
      <Dialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
            <div className="absolute top-4 right-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <Dialog.Title className="text-lg font-medium mb-4">
              {editingPerson ? 'Modifier une personne' : 'Ajouter une personne'}
            </Dialog.Title>

            <AuthorizedPersonForm
              initialData={editingPerson ? persons.find(p => p.id === editingPerson) : undefined}
              onComplete={() => {
                setIsModalOpen(false);
                fetchPersons();
              }}
            />
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
            <div className="flex items-center mb-4">
              <div className="bg-red-100 rounded-full p-2 mr-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <Dialog.Title className="text-lg font-medium">
                Confirmer la suppression
              </Dialog.Title>
            </div>

            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer cette personne ? Cette action est irréversible.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="btn-outline"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => deleteConfirmId && handleDeletePerson(deleteConfirmId)}
                className="btn-primary bg-red-600 hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </Dialog>
    </form>
  );
};

export default DepartureForm;