import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════════════
   Dwarka Dental Clinic — Landing Page
   Premium Professional Redesign with Glassmorphism & Animations
   ═══════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', service: '', date: '' });
  
  const navRef = useRef(null);

  // Scroll-triggered navigation style
  useEffect(() => {
    const handleScroll = () => {
      if (navRef.current) {
        if (window.scrollY > 50) {
          navRef.current.classList.add('lp-nav--scrolled');
        } else {
          navRef.current.classList.remove('lp-nav--scrolled');
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll-reveal IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lp-reveal--visible');
          }
        });
      },
      { threshold: 0.15 }
    );

    const revealElements = document.querySelectorAll('.lp-reveal');
    revealElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  function toggleFaq(idx) {
    setOpenFaq((prev) => (prev === idx ? null : idx));
  }

  function handleBooking(e) {
    e.preventDefault();
    const { name, phone, service, date } = form;
    if (!name || !phone || !service || !date) return;
    setBookingConfirmed(true);
    // Reset form
    setForm({ name: '', phone: '', service: '', date: '' });
  }

  const services = [
    {
      icon: 'stethoscope',
      badge: 'Preventive Care',
      title: 'Consultation & Checkup',
      desc: 'High-definition intraoral camera mapping, oral cancer screening, and personalized treatment planning.',
    },
    {
      icon: 'water_drop',
      badge: 'Hygiene',
      title: 'Ultrasonic Teeth Cleaning',
      desc: 'Painless plaque removal using EMS piezon ultrasonic scalers with airflow stain removal.',
    },
    {
      icon: 'healing',
      badge: 'Restorative',
      title: 'Tooth-Colored Fillings',
      desc: 'Biomimetic nanohybrid resin fillings matched to natural tooth enamel.',
    },
    {
      icon: 'medical_services',
      badge: 'Most Popular',
      title: 'Single-Sitting Root Canal',
      desc: 'Computerized rotary endodontics with electronic apex locators for 100% painless relief.',
      featured: true,
    },
    {
      icon: 'surgical',
      badge: 'Oral Surgery',
      title: 'Painless Tooth Extraction',
      desc: 'Minimally invasive extractions with rapid healing protocols.',
    },
    {
      icon: 'verified',
      badge: 'Prosthodontics',
      title: 'Zirconia Crowns & Bridges',
      desc: 'CAD/CAM milled metal-free zirconia crowns with lifetime warranty.',
    },
    {
      icon: 'precision_manufacturing',
      badge: 'Permanent Solution',
      title: 'Laser Dental Implants',
      desc: 'Computer-guided titanium implants with 99.2% success rate.',
      featured: true,
    },
    {
      icon: 'flare',
      badge: 'Cosmetic',
      title: 'Laser Teeth Whitening',
      desc: 'Up to 8 shades brighter in 45 minutes using cold light technology.',
    },
    {
      icon: 'auto_fix_high',
      badge: 'Orthodontics',
      title: 'Invisible Braces & Aligners',
      desc: 'Discreet removable clear aligners with 3D digital simulation.',
    },
  ];

  const whyCards = [
    {
      icon: 'medical_information',
      title: 'Experienced MDS Specialists',
      desc: 'Every complex procedure led by qualified Master of Dental Surgery doctors with 10+ years experience.',
    },
    {
      icon: 'sanitizer',
      title: 'Class-B 6-Step Autoclave',
      desc: 'European Class-B vacuum sterilization. Pouches opened in front of each patient.',
    },
    {
      icon: 'radiology',
      title: 'AI-Assisted Low Radiation X-Rays',
      desc: 'High-speed sensors emit 90% less radiation with instant chairside monitors.',
    },
    {
      icon: 'price_check',
      title: '100% Transparent Pricing',
      desc: 'No hidden surprises. Written treatment plan breakdown before any work begins.',
    },
    {
      icon: 'cloud_sync',
      title: 'Cloud Digital Records',
      desc: 'WhatsApp prescriptions, digital X-ray copies, treatment tracking on your phone.',
    },
    {
      icon: 'schedule',
      title: 'Morning & Evening Timings',
      desc: 'Open 6 days until 8:30 PM plus Sunday morning slots.',
    },
  ];

  const doctors = [
    {
      name: 'Dr. Rajesh Sharma',
      qual: 'MDS (Prosthodontics & Implantology)',
      exp: '16 Years | 4,200+ successful implants',
      badge: 'Lead Implantologist',
      image:
        'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&h=800&fit=crop',
    },
    {
      name: 'Dr. Neha Verma',
      qual: 'MDS (Orthodontics)',
      exp: '12 Years | Invisalign Certified',
      badge: 'Orthodontist',
      image:
        'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=600&h=800&fit=crop',
    },
    {
      name: 'Dr. Vikram Mehra',
      qual: 'MDS (Endodontics)',
      exp: '10 Years | Painless RCT Specialist',
      badge: 'Root Canal Expert',
      image:
        'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600&h=800&fit=crop',
    },
    {
      name: 'Dr. Ananya Kapoor',
      qual: 'MDS (Pediatric Dentistry)',
      exp: '8 Years | Child Psychology Trained',
      badge: 'Pediatric Specialist',
      image:
        'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&h=800&fit=crop',
    },
  ];

  const steps = [
    {
      num: '1',
      active: true,
      title: 'Instant Online Booking',
      desc: 'Choose your time slot online or via WhatsApp. Instant SMS confirmation with Google Maps pin.',
    },
    {
      num: '2',
      active: false,
      title: 'Digital Diagnostic Scan',
      desc: 'Zero waiting. Full 3D intraoral camera inspection and low-dose HD X-ray.',
    },
    {
      num: '3',
      active: false,
      title: 'Painless Treatment',
      desc: 'Gentle treatment with topical computerized numbing in a soothing operatory.',
    },
    {
      num: '4',
      active: false,
      title: 'Follow-Up & Care',
      desc: 'Digital post-op instructions sent to your phone with automated follow-up calls.',
    },
  ];

  const reviews = [
    {
      quote:
        'I had terrible dental anxiety. Dr. Vikram did my root canal completely painlessly in 40 minutes! Truly commendable work.',
      name: 'Sunita Chawla',
      location: 'Dwarka Sector 6',
      tag: 'Root Canal',
    },
    {
      quote:
        'Got dental implants for my mother. The digital 3D planning was explained transparently. She eats comfortably now!',
      name: 'Amit Bansal',
      location: 'Dwarka Sector 19',
      tag: 'Dental Implants',
    },
    {
      quote:
        'Took my 7-year-old son to Dr. Ananya. The pediatric area is cheerful. He was laughing instead of crying!',
      name: 'Pooja Nair',
      location: 'Dwarka Sector 22',
      tag: 'Pediatric',
    },
  ];

  const faqs = [
    {
      q: 'Is a root canal treatment painful?',
      a: 'Not at all. With modern computerized anaesthesia techniques, a root canal feels virtually like a regular filling. Most patients feel immediate relief during the first visit.',
    },
    {
      q: 'How much do dental implants cost?',
      a: 'Packages depend on the implant brand (Osstem, Straumann, Nobel) and zirconia crown type. During your 3D scan, we provide a transparent written estimate with zero hidden charges.',
    },
    {
      q: 'Do you accept dental insurance or TPA claims?',
      a: 'Yes, we provide itemized GST medical invoices, treatment records, and digital documentation required for corporate reimbursements and TPAs.',
    },
    {
      q: 'Are dental treatments safe for young children?',
      a: 'Yes, our pediatric wing is headed by Dr. Ananya Kapoor (MDS). We focus on behavioral guidance, zero-needle topical gels, and painless prevention.',
    },
    {
      q: 'What emergency services do you provide?',
      a: 'We handle same-day appointments for acute toothache, broken crowns, sports injuries, knocked-out teeth, and swellings. Call +91 11 2808 0000 for priority triage.',
    },
    {
      q: 'How do I reach the Sector 12 clinic?',
      a: 'Plot 14, Central Market, Sector 12, Dwarka. Just 450 meters from Dwarka Sector 12 Metro Station (Blue Line) with car parking in front.',
    },
  ];

  return (
    <div className="lp-root">
      {/* ══════════ NAVIGATION ══════════ */}
      <nav className="lp-nav" ref={navRef}>
        <div className="lp-nav-inner">
          {/* Logo */}
          <Link to="/" className="lp-brand" style={{ textDecoration: 'none' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'var(--lp-teal)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '700',
                fontSize: '20px',
                fontFamily: 'var(--lp-font-heading)',
              }}
            >
              D
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--lp-font-heading)',
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#0f172a',
                }}
              >
                Dwarka Dental
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--lp-teal)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Clinic · Sector 12
              </div>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="lp-nav-links">
            {['Services', 'Why Us', 'Doctors', 'Process', 'Reviews', 'FAQ'].map((label, i) => (
              <a
                key={label}
                href={`#${label.toLowerCase().replace(' ', '-')}`}
                className="lp-nav-link"
              >
                {label}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <a href="#book-form" className="lp-btn lp-btn-primary lp-btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                event
              </span>
              <span>Book Now</span>
            </a>

            {/* Mobile hamburger */}
            <button
              className="lp-icon-btn"
              style={{
                display: 'none',
                padding: '8px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#0f172a',
              }}
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                {mobileNavOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileNavOpen && (
          <div className="lp-mobile-nav-drawer">
            <div className="lp-mobile-nav-content">
              {['Services', 'Why Us', 'Doctors', 'Process', 'Reviews', 'FAQ'].map((label) => (
                <a
                  key={label}
                  href={`#${label.toLowerCase().replace(' ', '-')}`}
                  className="lp-mobile-nav-link"
                  onClick={() => setMobileNavOpen(false)}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ══════════ HERO ══════════ */}
      <section className="lp-hero" id="home">
        <div className="lp-hero-content">
          {/* Left Text */}
          <div className="lp-hero-text">
            <div className="lp-hero-badge lp-reveal">
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--lp-teal)',
                  animation: 'lp-pulse 2s infinite',
                }}
              />
              <span>Trusted by 8,000+ Patients in Dwarka</span>
            </div>
            <h1 className="lp-reveal lp-stagger-1">
              Your Smile Deserves
              <br />
              World-Class Care
            </h1>
            <p className="lp-hero-subtitle lp-reveal lp-stagger-2">
              Sector 12's trusted multi-specialty dental practice. Experience anxiety-free, digital-guided dentistry for your whole family.
            </p>
            <div className="lp-hero-ctas lp-reveal lp-stagger-3">
              <a href="#book-form" className="lp-btn lp-btn-primary lp-btn-lg">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  calendar_month
                </span>
                <span>Book Free Consultation</span>
              </a>
              <a href="#services" className="lp-btn lp-btn-ghost-white">
                <span>View All Services</span>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  arrow_forward
                </span>
              </a>
            </div>
            <div className="lp-trust-row lp-reveal lp-stagger-4">
              <div className="lp-trust-item">
                <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontSize: '20px' }}>
                  star
                </span>
                <span className="lp-trust-item-text">4.9/5 Rating</span>
              </div>
              <div className="lp-trust-item">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  emoji_events
                </span>
                <span className="lp-trust-item-text">15+ Years</span>
              </div>
              <div className="lp-trust-item">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  groups
                </span>
                <span className="lp-trust-item-text">8,000+ Patients</span>
              </div>
            </div>
          </div>

          {/* Right Visual */}
          <div className="lp-hero-visual lp-reveal lp-stagger-2">
            <div className="lp-hero-card">
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'var(--lp-gradient-cta)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'white' }}>
                  healing
                </span>
              </div>
              <h3
                style={{
                  fontFamily: 'var(--lp-font-heading)',
                  fontSize: '24px',
                  fontWeight: '700',
                  color: 'var(--lp-teal)',
                  marginBottom: '8px',
                }}
              >
                15,000+
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b' }}>Happy Smiles Transformed</p>
            </div>

            {/* Floating accent cards */}
            <div className="lp-hero-accent-card lp-hero-accent-card--1">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--lp-teal)', fontSize: '20px' }}>
                  verified
                </span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>100% Painless</span>
              </div>
            </div>

            <div className="lp-hero-accent-card lp-hero-accent-card--2">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontSize: '20px' }}>
                  star
                </span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>4.9 Rating</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ SERVICES ══════════ */}
      <section className="lp-section lp-services" id="services">
        <div className="lp-container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span className="lp-section-label lp-reveal">Our Treatments</span>
            <h2 className="lp-section-heading lp-reveal">Specialized Dental Treatments in Sector 12</h2>
            <p className="lp-section-desc lp-reveal">
              Equipped with advanced German dental tech, computerized anaesthesia, and biomimetic restorations.
            </p>
          </div>

          <div className="lp-services-grid">
            {services.map((service, i) => (
              <div
                key={i}
                className={`lp-service-card lp-reveal lp-stagger-${(i % 4) + 1} ${
                  service.featured ? 'lp-service-card--featured' : ''
                }`}
              >
                <div>
                  <div className="lp-service-icon-wrap">
                    <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>
                      {service.icon}
                    </span>
                  </div>
                  <span className="lp-service-badge">{service.badge}</span>
                  <h3 className="lp-service-title">{service.title}</h3>
                  <p className="lp-service-desc">{service.desc}</p>
                </div>
                <a href="#book-form" className="lp-service-link">
                  Explore Treatment
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    arrow_forward
                  </span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ WHY CHOOSE US ══════════ */}
      <section className="lp-section lp-why" id="why-us">
        <div className="lp-container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span className="lp-section-label lp-reveal">Uncompromising Quality</span>
            <h2 className="lp-section-heading lp-reveal">Why Dwarka Families Trust Our Clinic</h2>
            <p className="lp-section-desc lp-reveal">
              Medical excellence built into our daily sterilization, diagnosis, and patient care workflows.
            </p>
          </div>

          <div className="lp-why-grid">
            {whyCards.map((card, i) => (
              <div key={i} className={`lp-why-card lp-reveal lp-stagger-${(i % 3) + 1}`}>
                <div className="lp-why-icon-wrap">
                  <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                    {card.icon}
                  </span>
                </div>
                <h3 className="lp-why-title">{card.title}</h3>
                <p className="lp-why-desc">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ DOCTORS ══════════ */}
      <section className="lp-section lp-doctors" id="doctors">
        <div className="lp-container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span className="lp-section-label lp-reveal">Clinical Leadership</span>
            <h2 className="lp-section-heading lp-reveal">Meet Our Senior Dental Specialists</h2>
            <p className="lp-section-desc lp-reveal">
              Dedicated specialists committed to conservative tooth preservation and painless procedures.
            </p>
          </div>

          <div className="lp-doctors-grid">
            {doctors.map((doctor, i) => (
              <div key={i} className={`lp-doctor-card lp-reveal lp-stagger-${(i % 4) + 1}`}>
                <div className="lp-doctor-img-wrap">
                  <img src={doctor.image} alt={doctor.name} className="lp-doctor-img" />
                  <div className="lp-doctor-badge">{doctor.badge}</div>
                </div>
                <div className="lp-doctor-body">
                  <h3 className="lp-doctor-name">{doctor.name}</h3>
                  <div className="lp-doctor-qual">{doctor.qual}</div>
                  <p className="lp-doctor-exp">{doctor.exp}</p>
                  <a href="#book-form" className="lp-doctor-book">
                    Book with {doctor.name.split(' ')[1]}
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                      chevron_right
                    </span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ PROCESS ══════════ */}
      <section className="lp-section lp-process" id="process">
        <div className="lp-container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span className="lp-section-label lp-reveal">Stress-Free Patient Journey</span>
            <h2 className="lp-section-heading lp-reveal">How Your Visit Works</h2>
            <p className="lp-section-desc lp-reveal">
              From first tap to lasting oral health, we have eliminated long waiting times and clinical ambiguity.
            </p>
          </div>

          <div className="lp-steps-grid">
            {steps.map((step, i) => (
              <div key={i} className={`lp-step-card lp-reveal lp-stagger-${i + 1}`}>
                <div className={`lp-step-num ${step.active ? 'lp-step-num--active' : ''}`}>
                  {step.num}
                </div>
                <h3 className="lp-step-title">{step.title}</h3>
                <p className="lp-step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ REVIEWS ══════════ */}
      <section className="lp-section lp-reviews" id="reviews">
        <div className="lp-container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span className="lp-section-label lp-reveal">Real Patient Experiences</span>
            <h2 className="lp-section-heading lp-reveal">Trusted by 15,000+ Dwarka Residents</h2>
            <p className="lp-section-desc lp-reveal">
              Read authentic reviews from families who have experienced our care.
            </p>
          </div>

          <div className="lp-reviews-grid">
            {reviews.map((review, i) => (
              <div key={i} className={`lp-review-card lp-reveal lp-stagger-${i + 1}`}>
                <div className="lp-review-stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className="material-symbols-outlined"
                      style={{ color: '#f59e0b', fontSize: '18px' }}
                    >
                      star
                    </span>
                  ))}
                </div>
                <p className="lp-review-quote">"{review.quote}"</p>
                <div className="lp-review-footer">
                  <div>
                    <div className="lp-review-name">{review.name}</div>
                    <div className="lp-review-location">{review.location}</div>
                  </div>
                  <span className="lp-review-tag">{review.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section className="lp-section lp-faq" id="faq">
        <div className="lp-container lp-faq-container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span className="lp-section-label lp-reveal">Got Questions?</span>
            <h2 className="lp-section-heading lp-reveal">Frequently Asked Questions</h2>
            <p className="lp-section-desc lp-reveal">
              Find clear answers regarding treatments, costs, sterilization, and scheduling.
            </p>
          </div>

          <div className="lp-faq-list">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} className={`lp-faq-item lp-reveal lp-stagger-${(i % 4) + 1}`}>
                  <button className="lp-faq-btn" onClick={() => toggleFaq(i)} aria-expanded={isOpen}>
                    <span className="lp-faq-question">{faq.q}</span>
                    <span
                      className={`material-symbols-outlined lp-faq-icon ${
                        isOpen ? 'lp-faq-icon--open' : ''
                      }`}
                      style={{ fontSize: '24px' }}
                    >
                      expand_more
                    </span>
                  </button>
                  <div className={`lp-faq-answer-wrapper ${isOpen ? 'lp-faq-answer-wrapper--open' : ''}`}>
                    <div className="lp-faq-answer">{faq.a}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════ BOOKING ══════════ */}
      <section className="lp-section lp-book" id="book-form">
        <div className="lp-container">
          <div className="lp-book-content">
            {/* Left */}
            <div>
              <span className="lp-section-label lp-reveal">Book Your Visit</span>
              <h2 className="lp-section-heading lp-reveal">Schedule Your Priority Consultation</h2>
              <p className="lp-section-desc lp-reveal" style={{ margin: 0 }}>
                Front desk confirmation delivered via SMS & WhatsApp within 15 minutes. No pre-payment required.
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  marginTop: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
                className="lp-reveal lp-stagger-2"
              >
                {['✓ Zero waiting time', '✓ Digital 3D diagnostics', '✓ Transparent pricing', '✓ Same-day emergency slots'].map((item) => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Form */}
            <div className="lp-book-card lp-reveal lp-stagger-2">
              {!bookingConfirmed ? (
                <form className="lp-book-form" onSubmit={handleBooking}>
                  <div>
                    <label className="lp-form-label">Patient Name *</label>
                    <input
                      type="text"
                      className="lp-input"
                      placeholder="e.g. Ramesh Saxena"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="lp-form-label">Mobile Number *</label>
                    <input
                      type="tel"
                      className="lp-input"
                      placeholder="10-digit number"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      pattern="[0-9]{10}"
                      required
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="lp-form-label">Treatment Category *</label>
                    <select
                      className="lp-select"
                      value={form.service}
                      onChange={(e) => setForm({ ...form, service: e.target.value })}
                      required
                    >
                      <option value="">Select Service</option>
                      <option>Consultation & Checkup</option>
                      <option>Root Canal Treatment</option>
                      <option>Dental Implants</option>
                      <option>Teeth Whitening</option>
                      <option>Invisible Braces</option>
                      <option>Kids Dentistry</option>
                      <option>Emergency / Toothache</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="lp-form-label">Preferred Date *</label>
                    <input
                      type="date"
                      className="lp-input"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      required
                    />
                  </div>
                  <button type="submit" className="lp-submit-btn">
                    <span>Confirm Appointment Request</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                      arrow_forward
                    </span>
                  </button>
                </form>
              ) : (
                <div className="lp-confirm-card">
                  <div className="lp-confirm-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
                      check
                    </span>
                  </div>
                  <div>
                    <h3
                      style={{
                        fontFamily: 'var(--lp-font-heading)',
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#0f172a',
                        marginBottom: '8px',
                      }}
                    >
                      Appointment Request Received!
                    </h3>
                    <p className="lp-confirm-text">
                      Our Sector 12 front desk will call you within 15 minutes to confirm your exact timing. Check your SMS for confirmation.
                    </p>
                    <button
                      className="lp-btn lp-btn-outline"
                      style={{ marginTop: '16px', background: 'white' }}
                      onClick={() => setBookingConfirmed(false)}
                    >
                      Book Another Appointment
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            {/* Column 1 */}
            <div className="lp-footer-brand">
              <div className="lp-footer-logo">
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'var(--lp-teal)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: '700',
                    fontSize: '18px',
                  }}
                >
                  D
                </div>
                <span>Dwarka Dental</span>
              </div>
              <p className="lp-footer-desc">
                Sector 12's modern dental practice dedicated to comfortable, ethical, and clinically verified family dentistry in New Delhi.
              </p>
              <div className="lp-footer-social">
                <a href="#" className="lp-social-icon" aria-label="Facebook">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    facebook
                  </span>
                </a>
                <a href="#" className="lp-social-icon" aria-label="Instagram">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    photo_camera
                  </span>
                </a>
                <a href="#" className="lp-social-icon" aria-label="Google">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    search
                  </span>
                </a>
              </div>
            </div>

            {/* Column 2 */}
            <div>
              <h4 className="lp-footer-col-title">Services</h4>
              <ul className="lp-footer-links">
                {['Root Canal', 'Dental Implants', 'Invisible Braces', 'Teeth Whitening', 'Kids Dentistry'].map((item) => (
                  <li key={item}>
                    <a href="#services">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3 */}
            <div>
              <h4 className="lp-footer-col-title">Patient Care</h4>
              <ul className="lp-footer-links">
                {['Book Appointment', 'Emergency Helpline', 'Sterilization Protocols', 'FAQ', 'Reviews'].map((item) => (
                  <li key={item}>
                    <a href={item === 'Book Appointment' ? '#book-form' : item === 'FAQ' ? '#faq' : item === 'Reviews' ? '#reviews' : '#why-us'}>
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4 */}
            <div>
              <h4 className="lp-footer-col-title">Visit Us</h4>
              <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
                Sector 12 Central Market,
                <br />
                Dwarka, New Delhi 110078
              </p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
                Mon–Sat: 9am – 8:30pm
                <br />
                Sun: 10am – 2:00pm
              </p>
              <Link
                to="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  background: 'var(--lp-teal)',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '600',
                  textDecoration: 'none',
                  transition: 'background 0.2s ease',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  lock
                </span>
                <span>Staff Login</span>
              </Link>
            </div>
          </div>

          {/* Bottom */}
          <div className="lp-footer-bottom">
            <p>© 2025 Dwarka Dental Clinic. Sector 12, Dwarka, New Delhi. All rights reserved.</p>
            <div className="lp-footer-bottom-links">
              <a href="#">Privacy Policy</a>
              <a href="#">Patient Charter</a>
              <a href="#">Made with ❤️ for Dwarka</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
