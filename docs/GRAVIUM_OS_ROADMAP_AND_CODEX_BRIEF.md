# Gravium OS Roadmap and Codex Brief - Current

This document is the working roadmap, implementation plan, UI direction, and Codex handoff brief for Gravium OS.

Repo:
`D:\Gravium Design Studio\Web_App\graviumos`

Branch:
`featuretest`

Latest known clean checkpoint:

- `294a97f Polish mobile topbar and theme switch`
- `9b851ee Add mobile bottom navigation`
- `1466c6d Simplify items list layout`
- `9daf29b Add vendor details panel and quick actions`
- `2edc795 Simplify vendors list and mobile rows`
- `87e4649 Update Gravium OS roadmap after cost estimate cleanup`
- Working tree was clean after commit `294a97f`.

Current next module:
- Mobile-lite restrictions documentation and next MVP workflow planning.

---

## Development Rules

- User runs commands line-by-line in PowerShell.
- Avoid Bash heredoc syntax like `python - <<'PY'`.
- Use PowerShell-safe Python patches:
  `@' ... '@ | python -`
- Avoid `Set-Content` for TS/TSX unless explicitly using UTF-8.
- Prefer Python `Path.write_text(..., encoding="utf-8")`.
- Include patch + build/status commands together in one PowerShell block when possible.
- After patches, run:
  - `npm run build`
  - `git status --short`
  - `git diff --name-status`
  - `git diff --stat`
- If final `git status --short` has no output, treat working tree as clean.
- Commit at logical milestones, not after every tiny patch.
- UI fixes should be screenshot-driven and targeted.
- For fetched/selectable data like Items, Vendors, Projects, Units, Categories, use searchable suggestion/typeahead dropdowns instead of native selects where possible.
- Suggestion dropdowns must not be clipped. Use proper z-index, overflow-safe containers, or body/modal-safe rendering.
- New module/list pages should follow the Vendors-style PageHeader layout.
- Desktop card/list action rows should use a consistent responsive button-group container.
- Number inputs must allow empty/backspace states. Avoid trapping users with forced zero values.
- Avoid unsafe/special UI separators that may render incorrectly. Prefer plain ASCII labels.
- After UI/layout changes, remind user to test both desktop and mobile UI.
- Do not mark mobile UI fully cleared until user verifies on phone.

---

# Current Product Direction

Gravium OS is an internal operating system for Gravium Design Studio.

It should manage the full workflow:

1. Leads
2. Projects
3. Design workflow
4. Cost Estimates
5. Contract and booking payment
6. Planned Timeline
7. Execution tracking
8. Project Finance
9. Employee Tasks
10. KPI and dashboards
11. Handover
12. Reports and archive

The product should feel premium, clean, practical, and operationally useful, not like a generic template or over-carded SaaS dashboard.

Current priority modules that define the initial Gravium design system:

1. Items
2. Vendors
3. Cost Estimates
4. Timeline

Initial goal:

- Fix and standardize Items, Vendors, Cost Estimates, and Timeline first.
- Use the cleaned design system from these modules for the rest of the app.
- Avoid continuing to polish old template/Porsche-style pages directly until the core Gravium UI direction is stable.

---

# Product-Wide UI Direction

Avoid:

1. Too many large cards
2. Everything inside oversized rounded blocks
3. Low information density
4. Repetitive dashboard cards
5. Sidebars and card grids everywhere
6. Too many badges competing for attention
7. Decorative UI that does not improve operations
8. Generic template-looking pages

Use instead:

1. Compact operational lists
2. Tables where useful
3. Clear hierarchy
4. One smart primary action per row
5. Secondary actions in a three-dot menu where useful
6. Details in drawer, side panel, mobile sheet, or dedicated detail page
7. Charts only when they explain something useful
8. Fewer but more meaningful dashboard summaries

---

# Desktop vs Mobile Product Rule

Desktop and mobile should not expose the same complexity.

## Desktop

Desktop is the full operational control center.

Desktop should support:

1. Full planning
2. Deep editing
3. Large data tables/lists
4. Multi-step workflows
5. Timeline generation and review
6. Cost estimate creation/editing/approval
7. Detailed Project Finance
8. Advanced dashboards and KPI charts
9. Reports and exports
10. Admin settings and permissions

## Mobile

Mobile should be a lite operational mode.

Mobile should focus on:

