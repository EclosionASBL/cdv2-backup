import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKidStore } from '../../stores/kidStore';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { validateBelgianNRN } from '../../utils/validateBelgianNRN';
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
  personal?: {
    nom: string;
    prenom: string;
    dateNaissance: string;
    nNational: string;
    adresse: string;
    cPostal: string;
    localite: string;
    ecole: string;
    photoFile?: File;
    photoConsent: boolean;
  };
  health?: {
    specificMedical: string;
    pastMedical: string;
    medication: boolean;
    medicationDetails: string;
    medicationAutonomy: boolean;
    tetanus: boolean;
    doctorName: string;
    doctorPhone: string;
    parentalConsent: boolean;
  };
  allergies?: {
    hasAllergies: boolean;
    allergiesDetails: string;
    allergiesConsequences: string;
    specialDiet: boolean;
    dietDetails: string;
  };
  activities?: {
    canParticipate: boolean;
    restrictionDetails: string;
    swimLevel: 'pas du tout' | 'difficilement' | 'bien' | 'très bien';
    waterFear: boolean;
    otherInfo: string;
  };
  departure?: {
    isSoloDeparture: boolean;
    soloDepartureTime?: string;
    authorized_person_ids?: string[];
  };
  inclusion?: {
    has_needs: boolean;
    situation_details?: string;
    impact_details?: string;
    needs_dedicated_staff?: string;
    staff_details?: string;
    strategies?: string;
    assistive_devices?: string;
    stress_signals?: string;
    strengths?: string;
    previous_experience?: string;
  };
}

const NewKidPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [currentStep, setCurrentStep] = useState<FormStep>('personal');
  const [formData, setFormData] = useState<FormData>({});
  const [completedSteps, setCompletedSteps] = useState<FormStep[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps: { id: FormStep; label: string }[] = [
    { id: 'personal', label: 'Infos personnelles' },
    { id: 'health', label: 'Données santé' },
    { id: 'allergies', label: 'Allergies' },
    { id: 'activities', label: 'Activités' },
    { id: 'departure', label: 'Sorties' },
    { id: 'inclusion', label: 'Inclusion' },
  ];

  const handleStepComplete = (step: FormStep, data: any) => {
    setFormData(prev => {
      const updated = { ...prev, [step]: data };
      
      const currentIndex = steps.findIndex(s => s.id === step);
      if (currentIndex === steps.length - 1) {
        handleSubmit(updated);
      }
      
      return updated;
    });
    
    setCompletedSteps(prev => [...new Set([...prev, step])]);
    
    const currentIndex = steps.findIndex(s => s.id === step);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id);
    }
  };

  const handleStepChange = (step: FormStep) => {
    if (completedSteps.includes(step) || step === currentStep) {
      setCurrentStep(step);
    }
  };

  const isStepCompleted = (step: FormStep) => completedSteps.includes(step);

  const handleSubmit = async (dataToSave: FormData = formData) => {
    if (!user || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);

      // Validate national number if provided
      const isValidNRN = validateBelgianNRN(
        dataToSave.personal?.nNational?.replace(/\D/g, '') || ''
      );

      // Create kid record
      const { data: kid, error: kidError } = await supabase
        .from('kids')
        .insert({
          user_id: user.id,
          nom: dataToSave.personal?.nom,
          prenom: dataToSave.personal?.prenom,
          date_naissance: dataToSave.personal?.dateNaissance,
          n_national: dataToSave.personal?.nNational,
          is_national_number_valid: isValidNRN,
          adresse: dataToSave.personal?.adresse,
          cpostal: dataToSave.personal?.cPostal,
          localite: dataToSave.personal?.localite,
          ecole: dataToSave.personal?.ecole,
          photo_consent: dataToSave.personal?.photoConsent ?? false
        })
        .select('id')
        .single();

      if (kidError || !kid) throw new Error('Failed to create kid record');

      // Upload photo if provided
      if (dataToSave.personal?.photoFile) {
        const file = dataToSave.personal.photoFile;
        const ext = file.type === 'image/png' ? 'png' : 'jpg';
        const path = `${kid.id}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('kid-photos')
          .upload(path, file, { 
            upsert: true,
            contentType: file.type 
          });

        if (uploadError) throw uploadError;

        // Update kid record with photo URL
        await supabase
          .from('kids')
          .update({ photo_url: path })
          .eq('id', kid.id);
      }

      // Create activities record
      await supabase
        .from('kid_activities')
        .upsert({
          kid_id: kid.id,
          can_participate: dataToSave.activities?.canParticipate,
          restriction_details: dataToSave.activities?.restrictionDetails,
          swim_level: dataToSave.activities?.swimLevel,
          water_fear: dataToSave.activities?.waterFear,
          other_info: dataToSave.activities?.otherInfo
        }, { onConflict: 'kid_id' });

      // Create health record
      await supabase
        .from('kid_health')
        .upsert({
          kid_id: kid.id,
          specific_medical: dataToSave.health?.specificMedical,
          past_medical: dataToSave.health?.pastMedical,
          medication: dataToSave.health?.medication,
          medication_details: dataToSave.health?.medicationDetails,
          medication_autonomy: dataToSave.health?.medicationAutonomy,
          tetanus: dataToSave.health?.tetanus,
          doctor_name: dataToSave.health?.doctorName,
          doctor_phone: dataToSave.health?.doctorPhone,
          parental_consent: dataToSave.health?.parentalConsent,
          medication_form_sent: false
        }, { onConflict: 'kid_id' });

      // Create allergies record
      await supabase
        .from('kid_allergies')
        .upsert({
          kid_id: kid.id,
          has_allergies: dataToSave.allergies?.hasAllergies,
          allergies_details: dataToSave.allergies?.allergiesDetails,
          allergies_consequences: dataToSave.allergies?.allergiesConsequences,
          special_diet: dataToSave.allergies?.specialDiet,
          diet_details: dataToSave.allergies?.dietDetails
        }, { onConflict: 'kid_id' });

      // Create departure record
      await supabase
        .from('kid_departure')
        .upsert({
          kid_id: kid.id,
          leaves_alone: dataToSave.departure?.isSoloDeparture,
          departure_time: dataToSave.departure?.soloDepartureTime,
          pickup_people_ids: dataToSave.departure?.authorized_person_ids ?? []
        }, { onConflict: 'kid_id' });

      // Create inclusion record
      await supabase
        .from('kid_inclusion')
        .upsert({
          kid_id: kid.id,
          has_needs: dataToSave.inclusion?.has_needs,
          situation_details: dataToSave.inclusion?.situation_details,
          impact_details: dataToSave.inclusion?.impact_details,
          needs_dedicated_staff: dataToSave.inclusion?.needs_dedicated_staff,
          staff_details: dataToSave.inclusion?.staff_details,
          strategies: dataToSave.inclusion?.strategies,
          assistive_devices: dataToSave.inclusion?.assistive_devices,
          stress_signals: dataToSave.inclusion?.stress_signals,
          strengths: dataToSave.inclusion?.strengths,
          previous_experience: dataToSave.inclusion?.previous_experience
        }, { onConflict: 'kid_id' });

      navigate('/kids');
    } catch (error: any) {
      console.error('Error creating kid:', error);
      setError(error.message || "Une erreur s'est produite lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">Ajouter un enfant</h1>

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

export default NewKidPage;