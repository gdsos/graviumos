# Porsche Compatibility Layer — Legacy Only

This file exists only to keep older Gravium OS pages working while the app is migrated to the Gravium design system.

Do not use Porsche-style components in any new page, feature, or component.

## New UI direction

All new Gravium OS code must use:

- Tailwind CSS
- shadcn/ui primitives
- lucide-react icons
- global theme tokens from `src/index.css`
- common components from `src/components/common`

## Important

Do not delete `porsche.tsx` until all legacy pages have been migrated away from it.