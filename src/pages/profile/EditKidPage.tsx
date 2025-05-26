import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useKidStore } from '../../stores/kidStore';
import { useAuthStore } from '../../stores/authStore';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';

// Form components
import PersonalInfoForm from '../../components/forms/kid/PersonalInfoForm';
import HealthInfoForm from '../../components/forms/kid/HealthInfoForm';
import AllergiesForm from '../../components/forms/kid/AllergiesForm';
import ActivitiesForm from '../../components/forms/kid/ActivitiesForm';
import DepartureForm from '../../components/forms/kid/DepartureForm';
import InclusionForm from '../../components/forms/kid/InclusionForm';

type FormStep = 'personal' | 'health' | 'allergies' | 'activities' | 'departure' | 'inclusion';

interface FormData {
  personal?: any;
  health?: any;
  allergies?: any;
  activities?: any;
  departure?: any;
  inclusion?: any;
}

const EditKidPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { updateKid, fetchKid } = useKidStore();
  
  const [currentStep, setCurrentStep] = useState<FormStep>('personal');
  const [formData, setFormData] = useState<FormData>({});
  const [completedSteps, setCompletedSteps] = useState<FormStep[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const steps: { id: FormStep; label: string }[] = [
    { id: 'personal', label: 'Infos personnelles' },
    { id: 'health', label: 'Données santé' },
    { id: 'allergies', label: 'Allergies' },
    { id: 'activities', label: 'Activités' },
    { id: 'departure', label: 'Sorties' },
    { id: 'inclusion', label: 'Inclusion' },
  ];

  useEffect(() => {
    const loadKidData = async () => {
      if (!id) return;
      
      try {
        const kidData = await fetchKid(id);
        if (!kidData) {
          navigate('/kids');
          return;
        }

        setFormData({
          personal: {
            nom: kidData.nom,
            prenom: kidData.prenom,
            dateNaissance: kidData.date_naissance,
            nNational: kidData.n_national,
            adresse: kidData.adresse,
            cPostal: kidData.cpostal,
            localite: kidData.localite,
            ecole: kidData.ecole,
          },
          health: kidData.health ? {
            specificMedical: kidData.health.specific_medical || '',
            pastMedical: kidData.health.past_medical || '',
            medicationDetails: kidData.health.medication_details || '',
            medicationAutonomy: kidData.health.medication_autonomy || false,
            tetanus: kidData.health.tetanus || false,
            doctorName: kidData.health.doctor_name || '',
            doctorPhone: kidData.health.doctor_phone || '',
          } : {},
          allergies: kidData.allergies ? {
            hasAllergies: kidData.allergies.has_allergies || false,
            allergiesDetails: kidData.allergies.allergies_details || '',
            allergiesConsequences: kidData.allergies.allergies_consequences || '',
            specialDiet: kidData.allergies.special_diet || false,
            dietDetails: kidData.allergies.diet_details || '',
          } : {},
          activities: kidData.activities ? {
            canParticipate: kidData.activities.can_participate || true,
            restrictionDetails: kidData.activities.restriction_details || '',
            canSwim: kidData.activities.can_swim || false,
            waterFear: kidData.activities.water_fear || false,
            otherInfo: kidData.activities.other_info || '',
          } : {},
          departure: kidData.departure ? {
            isSoloDeparture: kidData.departure.leaves_alone || false,
            soloDepartureTime: kidData.departure.departure_time || '',
            authorized_person_ids: kidData.departure.pickup_people_ids || [],
          } : {},
          inclusion: kidData.inclusion ? {
            has_needs: kidData.inclusion.has_needs || false,
            situation_details: kidData.inclusion.situation_details || '',
            impact_details: kidData.inclusion.impact_details || '',
            needs_dedicated_staff: kidData.inclusion.needs_dedicated_staff || '',
            staff_details: kidData.inclusion.staff_details || '',
            strategies: kidData.inclusion.strategies || '',
            assistive_devices: kidData.inclusion.assistive_devices || '',
            stress_signals: kidData.inclusion.stress_signals || '',
            strengths: kidData.inclusion.strengths || '',
            previous_experience: kidData.inclusion.previous_experience || ''
          } : {},
        });

        // Mark all sections as completed initially
        setCompletedSteps(['personal', 'health', 'allergies', 'activities', 'departure', 'inclusion']);
      } catch (error) {
        console.error('Error loading kid data:', error);
        setError('Erreur lors du chargement des données');
      } finally {
        setIsLoading(false);
      }
    };

    loadKidData();
  }, [id, fetchKid, navigate]);

  const handleStepComplete = async (step: FormStep, data: any) => {
    setFormData(prev => ({ ...prev, [step]: data }));
    setCompletedSteps(prev => [...new Set([...prev, step])]);
    
    const currentIndex = steps.findIndex(s => s.id === step);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id);
    } else {
      await handleSubmit(data);
    }
  };

  const handleStepChange = (step: FormStep) => {
    if (completedSteps.includes(step) || step === currentStep) {
      setCurrentStep(step);
    }
  };

  const isStepCompleted = (step: FormStep) => completedSteps.includes(step);

  const handleSubmit = async (finalStepData?: any) => {
    if (!user || !id || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);

      // If we received final step data, update the form data first
      const currentFormData = finalStepData 
        ? { ...formData, inclusion: finalStepData }
        : formData;

      const kidData = {
        // Personal info
        nom: currentFormData.personal?.nom,
        prenom: currentFormData.personal?.prenom,
        date_naissance: currentFormData.personal?.dateNaissance,
        n_national: currentFormData.personal?.nNational,
        adresse: currentFormData.personal?.adresse,
        cpostal: currentFormData.personal?.cPostal,
        localite: currentFormData.personal?.localite,
        ecole: currentFormData.personal?.ecole,
        // Health info
        specific_medical: currentFormData.health?.specificMedical,
        medication_details: currentFormData.health?.medicationDetails,
        medication_autonomy: currentFormData.health?.medicationAutonomy,
        tetanus: currentFormData.health?.tetanus,
        doctor_name: currentFormData.health?.doctorName,
        doctor_phone: currentFormData.health?.doctorPhone,
        // Allergies info
        has_allergies: currentFormData.allergies?.hasAllergies,
        allergies_details: currentFormData.allergies?.allergiesDetails,
        allergies_consequences: currentFormData.allergies?.allergiesConsequences,
        special_diet: currentFormData.allergies?.specialDiet,
        diet_details: currentFormData.allergies?.dietDetails,
        // Activities info
        can_participate: currentFormData.activities?.canParticipate,
        restriction_details: currentFormData.activities?.restrictionDetails,
        can_swim: currentFormData.activities?.canSwim,
        water_fear: currentFormData.activities?.waterFear,
        other_info: currentFormData.activities?.otherInfo,
        // Departure info
        leaves_alone: currentFormData.departure?.isSoloDeparture,
        departure_time: currentFormData.departure?.soloDepartureTime,
        pickup_people_ids: currentFormData.departure?.authorized_person_ids || [],
        // Inclusion info
        ...currentFormData.inclusion
      };

      await updateKid(id, kidData);
      navigate(`/kids/${id}`);
    } catch (error: any) {
      console.error('Error updating kid:', error);
      setError(error.message || "Une erreur s'est produite lors de la mise à jour");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">Modifier les informations</h1>

      {/* Progress steps */}
      <div className="mb-12">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-200 -z-10" />
          
          <div className="grid grid-cols-6 w-full gap-4">
            {steps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => handleStepChange(step.id)}
                className={clsx(
                  "flex flex-col items-center relative",
                  (isStepCompleted(step.id) || step.id === currentStep) ? "cursor-pointer" : "cursor-not-allowed"
                )}
              >
                <div className={clsx(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 mb-2",
                  isStepCompleted(step.id)
                    ? "bg-green-500 border-green-500 text-white"
                    : step.id === currentStep
                    ? "bg-primary-600 border-primary-600 text-white"
                    : "bg-white border-gray-300 text-gray-500"
                )}>
                  {isStepCompleted(step.id) ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <span className={clsx(
                  "text-xs font-medium text-center",
                  step.id === currentStep
                    ? "text-primary-600"
                    : isStepCompleted(step.id)
                    ? "text-green-500"
                    : "text-gray-500"
                )}>
                  {step.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Form steps */}
      <div className="bg-white rounded-xl shadow-md p-6">
        {currentStep === 'personal' && (
          <PersonalInfoForm
            onComplete={(data) => handleStepComplete('personal', data)}
            initialData={formData.personal}
          />
        )}
        {currentStep === 'health' && (
          <HealthInfoForm
            onComplete={(data) => handleStepComplete('health', data)}
            initialData={formData.health}
          />
        )}
        {currentStep === 'allergies' && (
          <AllergiesForm
            onComplete={(data) => handleStepComplete('allergies', data)}
            initialData={formData.allergies}
          />
        )}
        {currentStep === 'activities' && (
          <ActivitiesForm
            onComplete={(data) => handleStepComplete('activities', data)}
            initialData={formData.activities}
          />
        )}
        {currentStep === 'departure' && (
          <DepartureForm
            onComplete={(data) => handleStepComplete('departure', data)}
            initialData={formData.departure}
          />
        )}
        {currentStep === 'inclusion' && (
          <InclusionForm
            onComplete={(data) => handleStepComplete('inclusion', data)}
            initialData={formData.inclusion}
          />
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditKidPage;