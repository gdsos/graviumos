import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

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
  { code: '+1', label: 'US' },
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
    .replace(/[^\d]/g, '')
    .slice(0, 10);

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
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => setIsOpen(false);
    const handleScroll = () => setIsOpen(false);

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const emitChange = (nextCountryCode: string, nextNumber: string) => {
    const cleanNumber = nextNumber.replace(/[^\d]/g, '').slice(0, 10);
    onChange(cleanNumber ? `${nextCountryCode} ${cleanNumber}` : nextCountryCode);
  };

  const openMenu = () => {
    if (disabled) return;

    const rect = buttonRef.current?.getBoundingClientRect();

    if (!rect) return;

    setMenuRect(rect);
    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
    setMenuRect(null);
  };

  const selectCountryCode = (nextCountryCode: string) => {
    emitChange(nextCountryCode, number);
    closeMenu();
  };

  const menu =
    isOpen && menuRect && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[90]" onMouseDown={closeMenu}>
            <div
              className="fixed w-44 overflow-hidden rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl"
              style={{
                top: menuRect.bottom + 8,
                left: menuRect.left,
              }}
              onMouseDown={event => event.stopPropagation()}
            >
              {COUNTRY_CODES.map(country => {
                const isSelected = country.code === countryCode;

                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => selectCountryCode(country.code)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                      isSelected ? 'bg-muted text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <span>{country.code}</span>
                    <span className="text-xs">{country.label}</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={className}>
      <div
        className={`flex h-10 w-full overflow-hidden rounded-lg border border-border bg-background text-foreground transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 ${
          disabled ? 'cursor-not-allowed opacity-60' : ''
        }`}
      >
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={isOpen ? closeMenu : openMenu}
          className="flex h-full shrink-0 items-center gap-2 border-r border-border bg-muted/30 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed"
          aria-label="Select country code"
        >
          {countryCode}
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          disabled={disabled}
          value={number}
          onChange={event => emitChange(countryCode, event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>

      {menu}
    </div>
  );
}