1. What needs attention?
2. What do I need to do now?
3. Quick status updates
4. Quick task handling
5. Quick payment/action checks
6. Basic edit/delete/archive when safe
7. Lightweight detail review
8. Alerts and notifications

Mobile should avoid full desktop complexity upfront.

Mobile pattern:

- Minimal visible text
- Fewer fields
- Fewer visible modules
- Strong primary action
- Secondary actions in three-dot menu
- Tap row/card to open a mobile sheet/detail view
- Desktop-only heavy features where necessary

---

# Mobile Navigation Direction

Replace mobile sidebar with a bottom navigation tab bar.

Preferred style:

- Floating liquid glass bottom nav
- Soft translucent background
- Blur/glass effect
- Thin border
- Rounded capsule
- Raised active tab/pill
- Icons + short labels
- Premium but subtle
- No heavy glow or noisy decoration
- Safe-area padding for modern phones

Suggested generic mobile nav:

1. Home
2. Projects
3. Tasks
4. Timeline
5. More

`More` can contain role-specific secondary modules such as Cost Estimates, Items, Vendors, Project Finance, Leads, Reports, and Settings.

Future navigation should be permission-aware and department-specific.

---

# Module UI Rules

## Items

Default direction:

- List/table-first layout
- Optional card view toggle later if useful
- Search/typeahead where selecting master data
- Main list shows only essential fields
- Details open in drawer/sheet/detail view
- Secondary actions in three-dot menu
- Mobile should show only key item name, scope/category, rate/price summary, status, and primary action

## Vendors

Default direction:

- List/table-first layout
- Optional card view toggle later
- Main list shows vendor name, scope/category, contact/status, and primary action
- Detailed vendor data should move to drawer/detail view
- Mobile should prioritize quick contact/open/edit actions
- Next immediate task: convert Vendors away from large vendor cards toward compact operational list rows.
- Keep PageHeader pattern.
- Use consistent action button group alignment similar to Cost Estimates.

## Cost Estimates

Default direction:

- Keep cost estimates as records/list rows where useful, but avoid oversized decorative cards.
- Estimate editor can stay structured because it is a complex workflow.
- Mobile should not attempt full complex estimate editing unless deliberately simplified.
- Mobile can view estimate status, totals, approval/revision state, and key actions.
- Desktop remains main place for detailed estimate creation/editing.
- Create Estimate modal should stay compact and operational.
- Area selection modal should support compact rows/list on mobile, grid on desktop/tablet where useful.
- Area selection modal now has Select/Deselect All and multi-step Undo.
- Bedroom/Bathroom naming logic must be consistent in both Create Estimate modal and editor.

## Timeline

Default direction:

- Timeline Work tab should be list-first, not card-first.
- Generated timelines are Planned/Estimated timelines, not execution truth.
- Confirmed timeline becomes the Planned baseline.
- Execution actions update Actual progress.
- Forecast is a later layer.
- Desktop can show full Planned vs Actual detail.
- Mobile should show a simplified execution row/card with one primary action and a details sheet.
- Gantt is hidden on mobile for now.

---

# Timeline Current Implementation Status

Completed:

1. Temporary Villa Athani dummy timeline dev controls added.
   - Fetch Data / Hide Data controls remain intentionally available.
   - Temporary dummy data should be removed only when user asks.
2. Timeline creation is gated by approved Cost Estimate.
3. Approved estimate source selection added.
4. Timeline generation from approved estimates added.
5. Planning controls added:
   - Contract Signed
   - Booking Payment Collected
   - Timeline Start Date
   - Editable payment gate percentages
6. Generated timeline review mode added:
   - Build Timeline creates a review draft
   - Dates, assignee, and status can be edited
   - Confirm Timeline activates it
7. Gantt now uses generated work package date range instead of old demo date range.
8. Intelligent Assist no longer mixes old demo alerts once a generated timeline is active.
9. Payment gate updates added:
   - Booking Payment Collected auto-marks booking payment as received
   - Payments support Unmark
   - Unmark re-blocks linked work packages
10. Side quest completed:
   - Temporary Villa Athani Stage 1 payment helper text changed from `After Steel Roof Finishes` to `After Fabrication Part-A`.
11. Timeline confirmation state polish added:
   - Review Draft Timeline state
   - Confirmed Planned Timeline banner
   - Baseline Locked messaging
   - Confirmation timestamp persistence
