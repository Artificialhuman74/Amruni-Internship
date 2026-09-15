import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { campApi } from '../services/campApi';
import { campDates, campTimes, whenLabel, mapsLink } from '../lib/camps';
import DoctorAvatar from '../components/DoctorAvatar';
import { IconHospital } from '../icons.jsx';

/** Health camps coming up, running now, or held in the last week. */
export default function Camps() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [camps, setCamps] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    campApi.recent().then(setCamps).catch(() => setFailed(true));
  }, []);

  return (
    <div className="screen screen--light">
      <div className="screen-header-nav">
        <button className="nav-back-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <span className="nav-header-title">Health camps</span>
        <div style={{ width: 40 }} />
      </div>

      <div className="camps">
        <p className="camps__intro">
          In-person camps with Amruni doctors — screenings, check-ups and advice, often free. Just turn up at the venue.
        </p>

        {failed && <p className="camps__empty">Camps couldn’t load. Check your connection and try again.</p>}
        {!failed && camps === null && <div className="hr-skel"><span /><span /></div>}
        {camps?.length === 0 && (
          <div className="camps__none">
            <IconHospital size={28} />
            <p>No camps right now. New ones will appear on your Home screen.</p>
          </div>
        )}

        {camps?.map((c, i) => (
          <motion.article
            key={c.id}
            className={`camp-card camp-card--${c.status}`}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(i, 5) * 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="camp-card__top">
              <span className={`camp-badge camp-badge--${c.status}`}>{whenLabel(c)}</span>
              <span className="camp-card__fee">{c.fee ? `₹${c.fee}` : 'Free'}</span>
            </div>
            <h2 className="camp-card__title">{c.title}</h2>
            {c.title !== c.campType && <p className="camp-card__type">{c.campType}</p>}

            <dl className="camp-card__facts">
              <div><dt>When</dt><dd>{campDates(c)}{campTimes(c) ? ` · ${campTimes(c)}` : ''}</dd></div>
              <div>
                <dt>Where</dt>
                <dd>
                  {c.venue}{c.address ? `, ${c.address}` : ''}, {c.city}{' '}
                  <a href={mapsLink(c)} target="_blank" rel="noreferrer" className="camp-card__map">Map</a>
                </dd>
              </div>
            </dl>

            {c.description && <p className="camp-card__desc">{c.description}</p>}

            {c.doctors.length > 0 && (
              <div className="camp-card__doctors">
                <p className="camp-card__doctors-title">Doctors at this camp</p>
                <ul>
                  {c.doctors.map((d) => (
                    <li key={d.id}>
                      <button type="button" onClick={() => navigate(`/doctor/${d.id}`)}>
                        <DoctorAvatar doctor={d} size={36} />
                        <span><strong>{d.name}</strong><small>{d.specialty}</small></span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.article>
        ))}
      </div>
    </div>
  );
}
