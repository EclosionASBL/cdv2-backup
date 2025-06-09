import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import clsx from 'clsx';

interface CancellationRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
  registrationDetails: {
    id: string;
    kid: {
      prenom: string;
      nom: string;
    };
    session: {
      stage: {
        title: string;
      };
      start_date: string;
      end_date: string;
      center: {
        name: string;
      };
    };
  } | null;
  isLoading: boolean;
}

export const CancellationRequestModal = ({
  isOpen,
  onClose,
  onConfirm,
  registrationDetails,
  isLoading
}: CancellationRequestModalProps) => {
  const [notes, setNotes] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Calculate days until start date
  const daysUntilStart = registrationDetails ? Math.ceil(
    (new Date(registrationDetails.session.start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  ) : 0;

  const isLessThan10Days = daysUntilStart < 10;

  const handleConfirm = () => {
    if (!isConfirmed || isLoading) return;
    onConfirm(notes);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-start mb-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <div className="ml-3">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Demande d'annulation
              </Dialog.Title>
            </div>
          </div>

          {registrationDetails && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-medium">{registrationDetails.session.stage.title}</p>
              <p className="text-sm text-gray-600">
                Pour: {registrationDetails.kid.prenom} {registrationDetails.kid.nom}
              </p>
              <p className="text-sm text-gray-600">
                Du {new Date(registrationDetails.session.start_date).toLocaleDateString('fr-FR')} au {new Date(registrationDetails.session.end_date).toLocaleDateString('fr-FR')}
              </p>
              <p className="text-sm text-gray-600">
                Centre: {registrationDetails.session.center.name}
              </p>
            </div>
          )}

          <div className="mt-2">
            <p className="text-sm text-gray-600">
              Vous êtes sur le point de demander l'annulation de cette inscription. Cette demande sera envoyée à l'équipe administrative pour confirmation.
            </p>
            
            {isLessThan10Days && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-800 font-medium">
                  Attention : Le stage commence dans moins de 10 jours
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Votre demande sera étudiée par l'ASBL Éclosion qui pourra la refuser ou appliquer des frais d'annulation selon les circonstances.
                </p>
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motif de l'annulation (facultatif)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={3}
                placeholder="Veuillez indiquer la raison de votre demande d'annulation..."
                disabled={isLoading}
              />
            </div>

            <div className="mt-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  disabled={isLoading}
                />
                <span className="text-sm text-gray-700">
                  Je confirme ma demande d'annulation et comprends que celle-ci sera soumise à validation
                </span>
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline"
              disabled={isLoading}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isConfirmed || isLoading}
              className={clsx(
                "btn-primary",
                (!isConfirmed || isLoading) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Traitement en cours...
                </span>
              ) : (
                'Confirmer la demande'
              )}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};