---
name: Serene Clinical Minimal
colors:
  surface: '#f8f9ff'
  surface-dim: '#c4dcff'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4ff'
  on-surface: '#011c37'
  on-surface-variant: '#3d4946'
  inverse-surface: '#1a314d'
  inverse-on-surface: '#eaf1ff'
  outline: '#6d7a76'
  outline-variant: '#bcc9c5'
  surface-tint: '#006b5d'
  primary: '#00685b'
  on-primary: '#ffffff'
  primary-container: '#008373'
  on-primary-container: '#f4fffb'
  inverse-primary: '#65dac4'
  secondary: '#57605f'
  on-secondary: '#ffffff'
  secondary-container: '#d8e2e0'
  on-secondary-container: '#5b6563'
  tertiary: '#805200'
  on-tertiary: '#ffffff'
  tertiary-container: '#a16800'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#83f6e0'
  primary-fixed-dim: '#65dac4'
  on-primary-fixed: '#00201b'
  on-primary-fixed-variant: '#005046'
  secondary-fixed: '#dbe5e3'
  secondary-fixed-dim: '#bfc9c7'
  on-secondary-fixed: '#141d1c'
  on-secondary-fixed-variant: '#3f4947'
  tertiary-fixed: '#ffddb5'
  tertiary-fixed-dim: '#ffb957'
  on-tertiary-fixed: '#2a1800'
  on-tertiary-fixed-variant: '#643f00'
  background: '#f8f9ff'
  on-background: '#011c37'
  surface-variant: '#d3e4ff'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 6rem
  margin-mobile: 3.5rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The visual identity embodies a modern, stress-free clinical experience tailored for contemporary healthcare in metropolitan Delhi. The design shifts away from the sterile, anxiety-inducing aesthetics of traditional dental practices, leaning instead into warmth, high hygiene standards, and effortless professionalism.

### Aesthetic Foundation
- **Style Mix:** Contemporary Medical Minimal infused with Soft Organic tactility. Surfaces feel airy and immaculate, anchored by deep slate-navy typographic weights.
- **Atmosphere:** Tranquil, pristine, highly competent, welcoming. Interfaces must convey immaculate sanitary standards alongside emotional ease.
- **Visual Tenets:**
  - Generous whitespace to promote mental calm and reduce cognitive friction for patients seeking appointments or reviewing treatments.
  - Soft, organic perimeter radii combined with gentle directional gradients in micro-interactions.
  - Absence of harsh high-contrast dividers; visual segmentation relies on deliberate shifts between fresh mint canvas fills and pure white clinical surfaces.

## Colors

The palette is tuned specifically for daylight clarity, reassurance, and strict WCAG AA contrast compliance against crisp mint and pure white fields.

### Palette Architecture
- **Primary Teal (`#0F9D8A`):** The clinical anchor. Conveys medical precision, renewal, and calm.
  - *Primary Dark (`#0A6E60`):* Interactive hover states and high-emphasis focal items.
  - *Primary Subdued (`#E3F6F3`):* Tonal fills for active states, light icon backdrops, and active table rows.
- **Fresh Mint Canvas (`#F0FAF8`):** The primary page body fill, reducing glare compared to stark white while signaling freshness.
- **Clinical White (`#FFFFFF`):** Reserved for elevated interactive cards, patient records, input fields, and modal dialogue overlays.
- **Deep Navy Base (`#0B2540`):** Replaces harsh pure black for all structural typography, data readouts, and primary labeling, providing authoritative contrast.
- **Warm Amber Accent (`#F5A524`):** Used selectively for clinic ratings, doctor credentials, pending appointment indicators, and high-urgency notifications.
- **Slate & Neutral Tones:**
  - *Slate Subdued (`#597184`):* Secondary body text, form microcopy, and appointment timestamps.
  - *Border Subtle (`#DCECE8`):* Low-contrast, mint-tinted borders for resting form controls and card frames.

## Typography

The typographic hierarchy balances warm, approachable geometry for patient orientation with strict, highly legible neutrality for dental medical data, tooth charts, and scheduling.

### Structural Roles
- **Headings (Plus Jakarta Sans):** Rounded terminal shapes infuse a human touch into procedure descriptions, clinic greetings, and doctor bios.
- **Body & Data (Inter):** Systemic, mathematically neutral letterforms ensure clinical clarity across dosage guidelines, post-treatment instructions, and billing breakdowns.
- **Letter Spacing:** Apply `-0.02em` tracking across all `headline-xl` and `headline-lg` styles for editorial polish. Maintain `0` tracking for body text, and apply `+0.02em` to `label-sm` when used in pill caps or badge tags.

## Layout & Spacing

Layouts adhere strictly to an 8px modular baseline to maintain structural calm. Content is bounded by a centered 1200px max-width container, preventing wide layout stretching on expansive medical workstations and monitors.

### Breakpoints & Canvas Flow
- **Desktop (>= 1024px):** 12-column grid, 24px gutters, with generous vertical section padding of 96px (`margin: 6rem`).
- **Tablet (768px - 1023px):** 8-column grid, 20px gutters, with 64px vertical section rhythm.
- **Mobile (< 768px):** 4-column grid, 16px gutters, with 56px (`margin-mobile: 3.5rem`) vertical section padding and 16px lateral screen margins.

### Spatial Discipline
Sections feature ample breathing room to prevent information overload. Clustered data blocks (e.g., patient vital summaries, doctor schedules) use internal increments of `space-sm` (12px) and `space-md` (16px), while distinct treatment category groupings use `space-xl` (32px).

## Elevation & Depth

Depth is established through soft, diffused ambient light rather than structural black shadows. Shadows are tinted with deep slate and teal pigments to mimic light passing through clean clinical glass and clean architectural interiors.

### Shadow Tiers
- **Elevation 1 (Resting Cards & Inputs):** 
  `0px 4px 20px rgba(11, 37, 64, 0.04)`
  Subtle separation of white containers from the fresh mint background.
- **Elevation 2 (Interactive Floating Elements, Date Pickers, Hover States):** 
  `0px 8px 30px rgba(15, 157, 138, 0.08), 0px 2px 8px rgba(11, 37, 64, 0.04)`
  Dual-cast shadow applying a slight teal ambient glow underneath primary cards upon hover.
- **Elevation 3 (Modals, Overlays, Patient Booking Drawer):** 
  `0px 20px 48px rgba(11, 37, 64, 0.12), 0px 4px 12px rgba(15, 157, 138, 0.06)`
  Broad, atmospheric drop shadow giving floating modals undeniable elevation without requiring heavy darkened backdrop scrims.

### Atmospheric Gradients
Hero sections and highlight panels may utilize soft ambient teal gradient orbs (`radial-gradient(circle at top right, rgba(15, 157, 138, 0.12), transparent 70%)`) blurred at `64px` behind structural white cards to introduce soft dimensional glow.

## Shapes

The design system relies on smooth, friendly roundedness to alleviate clinical apprehension. Hard, angular 90-degree corners are deliberately excluded.

### Radius Token Scale
- **Compact Controls (12px):** Applied to form fields, nested micro-buttons, search bars, and dropdown triggers.
- **Standard Structural Units (20px):** Applied to treatment service cards, doctor profile cards, and patient review modules.
- **Hero & Large Containers (28px):** Applied to appointment booking hero panels, clinic facility highlight showcases, and modal surfaces.
- **Pills (9999px / Fully Rounded):** Reserved exclusively for status badges, interactive filter chips, ratings badges, and floating action triggers.

## Components

### Buttons
- **Primary Button:** Filled `#0F9D8A` with pure white text, 12px corner radius (or full pill shape for CTAs like "Book Appointment"), tracking medium. Hover transitions to `#0A6E60` with a subtle transform lift (`translateY(-1px)`) and Elevation 2 glow. Active state scales to `0.98`.
- **Secondary / Soft Button:** Filled with mint tint `#E3F6F3` with primary teal `#0F9D8A` text. Hover shifts to `#D2EFE9`.
- **Tertiary / Ghost Button:** Transparent background, deep navy text, no border. Hover applies soft `#F0FAF8` tint.

### Form Inputs & Selectors
- **Resting:** Pure white background, `1.5px` border in `#DCECE8`, 12px radius, 16px internal padding. Navy text `#0B2540`, placeholder in `#8EA3B2`.
- **Focus State:** Border shifts cleanly to `#0F9D8A`, backed by a soft glow ring (`box-shadow: 0 0 0 4px rgba(15, 157, 138, 0.15)`). Transition is smooth (150ms ease-out).

### Badges & Chips
- **Status Pills:** Pill-shaped (fully rounded), 6px vertical by 12px horizontal padding.
  - *Confirmed / Verified:* `#E3F6F3` background with `#0F9D8A` text.
  - *Rating / Review:* Light warm amber background (`#FEF6E9`) with `#C98113` text, accompanied by an amber `#F5A524` star icon.
- **Interactive Filter Chips:** White background with subtle `#DCECE8` border. Selected state switches to teal fill with white text.

### Cards
- Standard cards feature a pure white canvas (`#FFFFFF`) against the `#F0FAF8` page backdrop, bounded by a 20px radius and Elevation 1.
- Hoverable treatment cards gently scale and step up to Elevation 2, emphasizing tactile feedback.

### Checkboxes & Radios
- Size: 20px by 20px. 6px radius for checkboxes, 50% for radios.
- Unchecked: White background, 1.5px `#DCECE8` border.
- Checked: Teal `#0F9D8A` fill with a crisp white checkmark or center pip.