12. Execution actions added:
   - Start Work
   - Pause Work
   - Resume Work
   - Complete Work
   - Mark Delayed
   - Delay Reason
   - Actual start/end/duration updates
   - Pause period tracking
13. Timeline Work tab converted from detailed cards to list-first execution tracker.
14. Work list alignment/clipping issues fixed.
15. Timeline mobile planning/source UI simplified.
16. Duplicate timeline source/summary blocks removed.
17. Gantt tab hidden on mobile.

Latest committed Timeline milestones:

- `c294fd7 Simplify timeline mobile planning UI`
- `8ce0b69 Convert timeline work packages to list view`

---

# Cost Estimate Current Implementation Status

Completed:

1. Cost Estimates list page converted from heavy cards to compact row/list layout.
2. Mobile Cost Estimate row actions are icon-only and compact.
3. Desktop list action group alignment refined:
   - Action group right-aligned.
   - Two-action and three-action rows fit inside a consistent responsive container.
   - Open button always says `Open`; no `Open Revision` label.
4. Desktop status badges moved below estimate name.
5. Mobile status badges moved to top-right and reduced.
6. Cost Estimate editor mobile header/actions simplified:
   - Top actions use compact icon + text buttons.
   - Bottom actions use compact icon + text buttons.
   - Save and Close dropdown hidden on mobile, still available on desktop.
7. Estimate Project block helper descriptions removed.
8. Summary price row simplified:
   - Mobile no horizontal scroll.
   - Compact 2x2 summary grid on mobile.
   - Desktop retains 4-column summary.
9. Service/Misc/Revenue controls simplified:
   - Mobile in one row.
   - Desktop stays normal form style.
10. Area setup layout refined:
   - Mobile compact two-row area cards.
   - Desktop table-like alignment.
   - Area name left on desktop.
   - Amount larger on mobile.
   - Delete action bottom-right on mobile.
11. Area detail headers refined:
   - Mobile Add Row button moved to top-right as `+ Add`.
   - Desktop keeps normal `Add New Row`.
12. Save Row action simplified:
   - Mobile uses tick-only button.
   - Desktop shows tick + `Save Row`.
13. Area quick-add buttons added in editor:
   - Bedroom Set
   - Common Bathroom
   - Add Bedroom
   - Add Bathroom
   - Mobile uses a two-column grid.
14. Create Estimate modal area selector compacted:
   - Select/Deselect All button.
   - Multi-step Undo button.
   - Compact area selector rows.
   - Mobile list restored by user preference.
   - Desktop/tablet can use grid.
15. Create Estimate modal quick-add buttons added:
   - Bedroom Set
   - Common Bathroom
   - Add Bedroom
   - Add Bathroom
16. Unified Bedroom/Bathroom/Master naming logic in both flows:
   - Create Estimate modal
   - Cost Estimate editor
17. Naming rule:
   - When adding Bedroom Set, Add Bedroom, or Add Bathroom:
     - first existing bedroom becomes `Master Bedroom` if none exists
     - first existing attached/general bathroom becomes `Master Bathroom` if none exists
     - new bedrooms become `Bedroom 1`, `Bedroom 2`, etc.
     - new attached bathrooms become `Attached Bathroom 1`, `Attached Bathroom 2`, etc.
18. Unassigned draft numbering added:
   - First: `Unassigned Draft`
   - Second: `Unassigned Draft 2`
   - Third: `Unassigned Draft 3`

Latest committed Cost Estimate milestones:

- `294a97f Polish mobile topbar and theme switch`
- `6932baa Convert cost estimates list to compact rows`

---

# MVP Definition

MVP means Gravium OS can manage one real project from approved estimate to planned timeline and basic execution/payment tracking.

## MVP Must Include

1. Projects basic structure
2. Items master
3. Vendors master
4. Cost Estimate create/edit/approve/revision flow
5. Employee Tasks module
   - Project-based tasks
   - Internal/non-project tasks
6. Timeline generated from approved cost estimate
7. Timeline planning controls
   - Contract signed
   - Booking payment collected
   - Timeline start date
   - Payment gate percentages
8. Timeline review and confirmation
9. Basic timeline execution actions
   - Start Work
   - Pause Work
   - Resume Work
   - Complete Work
   - Mark Delayed
   - Delay Reason
