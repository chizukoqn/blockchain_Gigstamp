# GigStamp Design Brainstorm

## Context
GigStamp is a mobile-first gig marketplace app with two user roles (Client and Worker). The design must feel modern, trustworthy, and efficient—similar to Uber/Grab—while maintaining clarity for role-based workflows and job lifecycle states.

---

## Design Approach Selected: Modern Minimalism with Functional Depth

### Design Movement
**Modern Minimalism + Functional Design** — Inspired by contemporary fintech and gig economy apps (Uber, Grab, Stripe). Clean surfaces with purposeful micro-interactions and a hierarchy that guides users through complex workflows.

### Core Principles
1. **Clarity First**: Every element serves a purpose. Remove visual noise; emphasize information hierarchy and action clarity.
2. **Trust Through Consistency**: Predictable patterns, consistent spacing, and reliable feedback build user confidence in a marketplace context.
3. **Mobile-Native Thinking**: Design for thumb-friendly interactions, scannable layouts, and single-column flows on small screens.
4. **Progressive Disclosure**: Show essential information first; reveal details on demand to avoid cognitive overload.

### Color Philosophy
- **Primary Brand**: Deep blue (`#1E40AF` / `oklch(0.45 0.15 260)`) — conveys trust, professionalism, and stability.
- **Accent/Action**: Vibrant orange (`#F97316` / `oklch(0.65 0.2 30)`) — draws attention to CTAs and status changes; energetic without aggression.
- **Status Colors**:
  - Created: Neutral gray (`#6B7280`)
  - Funded: Calm blue (`#3B82F6`)
  - Accepted: Warm orange (`#F97316`)
  - Submitted: Purple (`#A855F7`)
  - Completed: Green (`#10B981`)
- **Neutral Base**: Off-white background (`#FAFAFA`), dark charcoal text (`#1F2937`).
- **Reasoning**: Blue + orange is a complementary pair that feels modern and energetic. Grays and whites create breathing room. Status colors are distinct and accessible.

### Layout Paradigm
- **Single-Column Mobile-First**: Primary layout is vertical stack, optimized for portrait viewing.
- **Card-Based System**: Jobs, profiles, and actions live in distinct cards with subtle shadows and rounded corners (12px radius).
- **Bottom Navigation**: Persistent nav bar for role-specific sections (Dashboard, Browse/Create, Profile) on main screens.
- **Asymmetric Detail Pages**: Job detail and feedback screens use full-width layouts with header imagery and stacked content below.
- **Whitespace Strategy**: Generous padding (16px mobile, 24px tablet) between sections to reduce visual density.

### Signature Elements
1. **Status Timeline Badge**: Horizontal pill-shaped badges showing job lifecycle (Created → Funded → Accepted → Submitted → Completed). Visual progress indicator.
2. **Action Cards**: Elevated cards with clear CTAs (buttons) at the bottom. Consistent interaction pattern across all workflows.
3. **Micro-Status Indicators**: Small colored dots or tags next to job titles/worker names to instantly communicate state.

### Interaction Philosophy
- **Immediate Feedback**: Buttons show loading states; status changes animate smoothly.
- **Confirmation for Destructive Actions**: Critical actions (approve job, submit work) may show brief confirmation or toast.
- **Gesture-Friendly**: Large touch targets (44px minimum), ample spacing between interactive elements.
- **Contextual Help**: Empty states and onboarding hints guide first-time users.

### Animation Guidelines
- **Entrance Animations**: Subtle fade-in + slide-up (200ms) for new cards or modals.
- **Status Transitions**: Smooth color transitions (300ms) when job status changes.
- **Button Feedback**: Quick scale-down (100ms) on click; loading spinner for async actions.
- **Scroll Behavior**: Smooth scroll-to-top when navigating between sections.
- **No Distracting Motion**: Avoid excessive animations; keep focus on content and actions.

### Typography System
- **Display Font**: `Poppins` (bold, 600–700 weight) for headers and hero text. Modern, geometric, friendly.
- **Body Font**: `Inter` (regular, 400–500 weight) for body text and UI labels. Highly readable, neutral.
- **Font Hierarchy**:
  - H1 (Page Titles): Poppins 700, 28px mobile / 32px tablet
  - H2 (Section Headers): Poppins 600, 20px mobile / 24px tablet
  - Body (Content): Inter 400, 14px mobile / 16px tablet
  - Small (Labels, Metadata): Inter 500, 12px mobile / 13px tablet
  - Button Text: Inter 600, 14px mobile / 16px tablet

---

## Design Decisions for Implementation
- Use Tailwind's default spacing (4px base unit) for consistency.
- Leverage shadcn/ui components (Button, Card, Dialog, Badge) to maintain visual cohesion.
- Implement custom color tokens in `index.css` for status colors and brand palette.
- Add Google Fonts (Poppins + Inter) to `client/index.html`.
- Use Lucide React icons for consistency and minimal visual weight.
- Apply subtle shadows (`shadow-sm`, `shadow-md`) to cards for depth without heaviness.
- Ensure all interactive elements have clear focus states (ring-2 on focus).

---

## Next Steps
1. Update `client/src/index.css` with Poppins + Inter fonts and custom color tokens.
2. Build authentication flow (Landing → Login/Register → Role Selection).
3. Implement Client and Worker dashboards with bottom navigation.
4. Build job creation, browsing, and detail screens.
5. Implement rating system and feedback flow.
6. Test on mobile and tablet viewports.
