import { Outlet } from 'react-router-dom';
import { CalendarCheck, UserPlus } from 'lucide-react';

const AuthLayout = () => {
  return (
    <div className="container max-w-6xl mx-auto py-10 px-4 md:px-6">
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div className="hidden md:block">
          <div className="bg-primary-50 p-8 rounded-xl">
            <h2 className="text-3xl font-bold text-primary-800 mb-4">
              Stages pour enfants
            </h2>
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="bg-white p-2 rounded-full">
                  <CalendarCheck size={24} className="text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-primary-700">
                    Inscrivez vos enfants facilement
                  </h3>
                  <p className="text-slate-600">
                    Un processus simple pour inscrire vos enfants aux stages de leur choix
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="bg-white p-2 rounded-full">
                  <UserPlus size={24} className="text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-primary-700">
                    Créez un compte en quelques minutes
                  </h3>
                  <p className="text-slate-600">
                    Gérez les profils de vos enfants et suivez leurs inscriptions
                  </p>
                </div>
              </div>
              
              <div className="mt-8">
                <img 
                  src="https://images.pexels.com/photos/8617855/pexels-photo-8617855.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
                  alt="Enfants en activité" 
                  className="rounded-lg shadow-lg"
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md p-6 md:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;