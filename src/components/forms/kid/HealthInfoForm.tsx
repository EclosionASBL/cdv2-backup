import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';

interface HealthFormData {
  specificMedical: string;
  pastMedical: string;
  medication: boolean;
  medicationDetails: string;
  medicationAutonomy: boolean;
  tetanus: boolean;
  doctorName: string;
  doctorPhone: string;
  parentalConsent: boolean;
}

interface HealthInfoFormProps {
  onComplete: (data: HealthFormData) => void;
  initialData?: any;
  kidId?: string;
  kidName?: string;
}

export const MEDICATION_NOTICE = `Les animateurs disposent d'une boîte de premiers soins. Dans des situations ponctuelles ou dans l'attente de l'arrivée du médecin, ils peuvent administrer les médicaments cités ci‑dessous et ce à bon escient : paracétamol, désinfectant, pommade réparatrice en cas de brûlure solaire et calmante en cas de piqûre d'insectes.

En cas d'urgence, les parents/tuteurs seront avertis le plus rapidement possible. Néanmoins, s'ils ne sont pas joignables et que l'urgence le requiert, l'intervention se fera sans leur consentement.`;

export const PARENTAL_CONSENT_TEXT = `« Je marque mon accord pour que la prise en charge ou les traitements estimés nécessaires soient entrepris durant le séjour de mon enfant par le responsable de centre de vacances ou par le service médical qui y est associé. J'autorise le médecin local à prendre les décisions qu'il juge urgentes et indispensables pour assurer l'état de santé de l'enfant, même s'il s'agit d'une intervention chirurgicale. »

Traduction anglaise : « I hereby agree that, during the stay of my child, the responsible for the holiday centre or its medical service may take any required measure in order to provide adequate healthcare to my child. I also grant the local doctor the right to take any urgent and indispensable decision in order to ensure the health of my child, even in case of surgery. »`;

