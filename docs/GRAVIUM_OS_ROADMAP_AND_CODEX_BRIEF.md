# Gravium OS Roadmap and Codex Brief

This document is the working roadmap, implementation plan, and Codex handoff brief for Gravium OS.

Repo:
D:\Gravium Design Studio\Web_App\graviumos

Branch:
featuretest

## Development Rules

- The user runs commands line-by-line in PowerShell.
- Avoid Bash heredoc syntax like `python - <<'PY'`.
- Use PowerShell-safe Python patches:
  `@' ... '@ | python -`
- Avoid `Set-Content` for TS/TSX files unless explicitly UTF-8.
- Prefer Python `Path.write_text(..., encoding="utf-8")`.
- After patches, run:
  - `npm run build`
  - `git status --short`
  - `git diff --name-status`
  - `git diff --stat`
- If final `git status --short` has no output, treat the working tree as clean.
- Commit at logical milestones, not after every tiny patch.
- UI fixes should be screenshot-driven and targeted.
- For fetched/selectable data like Items, Vendors, Projects, Units, Categories, use searchable suggestion/typeahead dropdowns instead of native selects where possible.
- Suggestion dropdowns must not be clipped. Use proper z-index, overflow-safe containers, or body/modal-safe rendering.
- New module/list pages should follow the Vendors-style PageHeader layout.
- Desktop card action rows should use full-width responsive button groups.
- Number inputs should allow empty/backspace states. Avoid trapping users with forced zero values.
- Avoid unsafe/special UI separators that may render incorrectly. Prefer plain ASCII labels.

---

# Current Product Direction

Gravium OS is an internal operating system for Gravium Design Studio.

It should manage the full business workflow:

1. Leads
2. Projects
3. Design workflow
4. Cost Estimates
5. Contract and booking payment
6. Planned Timeline
7. Execution tracking
8. Project Finance
9. Handover
10. Reports and archive

The app should feel premium, clean, practical, and operationally useful, not like a generic template.

Current visual baseline:
- Vendors page
- Items page
- Cost Estimates page
- Timeline page

These pages define the current Gravium UI direction.

Design system:
- Tailwind
- Neue Montreal
- Gravium brand style
- Clean cards
- PageHeader on module/list pages
- Strong mobile layouts
- Clear light/dark contrast

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
9. Basic payment gates
10. Basic Project Finance direction
11. Clean consistent UI for the main workflow pages

## MVP Does Not Need Yet

1. Full Supabase conversion
2. Advanced KPI engine
3. Advanced permissions engine
4. Full client portal
5. Advanced purchase orders
6. Advanced PDF/report automation
7. Full forecast automation
8. PWA notifications

---

# Short Milestone Chart

| Milestone | Goal |
|---|---|
| 1. MVP Core Workflow | Projects, Items, Vendors, Cost Estimates, Employee Tasks, Timeline from approved estimate, basic payment gates |
| 2. Timeline Execution | Planned vs Actual timeline, Start/Pause/Resume/Complete work, delay reasons |
| 3. Project Finance Integration | Make Project Finance the payment source of truth; Timeline reads payment status |
| 4. Employee KPI Foundation | Use real task/project/payment/activity data for KPI tracking |
| 5. Dashboards and Permissions | Admin dashboard, Employee dashboard, Department Head views, page/feature access |
| 6. UI and Codebase Cleanup | Remove Porsche/template leftovers, standardize all pages to Gravium style |
| 7. Supabase Migration | Replace localStorage with real database tables and multi-user data |
| 8. Reports and Client Outputs | Branded Estimate PDF, Timeline Report, Progress Report, Handover Report |

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

3. Forecast Timeline
   - Recalculates current expected dates based on delays, pauses, payments, vendors, dependencies, site readiness, and client decisions.
   - Each work package should later support:
     - Projected Start Date
     - Projected End Date

## Execution Actions

Future work package actions:

1. Start Work
2. Pause Work
3. Resume Work
4. Complete Work
5. Mark Delayed
6. Add Delay Reason

## Internal View

Internal timeline should show:

1. Estimated vs Actual dates
2. Delay days
3. Pause history
4. Payment blockers
5. Vendor blockers
6. Dependency blockers
7. Projected handover shift

## Client-Facing View

Client reports should show:

1. Original Plan
2. Current Progress
3. Upcoming Works
4. Payment Gates
5. Expected Handover
6. Concise delay notes

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

Timeline should not permanently own payment truth.

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

## Admin Dashboard

Should show:

1. Projects
2. Timeline delays
3. Pending payments
4. Employee task performance
5. Cost estimates pending approval
6. Vendor issues
7. Lead status
8. Finance overview

## Employee Dashboard

Should show:

1. My tasks today
2. Overdue tasks
3. Project tasks assigned to me
4. Internal tasks assigned to me
5. Pending approvals
6. Recently completed work
7. Basic KPI snapshot

## Department Head Dashboard

Should show only department-relevant work.

Examples:
- Marketing head sees leads and marketing tasks.
- Finance head sees finance and payment tasks.
- Execution head sees site/timeline/vendor tasks.

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

Examples:
- Finance can update Project Finance but cannot edit Cost Estimate line items.
- Execution can update work package status but cannot delete projects.
- Marketing can manage leads but cannot access Project Finance.
- Employee can view Timeline but cannot edit payment gates.

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

Use Codex for:

1. Repo-wide cleanup
2. Multi-file refactors
3. Removing Porsche/template leftovers
4. Standardizing styles across many pages
5. Splitting large components
6. Supabase migration scaffolding
7. Route/page permission system
8. Large repetitive changes

Best Codex tasks for Gravium OS:

1. Find and remove legacy Porsche/template components.
2. Standardize all module pages to Gravium style.
3. Refactor large files like TimelinePage, CostEstimateSection, Projects, and Tasks.
4. Prepare Supabase service/data layer after schema is finalized.
5. Implement permissions guards after rules are finalized.

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

Immediate order:

1. Commit current timeline payment patch.
2. Add Timeline confirmation state.
3. Add basic execution actions:
   - Start Work
   - Pause Work
   - Resume Work
   - Complete Work
4. Improve Work tab UI for Planned vs Actual.
5. Start Project Finance cleanup plan.
6. Define MVP checklist in-app or docs.
7. Use Codex for Porsche/template cleanup and page standardization.

---

# New Chat Handoff Checklist

Whenever moving to a new chat, include:

1. Repo path:
   D:\Gravium Design Studio\Web_App\graviumos

2. Branch:
   featuretest

3. PowerShell workflow rules:
   - No Bash heredocs
   - Use `@' ... '@ | python -`
   - Use UTF-8 writes
   - Build/status check after patches

4. Latest clean commit and working tree status

5. Current module being worked on

6. Current implementation goal

7. Important long-term tracks:
   - MVP
   - Timeline planned/actual/forecast architecture
   - Project Finance source of truth
   - Employee Tasks and KPI
   - Dashboards and permissions
   - Supabase migration
   - Porsche/template cleanup
   - Gravium UI standardization
   - Reports/PDF exports

8. Temporary Villa Athani timeline dev controls remain intentionally available until user asks to remove them.
