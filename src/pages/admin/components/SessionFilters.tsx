import { BoxSelect as Select } from 'lucide-react';

interface SessionFiltersProps {
  selectedCenter: string | null;
  selectedPeriode: string | null;
  selectedSemaine: string | null;
  selectedStage: string | null;
  onCenterChange: (center: string | null) => void;
  onPeriodeChange: (periode: string | null) => void;
  onSemaineChange: (semaine: string | null) => void;
  onStageChange: (stage: string | null) => void;
  centers: { id: string; name: string }[];
  stages: { id: string; title: string }[];
  periodes: string[];
}

const SessionFilters = ({
  selectedCenter,
  selectedPeriode,
  selectedSemaine,
  selectedStage,
  onCenterChange,
  onPeriodeChange,
  onSemaineChange,
  onStageChange,
  centers,
  stages,
  periodes,
}: SessionFiltersProps) => {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Filtres</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="form-label">Centre</label>
          <select
            className="form-input"
            value={selectedCenter || ''}
            onChange={(e) => onCenterChange(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">Tous les centres</option>
            {centers.map((center) => (
              <option key={center.id} value={center.id}>
                {center.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">Période</label>
          <select
            className="form-input"
            value={selectedPeriode || ''}
            onChange={(e) => onPeriodeChange(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">Toutes les périodes</option>
            {periodes.map((periode) => (
              <option key={periode} value={periode}>
                {periode}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">Semaine</label>
          <select
            className="form-input"
            value={selectedSemaine || ''}
            onChange={(e) => onSemaineChange(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">Toutes les semaines</option>
            {Array.from({ length: 7 }, (_, i) => `S${i + 1}`).map((semaine) => (
              <option key={semaine} value={semaine}>
                {semaine}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">Stage</label>
          <select
            className="form-input"
            value={selectedStage || ''}
            onChange={(e) => onStageChange(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">Tous les stages</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.title}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default SessionFilters;