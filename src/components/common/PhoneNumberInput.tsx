import { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface PhoneCountryOption {
  code: string;
  label: string;
  maxLength?: number;
}

const PHONE_COUNTRY_OPTIONS: PhoneCountryOption[] = [
  { code: '+91', label: 'India', maxLength: 10 },
  { code: '+971', label: 'UAE', maxLength: 9 },
  { code: '+966', label: 'Saudi Arabia', maxLength: 9 },
  { code: '+974', label: 'Qatar', maxLength: 8 },
  { code: '+965', label: 'Kuwait', maxLength: 8 },
  { code: '+968', label: 'Oman', maxLength: 8 },
  { code: '+973', label: 'Bahrain', maxLength: 8 },
  { code: '+1', label: 'US / Canada', maxLength: 10 },
  { code: '+44', label: 'United Kingdom', maxLength: 10 },
];

interface ParsedPhoneNumber {
  countryCode: string;
  localNumber: string;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function parsePhoneNumber(value: string, defaultCountryCode: string): ParsedPhoneNumber {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return {
      countryCode: defaultCountryCode,
      localNumber: '',
    };
  }

  const matchingOption = PHONE_COUNTRY_OPTIONS
    .slice()
    .sort((a, b) => b.code.length - a.code.length)
    .find(option => trimmedValue.startsWith(option.code));

  if (matchingOption) {
    return {
      countryCode: matchingOption.code,
      localNumber: onlyDigits(trimmedValue.slice(matchingOption.code.length)),
    };
  }

  return {
    countryCode: defaultCountryCode,
    localNumber: onlyDigits(trimmedValue),
  };
}

function formatPhoneValue(countryCode: string, localNumber: string) {
  if (!localNumber) return '';
  return `${countryCode} ${localNumber}`;
}

interface PhoneNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  defaultCountryCode?: string;
  placeholder?: string;
}

export function PhoneNumberInput({
  value,
  onChange,
  defaultCountryCode = '+91',
  placeholder = 'Phone number',
}: PhoneNumberInputProps) {
  const [isOpen, setIsOpen] = useState(false);

  const parsedValue = useMemo(
    () => parsePhoneNumber(value, defaultCountryCode),
    [defaultCountryCode, value],
  );

  const selectedCountry =
    PHONE_COUNTRY_OPTIONS.find(option => option.code === parsedValue.countryCode) ||
    PHONE_COUNTRY_OPTIONS[0];

  const localNumber = selectedCountry.maxLength
    ? parsedValue.localNumber.slice(0, selectedCountry.maxLength)
    : parsedValue.localNumber;

  const handleCountryChange = (countryCode: string) => {
    const nextCountry =
      PHONE_COUNTRY_OPTIONS.find(option => option.code === countryCode) ||
      selectedCountry;

    const nextLocalNumber = nextCountry.maxLength
      ? localNumber.slice(0, nextCountry.maxLength)
      : localNumber;

    onChange(formatPhoneValue(nextCountry.code, nextLocalNumber));
    setIsOpen(false);
  };

  const handleNumberChange = (inputValue: string) => {
    const nextDigits = onlyDigits(inputValue);
    const limitedDigits = selectedCountry.maxLength
      ? nextDigits.slice(0, selectedCountry.maxLength)
      : nextDigits;

    onChange(formatPhoneValue(selectedCountry.code, limitedDigits));
  };

  return (
    <div className="flex h-10 overflow-visible rounded-lg border border-border bg-background text-sm text-foreground transition focus-within:border-foreground">
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setIsOpen(current => !current)}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 120);
          }}
          className="flex h-full items-center gap-1 border-r border-border bg-muted/50 px-3 text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground"
        >
          <span>{selectedCountry.code}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>

        {isOpen && (
          <div className="absolute left-0 top-[calc(100%+0.35rem)] z-[100] w-56 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl">
            {PHONE_COUNTRY_OPTIONS.map(option => {
              const isSelected = option.code === selectedCountry.code;

              return (
                <button
                  key={option.code}
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => handleCountryChange(option.code)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${
                    isSelected ? 'bg-muted text-foreground' : 'hover:bg-muted/70'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="font-medium">{option.code}</span>
                    <span className="ml-2 text-muted-foreground">{option.label}</span>
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <input
        type="tel"
        inputMode="numeric"
        value={localNumber}
        maxLength={selectedCountry.maxLength}
        onChange={event => handleNumberChange(event.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-muted-foreground"
        placeholder={
          selectedCountry.code === '+91'
            ? '10 digit number'
            : placeholder
        }
      />
    </div>
  );
}
