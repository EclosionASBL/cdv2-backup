import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { 
  Menu, X, ShoppingCart, ChevronDown, 
  User, LogOut, Home, CalendarDays, Users, UserPlus 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { user, signOut } = useAuthStore();
  const { itemCount } = useCartStore();
  const navigate = useNavigate();
  
  const toggleMenu = () => setIsOpen(!isOpen);
  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);
  
  const handleSignOut = async () => {
    try {
      // First check if we have a session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // If we have a session, attempt to sign out
        await signOut();
      } else {
        // If no session exists, just clear the local auth state
        await supabase.auth.signOut();
        localStorage.removeItem('sb-kids-camp-auth');
      }
      
      // Always navigate to home page after sign out attempt
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error during sign out:', error);
      // Even if there's an error, clear local state and redirect
      localStorage.removeItem('sb-kids-camp-auth');
      navigate('/', { replace: true });
    }
  };
  
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <CalendarDays className="h-8 w-8 text-primary-600" />
              <span className="ml-2 text-xl font-bold text-primary-800">Éclosion ASBL</span>
            </Link>
            
            {/* Desktop menu */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
              <Link 
                to="/"
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50"
              >
                Accueil
              </Link>
              <Link 
                to="/activities"
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50"
              >
                Stages
              </Link>
              {user ? (
                <>
                  <Link 
                    to="/dashboard"
                    className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50"
                  >
                    Tableau de bord
                  </Link>
                  <Link 
                    to="/kids"
                    className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50"
                  >
                    Mes enfants
                  </Link>
                  <Link 
                    to="/authorized-persons"
                    className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50"
                  >
                    Personnes autorisées
                  </Link>
                </>
              ) : null}
            </div>
          </div>
          
          {/* Right side nav items */}
          <div className="hidden sm:flex sm:items-center sm:ml-6">
            {user ? (
              <>
                <Link 
                  to="/cart" 
                  className="relative p-2 text-gray-600 hover:text-primary-600 mr-4"
                >
                  <ShoppingCart size={20} />
                  {itemCount() > 0 && (
                    <span className="absolute -top-1 -right-1 bg-accent-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {itemCount()}
                    </span>
                  )}
                </Link>
                
                <div className="relative ml-3">
                  <button
                    onClick={toggleDropdown}
                    className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-primary-600 focus:outline-none"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <User size={18} className="text-primary-600" />
                    </div>
                    <span>Mon compte</span>
                    <ChevronDown size={16} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isDropdownOpen && (
                    <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                      <div className="py-1">
                        <Link
                          to="/profile"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Mon profil
                        </Link>
                        <Link
                          to="/kids"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Mes enfants
                        </Link>
                        <Link
                          to="/dashboard"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Mes inscriptions
                        </Link>
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Se déconnecter
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary-600"
                >
                  Se connecter
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  S'inscrire
                </Link>
              </div>
            )}
          </div>
          
          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            {user && (
              <Link 
                to="/cart" 
                className="relative p-2 text-gray-600 mr-2"
              >
                <ShoppingCart size={20} />
                {itemCount() > 0 && (
                  <span className="absolute -top-1 -right-1 bg-accent-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {itemCount()}
                  </span>
                )}
              </Link>
            )}
            <button
              onClick={toggleMenu}
              className="p-2 rounded-md text-gray-500 hover:text-primary-600 hover:bg-gray-100 focus:outline-none"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {isOpen && (
        <div className="sm:hidden bg-white border-b">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link 
              to="/"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50"
              onClick={toggleMenu}
            >
              <div className="flex items-center">
                <Home size={18} className="mr-2" />
                Accueil
              </div>
            </Link>
            <Link 
              to="/activities"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50"
              onClick={toggleMenu}
            >
              <div className="flex items-center">
                <CalendarDays size={18} className="mr-2" />
                Stages
              </div>
            </Link>
            
            {user ? (
              <>
                <Link 
                  to="/dashboard"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50"
                  onClick={toggleMenu}
                >
                  <div className="flex items-center">
                    <User size={18} className="mr-2" />
                    Tableau de bord
                  </div>
                </Link>
                <Link 
                  to="/kids"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50"
                  onClick={toggleMenu}
                >
                  <div className="flex items-center">
                    <Users size={18} className="mr-2" />
                    Mes enfants
                  </div>
                </Link>
                <Link 
                  to="/authorized-persons"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50"
                  onClick={toggleMenu}
                >
                  <div className="flex items-center">
                    <UserPlus size={18} className="mr-2" />
                    Personnes autorisées
                  </div>
                </Link>
                <button
                  onClick={() => {
                    handleSignOut();
                    toggleMenu();
                  }}
                  className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50"
                >
                  <div className="flex items-center">
                    <LogOut size={18} className="mr-2" />
                    Se déconnecter
                  </div>
                </button>
              </>
            ) : (
              <div className="mt-4 flex flex-col space-y-2 px-3">
                <Link
                  to="/login"
                  className="px-4 py-2 text-center text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50"
                  onClick={toggleMenu}
                >
                  Se connecter
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-center text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700"
                  onClick={toggleMenu}
                >
                  S'inscrire
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;