/**
 * Database Seeder
 * Seeds clinic, staff users, treatment categories, patients, and appointments into Supabase.
 * Ensures appointments for TODAY, UPCOMING, MISSED, and ALL tabs exist dynamically.
 */
const bcrypt = require('bcryptjs')
const { clinicDb, userDb, treatmentCategoryDb, patientDb, appointmentDb } = require('../db')

const DEFAULT_TREATMENT_CATEGORIES = [
  { name: 'General Consultation', code: 'CONSULT', default_duration_minutes: 30, default_follow_up_days: 30 },
  { name: 'Orthodontics', code: 'ORTHO', default_duration_minutes: 45, default_follow_up_days: 28 },
  { name: 'Root Canal Treatment', code: 'RCT', default_duration_minutes: 60, default_follow_up_days: 10 },
  { name: 'Tooth Extraction', code: 'EXTRACT', default_duration_minutes: 30, default_follow_up_days: 5 },
  { name: 'Cavity Filling', code: 'FILL', default_duration_minutes: 45, default_follow_up_days: 30 },
  { name: 'Cleaning & Scaling', code: 'SCALE', default_duration_minutes: 45, default_follow_up_days: 180 },
  { name: 'Dental Implant', code: 'IMPLANT', default_duration_minutes: 90, default_follow_up_days: 14 },
  { name: 'Prosthodontics & Crown', code: 'CROWN', default_duration_minutes: 60, default_follow_up_days: 7 },
  { name: 'Emergency Dental', code: 'EMERG', default_duration_minutes: 30, default_follow_up_days: 3 },
  { name: 'X-Ray & Diagnosis', code: 'XRAY', default_duration_minutes: 20, default_follow_up_days: 7 },
]

const DEFAULT_STAFF = [
  {
    name: 'Dr. Admin',
    email: 'admin@dwarkadental.com',
    password: 'admin123',
    role: 'admin',
    phone: '+91 98765 00001',
  },
  {
    name: 'Dr. Neha Sharma',
    email: 'doctor@dwarkadental.com',
    password: 'doctor123',
    role: 'doctor',
    phone: '+91 98765 00002',
    specialization: 'General Dentistry',
  },
  {
    name: 'Dr. Rohan Mehta',
    email: 'rohan@dwarkadental.com',
    password: 'doctor123',
    role: 'doctor',
    phone: '+91 98765 00004',
    specialization: 'Endodontics & RCT',
  },
  {
    name: 'Dr. Kavita Iyer',
    email: 'kavita@dwarkadental.com',
    password: 'doctor123',
    role: 'doctor',
    phone: '+91 98765 00005',
    specialization: 'Periodontics',
  },
  {
    name: 'Dr. Arjun Kapoor',
    email: 'arjun@dwarkadental.com',
    password: 'doctor123',
    role: 'doctor',
    phone: '+91 98765 00006',
    specialization: 'Implantology & Prosthodontics',
  },
  {
    name: 'Priya Patel',
    email: 'receptionist@dwarkadental.com',
    password: 'receptionist123',
    role: 'receptionist',
    phone: '+91 98765 00003',
  },
]

const PATIENT_SEED_DATA = [
  {
    patient_number: 'DWK-2026-0001',
    name: 'Aarav Patil',
    date_of_birth: new Date('1996-04-12').toISOString(),
    gender: 'male',
    phone: '+91 98001 11001',
    email: 'aarav.patil@email.com',
    address: 'Flat 4B, Sunrise Apartments, Dwarka Sector 7, New Delhi 110075',
    emergency_contact: { name: 'Ramesh Patil', relation: 'Father', phone: '+91 98001 11002' },
    blood_group: 'B+',
    chief_complaint: 'Orthodontic consultation — misaligned teeth',
    allergies: [],
    medical_history: 'No significant medical history',
    status: 'follow_up',
    total_visits: 4,
  },
  {
    patient_number: 'DWK-2026-0002',
    name: 'Sneha Kulkarni',
    date_of_birth: new Date('1989-09-22').toISOString(),
    gender: 'female',
    phone: '+91 98001 11003',
    email: 'sneha.kulkarni@email.com',
    address: 'H-12, Model Town, Dwarka Sector 12, New Delhi 110078',
    emergency_contact: { name: 'Vijay Kulkarni', relation: 'Husband', phone: '+91 98001 11004' },
    blood_group: 'O+',
    chief_complaint: 'Severe toothache — lower right molar',
    allergies: ['Penicillin'],
    medical_history: 'Hypertension (controlled)',
    status: 'follow_up',
    total_visits: 6,
  },
  {
    patient_number: 'DWK-2026-0003',
    name: 'Rohit Sharma',
    date_of_birth: new Date('1982-11-08').toISOString(),
    gender: 'male',
    phone: '+91 98001 11005',
    email: 'rohit.sharma@email.com',
    address: '23, Patel Nagar, Dwarka Sector 3, New Delhi 110059',
    emergency_contact: { name: 'Anita Sharma', relation: 'Wife', phone: '+91 98001 11006' },
    blood_group: 'A+',
    chief_complaint: 'Gum bleeding and sensitivity',
    allergies: [],
    medical_history: 'Diabetes Type 2',
    status: 'completed',
    total_visits: 3,
  },
  {
    patient_number: 'DWK-2026-0004',
    name: 'Lakshmi Nair',
    date_of_birth: new Date('1969-06-30').toISOString(),
    gender: 'female',
    phone: '+91 98001 11007',
    email: 'lakshmi.nair@email.com',
    address: 'Block C, Vasant Kunj, New Delhi 110070',
    emergency_contact: { name: 'Suresh Nair', relation: 'Son', phone: '+91 98001 11008' },
    blood_group: 'AB+',
    chief_complaint: 'Missing tooth — requires implant',
    allergies: ['Latex'],
    medical_history: 'Osteoporosis, Thyroid',
    status: 'follow_up',
    total_visits: 8,
  },
  {
    patient_number: 'DWK-2026-0005',
    name: 'Karan Mehta',
    date_of_birth: new Date('2005-02-14').toISOString(),
    gender: 'male',
    phone: '+91 98001 11009',
    email: 'karan.mehta@email.com',
    address: 'Sector 22, Dwarka, New Delhi 110077',
    emergency_contact: { name: 'Sunil Mehta', relation: 'Father', phone: '+91 98001 11010' },
    blood_group: 'O-',
    chief_complaint: 'Wisdom tooth pain',
    allergies: [],
    medical_history: 'No significant history',
    status: 'new',
    total_visits: 1,
  },
  {
    patient_number: 'DWK-2026-0006',
    name: 'Divya Nanda',
    date_of_birth: new Date('1993-07-19').toISOString(),
    gender: 'female',
    phone: '+91 98001 11011',
    email: 'divya.nanda@email.com',
    address: '5A, Rohini Sector 11, New Delhi 110085',
    emergency_contact: { name: 'Raj Nanda', relation: 'Brother', phone: '+91 98001 11012' },
    blood_group: 'B-',
    chief_complaint: 'Cavity filling — two teeth',
    allergies: ['Sulfa drugs'],
    medical_history: 'No significant history',
    status: 'follow_up',
    total_visits: 2,
  },
  {
    patient_number: 'DWK-2026-0007',
    name: 'Ajay Bose',
    date_of_birth: new Date('1976-12-03').toISOString(),
    gender: 'male',
    phone: '+91 98001 11013',
    email: 'ajay.bose@email.com',
    address: '77, Pitampura, New Delhi 110034',
    emergency_contact: { name: 'Ritu Bose', relation: 'Wife', phone: '+91 98001 11014' },
    blood_group: 'A-',
    chief_complaint: 'Gum disease treatment',
    allergies: [],
    medical_history: 'Hypertension',
    status: 'inactive',
    total_visits: 5,
  },
  {
    patient_number: 'DWK-2026-0008',
    name: 'Preethi Rajan',
    date_of_birth: new Date('1998-03-25').toISOString(),
    gender: 'female',
    phone: '+91 98001 11015',
    email: 'preethi.rajan@email.com',
    address: 'Flat 201, Lajpat Nagar III, New Delhi 110024',
    emergency_contact: { name: 'Rajan Pillai', relation: 'Father', phone: '+91 98001 11016' },
    blood_group: 'O+',
    chief_complaint: 'Teeth whitening and cleaning',
    allergies: [],
    medical_history: 'No significant history',
    status: 'follow_up',
    total_visits: 2,
  },
  {
    patient_number: 'DWK-2026-0009',
    name: 'Manish Tiwari',
    date_of_birth: new Date('1986-08-17').toISOString(),
    gender: 'male',
    phone: '+91 98001 11017',
    email: 'manish.tiwari@email.com',
    address: 'H-Block, Sector 63, Noida 201301',
    emergency_contact: { name: 'Sunita Tiwari', relation: 'Wife', phone: '+91 98001 11018' },
    blood_group: 'B+',
    chief_complaint: 'Dental implant — upper jaw',
    allergies: ['NSAIDs'],
    medical_history: 'No significant history',
    status: 'follow_up',
    total_visits: 7,
  },
  {
    patient_number: 'DWK-2026-0010',
    name: 'Sunita Agarwal',
    date_of_birth: new Date('1962-05-10').toISOString(),
    gender: 'female',
    phone: '+91 98001 11019',
    email: 'sunita.agarwal@email.com',
    address: 'B-221, Defence Colony, New Delhi 110024',
    emergency_contact: { name: 'Rakesh Agarwal', relation: 'Son', phone: '+91 98001 11020' },
    blood_group: 'AB-',
    chief_complaint: 'Denture repair and root canal',
    allergies: ['Penicillin', 'Codeine'],
    medical_history: 'Diabetes, Heart disease',
    status: 'follow_up',
    total_visits: 12,
  },
  {
    patient_number: 'DWK-2026-0011',
    name: 'Vijay Desai',
    date_of_birth: new Date('1980-01-28').toISOString(),
    gender: 'male',
    phone: '+91 98001 11021',
    email: 'vijay.desai@email.com',
    address: 'Flat 3C, Saket, New Delhi 110017',
    emergency_contact: { name: 'Pooja Desai', relation: 'Wife', phone: '+91 98001 11022' },
    blood_group: 'A+',
    chief_complaint: 'Scaling and polishing',
    allergies: [],
    medical_history: 'No significant history',
    status: 'new',
    total_visits: 1,
  },
  {
    patient_number: 'DWK-2026-0012',
    name: 'Anita Joshi',
    date_of_birth: new Date('1995-11-04').toISOString(),
    gender: 'female',
    phone: '+91 98001 11023',
    email: 'anita.joshi@email.com',
    address: 'Kalkaji Extension, New Delhi 110019',
    emergency_contact: { name: 'Pradeep Joshi', relation: 'Father', phone: '+91 98001 11024' },
    blood_group: 'O+',
    chief_complaint: 'Braces — orthodontic treatment',
    allergies: [],
    medical_history: 'No significant history',
    status: 'completed',
    total_visits: 9,
  },
  {
    patient_number: 'DWK-2026-0013',
    name: 'Ramesh Chandra',
    date_of_birth: new Date('1966-03-18').toISOString(),
    gender: 'male',
    phone: '+91 98001 11025',
    email: 'ramesh.chandra@email.com',
    address: 'Mayur Vihar Phase 1, New Delhi 110091',
    emergency_contact: { name: 'Geeta Chandra', relation: 'Wife', phone: '+91 98001 11026' },
    blood_group: 'B+',
    chief_complaint: 'Multiple extractions and full denture',
    allergies: [],
    medical_history: 'Hypertension, COPD',
    status: 'follow_up',
    total_visits: 6,
  },
  {
    patient_number: 'DWK-2026-0014',
    name: 'Pooja Reddy',
    date_of_birth: new Date('2001-09-09').toISOString(),
    gender: 'female',
    phone: '+91 98001 11027',
    email: 'pooja.reddy@email.com',
    address: 'Hauz Khas Village, New Delhi 110016',
    emergency_contact: { name: 'Suresh Reddy', relation: 'Father', phone: '+91 98001 11028' },
    blood_group: 'A+',
    chief_complaint: 'Sensitivity in front teeth',
    allergies: [],
    medical_history: 'No significant history',
    status: 'new',
    total_visits: 1,
  },
  {
    patient_number: 'DWK-2026-0015',
    name: 'Gaurav Singh',
    date_of_birth: new Date('1988-06-22').toISOString(),
    gender: 'male',
    phone: '+91 98001 11029',
    email: 'gaurav.singh@email.com',
    address: 'Janakpuri, New Delhi 110058',
    emergency_contact: { name: 'Kavita Singh', relation: 'Wife', phone: '+91 98001 11030' },
    blood_group: 'O-',
    chief_complaint: 'Follow-up for root canal treatment',
    allergies: [],
    medical_history: 'No significant history',
    status: 'follow_up',
    total_visits: 3,
  },
]

