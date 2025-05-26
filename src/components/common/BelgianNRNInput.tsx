import { useRef, useState, useEffect } from 'react';

interface BelgianNRNInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onBlur?: () => void;
}

const BelgianNRNInput = ({ value, onChange, error, onBlur }: BelgianNRNInputProps) => {
  // Helper function to split the NRN string into segments
  const splitNRN = (nrn: string): { date: string; sequence: string; key: string } => {
    return {
      date: nrn.slice(0, 6),
      sequence: nrn.slice(6, 9),
      key: nrn.slice(9, 11)
    };
  };

  // Split value into segments, handling undefined values
  const [date, setDate] = useState(splitNRN(value || '').date);
  const [sequence, setSequence] = useState(splitNRN(value || '').sequence);
  const [key, setKey] = useState(splitNRN(value || '').key);

  // Refs for focus management
  const dateRef = useRef<HTMLInputElement>(null);
  const sequenceRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  // Update local state when props.value changes
  useEffect(() => {
    const segments = splitNRN(value || '');
    setDate(segments.date);
    setSequence(segments.sequence);
    setKey(segments.key);
  }, [value]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/\D/g, '').slice(0, 6);
    setDate(newValue);
    
    if (newValue.length === 6) {
      sequenceRef.current?.focus();
    }

    const joined = newValue + sequence + key;
    onChange(joined);
  };

  const handleSequenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/\D/g, '').slice(0, 3);
    setSequence(newValue);
    
    if (newValue.length === 3) {
      keyRef.current?.focus();
    }

    const joined = date + newValue + key;
    onChange(joined);
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/\D/g, '').slice(0, 2);
    setKey(newValue);

    const joined = date + sequence + newValue;
    onChange(joined);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentRef: React.RefObject<HTMLInputElement>,
    previousRef: React.RefObject<HTMLInputElement> | null
  ) => {
    if (e.key === 'Backspace' && !currentRef.current?.value && previousRef) {
      e.preventDefault();
      previousRef.current?.focus();
    }
  };

  return (
    <div className="flex items-center space-x-1">
      <div className="relative nrn-seg date">
        <input
          ref={dateRef}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          placeholder="YYMMDD"
          className="form-input w-24"
          value={date}
          onChange={handleDateChange}
          onKeyDown={(e) => handleKeyDown(e, dateRef, null)}
          onBlur={onBlur}
        />
      </div>

      <div className="relative nrn-seg seq">
        <input
          ref={sequenceRef}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          placeholder="123"
          className="form-input w-16"
          value={sequence}
          onChange={handleSequenceChange}
          onKeyDown={(e) => handleKeyDown(e, sequenceRef, dateRef)}
          onBlur={onBlur}
        />
      </div>

      <div className="relative nrn-seg key">
        <input
          ref={keyRef}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          placeholder="12"
          className="form-input w-12"
          value={key}
          onChange={handleKeyChange}
          onKeyDown={(e) => handleKeyDown(e, keyRef, sequenceRef)}
          onBlur={onBlur}
        />
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default BelgianNRNInput;