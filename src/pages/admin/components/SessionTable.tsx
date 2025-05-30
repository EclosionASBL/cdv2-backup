import { Pencil, Trash2, Copy, List as ListWait } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

interface SessionTableProps {
  sessions: any[];
  stages: { id: string; title: string }[];
  centers: { id: string; name: string }[];
  handleOpenModal: (session?: any) => void;
  handleDuplicate: (session: any) => void;
  setDeleteId: (id: string | null) => void;
  waitingListCounts?: Record<string, number>;
}

const SessionTable = ({
  sessions,
  stages,
  centers,
  handleOpenModal,
  handleDuplicate,
  setDeleteId,
  waitingListCounts = {}
}: SessionTableProps) => {
  // Fonction pour formater les dates
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stage
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Centre
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Période
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Semaine
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dates
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Places
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prix
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Inscrits
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Attente
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sessions.map((session) => {
              const stage = stages.find(s => s.id === session.stage_id);
              const center = centers.find(c => c.id === session.center_id);
              const registrationCount = session.current_registrations || 0;
              const remainingPlaces = session.capacity - registrationCount;
              const isFull = remainingPlaces <= 0;
              
              return (
                <tr key={session.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 max-w-[150px] truncate" title={stage?.title}>
                      {stage?.title}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-500 max-w-[120px] truncate" title={center?.name}>
                      {center?.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {session.periode}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {session.semaine || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(session.start_date)} - {formatDate(session.end_date)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {session.capacity}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      {session.prix_normal} €
                      {session.prix_reduit && (
                        <div className="text-xs text-gray-400">
                          Réduit: {session.prix_reduit} €
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={clsx(
                      "font-medium",
                      isFull ? "text-red-600" : "text-gray-700"
                    )}>
                      {registrationCount}
                    </span>
                    <span className="text-gray-500">/{session.capacity}</span>
                    {isFull && (
                      <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Complet
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {waitingListCounts[session.id] ? (
                      <Link 
                        to="/admin/waiting-list" 
                        className={clsx(
                          "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                          "bg-amber-100 text-amber-800"
                        )}
                      >
                        <ListWait className="h-3 w-3 mr-1" />
                        {waitingListCounts[session.id]}
                      </Link>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleOpenModal(session)}
                        className="text-primary-600 hover:text-primary-900"
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(session)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Dupliquer la session"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(session.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SessionTable;