10. Basic payment gates
11. Basic Project Finance direction
12. Clean consistent UI for Items, Vendors, Cost Estimates, Timeline, and Employee Tasks
13. Mobile-lite UI direction for key operational actions

## MVP Does Not Need Yet

1. Full Supabase conversion
2. Advanced KPI engine
3. Advanced permissions engine
4. Full client portal
5. Advanced purchase orders
6. Advanced PDF/report automation
7. Full forecast automation
8. PWA notifications
9. Full mobile parity with desktop

---

# Short Milestone Chart

| Milestone | Goal |
|---|---|
| 1. Core Module UI Standardization | Fix Items, Vendors, Cost Estimates, and Timeline as the initial Gravium design baseline |
| 2. MVP Core Workflow | Projects, Items, Vendors, Cost Estimates, Employee Tasks, Timeline from approved estimate, basic payment gates |
| 3. Timeline Execution | Planned vs Actual timeline, Start/Pause/Resume/Complete work, delay reasons |
| 4. Mobile Lite UX | Replace mobile sidebar with liquid-glass bottom nav and simplify mobile screens |
| 5. Project Finance Integration | Make Project Finance the payment source of truth; Timeline reads payment status |
| 6. Employee KPI Foundation | Use real task/project/payment/activity data for KPI tracking |
| 7. Dashboards and Permissions | Admin dashboard, Employee dashboard, Department Head views, page/feature access |
| 8. UI and Codebase Cleanup | Remove Porsche/template leftovers, standardize all pages to Gravium style |
| 9. Supabase Migration | Replace localStorage with real database tables and multi-user data |
| 10. Reports and Client Outputs | Branded Estimate PDF, Timeline Report, Progress Report, Handover Report |

---

# Current Timeline Architecture

Generated timelines must be treated as Planned/Estimated Timelines, not execution truth.

## Timeline Layers

1. Planned Timeline
   - Created after approved cost estimate, contract signing, and booking payment.
   - Becomes the baseline after confirmation.
   - Should not be overwritten during execution.

2. Actual Timeline
   - Tracks what really happened on site.
   - Each work package should track:
     - Estimated Start Date
     - Estimated End Date
     - Actual Start Date
     - Actual End Date
     - Actual Duration
     - Pause periods
     - Delay reason

3. Forecast Timeline
   - Recalculates current expected dates based on delays, pauses, payments, vendors, dependencies, site readiness, and client decisions.
   - Each work package should later support:
     - Projected Start Date
     - Projected End Date

## Execution Actions

Work package actions:

1. Start Work
2. Pause Work
3. Resume Work
4. Complete Work
5. Mark Delayed
6. Add / Update Delay Reason

---

# Cost Estimate to Timeline Workflow

Timeline should only be created after the linked Cost Estimate is Approved.

Timeline must not be created from:

1. Draft estimate
2. Revision draft
3. Unassigned draft
4. No estimate

If the linked Cost Estimate changes from Approved to Revision Draft:

- Timeline should wait.
- The revised estimate must be approved before timeline updates.

Business workflow:

1. Cost Estimate approved by client
2. Contract signed
3. Booking/advance payment collected
4. Timeline built from approved estimate
5. Vendors and dates assigned
6. Pauses/continuations optimized
7. Timeline reviewed
8. Timeline confirmed
9. Booking payment marked
10. Execution begins

---

# Project Finance Direction

Project Finance should become the payment source of truth.

Timeline payment gates are operational triggers.

Project Finance should eventually track:

1. Total project value
2. Payment schedule
3. Amount due
4. Amount received
5. Balance
6. Payment date
7. Payment mode
8. Reference/proof
9. GST/invoice status
10. Vendor payments
11. Project profit

Long-term behavior:

- Timeline asks: Is payment gate satisfied?
- Project Finance answers: Payment received, pending, partial, overdue, or approved by finance.
- Timeline should not permanently own payment truth.

---

# Employee Tasks and KPI System

Employee Tasks are part of MVP.

Tasks must support:

1. Project-based tasks
2. Internal/non-project tasks

Examples of project tasks:

- Prepare cost estimate
- Follow up with vendor
- Visit site
- Upload progress update
- Confirm material delivery
- Collect site measurement
- Update client on timeline delay

Examples of internal tasks:

- Call leads
- Post Instagram content
- Update vendor pricing
- Prepare monthly expense records
- Follow up pending payments
- Clean item master data

## KPI Philosophy

