import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface PhoneNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const COUNTRY_CODES = [
  { code: '+91', label: 'India' },
  { code: '+971', label: 'UAE' },
  { code: '+1', label: 'US / Canada' },
  { code: '+44', label: 'UK' },
];

function getPhoneParts(value: string) {
  const trimmed = value.trim();
  const matchingCode =
    COUNTRY_CODES
      .map(country => country.code)
      .sort((a, b) => b.length - a.length)
      .find(code => trimmed.startsWith(code)) || '+91';

  const number = trimmed
    .replace(matchingCode, '')
    .replace(/[^\d]/g, '');

  return {
    countryCode: matchingCode,
    number,
  };
}

export function PhoneNumberInput({
  value,
  onChange,
  disabled = false,
  className = '',
  placeholder = '10 digit number',
}: PhoneNumberInputProps) {
  const { countryCode, number } = getPhoneParts(value);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const emitChange = (nextCountryCode: string, nextNumber: string) => {
    const cleanNumber = nextNumber.replace(/[^\d]/g, '');
    onChange(cleanNumber ? `${nextCountryCode} ${cleanNumber}` : nextCountryCode);
  };

  const selectCountryCode = (nextCountryCode: string) => {
    emitChange(nextCountryCode, number);
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div
        className={`flex h-10 w-full overflow-hidden rounded-lg border border-border bg-background text-foreground transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 ${
          disabled ? 'cursor-not-allowed opacity-60' : ''
        }`}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(current => !current)}
          className="flex h-full shrink-0 items-center gap-2 border-r border-border bg-muted/30 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed"
          aria-label="Select country code"
        >
          {countryCode}
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <input
          type="tel"
          value={number}
          disabled={disabled}
          onChange={event => emitChange(countryCode, event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-12 z-50 w-44 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl">
          {COUNTRY_CODES.map(country => {
            const isSelected = country.code === countryCode;

            return (
              <button
                key={country.code}
                type="button"
                onClick={() => selectCountryCode(country.code)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  isSelected
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className="font-medium">{country.code}</span>
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="truncate text-xs">{country.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
