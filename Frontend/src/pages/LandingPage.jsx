import { useState } from 'react';
import { Link } from 'react-router-dom';

/* ─────────────────────────────────────────────
   Dwarka Dental Clinic — Landing Page
   Converted from stitch_dwarka_dental_clinic_landing_page/code.html
   ───────────────────────────────────────────── */

/* ── Sub-components ── */

function StarRating({ count = 5, size = 18 }) {
  return (
    <span className="lp-stars" style={{ '--star-size': `${size}px` }}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="material-symbols-outlined lp-star-icon">star</span>
      ))}
    </span>
  );
}

function ServiceCard({ icon, badge, title, desc, featured }) {
  return (
    <div className={`lp-service-card${featured ? ' lp-service-card--featured' : ''}`}>
      <div>
        <div className={`lp-service-icon${featured ? ' lp-service-icon--featured' : ''}`}>
          <span className="material-symbols-outlined" style={{ fontSize: 26 }}>{icon}</span>
        </div>
        <div className="lp-badge">{badge}</div>
        <h3 className="lp-headline-sm lp-service-title">{title}</h3>
        <p className="lp-body-sm lp-secondary">{desc}</p>
      </div>
      <a className="lp-link-arrow" href="#book-form">
        Explore Treatment &amp; Pricing <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
      </a>
    </div>
  );
}

function WhyCard({ icon, title, desc }) {
  return (
    <div className="lp-why-card">
      <div className="lp-why-icon">
        <span className="material-symbols-outlined" style={{ fontSize: 28 }}>{icon}</span>
      </div>
      <h3 className="lp-headline-sm lp-on-surface">{title}</h3>
      <p className="lp-body-sm lp-secondary" style={{ marginTop: 8 }}>{desc}</p>
    </div>
  );
}

function DoctorCard({ src, badge, name, qual, exp, bookLabel }) {
  return (
    <div className="lp-doctor-card">
      <div className="lp-doctor-img-wrap">
        <img className="lp-doctor-img" src={src} alt={name} />
        <div className="lp-doctor-badge">{badge}</div>
      </div>
      <div className="lp-doctor-body">
        <div>
          <h3 className="lp-headline-sm lp-on-surface" style={{ fontWeight: 700 }}>{name}</h3>
          <p className="lp-label-sm lp-primary" style={{ fontWeight: 600, marginTop: 2 }}>{qual}</p>
          <p className="lp-body-sm lp-secondary" style={{ marginTop: 8 }}>{exp}</p>
        </div>
        <a className="lp-doctor-book" href="#book-form">
          <span>{bookLabel}</span>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
        </a>
      </div>
    </div>
  );
}

function StepCard({ num, active, title, desc }) {
  return (
    <div className="lp-step-card">
      <div className={`lp-step-num${active ? ' lp-step-num--active' : ''}`}>{num}</div>
      <h3 className="lp-headline-sm lp-on-surface">{title}</h3>
      <p className="lp-body-sm lp-secondary" style={{ marginTop: 8 }}>{desc}</p>
    </div>
  );
}

function ReviewCard({ quote, name, location, tag }) {
  return (
    <div className="lp-review-card">
      <div>
        <StarRating size={18} />
        <p className="lp-body-md lp-on-surface-variant lp-review-text">&ldquo;{quote}&rdquo;</p>
      </div>
      <div className="lp-review-footer">
        <div>
          <p className="lp-label-md lp-on-surface" style={{ fontWeight: 700 }}>{name}</p>
          <p className="lp-label-sm lp-secondary">{location}</p>
        </div>
        <span className="lp-tag">{tag}</span>
      </div>
    </div>
  );
}