KPI must be data-driven, not arbitrary.

Avoid random scores unless the app can explain the source.

KPI sources should include:

1. Task completion rate
2. On-time completion rate
3. Overdue task count
4. Average delay days
5. Lead follow-up speed
6. Estimate preparation time
7. Site update consistency
8. Vendor follow-up completion
9. Payment follow-up completion
10. Project issue resolution time
11. Assigned vs completed workload
12. Rework/correction count

Employee KPI should be calculated from actual activity inside Gravium OS.

---

# Dashboards

Long-term dashboards:

1. Admin Dashboard
2. Employee Dashboard
3. Department Head Dashboard

Dashboard direction:

- Do not rely only on generic stat cards.
- Use clean, purposeful KPI charts.
- Charts should show trends, comparisons, workload, delays, payment progress, and employee/task performance.
- Every KPI should be drillable to the records behind it.
- Avoid decorative dashboard blocks that do not help decisions.

---

# Permissions

Gravium OS should support:

1. Admin
2. Partner/Owner
3. Department Head
4. Employee
5. Viewer/Limited Access

Permissions must support:

1. Page-level access
2. Feature-level access
3. Button/action access
4. Data visibility restrictions
5. Mobile navigation restrictions
6. Desktop-only feature restrictions

Examples:

- Finance can update Project Finance but cannot edit Cost Estimate line items.
- Execution can update work package status but cannot delete projects.
- Marketing can manage leads but cannot access Project Finance.
- Employee can view Timeline but cannot edit payment gates.
- Mobile users may be allowed to mark work/status updates but not perform complex setup or full estimate editing.

---

# UI and Codebase Cleanup Track

This is a major long-term track.

Goals:

1. Remove unwanted Porsche/template legacy components.
2. Remove unused template routes, demo pages, old assets, and dead imports.
3. Standardize every page to current Gravium UI style.
4. Use Vendors-style PageHeader for module/list pages.
5. Normalize card styling, badges, buttons, spacing, and mobile layouts.
6. Replace placeholder/demo copy before production.
7. Keep Tailwind + Neue Montreal + Gravium brand system consistent.
8. Refactor large pages/components when needed.
9. Apply the Items/Vendors/Cost Estimate/Timeline design system to the rest of the app.
10. Use list-first operational layouts unless cards provide clear value.
11. Add optional card toggles only where useful.
12. Move heavy details into drawers/sheets/detail pages.

This cleanup track must be included in every future new-chat handoff.

---

# When to Use Codex

Use normal ChatGPT patching for:

1. Small targeted fixes
2. 1-3 files
3. Known UI bugs
4. Clear TypeScript errors
5. Button/copy/layout adjustments
6. Patch/build/test/commit loops
7. Screenshot-driven UI fixes

Use Codex for:

1. Repo-wide cleanup
2. Multi-file refactors
3. Removing Porsche/template leftovers
4. Standardizing styles across many pages
5. Splitting large components
6. Supabase migration scaffolding
7. Route/page permission system
8. Large repetitive changes
9. Applying new list-first design patterns across old modules
10. Implementing full mobile navigation architecture

---

# Supabase Migration Plan

Before migrating, design schema.

Likely tables:

1. projects
2. leads
3. items
4. vendors
5. cost_estimates
6. cost_estimate_areas
7. cost_estimate_line_items
8. timelines
9. timeline_work_packages
10. timeline_payment_gates
11. project_payments
12. tasks
13. employees
14. roles
15. permissions
16. purchase_orders
17. project_files
18. project_chat

Migrate one module at a time.

Do not convert everything at once.

---

# Reports and Exports

Future branded client outputs:

1. Cost Estimate PDF
2. Timeline Report PDF
3. Project Progress Report
4. Payment Schedule Report
5. Handover Report

Reports should match Gravium branding and should not look like bland admin exports.

Timeline report should include:

1. Planned Schedule
2. Current Progress
3. Upcoming Works
4. Payment Gates
5. Expected Handover
6. Delay Notes
7. Charts/visual timeline

---

# Current Implementation Sequence

Immediate order from here:

1. Confirm clean status after latest Cost Estimate commit.
2. Continue core module UI baseline cleanup:
   - Mobile-lite restrictions and MVP workflow planning next
   - Items consistency pass after Vendors
   - Timeline/Cost Estimate only if phone testing shows regressions
