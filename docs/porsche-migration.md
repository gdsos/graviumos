# Porsche Migration Tracker

This document tracks the removal of Porsche-style wrapper components from Gravium OS.

## Current rule

No new code should import from:

`@/components/ui/porsche`

## Find Porsche usage

Run this command from the project root:

```powershell
Get-ChildItem -Path .\src -Recurse -File | Select-String -Pattern "@/components/ui/porsche|components/ui/porsche|PButton|PHeading|PInlineNotification|PModal|PTag|PText|PIcon|PSwitch|PTabs|PTabsItem"