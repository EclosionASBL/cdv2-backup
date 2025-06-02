import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthStore } from './stores/authStore';

// Layouts
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import AdminLayout from './components/admin/AdminLayout';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/profile/ProfilePage';
import KidsPage from './pages/profile/KidsPage';
import NewKidPage from './pages/profile/NewKidPage';
import EditKidPage from './pages/profile/EditKidPage';
import KidDetailsPage from './pages/profile/KidDetailsPage';
import InvoicesPage from './pages/profile/InvoicesPage';
import AuthorizedPersonsPage from './pages/authorized-persons/AuthorizedPersonsPage';
import NewAuthorizedPersonPage from './pages/authorized-persons/NewAuthorizedPersonPage';
import EditAuthorizedPersonPage from './pages/authorized-persons/EditAuthorizedPersonPage';
import ActivitiesPage from './pages/activities/ActivitiesPage';
import ActivityDetailsPage from './pages/activities/ActivityDetailsPage';
import CartPage from './pages/checkout/CartPage';
import CheckoutPage from './pages/checkout/CheckoutPage';
import OrderConfirmationPage from './pages/checkout/OrderConfirmationPage';
import InvoiceConfirmationPage from './pages/checkout/InvoiceConfirmationPage';
import RegistrationsPage from './pages/registrations/RegistrationsPage';
import NotFoundPage from './pages/NotFoundPage';

// Admin Pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminCentersPage from './pages/admin/AdminCentersPage';
import AdminStagesPage from './pages/admin/AdminStagesPage';
import AdminSessionsPage from './pages/admin/AdminSessionsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage';
import AdminMessagingPage from './pages/admin/AdminMessagingPage';
import AdminParascolaireActivitiesPage from './pages/admin/AdminParascolaireActivitiesPage';
import AdminParascolaireSessionsPage from './pages/admin/AdminParascolaireSessionsPage';
import AdminTarifConditionsPage from './pages/admin/AdminTarifConditionsPage';
import AdminSchoolsPage from './pages/admin/AdminSchoolsPage';
import AdminWaitingListPage from './pages/admin/AdminWaitingListPage';
import AdminInclusionRequestsPage from './pages/admin/AdminInclusionRequestsPage';

// Components
import LoadingScreen from './components/common/LoadingScreen';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/admin/AdminRoute';

function App() {
  const { user, setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Check for password recovery in URL
    const checkPasswordRecovery = async () => {
      // If we're on the reset-password page and there's a recovery token in the URL
      if (location.pathname === '/reset-password' && location.hash.includes('type=recovery')) {
        // The ResetPasswordPage component will handle the recovery flow
        return;
      }
    };

    checkPasswordRecovery();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setUser, location, navigate]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Public & parent routes */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />

        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
          />
          <Route 
            path="/register" 
            element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} 
          />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/invoices" element={<InvoicesPage />} />
          <Route path="/kids" element={<KidsPage />} />
          <Route path="/kids/new" element={<NewKidPage />} />
          <Route path="/kids/edit/:id" element={<EditKidPage />} />
          <Route path="/kids/:id" element={<KidDetailsPage />} />
          <Route path="/authorized-persons" element={<AuthorizedPersonsPage />} />
          <Route path="/authorized-persons/new" element={<NewAuthorizedPersonPage />} />
          <Route path="/authorized-persons/edit/:id" element={<EditAuthorizedPersonPage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/activities/:id" element={<ActivityDetailsPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
          <Route path="/invoice-confirmation" element={<InvoiceConfirmationPage />} />
          <Route path="/registrations" element={<RegistrationsPage />} />
        </Route>
      </Route>

      {/* Admin routes */}
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/centers" element={<AdminCentersPage />} />
          <Route path="/admin/stages" element={<AdminStagesPage />} />
          <Route path="/admin/sessions" element={<AdminSessionsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/payments" element={<AdminPaymentsPage />} />
          <Route path="/admin/messaging" element={<AdminMessagingPage />} />
          <Route path="/admin/parascolaire" element={<AdminParascolaireActivitiesPage />} />
          <Route path="/admin/parascolaire/sessions" element={<AdminParascolaireSessionsPage />} />
          <Route path="/admin/tarifs" element={<AdminTarifConditionsPage />} />
          <Route path="/admin/ecoles" element={<AdminSchoolsPage />} />
          <Route path="/admin/waiting-list" element={<AdminWaitingListPage />} />
          <Route path="/admin/inclusion-requests" element={<AdminInclusionRequestsPage />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;