3. Vendors next goal:
   - Convert current card-grid vendor list to compact operational list/table rows.
   - Keep mobile compact.
   - Use consistent desktop action group alignment.
   - Preserve existing form modal and category/filter logic.
4. Items next goal:
   - Check whether Items still matches the newer Cost Estimate/Timeline patterns.
   - Fix only consistency gaps.
5. Define mobile-lite restrictions:
   - What is mobile-visible
   - What is desktop-only
   - What can be quick-action only on mobile
6. Plan and implement liquid-glass mobile bottom nav.
7. Add row/detail drawer or mobile sheet pattern where needed.
8. Start Project Finance cleanup/integration plan.
9. Use Codex for Porsche/template cleanup and page standardization when scope becomes repo-wide.

---

# New Chat Handoff Checklist

Whenever moving to a new chat, include:

1. Repo path:
   `D:\Gravium Design Studio\Web_App\graviumos`

2. Branch:
   `featuretest`

3. PowerShell workflow rules:
   - No Bash heredocs
   - Use `@' ... '@ | python -`
   - Use UTF-8 writes
   - Build/status check after patches

4. Latest clean commit:
   - `294a97f Polish mobile topbar and theme switch`

5. Current module being worked on:
   - Mobile-lite restrictions and MVP workflow planning next

6. Current implementation goal:
   - Define mobile-lite restrictions per module.
   - Plan next MVP workflow tasks after core module UI cleanup.
   - Keep phone testing as the confirmation step for mobile changes.

7. Important product/UI tracks:
   - Items/Vendors/Cost Estimate/Timeline as first design-system baseline
   - List/table-first operational UI
   - Mobile-lite UX, not full desktop parity
   - Liquid-glass bottom nav for mobile
   - Department/permission-specific navigation
   - Timeline planned/actual/forecast architecture
   - Project Finance source of truth
   - Employee Tasks and KPI
   - Dashboards and permissions
   - Supabase migration
   - Porsche/template cleanup
   - Gravium UI standardization
   - Reports/PDF exports

8. Temporary Villa Athani timeline dev controls remain intentionally available until user asks to remove them.

9. Testing reminder:
   - After UI/layout changes, test desktop and mobile.
   - Do not mark mobile UI fully cleared until user verifies on phone.

---

# Suggested First Message for New Chat

We are continuing Gravium OS development.

Repo:
`D:\Gravium Design Studio\Web_App\graviumos`

Branch:
`featuretest`

Latest clean checkpoint:
`7247ed8 Simplify cost estimate editor and area workflows`

Working tree was clean after the commit.

Current next task:
Vendors list simplification.

Please start by asking me to run:

```powershell
cd "D:\Gravium Design Studio\Web_App\graviumos"
git status --short
git log --oneline -8
npm run build
git status --short
git diff --name-status
git diff --stat
```

Then continue with Vendors:
- inspect `src/pages/VendorsPage.tsx`
- inspect `src/features/vendors/components/VendorCard.tsx`
- convert vendor card grid to compact operational list/table rows
- keep mobile compact
- preserve VendorFormModal, VendorFilters, category storage, and delete confirmation logic
- test desktop and mobile


---

# Session Update - Vendors, Items, Mobile Navigation, TopBar

Completed in latest session:

1. Vendors mobile list cleanup
   - Converted vendor card grid to compact operational rows.
   - Mobile rows now show compact vendor info.
   - Mobile contact info is collapsed by default.
   - Tapping a vendor row expands contact info.
   - Tapping again or outside collapses contact info.
   - Edit/Delete remain grouped as mobile icon actions.
   - Commit: `2edc795 Simplify vendors list and mobile rows`

2. Vendors desktop details panel
   - Added desktop-only right-side vendor details panel.
   - Panel is hidden by default and opens only when a vendor row is selected.
   - Row Edit/Delete actions hide while the panel is open.
   - Edit/Delete moved into a three-dot manage menu.
   - Added quick action buttons:
     - Email
     - WhatsApp
     - Follow Up
     - Request Pricing
     - Assign Project
     - Log Interaction
     - Site Visit
     - Pricing Outdated
     - Procurement Task
   - Added vendor contact details, scope, assigned project count.
   - Rating pill moved beside category.
   - Rating pill tier colors added:
     - Gold for 4.5 to 5.0
     - Silver for 3.5 to 4.4
     - Bronze below 3.5
   - WhatsApp icon changed to a custom WhatsApp-style icon.
   - Commit: `9daf29b Add vendor details panel and quick actions`

