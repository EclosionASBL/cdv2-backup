import { Dialog } from '@headlessui/react';
import { X, User, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import clsx from 'clsx';

interface ImageWithFallbackProps {
  src: string | null;
  alt: string;
  className?: string;
}

export const ImageWithFallback = ({ src, alt, className }: ImageWithFallbackProps) => {
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const handleError = () => {
    if (retryCount < maxRetries) {
      // Exponential backoff: wait longer between each retry
      const timeout = Math.pow(2, retryCount) * 1000;
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setError(false); // Reset error to trigger a new load attempt
      }, timeout);
    } else {
      setError(true);
    }
  };

  if (error || !src) {
    return (
      <div className={clsx("bg-gray-100 flex items-center justify-center", className)}>
        <User className="h-12 w-12 text-gray-400" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={handleError}
      key={retryCount} // Force re-render on retry
    />
  );
};

interface ActivityModalProps {
  activity: any;
  isOpen: boolean;
  onClose: () => void;
}

const ActivityModal = ({ activity, isOpen, onClose }: ActivityModalProps) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  if (!activity) return null;
  
  const isSessionFull = (activity.current_registrations || 0) >= activity.capacity;

  const handleRegisterClick = () => {
    navigate('/login');
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-50" />

        <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <ImageWithFallback
                src={activity.stage.image_url}
                alt={activity.stage.title}
                className="h-32 w-32 object-cover rounded-lg"
              />
              <div>
                <h2 className="text-2xl font-bold">{activity.stage.title}</h2>
                <div className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-accent-500 text-white mt-2">
                  {activity.periode}
                </div>
                {isSessionFull && (
                  <div className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-red-500 text-white mt-2 ml-2">
                    Complet
                  </div>
                )}
              </div>
            </div>

            <div className="prose prose-sm max-w-none">
              <p>{activity.stage.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-semibold text-gray-700">Dates</h3>
                <p>{new Date(activity.start_date).toLocaleDateString('fr-FR')} - {new Date(activity.end_date).toLocaleDateString('fr-FR')}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700">Places disponibles</h3>
                <p>{isSessionFull ? 'Complet' : `${activity.capacity - (activity.current_registrations || 0)}/${activity.capacity} places`}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700">Prix</h3>
                <p className="text-primary-600 font-bold">
                  {activity.calculated_main_price ?? activity.prix_normal} €
                  {(activity.calculated_reduced_price ?? activity.prix_reduit) && (
                    <span className="text-sm text-gray-500 ml-2">
                      (Réduit: {activity.calculated_reduced_price ?? activity.prix_reduit} €)
                    </span>
                  )}
                </p>
                {activity.calculated_main_price !== activity.prix_normal && (
                  <span className="inline-block mt-1 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    Tarif local appliqué
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-gray-700">Centre</h3>
                <p>{activity.center.name}</p>
              </div>
            </div>

            {!user && !isSessionFull && (
              <div className="mt-4">
                <button
                  onClick={handleRegisterClick}
                  className="w-full btn-primary py-3 flex items-center justify-center"
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  Inscrire mon enfant
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default ActivityModal;