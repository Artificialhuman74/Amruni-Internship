import { useState, useEffect, useMemo } from 'react';
import { appointmentApi } from '../services/appointmentApi';
import { authApi, getAdminToken, setAdminToken, apiError } from '../services/api';
import { confirm } from '../lib/haptics';
import DoctorAvatar from '../components/DoctorAvatar';
import { LicenceEditor } from '../components/admin/PractitionerFields';
import CampManager from '../components/admin/CampManager';
import AddDoctorModal from '../components/admin/AddDoctorModal';
import { EMPTY_LICENCE, licenceLine, licenceProblem } from '../data/practitioners';
import { patientAppHref } from '../lib/siteLinks';
import {
  IconSettings, IconAlert, IconPlus, IconTip, IconMobile, IconCheckCircle,
  IconUser, IconChat, IconClose, IconAppointment, IconSearch, IconHospital,
} from '../icons.jsx';

const inlineHint = { display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: '-2px' };

export default function AdminDashboard() {
  // Auth state — the password is verified server-side (POST /api/admin/login)
  // which issues a short-lived admin token sent as X-Admin-Key on API calls.
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getAdminToken());
  const [loginError, setLoginError] = useState('');

  // Doctor state
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slotDoctorId, setSlotDoctorId] = useState(null); // doctor whose slot manager is open
  const [licenceDoctorId, setLicenceDoctorId] = useState(null); // doctor whose licences are open

  // Navigation & filter state
  const [activeTab, setActiveTab] = useState('doctors'); // 'doctors' | 'camps'
  const [showAddModal, setShowAddModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');


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

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      await authApi.adminLogin(password);
      setIsAuthenticated(true);
      setPassword('');
      confirm();
    } catch (err) {
      setLoginError(apiError(err, 'Invalid admin password'));
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminToken(null);
    confirm();
  };

  const availableSpecialties = useMemo(() => {
    const list = [
      'All',
      'Gynaecology',
      'Fertility',
      'Mental Health',
      'Pregnancy',
      'Menopause',
      'Ayurveda',
      'General Medicine',
      'Dermatology',
      'Nutrition & Dietetics',
    ];
    const dynamicSet = new Set(list);
    doctors.forEach((d) => {
      if (d.specialty) dynamicSet.add(d.specialty);
    });
    return Array.from(dynamicSet);
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      const matchesSpecialty =
        selectedSpecialty === 'All' ||
        (doc.specialty && doc.specialty.toLowerCase() === selectedSpecialty.toLowerCase());
      if (!matchesSpecialty) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        (doc.name && doc.name.toLowerCase().includes(q)) ||
        (doc.specialty && doc.specialty.toLowerCase().includes(q)) ||
        (doc.phone && doc.phone.toLowerCase().includes(q))
      );
    });
  }, [doctors, selectedSpecialty, searchQuery]);

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
      <div className="screen screen--light" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 var(--sp-6)', minHeight: '100dvh' }}>
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
            <span style={{ color: 'var(--clr-ink-muted)', display: 'inline-flex' }}><IconSettings size={40} /></span>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)', marginTop: 'var(--sp-2)' }}>Amruni Admin Portal</h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>Secure system console</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-ink)', marginBottom: 6, textTransform: 'uppercase' }}>Admin password</label>
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
              <p style={{ color: 'var(--clr-brand)', fontSize: 'var(--text-xs)', fontWeight: 600, ...inlineHint }}><IconAlert size={14} /> {loginError}</p>
            )}

            <button type="submit" className="btn btn--primary" style={{ marginTop: 'var(--sp-2)' }}>
              Log In
            </button>
          </form>

          <button
            onClick={() => window.location.assign(patientAppHref)}
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
    <div className="screen screen--light" style={{ paddingBottom: 'var(--sp-12)', minHeight: '100dvh', overflowY: 'auto' }}>
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

      <div style={{ padding: 'var(--sp-5) var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
        {/* Stats Grid - 2 Cards (Avg Fee removed) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-3)' }}>
          <div style={{ background: 'var(--clr-surface)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--clr-border)', textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', textTransform: 'uppercase' }}>Doctors</p>
            <p style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)', marginTop: 4 }}>{doctors.length}</p>
          </div>
          <div style={{ background: 'var(--clr-surface)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--clr-border)', textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', textTransform: 'uppercase' }}>Specialties</p>
            <p style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)', marginTop: 4 }}>
              {new Set(doctors.map(d => d.specialty)).size}
            </p>
          </div>
        </div>

        {/* Minimalist Tabs */}
        <div
          role="tablist"
          style={{
            display: 'flex',
            gap: 6,
            background: 'var(--clr-surface-2)',
            padding: 4,
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--clr-border)'
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'doctors'}
            onClick={() => setActiveTab('doctors')}
            style={{
              flex: 1,
              padding: 'var(--sp-2) var(--sp-4)',
              borderRadius: 'var(--radius-lg)',
              border: 'none',
              background: activeTab === 'doctors' ? 'var(--clr-surface)' : 'transparent',
              color: activeTab === 'doctors' ? 'var(--clr-ink)' : 'var(--clr-ink-muted)',
              fontWeight: activeTab === 'doctors' ? 700 : 500,
              fontSize: 'var(--text-sm)',
              boxShadow: activeTab === 'doctors' ? 'var(--shadow-xs)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.15s ease'
            }}
          >
            <IconUser size={16} />
            <span>Doctors</span>
            <span
              style={{
                background: activeTab === 'doctors' ? 'var(--clr-brand)' : 'var(--clr-border)',
                color: activeTab === 'doctors' ? 'var(--clr-ink-on-dark)' : 'var(--clr-ink-muted)',
                fontSize: 11,
                padding: '1px 7px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700
              }}
            >
              {doctors.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'camps'}
            onClick={() => setActiveTab('camps')}
            style={{
              flex: 1,
              padding: 'var(--sp-2) var(--sp-4)',
              borderRadius: 'var(--radius-lg)',
              border: 'none',
              background: activeTab === 'camps' ? 'var(--clr-surface)' : 'transparent',
              color: activeTab === 'camps' ? 'var(--clr-ink)' : 'var(--clr-ink-muted)',
              fontWeight: activeTab === 'camps' ? 700 : 500,
              fontSize: 'var(--text-sm)',
              boxShadow: activeTab === 'camps' ? 'var(--shadow-xs)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.15s ease'
            }}
          >
            <IconHospital size={16} />
            <span>Health Camps</span>
          </button>
        </div>

        {/* Tab 1: Doctors */}
        {activeTab === 'doctors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            {/* Search & Specialty Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {/* Search Bar */}
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--clr-ink-muted)',
                    display: 'inline-flex',
                    pointerEvents: 'none'
                  }}
                >
                  <IconSearch size={17} />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by doctor name, specialty, or phone..."
                  style={{
                    width: '100%',
                    padding: '10px 38px 10px 42px',
                    borderRadius: 'var(--radius-xl)',
                    border: '1.5px solid var(--clr-border)',
                    background: 'var(--clr-surface)',
                    color: 'var(--clr-ink)',
                    fontSize: 'var(--text-sm)',
                    outline: 'none',
                    boxShadow: 'var(--shadow-xs)'
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--clr-ink-muted)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex'
                    }}
                  >
                    <IconClose size={15} />
                  </button>
                )}
              </div>

              {/* Specialty Filter Pills */}
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  overflowX: 'auto',
                  paddingBottom: 4,
                  scrollbarWidth: 'none',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {availableSpecialties.map((spec) => {
                  const isSelected = selectedSpecialty.toLowerCase() === spec.toLowerCase();
                  return (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => setSelectedSpecialty(spec)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-full)',
                        border: isSelected ? '1px solid var(--clr-brand)' : '1px solid var(--clr-border)',
                        background: isSelected ? 'var(--clr-brand)' : 'var(--clr-surface)',
                        color: isSelected ? 'var(--clr-ink-on-dark)' : 'var(--clr-ink)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: isSelected ? 700 : 500,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {spec}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Doctor Listing Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-2)' }}>
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--clr-ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={inlineHint}><IconUser size={18} /></span>
                Doctor Directory
              </h2>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)' }}>
                Showing {filteredDoctors.length} of {doctors.length}
              </span>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-8) 0' }}>
                <div className="spinner"></div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                {filteredDoctors.map((doc) => (
                  <div key={doc.id}>
                    <div
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
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>
                          <span style={{ fontWeight: 600, color: 'var(--clr-brand)' }}>{doc.specialty}</span> · {doc.exp}
                        </div>
                        <LicenceBadge doctor={doc} onClick={() => setLicenceDoctorId(licenceDoctorId === doc.id ? null : doc.id)} />
                        <div style={{ fontSize: 10, color: 'var(--clr-ink-subtle)', marginTop: 4 }}>
                          <span style={inlineHint}><IconAppointment size={11} /></span> Next open slot: {doc.nextSlot || 'None published'}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--clr-ink-subtle)', marginTop: 2 }}>
                          <span style={inlineHint}><IconMobile size={11} /></span> Phone: {doc.phone || 'Not set'} · <span style={inlineHint}><IconChat size={11} /></span> Chat fee: ₹{doc.chatFee ?? '—'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-ink)' }}>{doc.fee}</span>
                        <button
                          onClick={() => setSlotDoctorId(slotDoctorId === doc.id ? null : doc.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            background: slotDoctorId === doc.id ? 'var(--clr-brand)' : 'oklch(0.55 0.12 260 / 0.1)',
                            color: slotDoctorId === doc.id ? 'var(--clr-ink-on-dark)' : 'oklch(0.45 0.12 260)',
                            fontWeight: 600,
                            fontSize: 10,
                            cursor: 'pointer',
                          }}
                        >
                          Slots
                        </button>
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
                    {slotDoctorId === doc.id && <SlotManager doctor={doc} />}
                    {licenceDoctorId === doc.id && (
                      <LicenceManager
                        doctor={doc}
                        onChange={(licences) => setDoctors((prev) => prev.map((d) => (d.id === doc.id ? withLicences(d, licences) : d)))}
                      />
                    )}
                  </div>
                ))}

                {filteredDoctors.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--clr-ink-muted)', border: '1px dashed var(--clr-border)', borderRadius: 'var(--radius-lg)' }}>
                    {searchQuery || selectedSpecialty !== 'All' ? (
                      <div>
                        <p style={{ fontWeight: 600 }}>No doctors match your filter criteria.</p>
                        <button
                          type="button"
                          onClick={() => { setSearchQuery(''); setSelectedSpecialty('All'); }}
                          style={{
                            marginTop: 'var(--sp-2)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--clr-brand)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          Clear all filters
                        </button>
                      </div>
                    ) : (
                      'No doctors currently registered in the database.'
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Health Camps */}
        {activeTab === 'camps' && (
          <CampManager doctors={doctors} />
        )}

        {/* Add Doctor Modal */}
        {showAddModal && (
          <AddDoctorModal
            onClose={() => setShowAddModal(false)}
            onDoctorAdded={(newDoc) => {
              setDoctors((prev) => [...prev, newDoc]);
              setShowAddModal(false);
            }}
          />
        )}

        {/* Action Menu Dialog (triggered by + button) */}
        {showActionMenu && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="action-menu-title"
            onClick={() => setShowActionMenu(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(4px)',
              zIndex: 9998,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--sp-4)',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--clr-surface)',
                borderRadius: 'var(--radius-xl)',
                border: '1.5px solid var(--clr-border)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                width: '100%',
                maxWidth: 360,
                padding: 'var(--sp-5)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--sp-4)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 id="action-menu-title" style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--clr-ink)' }}>
                    Choose Action
                  </h3>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>
                    Select what you want to create
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowActionMenu(false)}
                  style={{
                    background: 'var(--clr-surface-2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--clr-ink-muted)',
                    cursor: 'pointer'
                  }}
                >
                  <IconClose size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowActionMenu(false);
                    setShowAddModal(true);
                  }}
                  style={{
                    padding: 'var(--sp-4)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1.5px solid var(--clr-border)',
                    background: 'var(--clr-surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'var(--clr-brand)',
                    color: 'var(--clr-ink-on-dark)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <IconUser size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--clr-ink)' }}>Add Doctor</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>Register a practitioner to the directory</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowActionMenu(false);
                    setActiveTab('camps');
                  }}
                  style={{
                    padding: 'var(--sp-4)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1.5px solid var(--clr-border)',
                    background: 'var(--clr-surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'oklch(0.55 0.14 260)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <IconHospital size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--clr-ink)' }}>Create a Camp</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>Organize a community health camp</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Floating Circle Button with + on Bottom-Right inside content container */}
        <button
          type="button"
          onClick={() => setShowActionMenu(true)}
          title="Add Doctor or Create Camp"
          aria-label="Add Doctor or Create Camp"
          style={{
            position: 'fixed',
            bottom: 'max(24px, calc(env(safe-area-inset-bottom) + 16px))',
            right: 'max(20px, calc(50% - (var(--app-max-width) / 2) + 20px))',
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--clr-brand)',
            color: 'var(--clr-ink-on-dark)',
            border: '2px solid rgba(255, 255, 255, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(162, 38, 93, 0.45), 0 2px 8px rgba(0, 0, 0, 0.15)',
            zIndex: 999,
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <IconPlus size={28} />
        </button>
      </div>
    </div>
  );
}

