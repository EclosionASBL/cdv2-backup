import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdminStore } from '../../stores/adminStore';
import { 
  Building2, 
  Calendar, 
  Users, 
  TrendingUp,
  CreditCard,
  MessageSquare,
  Clock,
  GraduationCap,
  ChevronRight
} from 'lucide-react';

const AdminDashboardPage = () => {
  const { centers, stages, sessions, fetchCenters, fetchStages, fetchSessions } = useAdminStore();
  
  useEffect(() => {
    fetchCenters();
    fetchStages();
    fetchSessions();
  }, [fetchCenters, fetchStages, fetchSessions]);

  const holidayCenterCards = [
    {
      title: 'Centres',
      value: centers.length,
      icon: Building2,
      link: '/admin/centers',
      color: 'bg-blue-500'
    },
    {
      title: 'Stages',
      value: stages.length,
      icon: Calendar,
      link: '/admin/stages',
      color: 'bg-green-500'
    },
    {
      title: 'Sessions',
      value: sessions.length,
      icon: Clock,
      link: '/admin/sessions',
      color: 'bg-purple-500'
    }
  ];

  const parascolaireCards = [
    {
      title: 'Activités parascolaires',
      value: '-',
      icon: GraduationCap,
      link: '/admin/parascolaire',
      color: 'bg-amber-500'
    }
  ];

  const adminCards = [
    {
      title: 'Utilisateurs',
      value: '-',
      icon: Users,
      link: '/admin/users',
      color: 'bg-yellow-500'
    },
    {
      title: 'Paiements',
      value: '-',
      icon: CreditCard,
      link: '/admin/payments',
      color: 'bg-red-500'
    },
    {
      title: 'Communication',
      value: '-',
      icon: MessageSquare,
      link: '/admin/messaging',
      color: 'bg-indigo-500'
    }
  ];

  const CardGrid = ({ title, cards }: { title: string, cards: any[] }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <Link
            key={card.title}
            to={card.link}
            className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${card.color} bg-opacity-10`}>
                  <card.icon className={`h-6 w-6 ${card.color.replace('bg-', 'text-')}`} />
                </div>
                <span className="text-3xl font-bold">{card.value}</span>
              </div>
              <h3 className="text-gray-600 font-medium">{card.title}</h3>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Tableau de bord</h1>

      <div className="space-y-12">
        <CardGrid title="Centres de vacances" cards={holidayCenterCards} />
        <CardGrid title="Parascolaire" cards={parascolaireCards} />
        <CardGrid title="Administration" cards={adminCards} />
      </div>
    </div>
  );
};

export default AdminDashboardPage;