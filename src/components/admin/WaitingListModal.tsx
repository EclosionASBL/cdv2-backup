import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { useWaitingListStore } from '../../stores/waitingListStore';
import { Loader2, X, Clock, Users, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface WaitingListModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityId: string;
}

const WaitingListModal = ({ isOpen, onClose, activityId }: WaitingListModalProps) => {
  const { entries, fetchWaitingList, isLoading, offerSeat } = useWaitingListStore();
  const [processingEntry, setProcessingEntry] = useState<string | null>(null);
  
  useEffect(() => {
    if (isOpen && activityId) {
      fetchWaitingList();
    }
  }, [isOpen, activityId, fetchWaitingList]);
  
  // Filter waiting list entries for this activity
  const activityWaitingList = entries
    .filter(entry => 
      entry.activity_id === activityId && 
      (entry.status === 'waiting' || entry.status === 'invited')
    )
    .sort((a, b) => {
      // Sort by status (waiting first, then invited) and then by created_at
      if (a.status === 'waiting' && b.status !== 'waiting') return -1;
      if (a.status !== 'waiting' && b.status === 'waiting') return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const handleOfferSeat = async (id: string) => {
    try {
      setProcessingEntry(id);
      await offerSeat(id);
      toast.success('Place offerte avec succès');
    } catch (error) {
      console.error('Error offering seat:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setProcessingEntry(null);
    }
  };

  // Unwrap arrays for kid and parent if needed
  const unwrapEntry = (entry: any) => {
    const kid = Array.isArray(entry.kid) ? entry.kid[0] : entry.kid;
    const parent = Array.isArray(entry.parent) ? entry.parent[0] : entry.parent;
    const session = Array.isArray(entry.session) ? entry.session[0] : entry.session;
    return { ...entry, kid, parent, session };
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose} 
      className="fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="flex min-h-screen items-center justify-center p-4">
        <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-5xl w-full mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <Dialog.Title className="text-lg font-semibold flex items-center">
              <Users className="h-5 w-5 text-amber-600 mr-2" />
              Liste d'attente pour cette activité
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : activityWaitingList.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun enfant en liste d'attente</h3>
              <p className="text-gray-600">
                Il n'y a pas d'enfants en liste d'attente pour cette activité.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Enfant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Parent
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Téléphone
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date d'ajout
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activityWaitingList.map((entry, index) => {
                    // Unwrap nested objects
                    const unwrappedEntry = unwrapEntry(entry);
                    
                    return (
                      <tr key={unwrappedEntry.id} className={clsx(
                        "hover:bg-gray-50",
                        unwrappedEntry.status === 'invited' && "bg-blue-50"
                      )}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          #{index + 1}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {unwrappedEntry.kid?.prenom} {unwrappedEntry.kid?.nom}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {unwrappedEntry.parent?.prenom} {unwrappedEntry.parent?.nom}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {unwrappedEntry.parent?.email}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {unwrappedEntry.parent?.telephone || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {new Date(unwrappedEntry.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={clsx(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                            unwrappedEntry.status === 'waiting' 
                              ? "bg-amber-100 text-amber-800" 
                              : "bg-blue-100 text-blue-800"
                          )}>
                            <Clock className="h-3 w-3 mr-1" />
                            {unwrappedEntry.status === 'waiting' ? 'En attente' : 'Invité'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          {unwrappedEntry.status === 'waiting' ? (
                            <button
                              onClick={() => handleOfferSeat(unwrappedEntry.id)}
                              disabled={processingEntry === unwrappedEntry.id}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              {processingEntry === unwrappedEntry.id ? (
                                <span className="flex items-center">
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                  Envoi...
                                </span>
                              ) : (
                                "Offrir la place"
                              )}
                            </button>
                          ) : (
                            <span className="text-gray-400">Déjà invité</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="mt-6 flex justify-between">
            <Link
              to={`/admin/waiting-list?activity=${activityId}`}
              className="text-primary-600 hover:text-primary-700 flex items-center text-sm font-medium"
            >
              <LinkIcon className="h-4 w-4 mr-1" />
              Voir la liste d'attente complète
            </Link>
            
            <button
              onClick={onClose}
              className="btn-outline"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default WaitingListModal;