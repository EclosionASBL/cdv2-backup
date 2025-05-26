import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

const NotFoundPage = () => {
  return (
    <div className="container max-w-3xl mx-auto py-12 px-4 text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Page non trouvée</h1>
      <p className="text-lg text-gray-600 mb-8">
        Désolé, la page que vous recherchez n'existe pas.
      </p>
      <Link
        to="/"
        className="btn-primary inline-flex items-center"
      >
        <Home className="mr-2 h-5 w-5" />
        Retour à l'accueil
      </Link>
    </div>
  );
};

export default NotFoundPage;