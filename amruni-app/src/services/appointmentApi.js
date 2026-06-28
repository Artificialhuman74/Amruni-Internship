const DEFAULT_DOCTORS = [
  {
    id: 1,
    name: 'Dr. Ananya Sharma',
    specialty: 'Gynaecology',
    exp: '14 yrs exp',
    fee: '₹600',
    meetLink: 'https://meet.google.com/gyn-ananya-sharma',
    phone: '9876543210',
    lang: ['English', 'Hindi'],
    avatar: '🩺',
    photo: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300&h=300',
    rating: 4.9,
    reviews: 142,
    nextSlot: 'Today, 4:00 PM'
  },
  {
    id: 2,
    name: 'Dr. Sarah D\'Souza',
    specialty: 'Gynaecology',
    exp: '10 yrs exp',
    fee: '₹500',
    meetLink: 'https://meet.google.com/gyn-sarah-dsouza',
    phone: '9876543211',
    lang: ['English', 'Hindi', 'Konkani'],
    avatar: '🩺',
    photo: 'https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=300&h=300',
    rating: 4.8,
    reviews: 98,
    nextSlot: 'Today, 5:30 PM'
  },
  {
    id: 3,
    name: 'Dr. Priya Nair',
    specialty: 'Fertility',
    exp: '15 yrs exp',
    fee: '₹800',
    meetLink: 'https://meet.google.com/fer-priya-nair',
    phone: '9876543212',
    lang: ['English', 'Malayalam', 'Tamil'],
    avatar: '🩺',
    photo: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=300&h=300',
    rating: 4.9,
    reviews: 184,
    nextSlot: 'Tomorrow, 11:00 AM'
  },
  {
    id: 4,
    name: 'Dr. Vikram Malhotra',
    specialty: 'Fertility',
    exp: '18 yrs exp',
    fee: '₹900',
    meetLink: 'https://meet.google.com/fer-vikram-malhotra',
    phone: '9876543213',
    lang: ['English', 'Hindi', 'Punjabi'],
    avatar: '🩺',
    photo: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=300&h=300',
    rating: 4.7,
    reviews: 120,
    nextSlot: 'Today, 6:00 PM'
  },
  {
    id: 5,
    name: 'Dr. Shalini Sen',
    specialty: 'Mental Health',
    exp: '8 yrs exp',
    fee: '₹400',
    meetLink: 'https://meet.google.com/men-shalini-sen',
    phone: '9876543214',
    lang: ['English', 'Bengali'],
    avatar: '🩺',
    photo: 'https://images.unsplash.com/photo-1651008011680-7798363717df?auto=format&fit=crop&q=80&w=300&h=300',
    rating: 4.8,
    reviews: 75,
    nextSlot: 'Today, 3:30 PM'
  },
  {
    id: 6,
    name: 'Dr. Amit Patel',
    specialty: 'Mental Health',
    exp: '12 yrs exp',
    fee: '₹450',
    meetLink: 'https://meet.google.com/men-amit-patel',
    phone: '9876543215',
    lang: ['English', 'Gujarati', 'Hindi'],
    avatar: '🩺',
    photo: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=300&h=300',
    rating: 4.6,
    reviews: 110,
    nextSlot: 'Tomorrow, 10:00 AM'
  },
  {
    id: 7,
    name: 'Dr. Meera Krishnan',
    specialty: 'Pregnancy',
    exp: '11 yrs exp',
    fee: '₹700',
    meetLink: 'https://meet.google.com/pre-meera-krishnan',
    phone: '9876543216',
    lang: ['English', 'Kannada', 'Hindi'],
    avatar: '🩺',
    photo: 'https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&q=80&w=300&h=300',
    rating: 4.9,
    reviews: 156,
    nextSlot: 'Today, 2:30 PM'
  },
  {
    id: 8,
    name: 'Dr. Sneha Reddy',
    specialty: 'Pregnancy',
    exp: '9 yrs exp',
    fee: '₹550',
    meetLink: 'https://meet.google.com/pre-sneha-reddy',
    phone: '9876543217',
    lang: ['English', 'Telugu'],
    avatar: '🩺',
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300&h=300',
    rating: 4.8,
    reviews: 84,
    nextSlot: 'Tomorrow, 4:00 PM'
  },
  {
    id: 9,
    name: 'Dr. Rita Sen',
    specialty: 'Menopause',
    exp: '20 yrs exp',
    fee: '₹750',
    meetLink: 'https://meet.google.com/mno-rita-sen',
    phone: '9876543218',
    lang: ['English', 'Hindi', 'Bengali'],
    avatar: '🩺',
    photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=300&h=300',
    rating: 4.9,
    reviews: 210,
    nextSlot: 'Today, 4:30 PM'
  },
  {
    id: 10,
    name: 'Dr. Clara Oswald',
    specialty: 'Menopause',
    exp: '16 yrs exp',
    fee: '₹650',
    meetLink: 'https://meet.google.com/mno-clara-oswald',
    phone: '9876543219',
    lang: ['English', 'French'],
    avatar: '🩺',
    photo: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&q=80&w=300&h=300',
    rating: 4.7,
    reviews: 132,
    nextSlot: 'Tomorrow, 2:00 PM'
  },
  {
    id: 11,
    name: 'Dr. Hitesh Shah',
    specialty: 'Homeopathy',
    exp: '12 yrs exp',
    fee: '₹350',
    meetLink: 'https://meet.google.com/hom-hitesh-shah',
    phone: '9876543220',
    lang: ['English', 'Hindi', 'Gujarati'],
    avatar: '🩺',
    photo: 'https://images.unsplash.com/photo-1622902046580-2b47f47fdb47?auto=format&fit=crop&q=80&w=300&h=300',
    rating: 4.8,
    reviews: 115,
    nextSlot: 'Today, 5:00 PM'
  },
  {
    id: 12,
    name: 'Dr. Neeta Rao',
    specialty: 'Homeopathy',
    exp: '10 yrs exp',
    fee: '₹300',
    meetLink: 'https://meet.google.com/hom-neeta-rao',
    phone: '9876543221',
    lang: ['English', 'Hindi', 'Marathi'],
    avatar: '🩺',
    photo: 'https://images.unsplash.com/photo-1591604021695-0c69b7c05981?auto=format&fit=crop&q=80&w=300&h=300',
    rating: 4.6,
    reviews: 89,
    nextSlot: 'Tomorrow, 3:00 PM'
  }
];