3. Items consistency pass
   - Converted Items from large cards to compact operational rows.
   - Hid item description from main list.
   - Moved Edit/Delete into a three-dot menu.
   - Improved rates layout.
   - Desktop status badge placed beside item name.
   - Mobile status badge placed beside category.
   - Unit removed from category line.
   - Rate values show as `amount / unit`.
   - Mobile three-dot action button moved to top-right.
   - Mobile rates simplified for readability.
   - Summary cards converted to mobile grid.
   - Commit: `1466c6d Simplify items list layout`

4. Mobile bottom navigation
   - Added `src/components/layout/MobileBottomNav.tsx`.
   - Mobile sidebar hidden.
   - Floating bottom nav added with:
     - Home
     - Projects
     - Tasks
     - Timeline
     - More
   - More menu includes:
     - Cost Estimates
     - Items
     - Vendors
     - Financials where allowed
     - Leads where allowed
     - Settings for admin
   - Main content gets bottom padding on mobile so nav does not cover content.
   - Desktop sidebar remains unchanged.
   - Commit: `9b851ee Add mobile bottom navigation`

5. TopBar, sidebar, and theme switch polish
   - Removed redundant TopBar sidebar/logo trigger.
   - Added mobile-only Gravium branding on the left side of TopBar.
   - Removed duplicate TopBar branding on tablet/desktop.
   - Removed TopBar bottom separator line.
   - Restored cleaner TopBar height and utility placement.
   - Removed sidebar header separator line.
   - Centered sidebar branding with icon column.
   - Converted theme mode control from horizontal switch to vertical in-place switch.
   - Theme switch opens in-place with the selected theme on top.
   - Final switch geometry was tuned manually.
   - Commit: `294a97f Polish mobile topbar and theme switch`

Current clean commit:
- `294a97f Polish mobile topbar and theme switch`

Current status:
- Vendors mobile: cleared for now.
- Vendors desktop details panel: cleared for now.
- Items consistency pass: cleared for now.
- Mobile bottom nav: added and phone-tested.
- TopBar/sidebar/theme switch polish: committed and clean.

Important testing note:
- Mobile UI changes should still be phone-checked after future layout updates.
- Do not mark future mobile changes fully cleared until user verifies on phone.

Recommended next steps:

1. Define mobile-lite restrictions per module.
2. Decide which modules are visible in mobile bottom nav vs More.
3. Begin Project Finance cleanup/integration planning.
4. Continue MVP workflow planning:
   - Approved estimate
   - Contract/payment
   - Planned timeline
   - Basic execution/payment tracking
5. Later use Codex for repo-wide Porsche/template cleanup and page standardization.

---

# Session Update - Mobile Glass Navigation Drawer

Completed milestone:

1. Mobile bottom navigation has been rebuilt using ReactBits-style `GlassSurface`.
   - Added reusable component:
     - `src/components/ui/GlassSurface.tsx`
     - `src/components/ui/GlassSurface.css`
   - Added `framer-motion` dependency for selector and drawer animation.
   - Replaced the old mobile bottom nav with:
     - Home
     - Projects
     - Tasks
     - Timeline
     - Menu

2. Menu drawer behavior:
   - Secondary modules are now inside a grouped glass drawer.
   - Menu drawer groups currently include Procurement, Finance, Sales, and Admin where permissions allow.
   - Menu becomes active when the drawer is open.
   - Menu also stays active when the current route belongs to a secondary module.
   - Primary nav items no longer show active state while Menu is open.

3. Visual testing:
   - Light mode tested on phone.
   - Dark mode tested on phone.
   - Drawer width aligned with bottom nav width.
   - Drawer fill opacity, blur, and light-mode color were tuned.
   - Active selector light-mode color was tuned.
   - Navbar milestone is cleared by phone testing.

4. Latest clean checkpoint:
   - `6373948 Add mobile glass navigation drawer`

Next recommended work:
1. Begin app cleanup track.
2. Remove/replace Porsche/template remnants.
3. Convert older pages to the current Gravium style used by Vendors, Items, Cost Estimates, and Timeline.
4. Use Vendors-style `PageHeader` for module/list pages.
5. Continue mobile-lite rules per module after cleanup pass begins.

