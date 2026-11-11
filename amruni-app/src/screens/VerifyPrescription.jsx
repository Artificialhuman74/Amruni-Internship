import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { appointmentApi } from '../services/appointmentApi';
import { IconCheckCircle, IconPrescription, IconShield } from '../icons.jsx';

export default function VerifyPrescription() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlToken = (searchParams.get('token') || '').trim();

  const [tokenInput, setTokenInput] = useState(urlToken);
  const [loading, setLoading] = useState(Boolean(urlToken));
  const [result, setResult] = useState(null);
  const [networkError, setNetworkError] = useState('');

  const runCheck = useCallback(async (tok) => {
    const clean = (tok || '').trim();
    if (!clean) {
      setResult(null);
      setNetworkError('');
      return;
    }
    setLoading(true);
    setNetworkError('');
    try {
      const data = await appointmentApi.verifyPrescription(clean);
      setResult(data);
    } catch (err) {
      const payload = err?.response?.data;
      if (payload && typeof payload === 'object' && payload.status) {
        setResult(payload);
      } else {
        setResult(null);
        setNetworkError('Could not verify this prescription right now. Check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function checkInitial() {
      if (!urlToken) return;
      try {
        const data = await appointmentApi.verifyPrescription(urlToken);
        if (active) setResult(data);
      } catch (err) {
        if (!active) return;
        const payload = err?.response?.data;
        if (payload && typeof payload === 'object' && payload.status) setResult(payload);
        else setNetworkError('Could not verify this prescription right now. Check your connection and try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    checkInitial();
    return () => { active = false; };
  }, [urlToken]);

  function handleSubmit(e) {
    e.preventDefault();
    const clean = tokenInput.trim();
    if (!clean) return;
    if (clean !== urlToken) {
      setSearchParams({ token: clean }, { replace: true });
    } else {
      runCheck(clean);
    }
  }

  const isValid = result?.valid === true && result?.status === 'valid';
  const isSuperseded = result?.status === 'superseded';

  return (
    <div className="screen screen--light" style={{ padding: 'var(--sp-6)' }}>
      <div style={{ maxWidth: 460, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <IconPrescription size={22} />
          <div>
            <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-ink)' }}>
              Verify Prescription
            </h1>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)' }}>
              Confirm whether an Amruni prescription matches the clinician’s latest saved record.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <input
            type="text"
            className="input-field"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Paste verification token"
            aria-label="Prescription verification token"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn--primary" disabled={!tokenInput.trim() || loading} style={{ width: 'auto' }}>
            {loading ? 'Checking…' : 'Verify'}
          </button>
        </form>

        {networkError && (
          <div role="alert" style={{ padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', color: 'oklch(0.55 0.16 24)', fontSize: 'var(--text-sm)' }}>
            {networkError}
          </div>
        )}

        {!loading && result && (
          <div
            role="status"
            style={{
              background: 'var(--clr-surface-2)',
              border: '1.5px solid var(--clr-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--sp-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', color: isValid ? 'var(--clr-success)' : isSuperseded ? 'var(--clr-gold)' : 'oklch(0.55 0.16 24)' }}>
              {isValid ? <IconCheckCircle size={20} /> : <IconShield size={20} />}
              <strong style={{ fontSize: 'var(--text-base)' }}>
                {isValid
                  ? 'Authentic Amruni Record'
                  : isSuperseded
                  ? 'Superseded Copy'
                  : 'Verification Failed'}
              </strong>
            </div>

            {result.error && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)' }}>{result.error}</p>
            )}

            {result.rxId && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)', fontSize: 'var(--text-xs)' }}>
                <div>
                  <span style={{ color: 'var(--clr-ink-subtle)' }}>Rx ID</span>
                  <div style={{ fontWeight: 600, color: 'var(--clr-ink)' }}>{result.rxId}</div>
                </div>
                {result.consultationDate && (
                  <div>
                    <span style={{ color: 'var(--clr-ink-subtle)' }}>Consultation date</span>
                    <div style={{ fontWeight: 600, color: 'var(--clr-ink)' }}>{result.consultationDate}</div>
                  </div>
                )}
                {result.doctor?.name && (
                  <div>
                    <span style={{ color: 'var(--clr-ink-subtle)' }}>Practitioner</span>
                    <div style={{ fontWeight: 600, color: 'var(--clr-ink)' }}>
                      {result.doctor.name}
                      {result.doctor.specialty ? ` · ${result.doctor.specialty}` : ''}
                    </div>
                  </div>
                )}
                {result.doctor && (
                  <div>
                    <span style={{ color: 'var(--clr-ink-subtle)' }}>Registration</span>
                    <div style={{ fontWeight: 600, color: 'var(--clr-ink)' }}>
                      {result.doctor.registration || 'On file'}
                    </div>
                  </div>
                )}
                {typeof result.medicineCount === 'number' && (
                  <div>
                    <span style={{ color: 'var(--clr-ink-subtle)' }}>Medicines listed</span>
                    <div style={{ fontWeight: 600, color: 'var(--clr-ink)' }}>{result.medicineCount}</div>
                  </div>
                )}
                {result.issuedAt && (
                  <div>
                    <span style={{ color: 'var(--clr-ink-subtle)' }}>Record updated</span>
                    <div style={{ fontWeight: 600, color: 'var(--clr-ink)' }}>{result.issuedAt}</div>
                  </div>
                )}
              </div>
            )}

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', borderTop: '1px solid var(--clr-border)', paddingTop: 'var(--sp-3)' }}>
              Patient name, diagnosis, and medication details are omitted from public verification checks.
            </p>
          </div>
        )}

        <button className="btn btn--secondary" onClick={() => navigate('/')}>
          Go to Amruni
        </button>
      </div>
    </div>
  );
}

