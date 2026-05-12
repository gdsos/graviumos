# Gravium OS Project Workflow Reference

This document is the product workflow reference for Gravium OS. Use this before editing existing project, timeline, cost estimate, vendor, payment, or execution pages.

## Core Workflow

Lead / Client Enquiry
→ Project Created
→ Design Proposal / Design Estimate
→ Design Contract + Design Payment
→ Design Process
→ Design Approval
→ Execution Decision
→ Cost Estimate
→ Execution Contract + Execution Payment
→ Timeline Creation
→ Execution Tracking
→ Handover
→ Archive / Close Project

## Important Rules

- Project can be created before final revenue is confirmed.
- Design has its own estimate, payment gates, contract, and timeline.
- Execution timeline should only be created after Cost Estimate is approved.
- Design Only projects can later convert to Execution.
- Only one active timeline should exist per project timeline type.
- Once a timeline exists, Create Timeline becomes Edit Timeline.
- Dashboard, What Should I Do Next, payment gates, and timeline controls should not show before a real timeline exists.
- Execution timeline should fetch scope, pricing, vendors, and revenue from approved Cost Estimate.
- Cost Estimate should calculate COGS + service charge + misc charge + GST.
- Revenue mismatch should show a popup with Continue Editing and Update Revenue.
- Project Chat should allow assigned employees to chat inside a project and should be archivable after completion.

## Future Project Sections

- Project Overview
- Design Estimate
- Design Timeline
- Cost Estimate
- Execution Timeline
- Vendors
- Payments
- Documents / Contract
- Project Chat
- Files

## Project Chat

Employees assigned to a project should be able to chat inside the project. The chat should support project coordination, vendor updates, design clarifications, site updates, and finance notes.

After project completion, project chat can be archived to reduce active database/storage usage. Archived chats should remain read-only and searchable if needed.

## Cost Estimate

Cost Estimate should become a complete calculator with:

- Area / room-wise scope
- Scope item pricing
- COGS
- Service charge 10–20%
- Misc charge 10–15%
- GST 18%
- Gross revenue validation
- Revenue mismatch warning
- Branded PDF estimate export with company branding, address, client details, project details, terms, and approval status

Formula:

COGS Subtotal
+ Service Charge 10–20%
+ Misc Charge 10–15%
= Taxable Subtotal
+ GST 18%
= Estimated Gross Revenue

## Timeline

Design Timeline:
- Created after design estimate/design advance.
- Does not require approved Cost Estimate.
- Usually does not require heavy vendor workflow.

Execution Timeline:
- Created only after Cost Estimate is approved.
- Pulls scope items, pricing, vendor category, approved revenue, and payment structure from Cost Estimate.
- Generates work packages, payment gates, dependencies, and vendor assignments.

## Mobile UX Rules

- One stage visible at a time
- No horizontal overflow
- Full-width cards
- Sticky or easy-access Back / Continue controls
- Scroll to top after each step change
- Avoid giant side-by-side layouts
- Future steps locked until reached by Continue
