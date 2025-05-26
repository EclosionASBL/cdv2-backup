import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import LoadingScreen from '../common/LoadingScreen';

const AdminRoute = () => {
  const { user, profile, isLoading } = useAuthStore();
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  // Check if user is authenticated
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  // Check if user has admin role in app_metadata
  const isAdmin = user.app_metadata?.role === 'admin' || profile?.role === 'admin';
  
  if (!isAdmin) {
    return <Navigate to="/" />;
  }
  
  return <Outlet />;
};

export default AdminRoute;