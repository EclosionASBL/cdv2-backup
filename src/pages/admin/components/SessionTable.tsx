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
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Centre
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Période
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Semaine
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dates
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Places
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prix
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Inscrits
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Liste d'attente
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sessions.map((session) => (
              <tr key={session.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {stages.find(s => s.id === session.stage_id)?.title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {centers.find(c => c.id === session.center_id)?.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {session.periode}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {session.semaine || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(session.start_date).toLocaleDateString()} - {new Date(session.end_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {session.capacity}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {session.prix_normal} €
                  {session.prix_reduit && (
                    <span className="text-xs text-gray-400 ml-1">
                      (Réduit: {session.prix_reduit} €)
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {/* TODO: Replace with actual number of registrations */}
                  0
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
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
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleOpenModal(session)}
                    className="text-primary-600 hover:text-primary-900 mr-2"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDuplicate(session)}
                    className="text-blue-600 hover:text-blue-900 mr-2"
                    title="Dupliquer la session"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(session.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SessionTable;