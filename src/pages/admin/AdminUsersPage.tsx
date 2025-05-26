import { Users } from 'lucide-react';

const AdminUsersPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>
          <p className="text-gray-600">Gérez les comptes utilisateurs et leurs rôles</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-center h-48 text-gray-500">
          <div className="text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">Fonctionnalité à venir</p>
            <p className="text-sm">La gestion des utilisateurs sera bientôt disponible</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsersPage;