import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════════
   DWARKA DENTAL CLINIC — PROFESSIONAL LANDING PAGE
   Complete redesign with glassmorphism, animations, premium UI
   ═══════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', treatment: '', date: '' });
  
  const navRef = useRef(null);

  // Scroll-triggered nav background
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

  // Scroll-triggered reveal animations
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

    const elements = document.querySelectorAll('.lp-reveal');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  function toggleFaq(idx) {
    setOpenFaq((prev) => (prev === idx ? null : idx));
  }

  function handleBooking(e) {
    e.preventDefault();
    const { name, phone, treatment, date } = form;
    if (!name || !phone || !treatment || !date) return;
    setBookingConfirmed(true);
    setForm({ name: '', phone: '', treatment: '', date: '' });
  }

  const services = [
    { icon: 'dentistry', badge: 'Preventive', title: 'Consultation & Comprehensive Checkup', desc: 'High-definition intraoral camera mapping, oral cancer screening, and customized treatment planning.' },
    { icon: 'water_drop', badge: 'Hygiene', title: 'Ultrasonic Teeth Cleaning & Polishing', desc: 'Painless plaque and tartar removal using EMS piezon ultrasonic scalers with airflow stain removal.' },
    { icon: 'shield_with_heart', badge: 'Restorative', title: 'Tooth-Colored Composite Fillings', desc: 'Biomimetic nanohybrid resin fillings matched precisely to natural tooth enamel tone and contour.' },
    { icon: 'medical_services', badge: 'Most Popular', title: 'Single-Sitting Root Canal (RCT)', desc: 'Computerized rotary endodontics with electronic apex locators for 100% painless single-visit relief.', featured: true },
    { icon: 'healing', badge: 'Oral Surgery', title: 'Painless Tooth & Wisdom Extraction', desc: 'Minimally invasive extractions and surgical wisdom tooth management with rapid healing protocols.' },
    { icon: 'verified', badge: 'Prosthodontics', title: 'Zirconia Dental Crowns & Bridges', desc: 'CAD/CAM milled metal-free zirconia crowns with lifetime warranty on material integrity and bite strength.' },
    { icon: 'precision_manufacturing', badge: 'Permanent', title: 'Laser Dental Implants', desc: 'Computer-guided titanium implants with immediate loading options and 99.2% lifetime success rate.', featured: true },
    { icon: 'flare', badge: 'Cosmetic', title: 'Laser Teeth Whitening', desc: 'Up to 8 shades brighter smile in 45 minutes using enamel-safe cold light laser technology.' },
    { icon: 'auto_fix_high', badge: 'Orthodontics', title: 'Invisible Braces & Clear Aligners', desc: 'Discreet, removable clear aligners designed with 3D digital simulation for teens and working adults.' },
  ];

  const whyCards = [
    { icon: 'medical_information', title: 'Experienced MDS Specialists', desc: 'Every complex procedure is strictly led by qualified Master of Dental Surgery (MDS) doctors with 10+ years of clinical tenure.' },
    { icon: 'sanitizer', title: 'Class-B 6-Step Autoclave', desc: 'European Class-B vacuum sterilization for all instruments. Pouches opened exclusively in front of the patient.' },
    { icon: 'radiogy', title: 'AI-Assisted Low Radiation X-Rays', desc: 'High-speed sensors emit 90% less radiation than standard traditional dental film with instant chairside monitors.' },
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
    },
    {
      src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC50yhE5dho8mF_g3icq3drKdS7NDuRr0awzE6emtvqmrwwVHl4Q7eTuvutRe4Skpbh_VLORn4gld_fVa9kNInOTf6z2JuAkcso-BFCnIG5h3CfnHXp1XhwY1izGE8cyHyS9RZeXdzWHcsNXJo27z3D9WQHysSNDqjq4ho8PoWkbInZqs68K_s2NbQYyYXkbJiuoznYOp_S8CvivQ6JT5460bouAWlh4TYxN0Se6_w',
      badge: 'Invisalign Certified',
      name: 'Dr. Neha Verma',
      qual: 'MDS (Orthodontics & Dentofacial)',
      exp: '12 Years Exp. • Specialist in clear aligners, self-ligating braces, and smile aesthetics.',
    },
    {
      src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB--4BJQbfJ0r5CbqqCxp23EvcMtGeQ-lkxNnVSDlOIHsrwnV0Zpvv816nutVw8wQ5d7BjkC3SnfvnxNRNmXNgVEfLAtJeiCjJ3C370Tyau1IB_woqo4rH53-IEjX-mXeHvgTlB1rYozH0r6p1TRCNQUiKIfUM3qE_G5otrLy3ifvDeA8rPmUMFXQKrlSKTB9AB2J4VwYMmbFhzZpbSVQKTso72mE7O3RRwXaxO96c',
      badge: 'Root Canal Specialist',
      name: 'Dr. Vikram Mehra',
      qual: 'BDS, MDS (Conservative & Endodontics)',
      exp: '10 Years Exp. • Specialist in painless rotary RCT and biomimetic tooth restoration.',
    },
    {
      src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuASs2pnuLx1NARKAmGCFsU8-HEVadZU9dxtwY_5pP2ODC9AzslDauq9bl78jfZzdpnw8YoyfXnCgPFOzXNxOUktqqLvqgDpacoEvFGGFYpgLnKjQuX4yg6XoFCz_SnLpvFvavl0HQzig2fXDPlznDvilJOt0FzEsfisOs_Pvgyd1wPvs0U6ra1XhwQbfTuWCUJlPy0Ljd9TNdojuGquwlVQJ1LPrvoZ17vAbOjrmwI',
      badge: 'Pediatric Specialist',
      name: 'Dr. Ananya Kapoor',
      qual: 'MDS (Pediatric Dentistry)',
      exp: '8 Years Exp. • Child psychology trained, ensuring zero-fear dental care for toddlers and kids.',
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
    { quote: 'Took my 7-year-old son to Dr. Ananya. The pediatric clinic area is cheerful and calm. He was laughing during the checkup instead of crying. Best clinic for families in West Delhi.', name: 'Pooja Nair', location: 'Dwarka Sector 22', tag: 'Pediatric' },
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
      {/* ══════════ NAV / HEADER ══════════ */}
      <nav ref={navRef} className="lp-nav">
        <div className="lp-nav-inner">
          <a href="#" className="lp-nav-logo">
            <span className="lp-nav-logo-icon">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>dentistry</span>
            </span>
            Dwarka Dental
          </a>

          <div className="lp-nav-links">
            <a href="#services" className="lp-nav-link">Services</a>
            <a href="#why-us" className="lp-nav-link">Why Us</a>
            <a href="#doctors" className="lp-nav-link">Doctors</a>
            <a href="#process" className="lp-nav-link">Process</a>
            <a href="#reviews" className="lp-nav-link">Reviews</a>
            <a href="#faq" className="lp-nav-link">FAQ</a>
          </div>

          <div className="lp-nav-actions">
            <a href="#book-form" className="lp-btn lp-btn-primary lp-btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>event</span>
              Book Now
            </a>
            <button
              className="lp-mobile-toggle"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              aria-label="Toggle menu"
              style={{ display: mobileNavOpen ? 'flex' : 'none' }}
            >
              <span className="material-symbols-outlined">{mobileNavOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className={`lp-mobile-nav-drawer ${mobileNavOpen ? 'lp-nav--mobile-open' : ''}`}>
            <div className="lp-mobile-nav-content">
              {['#services', '#why-us', '#doctors', '#process', '#reviews', '#faq'].map((href, i) => (
                <a key={href} href={href} className="lp-mobile-nav-link" onClick={() => setMobileNavOpen(false)}>
                  {['Services', 'Why Us', 'Doctors', 'Process', 'Reviews', 'FAQ'][i]}
                </a>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ══════════ HERO SECTION ══════════ */}
      <section className="lp-hero">
        <div className="lp-hero-content">
          <div className="lp-hero-text">
            <div className="lp-hero-badge">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
              Trusted by 8,000+ Patients in Dwarka
            </div>
            
            <h1>
              Your Smile Deserves<br />
              World-Class Care
            </h1>
            
            <p className="lp-hero-subtitle">
              Experience anxiety-free, digital-guided dentistry for your whole family at Sector 12's most trusted multi-specialty dental practice.
            </p>

            <div className="lp-hero-ctas">
              <a href="#book-form" className="lp-btn lp-btn-primary lp-btn-lg">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>calendar_month</span>
                Book Free Consultation
              </a>
              <a href="#services" className="lp-btn lp-btn-ghost-white">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>
                View All Services
              </a>
            </div>

            <div className="lp-trust-row">
              <div className="lp-trust-item">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#fbbf24' }}>star</span>
                <span className="lp-trust-item-text">⭐ 4.9/5 Rating</span>
              </div>
              <div className="lp-trust-item">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'rgba(255,255,255,0.8)' }}>military_tech</span>
                <span className="lp-trust-item-text">🏆 15+ Years</span>
              </div>
              <div className="lp-trust-item">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'rgba(255,255,255,0.8)' }}>groups</span>
                <span className="lp-trust-item-text">👥 8,000+ Patients</span>
              </div>
            </div>
          </div>

          <div className="lp-hero-visual">
            <div className="lp-hero-card">
              <div style={{ width: 80, height: 80, borderRadius: 20, background: 'linear-gradient(135deg, #00685b, #14b8a6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'white' }}>dentistry</span>
              </div>
              <div>
                <div style={{ fontSize: 42, fontWeight: 800, fontFamily: 'var(--lp-font-heading)', color: 'var(--lp-teal)' }}>15K+</div>
                <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Happy Smiles Transformed</div>
              </div>
              <div style={{ height: 1, background: 'rgba(0,104,91,0.15)', margin: '20px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-around', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--lp-teal)' }}>99%</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Success Rate</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--lp-teal)' }}>4.9</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Google Rating</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ SERVICES SECTION ══════════ */}
      <section id="services" className="lp-section" style={{ background: '#f8fffe' }}>
        <div className="lp-container">
          <div className="lp-section-header lp-reveal">
            <div className="lp-section-label">Our Treatments</div>
            <h2 className="lp-section-title">Specialized Dental Treatments in Sector 12</h2>
            <p className="lp-section-subtitle">Equipped with advanced German dental tech, computerized anaesthesia, and biomimetic dental restorations.</p>
          </div>

          <div className="lp-services-grid">
            {services.map((s, i) => (
              <div key={i} className={`lp-service-card lp-reveal lp-stagger-${(i % 3) + 1} ${s.featured ? 'lp-service-card--featured' : ''}`}>
                <div>
                  <div className="lp-service-icon-wrap">
                    <span className="material-symbols-outlined" style={{ fontSize: 26 }}>{s.icon}</span>
                  </div>
                  <div className="lp-service-badge">{s.badge}</div>
                  <h3 className="lp-service-title">{s.title}</h3>
                  <p className="lp-service-desc">{s.desc}</p>
                </div>
                <a href="#book-form" className="lp-service-link">
                  Explore Treatment <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ WHY CHOOSE US SECTION ══════════ */}
      <section id="why-us" className="lp-section lp-why" style={{ background: 'white' }}>
        <div className="lp-container">
          <div className="lp-section-header lp-reveal">
            <div className="lp-section-label">Uncompromising Quality</div>
            <h2 className="lp-section-title">Why Dwarka Families Trust Our Clinic</h2>
            <p className="lp-section-subtitle">Medical excellence is not just a promise; it is built into our daily sterilization, diagnosis, and patient care workflows.</p>
          </div>

          <div className="lp-why-grid">
            {whyCards.map((w, i) => (
              <div key={i} className="lp-why-card lp-reveal lp-stagger-1">
                <div className="lp-why-icon">
                  <span className="material-symbols-outlined" style={{ fontSize: 22 }}>{w.icon}</span>
                </div>
                <h3 className="lp-why-title">{w.title}</h3>
                <p className="lp-why-desc">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ DOCTORS SECTION ══════════ */}
      <section id="doctors" className="lp-section lp-doctors" style={{ background: 'linear-gradient(180deg, #f0fdfa 0%, #ffffff 100%)' }}>
        <div className="lp-container">
          <div className="lp-section-header lp-reveal">
            <div className="lp-section-label">Clinical Leadership</div>
            <h2 className="lp-section-title">Meet Our Senior Dental Specialists</h2>
            <p className="lp-section-subtitle">Consult with dedicated specialists committed to conservative tooth preservation and painless procedures.</p>
          </div>

          <div className="lp-doctors-grid">
            {doctors.map((d, i) => (
              <div key={i} className="lp-doctor-card lp-reveal lp-stagger-1">
                <div className="lp-doctor-img-wrap">
                  <img src={d.src} alt={d.name} className="lp-doctor-img" />
                  <div className="lp-doctor-badge">{d.badge}</div>
                </div>
                <div className="lp-doctor-body">
                  <div>
                    <h3 className="lp-doctor-name">{d.name}</h3>
                    <p className="lp-doctor-qual">{d.qual}</p>
                    <p className="lp-doctor-exp" style={{ marginTop: 8 }}>{d.exp}</p>
                  </div>
                  <a href="#book-form" className="lp-doctor-book">
                    <span>Book with {d.name.split(' ')[1]}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ PROCESS STEPS SECTION ══════════ */}
      <section id="process" className="lp-section lp-process">
        <div className="lp-container">
          <div className="lp-section-header lp-reveal">
            <div className="lp-section-label">Stress-Free Patient Journey</div>
            <h2 className="lp-section-title">How Your Visit Works</h2>
            <p className="lp-section-subtitle">From first tap to lasting oral health, we have eliminated long waiting times and clinical ambiguity.</p>
          </div>

          <div className="lp-steps-grid">
            {steps.map((s, i) => (
              <div key={i} className="lp-step-card lp-reveal lp-stagger-1">
                <div className={`lp-step-num ${s.active ? 'lp-step-num--active' : ''}`}>{s.num}</div>
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ REVIEWS SECTION ══════════ */}
      <section id="reviews" className="lp-section" style={{ background: 'white' }}>
        <div className="lp-container">
          <div className="lp-section-header lp-reveal">
            <div className="lp-section-label">Real Patient Experiences</div>
            <h2 className="lp-section-title">Trusted by 15,000+ Dwarka Residents</h2>
            <p className="lp-section-subtitle">Authentic feedback from families who chose us for their dental care journey.</p>
          </div>

          <div className="lp-reviews-grid">
            {reviews.map((r, i) => (
              <div key={i} className="lp-review-card lp-reveal lp-stagger-1">
                <div>
                  <div className="lp-review-stars">
                    {[...Array(5)].map((_, j) => (
                      <span key={j} className="material-symbols-outlined" style={{ fontSize: 18, color: '#f59e0b', fontVariationSettings: "'FILL' 1" }}>star</span>
                    ))}
                  </div>
                  <p className="lp-review-quote">"{r.quote}"</p>
                </div>
                <div className="lp-review-footer">
                  <div>
                    <p className="lp-review-name">{r.name}</p>
                    <p className="lp-review-location">{r.location}</p>
                  </div>
                  <span className="lp-review-tag">{r.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FAQ SECTION ══════════ */}
      <section id="faq" className="lp-section lp-faq">
        <div className="lp-container lp-faq-container">
          <div className="lp-section-header lp-reveal">
            <div className="lp-section-label">Got Questions?</div>
            <h2 className="lp-section-title">Frequently Asked Questions</h2>
            <p className="lp-section-subtitle">Find clear answers regarding treatments, costs, sterilization, and scheduling.</p>
          </div>

          <div className="lp-faq-list">
            {faqs.map((f, i) => (
              <div key={i} className="lp-faq-item lp-reveal">
                <button className="lp-faq-btn" onClick={() => toggleFaq(i)} aria-expanded={openFaq === i}>
                  <span className="lp-faq-question">{f.q}</span>
                  <span className={`material-symbols-outlined lp-faq-icon ${openFaq === i ? 'lp-faq-icon--open' : ''}`}>expand_more</span>
                </button>
                <div className={`lp-faq-answer ${openFaq === i ? 'lp-faq-answer--open' : ''}`}>
                  {openFaq === i && <p className="lp-faq-answer-text">{f.a}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ BOOKING SECTION ══════════ */}
      <section id="book-form" className="lp-section lp-book">
        <div className="lp-container">
          <div className="lp-book-grid">
            <div className="lp-reveal">
              <div className="lp-section-label">Quick Consultation Booking</div>
              <h2 className="lp-section-title">Schedule Your Priority Visit</h2>
              <p className="lp-section-subtitle">Front desk confirmation delivered via SMS & WhatsApp within 15 minutes.</p>
              
              <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'white' }}>verified</span>
                  <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15 }}>No pre-payment required</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'white' }}>schedule</span>
                  <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15 }}>Flexible timing options</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'white' }}>price_check</span>
                  <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15 }}>100% transparent pricing</span>
                </div>
              </div>
            </div>

            {!bookingConfirmed ? (
              <div className="lp-book-card lp-reveal">
                <form className="lp-book-form" onSubmit={handleBooking}>
                  <div className="lp-book-input-group">
                    <label className="lp-book-label">Full Name *</label>
                    <input
                      type="text"
                      className="lp-book-input"
                      placeholder="e.g. Ramesh Saxena"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="lp-book-input-group">
                    <label className="lp-book-label">Mobile Phone *</label>
                    <input
                      type="tel"
                      className="lp-book-input"
                      placeholder="10-digit mobile"
                      pattern="[0-9]{10}"
                      required
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>

                  <div className="lp-book-input-group">
                    <label className="lp-book-label">Treatment Category *</label>
                    <select
                      className="lp-book-select"
                      required
                      value={form.treatment}
                      onChange={(e) => setForm({ ...form, treatment: e.target.value })}
                    >
                      <option value="">Select Treatment</option>
                      <option>Consultation & Checkup</option>
                      <option>Laser Teeth Whitening</option>
                      <option>Single-Sitting Root Canal</option>
                      <option>Laser Dental Implants</option>
                      <option>Invisible Braces & Aligners</option>
                      <option>Kids & Pediatric Dentistry</option>
                      <option>Severe Toothache (Urgent)</option>
                    </select>
                  </div>

                  <div className="lp-book-input-group">
                    <label className="lp-book-label">Preferred Date *</label>
                    <input
                      type="date"
                      className="lp-book-input"
                      required
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>

                  <button type="submit" className="lp-book-submit">
                    <span>Confirm Appointment Request</span>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="lp-book-confirmation lp-reveal">
                <div className="lp-book-confirmation-icon">
                  <span className="material-symbols-outlined">check</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 24, fontWeight: 700, color: 'white', margin: '0 0 8px' }}>Appointment Request Received!</h3>
                  <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.9)', margin: 0 }}>
                    Thank you! Our Sector 12 front desk will call you within 15 minutes to confirm your exact timing.
                  </p>
                </div>
                <button
                  onClick={() => setBookingConfirmed(false)}
                  style={{ padding: '10px 24px', borderRadius: 12, background: 'white', color: 'var(--lp-teal)', border: 'none', fontWeight: 600, cursor: 'pointer', marginTop: 16 }}
                >
                  Book Another
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            <div>
              <div className="lp-footer-logo">
                <span className="lp-footer-logo-icon">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>dentistry</span>
                </span>
                Dwarka Dental
              </div>
              <p className="lp-footer-desc">
                Sector 12's modern dental practice dedicated to comfortable, ethical, and clinically verified family dentistry in New Delhi.
              </p>
              <p style={{ fontSize: 14, marginTop: 16 }}>
                Emergency Helpline:<br />
                <strong style={{ color: 'var(--lp-teal)' }}>+91 11 2808 0000</strong>
              </p>
            </div>

            <div>
              <h4 className="lp-footer-col-title">Specialties</h4>
              <ul className="lp-footer-links">
                <li><a href="#services" className="lp-footer-link">Single-Sitting RCT</a></li>
                <li><a href="#services" className="lp-footer-link">Laser Dental Implants</a></li>
                <li><a href="#services" className="lp-footer-link">Invisible Aligners</a></li>
                <li><a href="#services" className="lp-footer-link">Kids Dentistry</a></li>
                <li><a href="#services" className="lp-footer-link">Zirconia Crowns</a></li>
              </ul>
            </div>

            <div>
              <h4 className="lp-footer-col-title">Patient Care</h4>
              <ul className="lp-footer-links">
                <li><a href="tel:+911128080000" className="lp-footer-link">Emergency Helpline</a></li>
                <li><Link to="/login" className="lp-footer-link">Staff Portal</Link></li>
                <li><a href="#book-form" className="lp-footer-link">Patient Portal</a></li>
                <li><a href="#why-us" className="lp-footer-link">Sterilization Protocols</a></li>
                <li><a href="#" className="lp-footer-link">Google Maps Directions</a></li>
              </ul>
            </div>

            <div>
              <h4 className="lp-footer-col-title">Visit Us</h4>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                Sector 12 Central Market,<br />
                Dwarka, New Delhi 110078
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 12 }}>
                Mon–Sat: 9am – 8:30pm<br />
                Sun: 10am – 2:00pm
              </p>
              <Link
                to="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 16,
                  padding: '8px 16px',
                  borderRadius: 9999,
                  background: 'var(--lp-teal)',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock</span>
                Staff Login
              </Link>
            </div>
          </div>

          <div className="lp-footer-bottom">
            <p>© 2025 Dwarka Dental Clinic. Sector 12, Dwarka, New Delhi. All rights reserved.</p>
            <div className="lp-footer-bottom-links">
              <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 14 }}>Privacy Policy</a>
              <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 14 }}>Patient Charter</a>
              <Link to="/login" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
                Staff Access
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
