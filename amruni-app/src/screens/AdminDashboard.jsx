import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentApi } from '../services/appointmentApi';
import { confirm } from '../lib/haptics';
import DoctorAvatar from '../components/DoctorAvatar';

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  // Auth state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem('amruni_admin_auth') === 'true'
  );
  const [loginError, setLoginError] = useState('');

  // Doctor state
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [docName, setDocName] = useState('');
  const [docSpecialty, setDocSpecialty] = useState('Gynaecology');
  const [docExp, setDocExp] = useState('');
  const [docFee, setDocFee] = useState('');
  const [docMeetLink, setDocMeetLink] = useState('');
  const [docPhone, setDocPhone] = useState('');
  const [docLang, setDocLang] = useState('English, Hindi');
  const [docPhoto, setDocPhoto] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState({ text: '', type: '' });

  const SPECIALTY_PRESETS = [
    'Gynaecology',
    'Fertility',
    'Mental Health',
    'Pregnancy',
    'Menopause',
    'Homeopathy'
  ];

  // Load doctors if authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    async function fetchDoctors() {
      try {
        const data = await appointmentApi.getDoctors();
        setDoctors(data);
      } catch (err) {
        console.error('Error fetching doctors:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDoctors();
  }, [isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim() === 'admin' && password === 'amruni') {
      setIsAuthenticated(true);
      sessionStorage.setItem('amruni_admin_auth', 'true');
      setLoginError('');
      confirm();
    } else {
      setLoginError('Invalid admin username or password');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('amruni_admin_auth');
    confirm();
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (limit to 1.5MB for localStorage storage capacity)
      if (file.size > 1500000) {
        alert('File is too large. Please upload an image smaller than 1.5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setDocPhoto(reader.result); // Base64 data URL
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    if (!docName.trim() || !docExp.trim() || !docFee.trim()) {
      setFormMessage({ text: 'Please fill in all required fields.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setFormMessage({ text: '', type: '' });

    // Formatting fields
    const formattedFee = docFee.startsWith('₹') ? docFee : `₹${docFee}`;
    const formattedExp = docExp.toLowerCase().includes('yr') ? docExp : `${docExp} yrs exp`;
    const langArray = docLang.split(',').map((l) => l.trim()).filter(Boolean);
    
    // Auto-generate meet link if left blank
    let meetLink = docMeetLink.trim();
    if (!meetLink) {
      const randomCode = Math.random().toString(36).substring(2, 5) + '-' + 
                         Math.random().toString(36).substring(2, 6) + '-' + 
                         Math.random().toString(36).substring(2, 5);
      meetLink = `https://meet.google.com/${randomCode}`;
    }

    const doctorData = {
      name: docName.trim(),
      specialty: docSpecialty,
      exp: formattedExp,
      fee: formattedFee,
      meetLink: meetLink,
      phone: docPhone.trim(),
      photo: docPhoto, // Base64 uploaded photo
      lang: langArray,
      avatar: '🩺', // General icon fallback
      rating: parseFloat((4.8 + Math.random() * 0.2).toFixed(1)), // randomized 4.8 - 5.0
      reviews: Math.floor(Math.random() * 150) + 15,
      nextSlot: 'Today, 4:00 PM',
    };

    try {
      const newDoc = await appointmentApi.addDoctor(doctorData);
      setDoctors((prev) => [...prev, newDoc]);
      setFormMessage({ text: 'Doctor added successfully!', type: 'success' });
      confirm();

      // Reset form
      setDocName('');
      setDocExp('');
      setDocFee('');
      setDocMeetLink('');
      setDocPhone('');
      setDocPhoto('');
      setDocLang('English, Hindi');

      // Reset file input in DOM
      const fileInput = document.getElementById('doctor-photo-upload');
      if (fileInput) fileInput.value = '';

      // Clear success message after 3 seconds
      setTimeout(() => setFormMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      console.error(err);
      setFormMessage({ text: 'Failed to add doctor.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDoctor = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      try {
        await appointmentApi.deleteDoctor(id);
        setDoctors((prev) => prev.filter((d) => d.id !== id));
        confirm();
      } catch (err) {
        console.error(err);
        alert('Failed to delete doctor');
      }
    }
  };

  // If not authenticated, show login form
  if (!isAuthenticated) {
    return (
      <div className="screen screen--light" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 var(--sp-6)', minHeight: '100vh' }}>
        <div style={{
          background: 'var(--clr-surface)',
          padding: 'var(--sp-6)',
          borderRadius: 'var(--radius-xl)',
          border: '1.5px solid var(--clr-border)',
          boxShadow: 'var(--shadow-md)',
          maxWidth: 400,
          margin: '0 auto',
          width: '100%'
        }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
            <span style={{ fontSize: 44 }}>⚙️</span>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)', marginTop: 'var(--sp-2)' }}>Amruni Admin Portal</h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>Secure system console</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-ink)', marginBottom: 6, textTransform: 'uppercase' }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                style={{
                  width: '100%',
                  padding: 'var(--sp-3) var(--sp-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--clr-border)',
                  background: 'var(--clr-surface-2)',
                  color: 'var(--clr-ink)',
                  fontSize: 'var(--text-sm)',
                  outline: 'none'
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-ink)', marginBottom: 6, textTransform: 'uppercase' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                style={{
                  width: '100%',
                  padding: 'var(--sp-3) var(--sp-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--clr-border)',
                  background: 'var(--clr-surface-2)',
                  color: 'var(--clr-ink)',
                  fontSize: 'var(--text-sm)',
                  outline: 'none'
                }}
                required
              />
            </div>

            {loginError && (
              <p style={{ color: 'var(--clr-brand)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>⚠️ {loginError}</p>
            )}

            <button type="submit" className="btn btn--primary" style={{ marginTop: 'var(--sp-2)' }}>
              Log In
            </button>
          </form>

          <button
            onClick={() => navigate('/settings')}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: 'var(--clr-ink-muted)',
              fontSize: 'var(--text-sm)',
              marginTop: 'var(--sp-4)',
              cursor: 'pointer'
            }}
          >
            ← Back to Patient App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen--light" style={{ paddingBottom: 'var(--sp-12)', minHeight: '100vh', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{
        padding: 'calc(env(safe-area-inset-top) + var(--sp-5)) var(--sp-6) var(--sp-4)',
        background: 'var(--clr-surface)',
        borderBottom: '1px solid var(--clr-border)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)' }}>Admin Dashboard</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>Manage systems & doctors</p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: 'var(--sp-2) var(--sp-3)',
            borderRadius: 'var(--radius-md)',
            border: '1.5px solid var(--clr-border)',
            background: 'var(--clr-surface-2)',
            color: 'var(--clr-brand)',
            fontWeight: 600,
            fontSize: 'var(--text-xs)',
            cursor: 'pointer'
          }}
        >
          Sign Out
        </button>
      </div>

      <div style={{ padding: 'var(--sp-5) var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        {/* Quick Back Navigation */}
        <button
          onClick={() => navigate('/settings')}
          style={{
            alignSelf: 'flex-start',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            color: 'var(--clr-brand)',
            fontWeight: 600,
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            padding: 0
          }}
        >
          ← Return to Patient App (Profile)
        </button>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
          <div style={{ background: 'var(--clr-surface)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--clr-border)', textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', textTransform: 'uppercase' }}>Doctors</p>
            <p style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)', marginTop: 4 }}>{doctors.length}</p>
          </div>
          <div style={{ background: 'var(--clr-surface)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--clr-border)', textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', textTransform: 'uppercase' }}>Types</p>
            <p style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)', marginTop: 4 }}>
              {new Set(doctors.map(d => d.specialty)).size}
            </p>
          </div>
          <div style={{ background: 'var(--clr-surface)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--clr-border)', textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', textTransform: 'uppercase' }}>Avg Fee</p>
            <p style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-success)', marginTop: 4 }}>
              ₹{doctors.length > 0 ? Math.round(doctors.reduce((sum, d) => sum + parseInt(d.fee.replace(/\D/g, '')), 0) / doctors.length) : 0}
            </p>
          </div>
        </div>

        {/* Add Doctor Section */}
        <div style={{
          background: 'var(--clr-surface)',
          padding: 'var(--sp-5)',
          borderRadius: 'var(--radius-xl)',
          border: '1.5px solid var(--clr-border)',
        }}>
          <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--clr-ink)', marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>➕</span> Add New Doctor
          </h2>

          <form onSubmit={handleAddDoctor} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-ink-muted)', marginBottom: 4 }}>NAME *</label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="e.g. Dr. Kavitha Nair"
                  style={{ width: '100%', padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', background: 'var(--clr-surface-2)', color: 'var(--clr-ink)', fontSize: 'var(--text-sm)', outline: 'none' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-ink-muted)', marginBottom: 4 }}>SPECIALTY *</label>
                <select
                  value={docSpecialty}
                  onChange={(e) => setDocSpecialty(e.target.value)}
                  style={{ width: '100%', padding: 'calc(var(--sp-3) + 2px) var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', background: 'var(--clr-surface-2)', color: 'var(--clr-ink)', fontSize: 'var(--text-sm)', outline: 'none' }}
                >
                  {SPECIALTY_PRESETS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-ink-muted)', marginBottom: 4 }}>EXPERIENCE *</label>
                <input
                  type="text"
                  value={docExp}
                  onChange={(e) => setDocExp(e.target.value)}
                  placeholder="e.g. 12 yrs or 12"
                  style={{ width: '100%', padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', background: 'var(--clr-surface-2)', color: 'var(--clr-ink)', fontSize: 'var(--text-sm)', outline: 'none' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-ink-muted)', marginBottom: 4 }}>FEE (₹) *</label>
                <input
                  type="text"
                  value={docFee}
                  onChange={(e) => setDocFee(e.target.value)}
                  placeholder="e.g. 599"
                  style={{ width: '100%', padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', background: 'var(--clr-surface-2)', color: 'var(--clr-ink)', fontSize: 'var(--text-sm)', outline: 'none' }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-ink-muted)', marginBottom: 4 }}>GOOGLE MEET LINK</label>
              <input
                type="url"
                value={docMeetLink}
                onChange={(e) => setDocMeetLink(e.target.value)}
                placeholder="e.g. https://meet.google.com/abc-defg-hij (Leave blank to auto-generate)"
                style={{ width: '100%', padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', background: 'var(--clr-surface-2)', color: 'var(--clr-ink)', fontSize: 'var(--text-sm)', outline: 'none' }}
              />
              <p style={{ fontSize: 10, color: 'var(--clr-ink-subtle)', marginTop: 4 }}>
                💡 Clicking call in client app will redirect the customer to this Meet link instead of in-app video.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-ink-muted)', marginBottom: 4 }}>PHONE NUMBER (for Chat/DM)</label>
              <input
                type="tel"
                value={docPhone}
                onChange={(e) => setDocPhone(e.target.value)}
                placeholder="e.g. 9876543210 (10-digit mobile)"
                style={{ width: '100%', padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', background: 'var(--clr-surface-2)', color: 'var(--clr-ink)', fontSize: 'var(--text-sm)', outline: 'none' }}
              />
              <p style={{ fontSize: 10, color: 'var(--clr-ink-subtle)', marginTop: 4 }}>
                📱 Used for WhatsApp chat consultations. Chat fee = ⅓ of video fee (auto-calculated).
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-ink-muted)', marginBottom: 4 }}>LANGUAGES (Comma-separated)</label>
                <input
                  type="text"
                  value={docLang}
                  onChange={(e) => setDocLang(e.target.value)}
                  placeholder="English, Hindi, Tamil"
                  style={{ width: '100%', padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', background: 'var(--clr-surface-2)', color: 'var(--clr-ink)', fontSize: 'var(--text-sm)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-ink-muted)', marginBottom: 4 }}>UPLOAD PHOTO</label>
                  <input
                    id="doctor-photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    style={{
                      width: '100%',
                      fontSize: 11,
                      color: 'var(--clr-ink-muted)',
                      cursor: 'pointer'
                    }}
                  />
                </div>
                {docPhoto ? (
                  <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1.5px solid var(--clr-border)', flexShrink: 0 }}>
                    <img src={docPhoto} alt="Upload preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--clr-surface-2)', border: '1.5px dashed var(--clr-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--clr-ink-subtle)', flexShrink: 0 }}>
                    No Photo
                  </div>
                )}
              </div>
            </div>

            {formMessage.text && (
              <p style={{
                color: formMessage.type === 'success' ? 'var(--clr-success)' : 'var(--clr-brand)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600
              }}>
                {formMessage.type === 'success' ? '✅' : '⚠️'} {formMessage.text}
              </p>
            )}

            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Adding doctor...' : 'Add Doctor'}
            </button>
          </form>
        </div>

        {/* Doctor Listing Section */}
        <div>
          <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--clr-ink)', marginBottom: 'var(--sp-4)' }}>
            👤 Doctor Directory ({doctors.length})
          </h2>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-8) 0' }}>
              <div className="spinner"></div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {doctors.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--sp-4)',
                    background: 'var(--clr-surface)',
                    border: '1px solid var(--clr-border)',
                    borderRadius: 'var(--radius-lg)',
                    gap: 'var(--sp-3)'
                  }}
                >
                  <DoctorAvatar doctor={doc} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--clr-ink)' }}>{doc.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>{doc.specialty} · {doc.exp}</div>
                    <div style={{ fontSize: 10, color: 'var(--clr-ink-subtle)', marginTop: 4, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      🔗 Meet: {doc.meetLink || 'In-app Video'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--clr-ink-subtle)', marginTop: 2 }}>
                      📱 Phone: {doc.phone || 'Not set'} · 💬 Chat fee: ₹{Math.round(parseInt(doc.fee.replace(/\D/g, '')) / 3) || '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-ink)' }}>{doc.fee}</span>
                    <button
                      onClick={() => handleDeleteDoctor(doc.id, doc.name)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: 'oklch(0.60 0.18 20 / 0.1)',
                        color: 'oklch(0.60 0.18 20)',
                        fontWeight: 600,
                        fontSize: 10,
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {doctors.length === 0 && (
                <div style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--clr-ink-muted)', border: '1px dashed var(--clr-border)', borderRadius: 'var(--radius-lg)' }}>
                  No doctors currently registered in the database.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