const HealthInfoForm = ({ onComplete, initialData }: HealthInfoFormProps) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [formData, setFormData] = useState<HealthFormData>({
    specificMedical: '',
    pastMedical: '',
    medication: false,
    medicationDetails: '',
    medicationAutonomy: false,
    tetanus: false,
    doctorName: '',
    doctorPhone: '',
    parentalConsent: false
  });
  const [submitAttempt, setSubmitAttempt] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData
      }));
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempt(true);
    
    // Validate form data
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.parentalConsent) {
      newErrors.parentalConsent = 'Vous devez marquer votre accord pour continuer';
    }

    if (!formData.specificMedical.trim()) {
      newErrors.specificMedical = 'Ce champ est requis';
    }

    if (!formData.pastMedical.trim()) {
      newErrors.pastMedical = 'Ce champ est requis';
    }

    if (formData.medication && !formData.medicationDetails.trim()) {
      newErrors.medicationDetails = 'Veuillez préciser les détails de la médication';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    onComplete(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Informations médicales</h2>

        {/* GDPR Notice */}
        <p className="text-sm text-gray-600 leading-5 mb-4">
          Ces informations seront utilisées pour le suivi journalier de votre enfant
          et sont réservées à une utilisation interne par les collaborateurs et,
          le cas échéant, par les prestataires de santé consultés. Conformément à
          la loi sur le traitement des données personnelles, vous pouvez les consulter
          et les modifier à tout moment. Ces données seront détruites un an après le
          séjour si aucun dossier n'est ouvert.
        </p>
        
        {/* Medical notice */}
        <div className="p-4 bg-yellow-50 rounded-lg">
          <p className="whitespace-pre-line text-sm text-gray-800">{MEDICATION_NOTICE}</p>
        </div>

        {/* Medical information textareas */}
        <div>
          <label htmlFor="specificMedical" className="block text-sm font-medium text-gray-700">
            Informations médicales importantes
          </label>
          <textarea
            id="specificMedical"
            value={formData.specificMedical}
            onChange={(e) => setFormData(prev => ({ ...prev, specificMedical: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 min-h-[130px]"
            rows={4}
            placeholder="Si rien à signaler, écrivez : « Tout va bien »."
          />
          <p className="mt-1 text-sm text-gray-500">Précisez la fréquence / conduite à tenir si nécessaire.</p>
          {errors.specificMedical && (
            <p className="mt-1 text-sm text-red-600">{errors.specificMedical}</p>
          )}
        </div>

        <div>
          <label htmlFor="pastMedical" className="block text-sm font-medium text-gray-700">
            Antécédents médicaux
          </label>
          <textarea
            id="pastMedical"
            value={formData.pastMedical}
            onChange={(e) => setFormData(prev => ({ ...prev, pastMedical: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 min-h-[130px]"
            rows={4}
            placeholder="Si aucun antécédent, écrivez : « Tout va bien »."
          />
          <p className="mt-1 text-sm text-gray-500">Ajoutez l'année quand c'est pertinent.</p>
          {errors.pastMedical && (
            <p className="mt-1 text-sm text-red-600">{errors.pastMedical}</p>
          )}
        </div>

        {/* Medication section */}
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="medication"
              checked={formData.medication}
              onChange={(e) => setFormData(prev => ({ ...prev, medication: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="medication" className="ml-2 block text-sm text-gray-700">
              L'enfant doit-il prendre des médicaments ?
            </label>
          </div>

          {formData.medication && (
            <>
              <div>
                <label htmlFor="medicationDetails" className="block text-sm font-medium text-gray-700">
                  Détails de la médication
                </label>
                <textarea
                  id="medicationDetails"
                  value={formData.medicationDetails}
                  onChange={(e) => setFormData(prev => ({ ...prev, medicationDetails: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 min-h-[130px]"
                  rows={4}
                  placeholder="Précisez les médicaments et la posologie"
                />
                {errors.medicationDetails && (
                  <p className="mt-1 text-sm text-red-600">{errors.medicationDetails}</p>
                )}
                <p className="text-sm text-gray-600 mt-2">
                  Nous vous enverrons le formulaire d'autorisation par email après cette étape. Veuillez le signer et l'apporter le premier jour.
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="medicationAutonomy"
                  checked={formData.medicationAutonomy}
                  onChange={(e) => setFormData(prev => ({ ...prev, medicationAutonomy: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="medicationAutonomy" className="ml-2 block text-sm text-gray-700">
                  L'enfant peut-il prendre ses médicaments de manière autonome ?
                </label>
              </div>
            </>
          )}
        </div>

        {/* Tetanus section */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="tetanus"
            checked={formData.tetanus}
            onChange={(e) => setFormData(prev => ({ ...prev, tetanus: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="tetanus" className="ml-2 block text-sm text-gray-700">
            L'enfant est-il vacciné contre le tétanos ?
          </label>
        </div>

        {/* Doctor section */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="doctorName" className="block text-sm font-medium text-gray-700">
              Nom du médecin traitant
            </label>
            <input
              type="text"
              id="doctorName"
              value={formData.doctorName}
              onChange={(e) => setFormData(prev => ({ ...prev, doctorName: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="doctorPhone" className="block text-sm font-medium text-gray-700">
              Téléphone du médecin
            </label>
            <input
              type="tel"
              id="doctorPhone"
              value={formData.doctorPhone}
              onChange={(e) => setFormData(prev => ({ ...prev, doctorPhone: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Parental consent */}
        <div className="mt-6">
          <p className="whitespace-pre-line text-sm text-gray-700">{PARENTAL_CONSENT_TEXT}</p>

          <div className="mt-4 flex items-center">
            <input
              type="checkbox"
              id="parentalConsent"
              checked={formData.parentalConsent}
              onChange={e => setFormData(prev => ({ ...prev, parentalConsent: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="parentalConsent" className="ml-2 text-sm text-gray-700">
              Oui, je marque mon accord.
            </label>
          </div>
          {submitAttempt && !formData.parentalConsent && (
            <p className="text-red-500 text-sm mt-1">Vous devez marquer votre accord pour continuer.</p>
          )}
        </div>
      </div>

      <div className="flex justify-between mt-6 pt-6 border-t">
        <button
          type="button"
          onClick={() => navigate('/kids')}
          className="btn-outline"
        >
          Annuler
        </button>
        <div className="flex space-x-4">
          <button type="submit" className="btn-primary">
            Suivant
          </button>
        </div>
      </div>
    </form>
  );
};

export default HealthInfoForm;