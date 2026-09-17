import { useState, useRef } from 'react';
import { appointmentApi } from '../../services/appointmentApi';
import { apiError } from '../../services/api';
import { SpecialtyPicker, LanguagePicker } from './PractitionerFields';
import CountryPhoneInput from '../CountryPhoneInput';
import { DEFAULT_COUNTRY } from '../../data/countries';
import { LICENCE_COUNTRIES, REGIONS, AUTHORITY_SUGGESTIONS, countryByCode } from '../../data/practitioners';
import { confirm } from '../../lib/haptics';
import {
  IconUser, IconPlus, IconClose, IconAlert, IconCheckCircle,
  IconStethoscope, IconTip, IconRecords,
} from '../../icons.jsx';

export default function AddDoctorModal({ onClose, onDoctorAdded }) {
  // Form State
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('Gynaecology');
  const [exp, setExp] = useState('');
  const [fee, setFee] = useState('');
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [lang, setLang] = useState(['English', 'Hindi']);
  const [meetLink, setMeetLink] = useState('');
  const [photo, setPhoto] = useState('');

  // Optional Licence & Document State
  const [showLicence, setShowLicence] = useState(false);
  const [licCountry, setLicCountry] = useState('IN');
  const [licRegion, setLicRegion] = useState('');
  const [licAuthority, setLicAuthority] = useState('');
  const [licNumber, setLicNumber] = useState('');
  const [licExpiresOn, setLicExpiresOn] = useState('');
  const [licDoc, setLicDoc] = useState(null); // { name, data }

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const photoInputRef = useRef(null);
  const docInputRef = useRef(null);
  const today = new Date().toISOString().slice(0, 10);

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1500000) {
      alert('Photo is too large. Please upload an image under 1.5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const handleLicenceDocUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5000000) {
      alert('Document is too large. Please upload a file under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setLicDoc({ name: file.name, data: reader.result });
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !exp.trim() || !fee.trim() || !specialty) {
      setError('Please fill in all mandatory fields.');
      return;
    }

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError('Phone number is mandatory for doctor registration.');
      return;
    }

    if (country.code === 'IN' && !/^[6-9]\d{9}$/.test(trimmedPhone)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    // Phone format: store with country code for international, or clean standard format
    const fullPhone = country.code === 'IN' ? trimmedPhone : `${country.dial}${trimmedPhone}`;
    const formattedFee = fee.startsWith('₹') ? fee : `₹${fee}`;
    const formattedExp = exp.toLowerCase().includes('yr') ? exp : `${exp} yrs exp`;

    // Optional licences
    const licences = [];
    if (licNumber.trim() || licAuthority.trim()) {
      licences.push({
        country: licCountry,
        region: licRegion || null,
        authority: licAuthority.trim() || 'Medical Council',
        number: licNumber.trim() || 'Pending',
        expiresOn: licExpiresOn || null,
        document: licDoc?.data || null,
      });
    }

    const doctorData = {
      name: name.trim(),
      specialty,
      exp: formattedExp,
      fee: formattedFee,
      meetLink: meetLink.trim() || null,
      phone: fullPhone,
      photo: photo || null,
      lang,
      avatar: '🩺',
      rating: parseFloat((4.8 + Math.random() * 0.2).toFixed(1)),
      reviews: Math.floor(Math.random() * 150) + 15,
      nextSlot: 'Today, 4:00 PM',
      licences,
    };

    setSubmitting(true);
    try {
      const newDoc = await appointmentApi.addDoctor(doctorData);
      confirm();
      onDoctorAdded(newDoc);
      onClose();
    } catch (err) {
      console.error('Failed to add doctor:', err);
      setError(apiError(err, 'Failed to add doctor. Please check the details.'));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLicCountry = countryByCode(licCountry);
  const regions = REGIONS[licCountry];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--sp-4)',
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--clr-surface)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--clr-border)',
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 'var(--sp-6)',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'var(--clr-surface-2)',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--clr-ink-muted)',
          }}
        >
          <IconClose size={16} />
        </button>

        {/* Circular Avatar Uploader (Matching User Reference Image) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--sp-6)' }}>
          <div
            onClick={() => photoInputRef.current?.click()}
            style={{
              position: 'relative',
              width: 92,
              height: 92,
              borderRadius: 'var(--radius-full)',
              background: 'var(--clr-surface-2)',
              border: '2px dashed var(--clr-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'visible',
            }}
          >
            {photo ? (
              <img
                src={photo}
                alt="Uploaded preview"
                style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-full)', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ color: 'var(--clr-ink-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconUser size={44} />
              </div>
            )}

            {/* Overlapping Plus Badge Circle */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-full)',
                background: 'var(--clr-brand)',
                color: 'var(--clr-ink-on-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)',
                border: '2px solid var(--clr-surface)',
              }}
            >
              <IconPlus size={16} />
            </div>
          </div>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            style={{ display: 'none' }}
          />

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 8 }}>
            Upload doctor portrait photo
          </p>
        </div>

        {/* Title */}
        <h2 id="modal-title" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-ink)', textAlign: 'center', marginBottom: 'var(--sp-4)' }}>
          Add Practitioner
        </h2>

        {error && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'oklch(0.55 0.18 24 / 0.1)',
              color: 'oklch(0.55 0.18 24)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 'var(--sp-4)',
            }}
          >
            <IconAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {/* Full Name */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-ink)', marginBottom: 6 }}>
              Full Name *
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--clr-surface)',
                border: '1px solid var(--clr-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '2px 12px',
              }}
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Kavitha Nair"
                required
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  padding: 'var(--sp-3) 0',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--clr-ink)',
                  outline: 'none',
                }}
              />
              <span style={{ color: 'var(--clr-ink-subtle)', display: 'inline-flex' }}>
                <IconUser size={16} />
              </span>
            </div>
          </div>

          {/* Specialty Picker */}
          <div>
            <SpecialtyPicker value={specialty} onChange={setSpecialty} required />
          </div>

          {/* Exp & Fee Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-ink)', marginBottom: 6 }}>
                Experience *
              </label>
              <input
                type="text"
                value={exp}
                onChange={(e) => setExp(e.target.value)}
                placeholder="e.g. 10 yrs or 10"
                required
                style={{
                  width: '100%',
                  padding: 'var(--sp-3) var(--sp-4)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--clr-border)',
                  background: 'var(--clr-surface)',
                  color: 'var(--clr-ink)',
                  fontSize: 'var(--text-sm)',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-ink)', marginBottom: 6 }}>
                Fee (₹) *
              </label>
              <input
                type="text"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="e.g. 500"
                required
                style={{
                  width: '100%',
                  padding: 'var(--sp-3) var(--sp-4)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--clr-border)',
                  background: 'var(--clr-surface)',
                  color: 'var(--clr-ink)',
                  fontSize: 'var(--text-sm)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Phone Number (MANDATORY) with Country Code Picker */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-ink)', marginBottom: 6 }}>
              Phone Number (Mandatory for Doctor Sign-in) *
            </label>
            <CountryPhoneInput
              country={country}
              onCountryChange={setCountry}
              phone={phone}
              onPhoneChange={setPhone}
              required
              placeholder={country.placeholder || '10-digit mobile'}
            />
            <p style={{ fontSize: 11, color: 'var(--clr-ink-subtle)', marginTop: 4 }}>
              The doctor will use this exact number and country code to sign into the Doctor Console.
            </p>
          </div>

          {/* Languages Picker */}
          <div>
            <LanguagePicker value={lang} onChange={setLang} />
          </div>

          {/* Optional Meet Link */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-ink-muted)', marginBottom: 6 }}>
              Google Meet Link (Optional)
            </label>
            <input
              type="url"
              value={meetLink}
              onChange={(e) => setMeetLink(e.target.value)}
              placeholder="Auto-generated if left blank"
              style={{
                width: '100%',
                padding: 'var(--sp-3) var(--sp-4)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--clr-border)',
                background: 'var(--clr-surface)',
                color: 'var(--clr-ink)',
                fontSize: 'var(--text-sm)',
                outline: 'none',
              }}
            />
          </div>

          {/* Optional Licence & Documents Collapsible */}
          <div
            style={{
              border: '1px solid var(--clr-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--sp-3) var(--sp-4)',
              background: 'var(--clr-surface-2)',
            }}
          >
            <button
              type="button"
              onClick={() => setShowLicence(!showLicence)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--clr-ink)',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconRecords size={14} /> Licence & Certification (Optional)
              </span>
              <span style={{ color: 'var(--clr-ink-subtle)', fontSize: 12 }}>
                {showLicence ? '▲ Hide' : '▼ Add details'}
              </span>
            </button>

            {showLicence && (
              <div style={{ marginTop: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--clr-ink-muted)', display: 'block', marginBottom: 2 }}>
                      Country
                    </label>
                    <select
                      value={licCountry}
                      onChange={(e) => { setLicCountry(e.target.value); setLicRegion(''); }}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', background: 'var(--clr-surface)', fontSize: 12 }}
                    >
                      {LICENCE_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--clr-ink-muted)', display: 'block', marginBottom: 2 }}>
                      {selectedLicCountry.regionLabel || 'Region'}
                    </label>
                    {regions ? (
                      <select
                        value={licRegion}
                        onChange={(e) => setLicRegion(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', background: 'var(--clr-surface)', fontSize: 12 }}
                      >
                        <option value="">National / Select</option>
                        {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <input
                        value={licRegion}
                        onChange={(e) => setLicRegion(e.target.value)}
                        placeholder="Optional"
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', background: 'var(--clr-surface)', fontSize: 12 }}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--clr-ink-muted)', display: 'block', marginBottom: 2 }}>
                    Issuing Council or Board
                  </label>
                  <input
                    value={licAuthority}
                    onChange={(e) => setLicAuthority(e.target.value)}
                    placeholder={AUTHORITY_SUGGESTIONS[licCountry]?.[0] || 'Medical Council'}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', background: 'var(--clr-surface)', fontSize: 12 }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--clr-ink-muted)', display: 'block', marginBottom: 2 }}>
                      Registration Number
                    </label>
                    <input
                      value={licNumber}
                      onChange={(e) => setLicNumber(e.target.value)}
                      placeholder="e.g. KMC 12345"
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', background: 'var(--clr-surface)', fontSize: 12 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--clr-ink-muted)', display: 'block', marginBottom: 2 }}>
                      Valid Until
                    </label>
                    <input
                      type="date"
                      min={today}
                      value={licExpiresOn}
                      onChange={(e) => setLicExpiresOn(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', background: 'var(--clr-surface)', fontSize: 12 }}
                    />
                  </div>
                </div>

                {/* Document Certificate Upload */}
                <div>
                  <label style={{ fontSize: 11, color: 'var(--clr-ink-muted)', display: 'block', marginBottom: 4 }}>
                    Certificate / Licence Document
                  </label>
                  <input
                    ref={docInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleLicenceDocUpload}
                    style={{ display: 'none' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => docInputRef.current?.click()}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--clr-border)',
                        background: 'var(--clr-surface)',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--clr-ink)',
                        cursor: 'pointer',
                      }}
                    >
                      📎 Choose File
                    </button>
                    {licDoc ? (
                      <span style={{ fontSize: 11, color: 'var(--clr-success)', fontWeight: 600 }}>
                        ✓ {licDoc.name}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--clr-ink-subtle)' }}>
                        Optional PDF or Image
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit & Cancel Buttons (Matching User Mockup) */}
          <div style={{ marginTop: 'var(--sp-2)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn--primary"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 'var(--radius-lg)',
                fontWeight: 700,
                fontSize: 'var(--text-sm)',
              }}
            >
              {submitting ? 'Adding Practitioner…' : 'Add Doctor'}
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--clr-ink-muted)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                padding: '8px',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