function FaqItem({ index, open, question, answer, onToggle }) {
  return (
    <div className="lp-faq-item">
      <button className="lp-faq-btn" onClick={() => onToggle(index)} aria-expanded={open}>
        <span className="lp-headline-sm lp-on-surface lp-faq-question">{question}</span>
        <span className={`material-symbols-outlined lp-primary lp-faq-icon${open ? ' lp-faq-icon--open' : ''}`}>expand_more</span>
      </button>
      {open && (
        <div className="lp-faq-answer lp-body-sm lp-secondary">{answer}</div>
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function LandingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [bookingSummary, setBookingSummary] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', treatment: '', date: '' });

  function toggleFaq(idx) {
    setOpenFaq(prev => (prev === idx ? null : idx));
  }

  function handleBook(e) {
    e.preventDefault();
    const { name, phone, treatment, date } = form;
    if (!name || !phone || !treatment || !date) return;
    setBookingSummary(
      `Thank you, ${name}! Your consultation request for ${treatment} on ${date} has been registered. Our Sector 12 front desk will call ${phone} within 15 minutes to confirm your exact timing.`
    );
    setBookingConfirmed(true);
    setForm({ name: '', phone: '', treatment: '', date: '' });
  }

  const services = [
    { icon: 'dentistry', badge: 'Preventive Care', title: '1. Consultation & Comprehensive Checkup', desc: 'High-definition intraoral camera mapping, oral cancer screening, and customized treatment planning.' },
    { icon: 'water_drop', badge: 'Hygiene & Gum Health', title: '2. Ultrasonic Teeth Cleaning & Polishing', desc: 'Painless plaque and tartar removal using EMS piezon ultrasonic scalers with airflow stain removal.' },
    { icon: 'shield_with_heart', badge: 'Restorative', title: '3. Tooth-Colored Composite Fillings', desc: 'Biomimetic nanohybrid resin fillings matched precisely to natural tooth enamel tone and contour.' },
    { icon: 'medical_services', badge: 'Most Popular', title: '4. Single-Sitting Root Canal (RCT)', desc: 'Computerized rotary endodontics with electronic apex locators for 100% painless single-visit relief.', featured: true },
    { icon: 'healing', badge: 'Oral Surgery', title: '5. Painless Tooth & Wisdom Extraction', desc: 'Minimally invasive extractions and surgical wisdom tooth management with rapid healing protocols.' },
    { icon: 'verified', badge: 'Prosthodontics', title: '6. Zirconia Dental Crowns & Bridges', desc: 'CAD/CAM milled metal-free zirconia crowns with lifetime warranty on material integrity and bite strength.' },
    { icon: 'precision_manufacturing', badge: 'Permanent Solution', title: '7. Laser Dental Implants', desc: 'Computer-guided titanium implants with immediate loading options and 99.2% lifetime success rate.', featured: true },
    { icon: 'flare', badge: 'Cosmetic Smile', title: '8. Laser Teeth Whitening', desc: 'Up to 8 shades brighter smile in 45 minutes using enamel-safe cold light laser technology.' },
    { icon: 'auto_fix_high', badge: 'Orthodontics', title: '9. Invisible Braces & Clear Aligners', desc: 'Discreet, removable clear aligners designed with 3D digital simulation for teens and working adults.' },
  ];

  const whyCards = [
    { icon: 'medical_information', title: 'Experienced MDS Specialists', desc: 'Every complex procedure is strictly led by qualified Master of Dental Surgery (MDS) doctors with 10+ years of clinical tenure.' },
    { icon: 'sanitizer', title: 'Class-B 6-Step Autoclave', desc: 'European Class-B vacuum sterilization for all instruments. Pouches opened exclusively in front of the patient.' },
    { icon: 'radiology', title: 'AI-Assisted Low Radiation X-Rays', desc: 'High-speed sensors emit 90% less radiation than standard traditional dental film with instant chairside chair-monitors.' },
    { icon: 'price_check', title: '100% Transparent Upfront Pricing', desc: 'No hidden clinic fee surprises. Written treatment plan breakdown provided before beginning any dental work.' },
    { icon: 'cloud_sync', title: 'Cloud Digital Patient Records', desc: 'Seamless WhatsApp prescriptions, digital X-ray copies, and treatment tracking accessible anytime on your phone.' },
    { icon: 'schedule', title: 'Morning & Evening Timings', desc: 'Open 6 days a week until 8:30 PM plus Sunday morning slots so you never have to skip work or school.' },
  ];

  const doctors = [
    {
      src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDJbslD4x9qo6MlouT_lZFDEsOeZNlsEpcNDH4Ct-fxbjzNgN6VQrHx2LlzmL3b56ugfqIRfhuhV0g8jkAJ3N65sZUgZ1v4pQvdW5EXw9CBe5shGJRAY46xj1XuUGjrXKxxuBfc-iYy6slKeF259SwoNNMJHFmuTn-bDq2kr6httJNa7XsOZ5hwqwZSGq4FVC52j2RExXeAsCaPWIW0FiUyomIozrDjAdpAwqa9MHA',
      badge: 'Lead Implantologist',
      name: 'Dr. Rajesh Sharma',
      qual: 'MDS (Prosthodontics & Implantology)',
      exp: '16 Years Exp. • Over 4,200 successful dental implants & full-mouth rehabilitation cases.',
      bookLabel: 'Book with Dr. Rajesh',
    },
    {
      src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC50yhE5dho8mF_g3icq3drKdS7NDuRr0awzE6emtvqmrwwVHl4Q7eTuvutRe4Skpbh_VLORn4gld_fVa9kNInOTf6z2JuAkcso-BFCnIG5h3CfnHXp1XhwY1izGE8cyHyS9RZeXdzWHcsNXJo27z3D9WQHysSNDqjq4ho8PoWkbInZqs68K_s2NbQYyYXkbJiuoznYOp_S8CvivQ6JT5460bouAWlh4TYxN0Se6_w',
      badge: 'Invisalign Certified',
      name: 'Dr. Neha Verma',
      qual: 'MDS (Orthodontics & Dentofacial)',
      exp: '12 Years Exp. • Specialist in clear aligners, self-ligating braces, and smile aesthetics.',
      bookLabel: 'Book with Dr. Neha',
    },
    {
      src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB--4BJQbfJ0r5CbqqCxp23EvcMtGeQ-lkxNnVSDlOIHsrwnV0Zpvv816nutVw8wQ5d7BjkC3SnfvnxNRNmXNgVEfLAtJeiCjJ3C370Tyau1IB_woqo4rH53-IEjX-mXeHvgTlB1rYozH0r6p1TRCNQUiKIfUM3qE_G5otrLy3ifvDeA8rPmUMFXQKrlSKTB9AB2J4VwYMmbFhzZpbSVQKTso72mE7O3RRwXaxO96c',
      badge: 'Root Canal Specialist',
      name: 'Dr. Vikram Mehra',
      qual: 'BDS, MDS (Conservative & Endodontics)',
      exp: '10 Years Exp. • Specialist in painless rotary RCT and biomimetic tooth restoration.',
      bookLabel: 'Book with Dr. Vikram',
    },
    {
      src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuASs2pnuLx1NARKAmGCFsU8-HEVadZU9dxtwY_5pP2ODC9AzslDauq9bl78jfZzdpnw8YoyfXnCgPFOzXNxOUktqqLvqgDpacoEvFGGFYpgLnKjQuX4yg6XoFCz_SnLpvFvavl0HQzig2fXDPlznDvilJOt0FzEsfisOs_Pvgyd1wPvs0U6ra1XhwQbfTuWCUJlPy0Ljd9TNdojuGquwlVQJ1LPrvoZ17vAbOjrmwI',
      badge: 'Pediatric Specialist',
      name: 'Dr. Ananya Kapoor',
      qual: 'MDS (Pediatric Dentistry)',
      exp: '8 Years Exp. • Child psychology trained, ensuring zero-fear dental care for toddlers and kids.',
      bookLabel: 'Book with Dr. Ananya',
    },
  ];

  const steps = [
    { num: '1', active: true, title: 'Instant Online Booking', desc: 'Choose your preferred time slot online or via WhatsApp. Instant SMS confirmation with clinic Google Maps pin.' },
    { num: '2', active: false, title: 'Digital Diagnostic Scan', desc: 'Check-in with zero waiting. Full 3D intraoral camera inspection and low-dose HD digital X-ray.' },
    { num: '3', active: false, title: 'Painless Treatment', desc: 'Gentle treatment carried out with topical computerized numbing gels in a soothing, music-assisted operatory.' },
    { num: '4', active: false, title: 'Follow-Up & Care', desc: 'Digital post-op care instructions sent to your phone with automated follow-up calls and warranty cards.' },
  ];

  const reviews = [
    { quote: 'I had terrible dental anxiety after a bad experience elsewhere. Dr. Vikram at Dwarka Dental Sector 12 did my root canal completely painlessly in just 40 minutes! Truly commendable work.', name: 'Sunita Chawla', location: 'Dwarka Sector 6', tag: 'Root Canal' },
    { quote: 'Got dental implants for my mother with Dr. Rajesh Sharma. The digital 3D planning was explained transparently, and the pricing was clear with no sudden add-ons. She eats comfortably now!', name: 'Amit Bansal', location: 'Dwarka Sector 19', tag: 'Dental Implants' },
    { quote: 'Took my 7-year-old son to Dr. Ananya. The pediatric clinic area is cheerful and calm. He was laughing during the checkup instead of crying. Best clinic for families in West Delhi.', name: 'Pooja Nair', location: 'Dwarka Sector 22', tag: 'Pediatric Dentistry' },
  ];

  const faqs = [
    { q: '1. Is a root canal treatment painful?', a: 'Not at all. With modern computerized local anaesthesia techniques and rotary apex endodontics, a root canal at our Sector 12 clinic feels virtually like getting a regular filling. Most patients feel immediate relief from prior toothaches during the very first visit.' },
    { q: '2. How much do dental implants cost?', a: 'Dental implant packages depend on the implant brand (Osstem, Straumann, or Nobel Biocare) and the type of zirconia crown required. During your diagnostic 3D scan, we provide a transparent, all-inclusive written estimate with zero hidden consultation or surgery surcharges.' },
    { q: '3. Do you accept dental insurance or TPA claims?', a: 'Yes, we provide itemized GST medical invoices, treatment records, and digital documentation required for corporate dental reimbursements, health insurance OPD add-ons, and major Third-Party Administrators (TPAs).' },
    { q: '4. Are dental treatments safe for young children?', a: 'Yes, our dedicated pediatric wing is headed by Dr. Ananya Kapoor (MDS). We focus on behavioral guidance, zero-needle topical gels, and painless prevention methods like dental sealants to make children look forward to dental care.' },
    { q: '5. What emergency dental services do you provide?', a: 'We handle same-day emergency appointments for acute toothache, broken crowns, sports dental injuries, knocked-out teeth, and facial swellings. Call our direct helpline at +91 11 2808 0000 for immediate priority triage.' },
    { q: '6. How do I reach the Sector 12 clinic?', a: 'Our clinic is situated at Plot 14, Central Market, Sector 12, Dwarka. It is conveniently located just 450 meters from the Dwarka Sector 12 Metro Station (Blue Line) with convenient car parking right in front of the building.' },
  ];

  return (
    <>
      {/* ── Google Fonts & Material Symbols ── */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />

      <div className="lp-root">

        {/* ══════════ HEADER ══════════ */}
        <header className="lp-header">
          <div className="lp-container lp-header-inner">
            {/* Logo */}
            <a href="#" className="lp-brand">
              <div className="lp-brand-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2C8 2 4 5 4 9c0 2.5 1 4 2 5.5S8 17 8 22h8c0-5 2-4 4-7.5s2-3 2-5.5c0-4-4-7-8-7z" />
                </svg>
              </div>
              <div className="lp-brand-text">
                <span className="lp-brand-name">Dwarka Dental</span>
                <span className="lp-brand-sub">Clinic · Sector 12</span>
              </div>
            </a>

            {/* Desktop Nav */}
            <nav className="lp-nav">
              {['#services', '#why-us', '#doctors', '#process', '#reviews', '#faq', '#contact'].map((href, i) => (
                <a key={href} href={href} className={`lp-nav-link${i === 0 ? ' lp-nav-link--active' : ''}`}>
                  {['Services', 'Why Us', 'Doctors', 'Process', 'Testimonials', 'FAQ', 'Contact'][i]}
                </a>
              ))}
            </nav>

            {/* Trailing actions */}
            <div className="lp-header-actions">
              <a href="tel:+911128080000" className="lp-emergency-pill">
                <span className="material-symbols-outlined lp-primary" style={{ fontSize: 18 }}>support_agent</span>
                <span className="lp-emergency-num">+91 11 2808 0000</span>
              </a>
              <button className="lp-icon-btn" title="Staff Portal Login" onClick={() => setStaffModalOpen(true)}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>lock</span>
              </button>
              <a href="#book-form" className="lp-btn-primary">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>event</span>
                <span>Book Appointment</span>
              </a>
              <button className="lp-mobile-menu-btn" onClick={() => setMobileNavOpen(v => !v)}>
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{mobileNavOpen ? 'close' : 'menu'}</span>
              </button>
            </div>
          </div>

          {/* Mobile Nav Drawer */}
          {mobileNavOpen && (
            <div className="lp-mobile-nav">
              <div className="lp-mobile-nav-grid">
                {['#services', '#why-us', '#doctors', '#process', '#reviews', '#faq', '#contact'].map((href, i) => (
                  <a key={href} href={href} className="lp-mobile-nav-link" onClick={() => setMobileNavOpen(false)}>
                    {['Services', 'Why Us', 'Doctors', 'Process', 'Testimonials', 'FAQ', 'Contact'][i]}
                  </a>
                ))}
                <a href="tel:+911128080000" className="lp-mobile-nav-link lp-mobile-nav-emergency">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>call</span> Emergency
                </a>
              </div>
            </div>
          )}
        </header>

        {/* ══════════ HERO ══════════ */}
        <section className="lp-hero lp-ambient-glow">
          <div className="lp-container">
            <div className="lp-hero-grid">
              {/* Left copy */}
              <div className="lp-hero-copy">
                <div className="lp-accredited-pill">
                  <span className="lp-pulse-dot" />
                  <span>Accredited Dental Practice in Sector 12, Dwarka</span>
                </div>
                <h1 className="lp-hero-h1">
                  Healthy smiles, gentle care in <span className="lp-hero-accent">Dwarka</span>
                </h1>
                <p className="lp-body-lg lp-secondary lp-hero-sub">
                  Sector 12's trusted multi-specialty dental practice. Experience anxiety-free, digital-guided dentistry for your whole family.
                </p>
                <div className="lp-hero-ctas">
                  <a href="#book-form" className="lp-btn-primary lp-btn-primary--lg">
                    <span className="material-symbols-outlined">calendar_month</span>
                    <span>Book Instant Consultation</span>
                  </a>
                  <a href="tel:+911128080000" className="lp-btn-ghost">
                    <span className="material-symbols-outlined lp-primary">call</span>
                    <span>Call Clinic Now</span>
                  </a>
                </div>
                {/* Trust badges */}
                <div className="lp-trust-strip">
                  <div><div className="lp-headline-sm lp-on-surface" style={{ fontWeight: 700 }}>15,000+</div><div className="lp-label-sm lp-secondary">Happy Smiles</div></div>
                  <div>
                    <div className="lp-headline-sm lp-on-surface" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      4.9<span className="material-symbols-outlined lp-amber" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>star</span>
                    </div>
                    <div className="lp-label-sm lp-secondary">850+ Google Reviews</div>
                  </div>
                  <div><div className="lp-headline-sm lp-on-surface" style={{ fontWeight: 700 }}>15+ Yrs</div><div className="lp-label-sm lp-secondary">Clinical Excellence</div></div>
                  <div><div className="lp-headline-sm lp-primary" style={{ fontWeight: 700 }}>NABH</div><div className="lp-label-sm lp-secondary">Sterilization Protocols</div></div>
                </div>
              </div>

              {/* Right visual */}
              <div className="lp-hero-visual">
                <div className="lp-hero-img-wrap">
                  <img
                    className="lp-hero-img"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAliJT9MrFBRqXtti2nwt2YlAUmZ3_vtHgQcr3depIW2fmaS9_HxnalMsaWrB7tnWxu02NZv1w5ulRP8i6vHxLf2p-9aqIRZ98NPQHy-uv4G12gAerUUnLehmdeqtf8ulEzi3AMn-rgNPuIyT0DiHNQMBwkjIRMNFo-fyBHlzQWmvEjktOPBGPkW7Rg3B-i0yXTjfGAbwnRyL4FLDF-1c5O5JmeQiniISSF5b0PC0Y"
                    alt="Modern dental operatory room in Dwarka"
                  />
                  <div className="lp-hero-img-overlay" />
                  <div className="lp-float-pill lp-float-pill--tl">
                    <span className="lp-dot-primary" />
                    <span className="lp-label-sm" style={{ fontWeight: 600 }}>100% Painless Care</span>
                  </div>
                  <div className="lp-float-card lp-float-card--bl">
                    <div className="lp-float-icon"><span className="material-symbols-outlined" style={{ fontSize: 18 }}>biotech</span></div>
                    <div>
                      <p className="lp-label-sm lp-on-surface" style={{ fontWeight: 700 }}>Digital 3D X-Ray</p>
                      <p style={{ fontSize: 11, color: 'var(--lp-secondary)' }}>Zero High-Radiation Scan</p>
                    </div>
                  </div>
                  <div className="lp-float-pill lp-float-pill--tr">
                    <span className="material-symbols-outlined lp-amber" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="lp-label-sm" style={{ fontWeight: 700 }}>4.9 Dwarka Rating</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Quick Booking Form ── */}
            <div className="lp-booking-card" id="book-form">
              <div style={{ maxWidth: 700, marginBottom: 24 }}>
                <div className="lp-section-overline">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bolt</span> Quick Consultation Booking
                </div>
                <h2 className="lp-headline-md lp-on-surface">Schedule Your Priority Visit in Sector 12</h2>
                <p className="lp-body-sm lp-secondary">Front desk confirmation delivered via SMS &amp; WhatsApp within 15 minutes.</p>
              </div>

              {!bookingConfirmed ? (
                <form className="lp-book-form" onSubmit={handleBook}>
                  <div>
                    <label className="lp-form-label">Patient Full Name *</label>
                    <div className="lp-input-wrap">
                      <input className="lp-input" id="patientName" type="text" placeholder="e.g. Ramesh Saxena" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                      <span className="material-symbols-outlined lp-input-icon">person</span>
                    </div>
                  </div>
                  <div>
                    <label className="lp-form-label">Mobile Phone *</label>
                    <div className="lp-input-wrap">
                      <input className="lp-input" id="patientPhone" type="tel" pattern="[0-9]{10}" placeholder="10-digit mobile number" required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                      <span className="material-symbols-outlined lp-input-icon">smartphone</span>
                    </div>
                  </div>
                  <div>
                    <label className="lp-form-label">Treatment Category *</label>
                    <div className="lp-input-wrap">
                      <select className="lp-input lp-select" id="treatmentCategory" required value={form.treatment} onChange={e => setForm(f => ({ ...f, treatment: e.target.value }))}>
                        <option value="">Select Treatment</option>
                        <option>Consultation &amp; Checkup</option>
                        <option>Laser Teeth Whitening</option>
                        <option>Single-Sitting Root Canal</option>
                        <option>Laser Dental Implants</option>
                        <option>Invisible Braces &amp; Aligners</option>
                        <option>Kids &amp; Pediatric Dentistry</option>
                        <option>Severe Toothache (Urgent)</option>
                      </select>
                      <span className="material-symbols-outlined lp-input-icon" style={{ pointerEvents: 'none' }}>expand_more</span>
                    </div>
                  </div>
                  <div>
                    <label className="lp-form-label">Preferred Date *</label>
                    <input className="lp-input" id="appointmentDate" type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div className="lp-book-footer">
                    <div className="lp-book-note">
                      <span className="material-symbols-outlined lp-primary" style={{ fontSize: 18 }}>verified_user</span>
                      <span className="lp-label-sm lp-secondary">No pre-payment required. Pay after treatment at the clinic desk.</span>
                    </div>
                    <button type="submit" className="lp-btn-primary lp-btn-submit">
                      <span>Confirm Appointment Request</span>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="lp-confirm-card">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div className="lp-confirm-icon"><span className="material-symbols-outlined" style={{ fontSize: 28 }}>task_alt</span></div>
                    <div>
                      <h3 className="lp-headline-sm lp-on-surface">Appointment Request Received!</h3>
                      <p className="lp-body-sm lp-secondary" style={{ marginTop: 4 }}>{bookingSummary}</p>
                    </div>
                  </div>
                  <button className="lp-dismiss-btn" onClick={() => setBookingConfirmed(false)}>Dismiss</button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ══════════ SERVICES ══════════ */}
        <section className="lp-section lp-section--surface" id="services">
          <div className="lp-container">
            <div className="lp-section-header">
              <span className="lp-overline">World-Class Dentistry</span>
              <h2 className="lp-headline-lg lp-on-surface">Specialized Dental Treatments in Sector 12</h2>
              <p className="lp-body-md lp-secondary">Equipped with advanced German dental tech, computerized anaesthesia, and biomimetic dental restorations.</p>
            </div>
            <div className="lp-services-grid">
              {services.map((s, i) => (
                <ServiceCard key={i} {...s} />
              ))}
              {/* Pediatric wide card */}
              <div className="lp-service-card lp-service-card--wide">
                <div className="lp-service-wide-inner">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div className="lp-service-icon">
                      <span className="material-symbols-outlined" style={{ fontSize: 26 }}>child_care</span>
                    </div>
                    <div>
                      <div className="lp-badge">Pediatric Wing</div>
                      <h3 className="lp-headline-sm lp-on-surface">10. Kids &amp; Pediatric Dentistry</h3>
                      <p className="lp-body-sm lp-secondary" style={{ maxWidth: 560, marginTop: 6 }}>
                        Gentle pit-and-fissure sealants, fluoride shields, milk tooth crowns, and fun, anxiety-free checkups tailored for young children in Dwarka.
                      </p>
                    </div>
                  </div>
                  <a href="#book-form" className="lp-btn-ghost lp-btn-ghost--sm">
                    Book Pediatric Slot <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_today</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ WHY US ══════════ */}
        <section className="lp-section lp-section--surface-low" id="why-us">
          <div className="lp-container">
            <div className="lp-section-header-split">
              <div>
                <span className="lp-overline">Uncompromising Quality</span>
                <h2 className="lp-headline-lg lp-on-surface">Why Dwarka Families Trust Our Clinic</h2>
              </div>
              <p className="lp-body-md lp-secondary" style={{ maxWidth: 380 }}>
                Medical excellence is not just a promise; it is built into our daily sterilization, diagnosis, and patient care workflows.
              </p>
            </div>
            <div className="lp-why-grid">
              {whyCards.map((w, i) => <WhyCard key={i} {...w} />)}
            </div>
          </div>
        </section>

        {/* ══════════ DOCTORS ══════════ */}
        <section className="lp-section lp-section--surface" id="doctors">
          <div className="lp-container">
            <div className="lp-section-header">
              <span className="lp-overline">Clinical Leadership</span>
              <h2 className="lp-headline-lg lp-on-surface">Meet Our Senior Dental Specialists</h2>
              <p className="lp-body-md lp-secondary">Consult with dedicated specialists committed to conservative tooth preservation and painless procedures.</p>
            </div>
            <div className="lp-doctors-grid">
              {doctors.map((d, i) => <DoctorCard key={i} {...d} />)}
            </div>
          </div>
        </section>

        {/* ══════════ HOW IT WORKS ══════════ */}
        <section className="lp-section lp-section--surface-low" id="process">
          <div className="lp-container">
            <div className="lp-section-header">
              <span className="lp-overline">Stress-Free Patient Journey</span>
              <h2 className="lp-headline-lg lp-on-surface">How Your Visit Works</h2>
              <p className="lp-body-md lp-secondary">From first tap to lasting oral health, we have eliminated long waiting times and clinical ambiguity.</p>
            </div>
            <div className="lp-steps-grid">
              {steps.map((s, i) => <StepCard key={i} {...s} />)}
            </div>
          </div>
        </section>

        {/* ══════════ TECHNOLOGY & HYGIENE ══════════ */}
        <section className="lp-section lp-section--surface">
          <div className="lp-container">
            <div className="lp-tech-card">
              <div className="lp-tech-grid">
                <div>
                  <span className="lp-overline">Cutting-Edge Infrastructure</span>
                  <h2 className="lp-headline-lg lp-on-surface" style={{ marginTop: 8, marginBottom: 24 }}>Hospital-Grade Hygiene &amp; Next-Gen Tech</h2>
                  <p className="lp-body-md lp-secondary" style={{ marginBottom: 24 }}>
                    We uphold the stringent sterilization and hygiene benchmarks established by the National Accreditation Board for Hospitals &amp; Healthcare Providers (NABH).
                  </p>
                  <div className="lp-tech-checks">
                    {[
                      { t: 'Class-B Vacuum Autoclaves & Chemical Indicators', d: 'Multi-tier sterilization eliminating 100% of bacterial spores and micro-pathogens.' },
                      { t: 'Intraoral 3D Scanners & Digital Impression', d: 'No messy goopy paste impressions; quick digital optical wand scans completed in 60 seconds.' },
                      { t: 'HEPA-Filtered Operatory Air Quality', d: 'Continuous aerosol suction units and medical-grade air sanitizers running after every patient visit.' },
                    ].map((item, i) => (
                      <div key={i} className="lp-tech-check-row">
                        <div className="lp-check-icon"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span></div>
                        <div>
                          <h4 className="lp-label-lg lp-on-surface">{item.t}</h4>
                          <p className="lp-body-sm lp-secondary">{item.d}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="lp-sterilize-guarantee">
                    <span className="material-symbols-outlined lp-primary" style={{ fontSize: 36 }}>verified</span>
                    <div>
                      <p className="lp-label-md lp-on-surface" style={{ fontWeight: 700 }}>Sector 12 Sterilization Guarantee</p>
                      <p className="lp-label-sm lp-secondary">Each patient pack is sealed, dated, and unsealed directly before your eyes.</p>
                    </div>
                  </div>
                </div>
                <div className="lp-tech-img-wrap">
                  <img
                    className="lp-tech-img"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCii1NFCiOoVme9VI6QEV3gBKWt1zVEOp9MTg8wKtb0EizwJs-vL9sT2lYkMIDJ2oONfgtTnPNulumCSe4TL-2HsV6OBC3mzM6Zf9T0vNd6qOgB4lWanYrd-9wa4MiyitEGNlcGx3k_Vf5j2Fq9LgXDR0BaWq8eZsdrYBIgiuAgYu4bz-MCkwhUcNTBRKnugn_cPYBkdpGaZTccy0sgT5g29mfChfE-oKurnPm5UoE"
                    alt="Class-B dental autoclave sterilization"
                  />
                  <div className="lp-tech-img-overlay">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p className="lp-label-sm lp-on-surface" style={{ fontWeight: 700 }}>6-Step Autoclave Protocol</p>
                        <p className="lp-label-sm lp-secondary">Decontamination • Ultrasonic • Pouching • Vacuum Heat • Storage</p>
                      </div>
                      <span className="lp-certified-badge">100% Certified</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ REVIEWS ══════════ */}
        <section className="lp-section lp-section--surface-low" id="reviews">
          <div className="lp-container">
            <div className="lp-reviews-header">
              <div>
                <span className="lp-overline">Real Patient Experiences</span>
                <h2 className="lp-headline-lg lp-on-surface">Trusted by 15,000+ Dwarka Residents</h2>
              </div>
              <div className="lp-rating-badge">
                <div className="lp-rating-num">4.9</div>
                <StarRating size={20} />
                <span className="lp-label-sm lp-secondary">(850+ Verified Google Reviews)</span>
              </div>
            </div>
            <div className="lp-reviews-grid">
              {reviews.map((r, i) => <ReviewCard key={i} {...r} />)}
            </div>
          </div>
        </section>

        {/* ══════════ FAQ ══════════ */}
        <section className="lp-section lp-section--surface" id="faq">
          <div className="lp-container lp-faq-container">
            <div className="lp-section-header">
              <span className="lp-overline">Got Questions?</span>
              <h2 className="lp-headline-lg lp-on-surface">Frequently Asked Questions</h2>
              <p className="lp-body-md lp-secondary">Find clear answers regarding treatments, costs, sterilization, and scheduling.</p>
            </div>
            <div className="lp-faq-list">
              {faqs.map((f, i) => (
                <FaqItem key={i} index={i} open={openFaq === i} question={f.q} answer={f.a} onToggle={toggleFaq} />
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ EMERGENCY BANNER ══════════ */}
        <section className="lp-emergency-banner">
          <div className="lp-container lp-emergency-inner">
            <div className="lp-emergency-left">
              <div className="lp-emergency-icon-wrap">
                <span className="material-symbols-outlined lp-emergency-icon-sym">emergency</span>
              </div>
              <div>
                <h3 className="lp-headline-sm" style={{ fontWeight: 700 }}>Facing Severe Tooth Pain or Dental Trauma?</h3>
                <p className="lp-body-sm" style={{ opacity: 0.95 }}>Priority emergency slots reserved daily for urgent relief in Dwarka Sector 12.</p>
              </div>
            </div>
            <a href="tel:+911128080000" className="lp-emergency-cta">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>call</span>
              <span>Call Helpline +91 11 2808 0000</span>
            </a>
          </div>
        </section>

        {/* ══════════ CONTACT ══════════ */}
        <section className="lp-section lp-section--surface" id="contact">
          <div className="lp-container">
            <div className="lp-contact-grid">
              <div className="lp-contact-info">
                <div>
                  <span className="lp-overline">Visit Dwarka Dental</span>
                  <h2 className="lp-headline-lg lp-on-surface">Sector 12 Clinic Location &amp; Hours</h2>
                  <p className="lp-body-md lp-secondary">Centrally accessible for residents of Sector 12, 11, 13, 6, and adjoining Dwarka sub-city sectors.</p>
                </div>
                <div className="lp-contact-card">
                  <div className="lp-contact-card-icon"><span className="material-symbols-outlined" style={{ fontSize: 26 }}>location_on</span></div>
                  <div>
                    <h3 className="lp-headline-sm lp-on-surface" style={{ fontWeight: 700 }}>Clinic Address</h3>
                    <p className="lp-body-sm lp-secondary">Plot 14, Central Market, Sector 12, Dwarka, New Delhi 110078<br />
                      <span className="lp-primary" style={{ fontWeight: 500 }}>(Near Dwarka Sector 12 Metro Station - Blue Line)</span></p>
                    <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="lp-maps-link">
                      Get Google Maps Directions <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                    </a>
                  </div>
                </div>
                <div className="lp-contact-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <span className="material-symbols-outlined lp-primary" style={{ fontSize: 24 }}>calendar_clock</span>
                    <h3 className="lp-headline-sm lp-on-surface" style={{ fontWeight: 700 }}>Clinic Working Hours</h3>
                  </div>
                  <div className="lp-hours-row lp-hours-row--border"><span className="lp-on-surface" style={{ fontWeight: 500 }}>Monday – Saturday</span><span className="lp-primary" style={{ fontWeight: 600 }}>9:00 AM – 8:30 PM</span></div>
                  <div className="lp-hours-row"><span className="lp-on-surface" style={{ fontWeight: 500 }}>Sunday</span><span className="lp-primary" style={{ fontWeight: 600 }}>10:00 AM – 2:00 PM</span></div>
                </div>
                <div className="lp-contact-ctas">
                  <a href="https://wa.me/911128080000" target="_blank" rel="noreferrer" className="lp-whatsapp-btn">
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chat</span>
                    <span>Chat on WhatsApp</span>
                  </a>
                  <a href="tel:+911128080000" className="lp-btn-ghost">
                    <span className="material-symbols-outlined lp-primary" style={{ fontSize: 20 }}>call</span>
                    <span>Direct Call Desk</span>
                  </a>
                </div>
              </div>

              <div className="lp-map-card">
                <div className="lp-map-img-wrap">
                  <img
                    className="lp-map-img"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDpaQw0GiPO8oLJaSVSMTlBlPqmROudppgIgBeFbHK2r3oOhY4VMtjhBUnYC4RUuoA78uti9e20ta8oh_YpiKh20nLLdaSqMO0FVl2pTB7KN7F40pm3Knc6QXa5qS0aZzfziSfRzSlL6UqF0_qL56cY4sAb1jX3Cn7uq_DkacrIkUgHeUqC9SaMxA_dhQWgTLIEsydYyHS5MU7VAVEBWvQbMAiBHPs8rUh1nH_PytM"
                    alt="Dwarka Sector 12 map"
                  />
                  <div className="lp-map-overlay">
                    <div>
                      <p className="lp-label-md lp-on-surface" style={{ fontWeight: 700 }}>Dwarka Dental Clinic</p>
                      <p className="lp-label-sm lp-secondary">Plot 14, Sector 12 Central Market</p>
                    </div>
                    <a href="#book-form" className="lp-map-book-btn">Book Slot</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ FOOTER ══════════ */}
        <footer className="lp-footer">
          <div className="lp-container">
            <div className="lp-footer-grid">
              <div className="lp-footer-brand">
                <div className="lp-brand">
                  <div className="lp-brand-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8 2 4 5 4 9c0 2.5 1 4 2 5.5S8 17 8 22h8c0-5 2-4 4-7.5s2-3 2-5.5c0-4-4-7-8-7z" /></svg></div>
                  <div className="lp-brand-text"><span className="lp-brand-name">Dwarka Dental</span><span className="lp-brand-sub">Clinic · Sector 12</span></div>
                </div>
                <p className="lp-body-sm lp-on-surface-variant" style={{ maxWidth: 320, marginTop: 12 }}>Sector 12's modern dental practice dedicated to comfortable, ethical, and clinically verified family dentistry in New Delhi.</p>
                <p className="lp-body-sm lp-secondary" style={{ marginTop: 12 }}>Emergency Helpline:<br /><strong className="lp-primary">+91 11 2808 0000</strong></p>
              </div>
              <div>
                <p className="lp-footer-col-title">Specialties</p>
                <ul className="lp-footer-links">
                  {['Single-Sitting RCT', 'Laser Dental Implants', 'Invisible Aligners', 'Kids Dentistry', 'Zirconia Crowns'].map(s => (
                    <li key={s}><a href="#services">{s}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="lp-footer-col-title">Patient Care</p>
                <ul className="lp-footer-links">
                  <li><a href="tel:+911128080000">Dental Emergency Helpline</a></li>
                  <li><button className="lp-footer-link-btn" onClick={() => setStaffModalOpen(true)}>Staff Portal</button></li>
                  <li><a href="#book-form">Patient Portal</a></li>
                  <li><a href="#why-us">Sterilization Protocols</a></li>
                  <li><a href="#contact">Google Maps Directions</a></li>
                </ul>
              </div>
              <div>
                <p className="lp-footer-col-title">Visit Us</p>
                <p className="lp-body-sm lp-on-surface-variant">Sector 12 Central Market,<br />Dwarka, New Delhi 110078</p>
                <p className="lp-label-sm lp-secondary" style={{ marginTop: 8 }}>Mon–Sat: 9am – 8:30pm<br />Sun: 10am – 2:00pm</p>
                <div style={{ marginTop: 16 }}>
                  <Link to="/login" className="lp-staff-login-link">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock</span>
                    Staff / Doctor Login
                  </Link>
                </div>
              </div>
            </div>
            <div className="lp-footer-bottom">
              <p>© 2025 Dwarka Dental Clinic. Sector 12, Dwarka, New Delhi. All rights reserved.</p>
              <div className="lp-footer-bottom-links">
                <a href="#">Privacy Policy</a>
                <a href="#">Patient Charter</a>
                <button className="lp-footer-link-btn" onClick={() => setStaffModalOpen(true)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock</span> Staff Access
                </button>
              </div>
            </div>
          </div>
        </footer>

        {/* ══════════ STAFF MODAL ══════════ */}
        {staffModalOpen && (
          <div className="lp-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setStaffModalOpen(false)}>
            <div className="lp-modal">
              <button className="lp-modal-close" onClick={() => setStaffModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div className="lp-modal-icon"><span className="material-symbols-outlined">lock</span></div>
                <div>
                  <h3 className="lp-headline-sm lp-on-surface" style={{ fontWeight: 700 }}>Staff Portal Login</h3>
                  <p className="lp-label-sm lp-secondary">Dwarka Dental Internal EMR Access</p>
                </div>
              </div>
              <form className="lp-modal-form" onSubmit={(e) => { e.preventDefault(); setStaffModalOpen(false); }}>
                <div>
                  <label className="lp-form-label">Staff ID or Doctor Email</label>
                  <input className="lp-input" type="text" placeholder="dr.sharma@dwarkadental.in" required />
                </div>
                <div>
                  <label className="lp-form-label">Password</label>
                  <input className="lp-input" type="password" placeholder="••••••••" required />
                </div>
                <div className="lp-modal-remember">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <input type="checkbox" /> Remember station
                  </label>
                  <a href="#" className="lp-primary" style={{ fontSize: 13 }}>Forgot?</a>
                </div>
                <Link to="/login" className="lp-btn-primary lp-btn-submit" style={{ textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                  Go to Staff Login Portal
                </Link>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
