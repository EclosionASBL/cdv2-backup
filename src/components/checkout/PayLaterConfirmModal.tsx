import { Dialog } from '@headlessui/react';
import { FileText, AlertCircle } from 'lucide-react';

interface PayLaterConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const PayLaterConfirmModal = ({ isOpen, onClose, onConfirm }: PayLaterConfirmModalProps) => {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="flex min-h-screen items-center justify-center p-4">
        <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
          <Dialog.Title className="text-lg font-medium mb-4">
            Confirmation de paiement différé
          </Dialog.Title>

          <div className="mb-6">
            <div className="flex items-start space-x-3 mb-4">
              <FileText className="h-5 w-5 text-primary-600 flex-shrink-0 mt-1" />
              <div>
                <p className="text-gray-700 mb-2">
                  En choisissant cette option, vous recevrez une facture par email à régler dans les 30 jours.
                </p>
                <p className="text-gray-700">
                  L'inscription ne sera définitivement confirmée qu'après réception du paiement.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 p-3 rounded-lg">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="ml-2 text-sm text-amber-700">
                  Si le paiement n'est pas reçu dans les délais, l'inscription pourra être annulée et la place libérée pour un autre participant.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="btn-outline"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              className="btn-primary"
            >
              Confirmer
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default PayLaterConfirmModal;