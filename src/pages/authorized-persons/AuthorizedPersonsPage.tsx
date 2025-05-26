import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthorizedPersonsStore } from '../../stores/authorizedPersonsStore';
import { PlusCircle, Loader2, User, Phone, AlertTriangle } from 'lucide-react';

const AuthorizedPersonsPage = () => {
  const { persons, fetchPersons, isLoading, deletePerson } = useAuthorizedPersonsStore();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchPersons();
  }, [fetchPersons]);

  const handleDelete = async (id: string) => {
    try {
      await deletePerson(id);
      setDeleteId(null);
    } catch (error) {
      console.error('Error deleting person:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Personnes autorisées</h1>
        <Link
          to="/authorized-persons/new"
          className="btn-primary flex items-center"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          Ajouter une personne
        </Link>
      </div>

      {persons.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">
            Vous n'avez pas encore ajouté de personnes autorisées.
          </p>
          <Link
            to="/authorized-persons/new"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Ajouter une personne autorisée
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {persons.map((person) => (
            <div
              key={person.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-center space-x-4">
                  {person.photo_url ? (
                    <div className="h-16 w-16 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                      <img 
                        src={person.photo_url}
                        alt={`${person.first_name} ${person.last_name}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <User className="h-8 w-8 text-primary-600" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {person.first_name} {person.last_name}
                    </h2>
                    <p className="text-gray-600">{person.relationship}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center text-gray-600">
                  <Phone className="h-4 w-4 mr-2" />
                  {person.phone_number}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <Link
                    to={`/authorized-persons/edit/${person.id}`}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Modifier
                  </Link>
                  <button
                    onClick={() => setDeleteId(person.id)}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
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
              Êtes-vous sûr de vouloir supprimer cette personne autorisée ? Cette action est irréversible.
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

export default AuthorizedPersonsPage;