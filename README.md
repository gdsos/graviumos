# Gravium OS

Gravium OS is the internal operating system for Gravium Design Studio.

It is being built as a business operations platform for managing leads, projects, tasks, vendors, items, cost estimates, timelines, finance workflows, and future employee performance systems.

## Current Development Focus

- Mobile-first operational UI cleanup
- Vendors, Items, Cost Estimates, and Timeline workflow polish
- Mobile glass navigation and drawer system
- Porsche/template legacy cleanup
- Preparing older modules for the current Gravium visual system

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Supabase planned for backend/data workflows

## Development Notes

The active development branch is `featuretest`.

Before committing changes, run these checks:

- npm run build
- git status --short
- git diff --name-status
- git diff --stat

Mobile UI changes should be phone-tested before being marked complete.
