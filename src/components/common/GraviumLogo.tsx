import { useTheme } from '@/contexts/ThemeContext';

type GraviumLogoVariant = 'wordmark' | 'icon';
type GraviumLogoTheme = 'auto' | 'light' | 'dark';

interface GraviumLogoProps {
  variant?: GraviumLogoVariant;
  logoTheme?: GraviumLogoTheme;
  className?: string;
}

export function GraviumLogo({
  variant = 'wordmark',
  logoTheme = 'auto',
  className = '',
}: GraviumLogoProps) {
  const { resolvedTheme } = useTheme();

  const effectiveTheme = logoTheme === 'auto' ? resolvedTheme : logoTheme;
  const isDark = effectiveTheme === 'dark';

  const src =
    variant === 'icon'
      ? isDark
        ? '/brand/gravium-icon-dark.png'
        : '/brand/gravium-icon-light.png'
      : isDark
        ? '/brand/gravium-wordmark-dark.png'
        : '/brand/gravium-wordmark-light.png';

  return (
    <img
      src={src}
      alt={variant === 'icon' ? 'Gravium icon' : 'Gravium OS'}
      className={className}
      draggable={false}
    />
  );
}