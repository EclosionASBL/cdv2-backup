import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useKidStore } from '../../stores/kidStore';
import { PlusCircle, User } from 'lucide-react';
import { useState } from 'react';

const ImageWithFallback = ({ src, alt, className }: { src: string | null, alt: string, className?: string }) => {
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const handleError = () => {
    if (retryCount < maxRetries) {
      const timeout = Math.pow(2, retryCount) * 1000;
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setError(false);
      }, timeout);
    } else {
      setError(true);
    }
  };

  if (error || !src) {
    return (
      <div className={className}>
        <User className="h-full w-full text-primary-500 p-3" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={handleError}
      key={retryCount}
    />
  );
};

const KidsPage = () => {
  const { user } = useAuthStore();
  const { kids, isLoading, error, fetchKids, getPhotoUrl } = useKidStore();

  useEffect(() => {
    if (user) {
      fetchKids();
    }
  }, [user, fetchKids]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mes enfants</h1>
        <Link
          to="/kids/new"
          className="btn-primary flex items-center"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          Ajouter un enfant
        </Link>
      </div>

      {kids.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">
            Vous n'avez pas encore ajouté d'enfant.
          </p>
          <Link
            to="/kids/new"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Ajouter un enfant
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {kids.map((kid) => {
            const photoUrl = getPhotoUrl(kid.id);
            
            return (
              <Link
                key={kid.id}
                to={`/kids/${kid.id}`}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full overflow-hidden bg-primary-100 flex-shrink-0">
                    <ImageWithFallback
                      src={photoUrl}
                      alt={`${kid.prenom} ${kid.nom}`}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div>
                    <h2 className="font-semibold text-gray-900">
                      {kid.prenom} {kid.nom}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      {new Date(kid.date_naissance).toLocaleDateString('fr-BE')}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default KidsPage;