/**
 * Creates date objects relative to today's date (00:00:00) with specified day offset and hour/minute time.
 */
function makeDateTime(dayOffset, hour, minute) {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d
}

async function seedDatabase() {
  try {
    // ── 1. Seed Clinic ──────────────────────────────────────────────────────
    const clinic = await clinicDb.getDefaultClinic()
    console.log('[Seed] Clinic ready:', clinic.name)

    // ── 2. Seed Staff Users with bcrypt hashed passwords ───────────────────
    const staffMap = {}
    for (const staff of DEFAULT_STAFF) {
      let existing = await userDb.findByEmail(staff.email)
      if (!existing) {
        const password_hash = await bcrypt.hash(staff.password, 12)
        existing = await userDb.createUser({
          clinic_id: clinic.id,
          name: staff.name,
          email: staff.email,
          password_hash,
          role: staff.role,
          phone: staff.phone,
          specialization: staff.specialization || null,
          status: 'active',
        })
        console.log(`[Seed] User created: ${staff.email} (${staff.role})`)
      } else {
        const isValid = await bcrypt.compare(staff.password, existing.password_hash).catch(() => false)
        if (!isValid) {
          const password_hash = await bcrypt.hash(staff.password, 12)
          await userDb.updateUser(existing.id, { password_hash })
          existing = { ...existing, password_hash }
          console.log(`[Seed] Password hash refreshed for: ${staff.email}`)
        }
      }
      staffMap[staff.email] = existing
    }

    // ── 3. Seed Treatment Categories ────────────────────────────────────────
    const catMap = {}
    for (const cat of DEFAULT_TREATMENT_CATEGORIES) {
      const doc = await treatmentCategoryDb.upsertByCode(cat.code, clinic.id, {
        ...cat,
        clinic_id: clinic.id,
        is_active: true,
      })
      catMap[cat.code] = doc
    }
    console.log(`[Seed] ${DEFAULT_TREATMENT_CATEGORIES.length} treatment categories updated/seeded`)

    // ── 4. Seed Patients ────────────────────────────────────────────────────
    const doctorList = [
      staffMap['doctor@dwarkadental.com'],
      staffMap['rohan@dwarkadental.com'],
      staffMap['kavita@dwarkadental.com'],
      staffMap['arjun@dwarkadental.com'],
    ].filter(Boolean)

    const patientMap = {}
    for (let i = 0; i < PATIENT_SEED_DATA.length; i++) {
      const pData = PATIENT_SEED_DATA[i]
      const assignedDoctor = doctorList[i % doctorList.length]

      let patient = await patientDb.findByPatientNumber(pData.patient_number)
      if (!patient) {
        // Remove patient_number from create payload — let the sequence generate it
        const { patient_number, ...patientInsertData } = pData
        patient = await patientDb.create({
          ...patientInsertData,
          clinic_id: clinic.id,
          assigned_doctor_id: assignedDoctor ? assignedDoctor.id : null,
          registered_at: new Date(Date.now() - (30 - i) * 86400000).toISOString(),
          is_deleted: false,
        })
        console.log(`[Seed] Patient created: ${patient.name} (${patient.patient_number})`)
      }
      patientMap[pData.patient_number] = patient
    }

    // ── 5. Seed Appointments ─────────────────────────────────────────────────
    // Count non-deleted appointments via the db layer
    const { total: aptCount } = await appointmentDb.findAll({ clinic_id: clinic.id, limit: 1 })

    if (aptCount === 0) {
      console.log('[Seed] Seeding appointment records for TODAY, UPCOMING, and MISSED...')

      const defaultDoctor = staffMap['doctor@dwarkadental.com'] || doctorList[0]
      const rohanDoctor = staffMap['rohan@dwarkadental.com'] || defaultDoctor
      const kavitaDoctor = staffMap['kavita@dwarkadental.com'] || defaultDoctor
      const arjunDoctor = staffMap['arjun@dwarkadental.com'] || defaultDoctor
      const receptionist = staffMap['receptionist@dwarkadental.com']

      const p1 = patientMap['DWK-2026-0001']
      const p2 = patientMap['DWK-2026-0002']
      const p3 = patientMap['DWK-2026-0003']
      const p4 = patientMap['DWK-2026-0004']
      const p5 = patientMap['DWK-2026-0005']
      const p6 = patientMap['DWK-2026-0006']
      const p7 = patientMap['DWK-2026-0007']
      const p8 = patientMap['DWK-2026-0008']
      const p9 = patientMap['DWK-2026-0009']
      const p10 = patientMap['DWK-2026-0010']
      const p11 = patientMap['DWK-2026-0011']
      const p12 = patientMap['DWK-2026-0012']
      const p13 = patientMap['DWK-2026-0013']
      const p14 = patientMap['DWK-2026-0014']
      const p15 = patientMap['DWK-2026-0015']

      const APPOINTMENTS_SEED = [
        // ── TODAY'S APPOINTMENTS (dayOffset: 0) ─────────────────────────────
        { patient: p1, doctor: defaultDoctor, cat: catMap['ORTHO'], day: 0, hour: 9, min: 0, duration: 45, status: 'confirmed', priority: 'normal', notes: 'Review braces progress — month 3' },
        { patient: p8, doctor: defaultDoctor, cat: catMap['SCALE'], day: 0, hour: 10, min: 0, duration: 30, status: 'arrived', priority: 'normal', notes: 'Post-whitening sensitivity check' },
        { patient: p15, doctor: defaultDoctor, cat: catMap['RCT'], day: 0, hour: 11, min: 0, duration: 60, status: 'in_progress', priority: 'high', notes: 'Post root canal review & dressing' },
        { patient: p12, doctor: defaultDoctor, cat: catMap['ORTHO'], day: 0, hour: 14, min: 0, duration: 30, status: 'scheduled', priority: 'normal', notes: 'Monthly brace tightening' },
        { patient: p2, doctor: rohanDoctor, cat: catMap['RCT'], day: 0, hour: 9, min: 30, duration: 60, status: 'completed', priority: 'high', notes: 'Second session of root canal — lower right molar' },
        { patient: p6, doctor: rohanDoctor, cat: catMap['FILL'], day: 0, hour: 11, min: 0, duration: 45, status: 'scheduled', priority: 'normal', notes: 'Composite filling — upper left premolar' },
        { patient: p10, doctor: rohanDoctor, cat: catMap['CROWN'], day: 0, hour: 15, min: 0, duration: 60, status: 'scheduled', priority: 'normal', notes: 'Crown measurement & fitting trial' },
        { patient: p4, doctor: arjunDoctor, cat: catMap['IMPLANT'], day: 0, hour: 10, min: 30, duration: 60, status: 'confirmed', priority: 'normal', notes: 'Post-surgical implant review' },
        { patient: p9, doctor: arjunDoctor, cat: catMap['IMPLANT'], day: 0, hour: 16, min: 0, duration: 60, status: 'scheduled', priority: 'normal', notes: 'Final implant placement consultation' },

        // ── UPCOMING APPOINTMENTS (dayOffset: 1, 2, 3, 5) ────────────────────
        { patient: p5, doctor: arjunDoctor, cat: catMap['EXTRACT'], day: 1, hour: 10, min: 0, duration: 30, status: 'scheduled', priority: 'emergency', notes: 'Wisdom tooth extraction procedure' },
        { patient: p11, doctor: kavitaDoctor, cat: catMap['SCALE'], day: 1, hour: 11, min: 30, duration: 45, status: 'scheduled', priority: 'normal', notes: 'Full mouth cleaning and scaling' },
        { patient: p14, doctor: rohanDoctor, cat: catMap['CONSULT'], day: 2, hour: 10, min: 30, duration: 30, status: 'scheduled', priority: 'normal', notes: 'Sensitivity assessment in front teeth' },
        { patient: p2, doctor: rohanDoctor, cat: catMap['CROWN'], day: 2, hour: 14, min: 0, duration: 45, status: 'scheduled', priority: 'normal', notes: 'Post root canal crown fitting review' },
        { patient: p4, doctor: arjunDoctor, cat: catMap['IMPLANT'], day: 3, hour: 11, min: 0, duration: 45, status: 'scheduled', priority: 'normal', notes: 'Final osseointegration check' },
        { patient: p13, doctor: arjunDoctor, cat: catMap['CROWN'], day: 5, hour: 15, min: 0, duration: 60, status: 'scheduled', priority: 'normal', notes: 'Full denture trial fitting' },

        // ── MISSED APPOINTMENTS (dayOffset: -1, -2) ──────────────────────────
        { patient: p3, doctor: kavitaDoctor, cat: catMap['CONSULT'], day: -1, hour: 11, min: 0, duration: 30, status: 'missed', priority: 'normal', notes: 'Patient missed follow-up consultation' },
        { patient: p7, doctor: kavitaDoctor, cat: catMap['SCALE'], day: -2, hour: 15, min: 30, duration: 45, status: 'missed', priority: 'normal', notes: 'Patient missed gum treatment session' },

        // ── PAST COMPLETED APPOINTMENTS (dayOffset: -5, -10) ─────────────────
        { patient: p1, doctor: defaultDoctor, cat: catMap['ORTHO'], day: -10, hour: 10, min: 30, duration: 45, status: 'completed', priority: 'normal', notes: 'Braces monthly adjustment complete' },
        { patient: p2, doctor: rohanDoctor, cat: catMap['RCT'], day: -5, hour: 9, min: 30, duration: 60, status: 'completed', priority: 'normal', notes: 'First session of root canal — lower right molar' },
      ]

      for (const apt of APPOINTMENTS_SEED) {
        if (!apt.patient || !apt.doctor) continue

        const startAt = makeDateTime(apt.day, apt.hour, apt.min)
        const endAt = new Date(startAt.getTime() + (apt.duration || 30) * 60000)

        // appointment_number is auto-generated by sequence — do NOT pass it
        await appointmentDb.create({
          clinic_id: clinic.id,
          patient_id: apt.patient.id,
          doctor_id: apt.doctor.id,
          treatment_category_id: apt.cat ? apt.cat.id : null,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          duration_minutes: apt.duration || 30,
          status: apt.status,
          priority: apt.priority || 'normal',
          notes: apt.notes || '',
          created_by_id: receptionist ? receptionist.id : apt.doctor.id,
          is_deleted: false,
        })
      }
      console.log(`[Seed] ${APPOINTMENTS_SEED.length} appointments seeded successfully!`)
    } else {
      console.log(`[Seed] Database already has ${aptCount} appointments.`)
    }

    console.log('[Seed] Database seeding complete!')
  } catch (err) {
    console.error('[Seed] Seeding error:', err)
  }
}

module.exports = { seedDatabase }
