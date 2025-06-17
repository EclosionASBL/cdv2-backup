import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useKidStore } from '../stores/kidStore';
import { CalendarDays, User, AlertTriangle, Users, PlusCircle, Loader2, CheckCircle, Clock, FileText, Bell, CreditCard, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import clsx from 'clsx';
import { getAgeFromDate } from '../utils/date';

interface Registration {
  id: string;
  payment_status: string;
  amount_paid: number;
  created_at: string;
  kid_id: string;
  activity_id: string;
  price_type: string;
  reduced_declaration: boolean;
  invoice_id: string | null;
  kid: {
    prenom: string;
    nom: string;
  };
  session: {
    stage: {
      title: string;
    };
    start_date: string;
    end_date: string;
    center: {
      name: string;
    };
  };
}

interface UserBalance {
  gross_balance: number;
  net_balance: number;
  total_invoiced: number;
  total_paid: number;
  total_pending: number;
  total_credits: number;
}

const DashboardPage = () => {
  const { user, profile, fetchProfile } = useAuthStore();
  const { kids, fetchKids } = useKidStore();
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoadingRegistrations, setIsLoadingRegistrations] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  useEffect(() => {
    if (user && !profile) {
      fetchProfile();
    }
    if (user) {
      fetchKids();
      fetchRegistrations();
      fetchInvoices();
      fetchUserBalance();
    }
  }, [user, profile, fetchProfile, fetchKids]);

  const fetchRegistrations = async () => {
    if (!user) return;
    
    try {
      setIsLoadingRegistrations(true);
      setRegistrationError(null);
      
      const { data, error } = await supabase
        .from('registrations')
        .select(`
          id,
          payment_status,
          amount_paid,
          kid:kid_id(
            prenom,
            nom
          ),
          session:activity_id(
            stage:stage_id(
              title
            ),
            start_date,
            end_date,
            center:center_id(
              name
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      
      setRegistrations(data || []);
    } catch (err: any) {
      console.error('Error fetching registrations:', err);
      setRegistrationError('Error fetching registrations');
    } finally {
      setIsLoadingRegistrations(false);
    }
  };

  const fetchInvoices = async () => {
    if (!user) return;
    
    try {
      setIsLoadingInvoices(true);
      
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      
      setInvoices(data || []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const fetchUserBalance = async () => {
    if (!user) return;
    
    try {
      setIsLoadingBalance(true);
      
      const { data, error } = await supabase.rpc('calculate_user_balance', {
        p_user_id: user.id
      });
      
      if (error) throw error;
      setUserBalance(data[0]);
    } catch (err) {
      console.error('Error fetching user balance:', err);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const hasValidNN =
    !!profile?.nnational && !['EMPTY', '000', 'NULL'].includes(profile.nnational);

  // Check if user is eligible for tax certificate
  const isTaxCertificateEligible = profile?.account_type === 'parent' && profile?.is_legal_guardian === true && hasValidNN;

  // TODO replace with real query later
  const hasCertificates = false;

  if (!profile) {
    return null;
  }

  return (
    <div className="container max-w-7xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">Tableau de bord</h1>
      
      <div className="grid md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-primary-100 rounded-lg mr-4">
              <User className="h-6 w-6 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold">Mon profil</h2>
          </div>
          
          <div className="space-y-3 text-gray-600">
            {profile.account_type === 'parent' ? (
              <p>
                <span className="font-medium">Nom complet:</span>{' '}
                {profile.prenom} {profile.nom}
              </p>
            ) : (
              <>
                <p>
                  <span className="font-medium">Organisation:</span>{' '}
                  {profile.organisation_name}
                </p>
                <p>
                  <span className="font-medium">Contact:</span>{' '}
                  {profile.prenom} {profile.nom}
                </p>
              </>
            )}
            <p>
              <span className="font-medium">Adresse:</span>{' '}
              {profile.adresse}, {profile.cpostal} {profile.localite}
            </p>
            <p>
              <span className="font-medium">Téléphone:</span>{' '}
              {profile.telephone}
            </p>
            
            {profile.account_type === 'parent' && (
              <div className={clsx(
                "mt-4 p-3 rounded-lg text-sm",
                isTaxCertificateEligible 
                  ? "bg-green-50 text-green-700"
                  : "bg-yellow-50 text-yellow-700"
              )}>
                <div className="flex items-start">
                  {isTaxCertificateEligible ? (
                    <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  )}
                  <p>
                    {isTaxCertificateEligible 
                      ? "Vous êtes éligible pour recevoir des attestations fiscales." 
                      : profile.account_type === 'parent' && profile.is_legal_guardian && !hasValidNN
                        ? "Vous pouvez bénéficier d'attestations fiscales, mais il nous manque votre numéro de registre national."
                        : "Vous n'êtes pas éligible pour recevoir des attestations fiscales car vous n'êtes pas indiqué comme tuteur légal."}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={() => navigate('/profile')}
            className="btn-outline mt-4"
          >
            Modifier mon profil
          </button>
        </div>
        
        {/* Kids Card */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="p-2 bg-primary-100 rounded-lg mr-4">
                <Users className="h-6 w-6 text-primary-600" />
              </div>
              <h2 className="text-xl font-semibold">Mes enfants</h2>
            </div>
            <button
              onClick={() => navigate('/kids/new')}
              className="btn-primary flex items-center text-sm"
            >
              <PlusCircle className="h-4 w-4 mr-1" />
              Ajouter
            </button>
          </div>
          
          {kids.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500 mb-4">Aucun enfant enregistré</p>
              <button
                onClick={() => navigate('/kids/new')}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Ajouter un enfant
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {kids.map((kid) => (
                <div
                  key={kid.id}
                  onClick={() => navigate(`/kids/${kid.id}`)}
                  className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center mr-3">
                    {kid.photo_url ? (
                      <img 
                        src={kid.photo_signed_url || kid.photo_url}
                        alt={`${kid.prenom}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-primary-600 font-medium">
                        {kid.prenom[0]}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{kid.prenom} {kid.nom}</p>
                    <p className="text-sm text-gray-500">
                      {getAgeFromDate(kid.date_naissance)} ans
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Financial Summary Card */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-primary-100 rounded-lg mr-4">
              <CreditCard className="h-6 w-6 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold">Situation financière</h2>
          </div>
          
          {isLoadingBalance ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : userBalance ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total facturé:</span>
                <span className="font-medium">{formatCurrency(userBalance.total_invoiced)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total payé:</span>
                <span className="font-medium text-green-600">{formatCurrency(userBalance.total_paid)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Notes de crédit:</span>
                <span className="font-medium text-blue-600">{formatCurrency(userBalance.total_credits)}</span>
              </div>
              
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{userBalance.net_balance < 0 ? 'Votre crédit:' : 'Solde à payer:'}</span>
                  <span className={clsx(
                    "font-bold text-lg",
                    userBalance.net_balance > 0 ? "text-yellow-600" : "text-green-600"
                  )}>
                    {formatCurrency(Math.abs(userBalance.net_balance))}
                  </span>
                </div>
              </div>
              
              {userBalance.net_balance > 0 && (
                <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-700">
                  <div className="flex items-start">
                    <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                    <p>Veuillez régler ce montant selon les instructions sur vos factures</p>
                  </div>
                </div>
              )}
              
              {userBalance.net_balance <= 0 && (
                <div className="bg-green-50 p-3 rounded-lg text-sm text-green-700">
                  <div className="flex items-start">
                    <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                    <p>
                      {userBalance.net_balance === 0 
                        ? "Toutes vos factures sont payées" 
                        : `Un remboursement de ${formatCurrency(Math.abs(userBalance.net_balance))} vous sera versé`}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="text-center pt-2">
                <Link to="/profile/invoices" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                  Voir toutes mes factures
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-600 mb-4">Aucune information financière disponible</p>
              <button
                onClick={fetchUserBalance}
                className="text-primary-600 hover:text-primary-700 font-medium flex items-center mx-auto"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Actualiser
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Registrations Card */}
      <div className="mt-8 bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center mb-4">
          <div className="p-2 bg-primary-100 rounded-lg mr-4">
            <CalendarDays className="h-6 w-6 text-primary-600" />
          </div>
          <div className="flex items-center">
            <h2 className="text-xl font-semibold">Mes inscriptions</h2>
            {profile?.has_new_registration_notification && (
              <span className="ml-2 flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
          </div>
        </div>
        
        {isLoadingRegistrations ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : registrationError ? (
          <div className="text-center py-6">
            <p className="text-red-600 mb-4">{registrationError}</p>
            <button 
              onClick={fetchRegistrations}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Réessayer
            </button>
          </div>
        ) : registrations.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-600 mb-4">Aucune inscription en cours.</p>
            <Link to="/activities" className="text-primary-600 hover:text-primary-700 font-medium">
              Découvrir les stages
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {registrations.map((reg) => (
              <div key={reg.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{reg.session.stage.title}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(reg.session.start_date).toLocaleDateString('fr-FR')} - {new Date(reg.session.end_date).toLocaleDateString('fr-FR')}
                    </p>
                    <p className="text-sm text-gray-600">
                      Pour: {reg.kid.prenom} {reg.kid.nom}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      reg.payment_status === 'paid' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {reg.payment_status === 'paid' ? (
                        <><CheckCircle className="h-3 w-3 mr-1" /> Payé</>
                      ) : (
                        <><Clock className="h-3 w-3 mr-1" /> En attente</>
                      )}
                    </span>
                    <span className="text-sm font-medium mt-1">{reg.amount_paid} €</span>
                  </div>
                </div>
              </div>
            ))}
            
            {registrations.length > 0 && (
              <div className="text-center pt-2">
                <Link to="/registrations" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                  Voir toutes mes inscriptions
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invoices Section */}
      <div className="mt-8 bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="p-2 bg-primary-100 rounded-lg mr-4">
              <FileText className="h-6 w-6 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold">Mes factures récentes</h2>
          </div>
          <Link
            to="/profile/invoices"
            className="text-primary-600 hover:text-primary-700 font-medium text-sm"
          >
            Voir toutes mes factures
          </Link>
        </div>
        
        {isLoadingInvoices ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-600">Aucune facture disponible.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">Facture {invoice.invoice_number}</h3>
                    <p className="text-sm text-gray-600">
                      Émise le {new Date(invoice.created_at).toLocaleDateString('fr-FR')}
                    </p>
                    {invoice.due_date && (
                      <p className="text-sm text-gray-600">
                        Échéance: {new Date(invoice.due_date).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={clsx(
                      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                      invoice.status === 'paid' 
                        ? 'bg-green-100 text-green-800' 
                        : invoice.status === 'cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    )}>
                      {invoice.status === 'paid' ? (
                        <><CheckCircle className="h-3 w-3 mr-1" /> Payé</>
                      ) : invoice.status === 'cancelled' ? (
                        <><AlertTriangle className="h-3 w-3 mr-1" /> Annulé</>
                      ) : (
                        <><Clock className="h-3 w-3 mr-1" /> En attente</>
                      )}
                    </span>
                    <span className="text-sm font-medium mt-1">{invoice.amount} €</span>
                    
                    {invoice.pdf_url && (
                      <a 
                        href={invoice.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700 text-xs mt-2 flex items-center"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Voir la facture
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tax Certificate Section - only shown for eligible users */}
      {isTaxCertificateEligible && (
        <div className="mt-8 bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-primary-100 rounded-lg mr-4">
              <FileText className="h-6 w-6 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold">Attestations fiscales</h2>
          </div>
          
          <p className="text-gray-600 mb-4">
            {hasCertificates
              ? "En tant que tuteur légal, vous pouvez télécharger les attestations fiscales pour les frais de garde de vos enfants."
              : "Les attestations seront disponibles prochainement."}
          </p>
          
          <button className="btn-primary" disabled={!hasCertificates}>
            Télécharger les attestations
          </button>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;