/**
 * Availability manager: the doctor (via admin) publishes priced, bookable
 * slots by expanding a time range. Consumers only ever see 'open' slots.
 */
function SlotManager({ doctor }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(today);
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('17:00');
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState(doctor.videoFee || '');

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    async function loadSlots() {
      try {
        const data = await appointmentApi.getAllSlots(doctor.id);
        if (!cancelled) setSlots(data);
      } catch (err) {
        console.error('Failed to load slots', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadSlots();
    return () => { cancelled = true; };
  }, [doctor.id, refreshKey]);

  const handlePublish = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await appointmentApi.publishSlots(doctor.id, {
        date, start, end,
        durationMinutes: Number(duration) || 30,
        price: price ? Number(price) : undefined,
      });
      setMessage(res.created > 0 ? `Published ${res.created} slots.` : 'No new slots (times already published).');
      refresh();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to publish slots.');
    }
  };

  const handleDeleteSlot = async (slotId) => {
    try {
      await appointmentApi.deleteSlot(slotId);
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch (err) {
      setMessage(err.response?.data?.error || 'Could not remove that slot.');
    }
  };

  const byDate = slots.reduce((acc, s) => {
    (acc[s.date] = acc[s.date] || []).push(s);
    return acc;
  }, {});

  const statusColor = { open: 'var(--clr-success)', locked: 'oklch(0.65 0.15 80)', booked: 'var(--clr-brand)' };

  const fieldStyle = {
    padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--clr-border)', background: 'var(--clr-surface)',
    fontSize: 'var(--text-xs)', color: 'var(--clr-ink)', width: '100%',
  };

  return (
    <div style={{
      marginTop: 'var(--sp-2)', padding: 'var(--sp-4)',
      background: 'var(--clr-surface-2)', border: '1px solid var(--clr-border)',
      borderRadius: 'var(--radius-lg)',
    }}>
      <h3 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-ink)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--sp-3)' }}>
        ⏰ Availability — {doctor.name}
      </h3>

      {/* Publish form */}
      <form onSubmit={handlePublish} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
        <label style={{ fontSize: 10, color: 'var(--clr-ink-muted)' }}>Date
          <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} style={fieldStyle} required />
        </label>
        <label style={{ fontSize: 10, color: 'var(--clr-ink-muted)' }}>Price per slot (₹)
          <input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} style={fieldStyle} placeholder={`Default ₹${doctor.videoFee}`} />
        </label>
        <label style={{ fontSize: 10, color: 'var(--clr-ink-muted)' }}>From
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={fieldStyle} required />
        </label>
        <label style={{ fontSize: 10, color: 'var(--clr-ink-muted)' }}>To
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={fieldStyle} required />
        </label>
        <label style={{ fontSize: 10, color: 'var(--clr-ink-muted)' }}>Slot length (min)
          <select value={duration} onChange={(e) => setDuration(e.target.value)} style={fieldStyle}>
            {[15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n} min</option>)}
          </select>
        </label>
        <button type="submit" className="btn btn--primary btn--sm" style={{ alignSelf: 'end' }}>
          Publish Slots
        </button>
      </form>

      {message && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginBottom: 'var(--sp-3)' }}>{message}</p>}

      {/* Upcoming slots grouped by day */}
      {loading ? (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)' }}>Loading slots…</p>
      ) : slots.length === 0 ? (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)' }}>No upcoming slots published.</p>
      ) : (
        Object.entries(byDate).map(([day, daySlots]) => (
          <div key={day} style={{ marginBottom: 'var(--sp-3)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--clr-ink-muted)', marginBottom: 'var(--sp-2)' }}>{day}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
              {daySlots.map((s) => (
                <span key={s.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 8px', borderRadius: 'var(--radius-pill)',
                  background: 'var(--clr-surface)', border: '1px solid var(--clr-border)',
                  fontSize: 10, color: 'var(--clr-ink)',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor[s.status] || 'var(--clr-border)' }} />
                  {s.time} · ₹{s.price}
                  {s.status !== 'booked' && (
                    <button
                      onClick={() => handleDeleteSlot(s.id)}
                      aria-label={`Remove ${s.time} slot`}
                      style={{ border: 'none', background: 'none', color: 'var(--clr-ink-subtle)', cursor: 'pointer', padding: 0, lineHeight: 1, display: 'inline-flex' }}
                    >
                      <IconClose size={13} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Licence state on each directory row.
 *
 * "None on file" is amber, not red: it is every practitioner onboarded before
 * licences were captured, still bookable, and this is the prompt to go and
 * add one. "Expired" is red because it is the state that has already stopped
 * their bookings.
 */
function LicenceBadge({ doctor, onClick }) {
  const status = doctor.licenceStatus ?? 'none';
  const current = (doctor.licences ?? []).filter((l) => !l.expired);
  const text = status === 'current'
    ? `Licensed · ${current.map((l) => l.region || l.country).join(', ')}`
    : status === 'expired' ? 'Licence expired — bookings paused' : 'No licence on file — add one';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${text}. Manage licences for ${doctor.name}`}
      className={`lic-badge lic-badge--${status}`}
      title={(doctor.licences ?? []).map((l) => `${licenceLine(l)} · ${l.number}${l.expiresOn ? ` · until ${l.expiresOn}` : ''}`).join('\n') || undefined}
    >
      {text}
    </button>
  );
}

function withLicences(doctor, licences) {
  const today = new Date().toISOString().slice(0, 10);
  const marked = licences.map((l) => ({ ...l, expired: Boolean(l.expiresOn) && l.expiresOn < today }));
  const status = !marked.length ? 'none' : marked.some((l) => !l.expired) ? 'current' : 'expired';
  return { ...doctor, licences: marked, licenceStatus: status };
}

/**
 * Licences for a practitioner already in the directory — the eighteen seeded
 * before licences were captured, a renewal, or a newly licensed state.
 */
function LicenceManager({ doctor, onChange }) {
  const [draft, setDraft] = useState([{ ...EMPTY_LICENCE }]);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const licences = doctor.licences ?? [];

  async function save() {
    const problem = draft.map(licenceProblem).find(Boolean);
    if (problem) { setShowErrors(true); setMessage(problem); return; }
    setBusy(true); setMessage('');
    try {
      const added = [];
      for (const l of draft) {
        added.push(await appointmentApi.addLicence(doctor.id, {
          country: l.country, region: l.region || null, authority: l.authority.trim(),
          number: l.number.trim(), expiresOn: l.expiresOn || null,
        }));
      }
      onChange([...licences, ...added]);
      setDraft([{ ...EMPTY_LICENCE }]); setShowErrors(false);
      confirm();
    } catch (err) {
      setMessage(apiError(err, 'Could not save the licence.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(l) {
    if (!window.confirm(`Remove the ${licenceLine(l)} licence (${l.number})?`)) return;
    try {
      await appointmentApi.deleteLicence(doctor.id, l.id);
      onChange(licences.filter((x) => x.id !== l.id));
    } catch (err) {
      setMessage(apiError(err, 'Could not remove the licence.'));
    }
  }

  return (
    <div className="lic-manager">
      {licences.length > 0 && (
        <ul className="lic-manager__list">
          {licences.map((l) => (
            <li key={l.id} className={l.expired ? 'is-expired' : ''}>
              <span>
                <strong>{licenceLine(l)}</strong>
                <small>{l.number}{l.expiresOn ? ` · ${l.expired ? 'expired' : 'valid until'} ${l.expiresOn}` : ' · no expiry'}</small>
              </span>
              <button type="button" onClick={() => remove(l)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <LicenceEditor value={draft} onChange={setDraft} showErrors={showErrors} />
      {message && <p className="lic__problem" role="alert">{message}</p>}
      <button type="button" className="btn btn--primary btn--sm" onClick={save} disabled={busy}>
        {busy ? 'Saving…' : draft.length > 1 ? `Save ${draft.length} licences` : 'Save licence'}
      </button>
    </div>
  );
}
