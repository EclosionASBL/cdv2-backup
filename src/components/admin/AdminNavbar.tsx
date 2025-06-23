import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutGrid, LogOut, Building2, Calendar, Clock, Users, CreditCard, MessageSquare, Tag, GraduationCap, School, List as ListWait, FileText, Ban, Database, Mail, Receipt, UserCheck, BarChart4 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const AdminNavbar = () => {
  const navigate = useNavigate();
  const { signOut } = useAuthStore();
  
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleMouseEnter = (key: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpenMenu(key);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpenMenu(null);
    }, 200);
  };

  const navGroups = [
    {
      title: 'Centres de vacances',
      key: 'vacances',
      items: [
        { label: 'Centres', icon: Building2, href: '/admin/centers' },
        { label: 'Stages', icon: Calendar, href: '/admin/stages' },
        { label: 'Programmation', icon: Clock, href: '/admin/sessions' },
        { label: 'Liste d\'attente', icon: ListWait, href: '/admin/waiting-list' },
        { label: 'Demandes d\'annulation', icon: Ban, href: '/admin/cancellation-requests' },
        { label: 'Inscriptions par groupe', icon: UserCheck, href: '/admin/registrations-by-group' }
      ]
    },
    {
      title: 'Parascolaire',
      key: 'parascolaire',
      items: [
        { label: 'Activités', icon: Calendar, href: '/admin/parascolaire/activities' },
        { label: 'Programmation', icon: Clock, href: '/admin/parascolaire/sessions' }
      ]
    },
    {
      title: 'Administration',
      key: 'admin',
      items: [
        { label: 'Utilisateurs', icon: Users, href: '/admin/users' },
        { label: 'Paiements', icon: CreditCard, href: '/admin/payments' },
        { label: 'Tableau financier', icon: BarChart4, href: '/admin/financial-overview' },
        { label: 'Notes de crédit', icon: Receipt, href: '/admin/credit-notes' },
        { label: 'Transactions bancaires', icon: Database, href: '/admin/bank-transactions' },
        { label: 'Communication', icon: MessageSquare, href: '/admin/messaging' },
        { label: 'Newsletter', icon: Mail, href: '/admin/newsletter' },
        { label: 'Conditions tarifaires', icon: Tag, href: '/admin/tarifs' },
        { label: 'Écoles', icon: School, href: '/admin/ecoles' },
        { label: 'Demandes d\'inclusion', icon: FileText, href: '/admin/inclusion-requests' }
      ]
    }
  ];

  return (
    <nav className="bg-white shadow relative z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-6">
            <Link to="/admin" className="flex items-center font-semibold text-gray-900">
              <LayoutGrid className="h-5 w-5 text-primary-600 mr-2" />
              Espace Administrateur
            </Link>

            {navGroups.map((group) => (
              <div
                key={group.key}
                className="relative"
                onMouseEnter={() => handleMouseEnter(group.key)}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  className={`text-sm font-medium flex items-center px-3 py-2 ${
                    openMenu === group.key ? 'text-primary-600' : 'text-gray-700'
                  }`}
                >
                  {group.title}
                  <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openMenu === group.key && (
                  <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <item.icon className="h-4 w-4 mr-2" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center text-gray-700 hover:text-primary-600"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default AdminNavbar;