// Helper functions for doctor persistence in localStorage
const getStoredDoctors = () => {
  try {
    const stored = localStorage.getItem('amruni_doctors_v4');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to parse stored doctors, resetting', e);
  }
  // Fallback to DEFAULT_DOCTORS and save them
  localStorage.setItem('amruni_doctors_v4', JSON.stringify(DEFAULT_DOCTORS));
  return DEFAULT_DOCTORS;
};

const saveStoredDoctors = (doctors) => {
  localStorage.setItem('amruni_doctors_v4', JSON.stringify(doctors));
};

/**
 * Mock APIs for appointments
 */
export const appointmentApi = {
  getDoctors: async () => {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 300));
    return getStoredDoctors();
  },

  getDoctorById: async (id) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const doctors = getStoredDoctors();
    const doctor = doctors.find((d) => d.id === parseInt(id));
    if (!doctor) throw new Error('Doctor not found');
    return doctor;
  },

  bookAppointment: async ({ doctorId, date, time, reason, consultMode, fee }) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const appointmentId = 'apt_' + Math.random().toString(36).substring(2, 9);
    
    // Store in local storage for session persistence
    const newAppointment = {
      appointmentId,
      doctorId,
      date,
      time,
      reason,
      consultMode: consultMode || 'video',
      fee: fee || '',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };
    
    const existing = JSON.parse(localStorage.getItem('amruni_appointments') || '[]');
    existing.push(newAppointment);
    localStorage.setItem('amruni_appointments', JSON.stringify(existing));

    return { appointmentId };
  },

  getAppointment: async (appointmentId) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const existing = JSON.parse(localStorage.getItem('amruni_appointments') || '[]');
    const appointment = existing.find((a) => a.appointmentId === appointmentId);
    if (!appointment) return null;
    
    // Attach doctor details
    const doctors = getStoredDoctors();
    const doctor = doctors.find((d) => d.id === parseInt(appointment.doctorId));
    return { ...appointment, doctor };
  },

  cancelAppointment: async (appointmentId) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const existing = JSON.parse(localStorage.getItem('amruni_appointments') || '[]');
    const filtered = existing.filter((a) => a.appointmentId !== appointmentId);
    localStorage.setItem('amruni_appointments', JSON.stringify(filtered));
    return { success: true };
  },

  addDoctor: async (doctor) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const doctors = getStoredDoctors();
    const maxId = doctors.reduce((max, d) => d.id > max ? d.id : max, 0);
    const newDoctor = {
      ...doctor,
      id: maxId + 1,
      rating: doctor.rating || 5.0,
      reviews: doctor.reviews || 0,
    };
    doctors.push(newDoctor);
    saveStoredDoctors(doctors);
    return newDoctor;
  },

  deleteDoctor: async (id) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const doctors = getStoredDoctors();
    const filtered = doctors.filter((d) => d.id !== parseInt(id));
    saveStoredDoctors(filtered);
    
    // Also clean up appointments associated with this doctor!
    try {
      const appointments = JSON.parse(localStorage.getItem('amruni_appointments') || '[]');
      const remainingAppointments = appointments.filter(a => parseInt(a.doctorId) !== parseInt(id));
      localStorage.setItem('amruni_appointments', JSON.stringify(remainingAppointments));
    } catch (e) {
      console.error('Failed to clean up appointments for deleted doctor', e);
    }
    
    return { success: true };
  },

  completeAppointment: async (appointmentId) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    try {
      const appointments = JSON.parse(localStorage.getItem('amruni_appointments') || '[]');
      const updated = appointments.map(a => 
        a.appointmentId === appointmentId ? { ...a, status: 'completed' } : a
      );
      localStorage.setItem('amruni_appointments', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to complete appointment', e);
    }
    return { success: true };
  }
};
