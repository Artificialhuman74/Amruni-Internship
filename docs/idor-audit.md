# IDOR Audit (Non-Payment Routes)

Scope: Every backend route taking a path or referencing ID across `server/app/routes_*.py`, excluding payment-owned files (`payments.py`, `routes_bookings.py`, `routes_care.py`). Audit only — no code changes made here.

| route | who should access it | ownership checked (yes/no) | risk |
|---|---|---|---|
| `GET /api/camps/{camp_id}` (`routes_camps.py:172`) | Public (patients and visitors) | no (intentionally public catalog read) | Low |
| `PUT /api/camps/{camp_id}` (`routes_camps.py:195`) | Admin (`require_admin`) | yes (admin-gated) | Low |
| `DELETE /api/camps/{camp_id}` (`routes_camps.py:210`) | Admin (`require_admin`) | yes (admin-gated) | Low |
| `GET /api/doctors/{doctor_id}` (`routes_doctors.py:165`) | Public (patients and visitors) | no (intentionally public catalog read; note `doctor_json` exposes practitioner `phone` and `licence_json` includes licence `document`) | Low |
| `POST /api/doctors/{doctor_id}/licences` (`routes_doctors.py:209`) | Admin (`require_admin`) | yes (admin-gated) | Low |
| `DELETE /api/doctors/{doctor_id}/licences/{licence_id}` (`routes_doctors.py:224`) | Admin (`require_admin`) | yes (admin-gated + `id = ? AND doctor_id = ?`) | Low |
| `DELETE /api/doctors/{doctor_id}` (`routes_doctors.py:235`) | Admin (`require_admin`) | yes (admin-gated) | Low |
| `GET /api/doctors/{doctor_id}/slots` (`routes_doctors.py:248`) | Public (`all=false`); Admin (`all=true`) | no (public slot catalog; `all=true` lacks `require_admin` though returns no patient PII) | Low |
| `POST /api/doctors/{doctor_id}/slots` (`routes_doctors.py:273`) | Admin (`require_admin`) | yes (admin-gated) | Low |
| `DELETE /api/slots/{slot_id}` (`routes_doctors.py:313`) | Admin (`require_admin`) | yes (admin-gated) | Low |
| `DELETE /api/doctor/slots/{slot_id}` (`routes_doctor.py:249`) | Practitioner owner (`current_doctor`) | yes (`WHERE id = ? AND doctor_id = ?`) | Low |
| `GET /api/doctor/appointments/{appointment_id}/record` (`routes_doctor.py:273`) | Practitioner owner of a `confirmed`/`completed` appointment | no (checks `doctor_id = ?` and masks `anonymous`, but does not require `status IN ('confirmed', 'completed')`) | Medium |
| `PUT /api/doctor/appointments/{appointment_id}/record` (`routes_doctor.py:294`) | Practitioner owner of a `confirmed`/`completed` appointment | no (checks `doctor_id = ?`, but allows writing records and calling `sync_from_prescription` on `cancelled`/`pending_payment` bookings) | High |
| `GET /api/doctor/patients/{user_id}/chart` (`routes_doctor.py:417`) | Practitioner with `confirmed`/`completed` non-anonymous appointment (`_require_relationship`) | yes (`_require_relationship` + `effective_share` / `can_see` / `can_see_document`) | Low |
| `PUT /api/doctor/patients/{user_id}/chart` (`routes_doctor.py:557`) | Practitioner with `confirmed`/`completed` non-anonymous appointment (`_require_relationship`) | yes (`_require_relationship` + section merge guard) | Low |
| `POST /api/doctor/patients/{user_id}/documents` (`routes_doctor.py:599`) | Practitioner with `confirmed`/`completed` non-anonymous appointment (`_require_relationship`) | yes (`_require_relationship`) | Low |
| `GET /api/doctor/patients/{user_id}/documents/{doc_id}` (`routes_doctor.py:619`) | Practitioner with `confirmed`/`completed` non-anonymous appointment + document share | yes (`_require_relationship` + `user_id` + `can_see_document`) | Low |
| `DELETE /api/doctor/patients/{user_id}/documents/{doc_id}` (`routes_doctor.py:634`) | Practitioner uploader with active relationship | yes (`_require_relationship` + `user_id` + `doctor_id` + `uploaded_by != 'patient'`) | Low |
| `POST /api/journal` (`routes_community.py:264`, body `moodLogId`) | Authenticated patient (`current_user`), referencing only her own `moodLogId` | no (`body.moodLogId` is stored unverified and `_moods_for` at line 239 queries `mood_logs WHERE id IN (...)` without `user_id = ?`, leaking another user's decrypted mood entry) | High |
| `PATCH /api/journal/{entry_id}` (`routes_community.py:288`, body `moodLogId`) | Journal entry owner (`current_user`), referencing only her own `moodLogId` | no (`entry_id` checks `user_id = ?`, but unverified `body.moodLogId` + `_moods_for` still leaks another user's mood entry) | High |
| `DELETE /api/journal/{entry_id}` (`routes_community.py:316`) | Journal entry owner (`current_user`) | yes (`WHERE id = ? AND user_id = ?`, plus mood delete scoped to `user_id = ?`) | Low |
| `POST /api/journal/{entry_id}/share` (`routes_community.py:340`) | Journal entry owner (`current_user`) | yes (`WHERE id = ? AND user_id = ?`) | Low |
| `GET /api/community/posts/{post_id}` (`routes_community.py:399`) | Authenticated member allowed by age gate & block list | no (public read gated on `approved` + adolescent tag filter, but root post fetch omits `community_blocks` unlike `reply_rows`) | Low |
| `POST /api/community/posts` (`routes_community.py:427`, body `replyToId`) | Authenticated member replying to an approved visible post | no (public reply; checks parent `id` exists, but omits `moderation_status = 'approved'` and adolescent tag restriction on parent) | Low |
| `POST /api/community/posts/{post_id}/like` (`routes_community.py:465`) | Authenticated member (`current_user`) | yes (like row scoped to `user["id"]`; omits `moderation_status = 'approved'` check) | Low |
| `POST /api/community/posts/{post_id}/vote` (`routes_community.py:488`) | Authenticated member (`current_user`) | yes (vote row scoped to `user["id"]`; omits `moderation_status = 'approved'` check) | Low |
| `POST /api/community/posts/{post_id}/report` (`routes_community.py:510`) | Authenticated member (`current_user`) | yes (report row records `reporter_id = user["id"]`; duplicate-report moderation abuse is separate in T10) | Low |
| `POST /api/community/posts/{post_id}/block-author` (`routes_community.py:528`) | Authenticated member (`current_user`) | yes (block row scoped to `user["id"]`) | Low |
| `PUT /api/me/history/items/{item_id}` (`routes_history.py:239`) | Patient owner (`current_user`) | yes (`WHERE id = ? AND user_id = ?`) | Low |
| `DELETE /api/me/history/items/{item_id}` (`routes_history.py:253`) | Patient owner (`current_user`) | yes (`WHERE id = ? AND user_id = ?`) | Low |
| `GET /api/me/documents/{doc_id}` (`routes_history.py:287`) | Patient owner (`current_user`) | yes (`WHERE id = ? AND user_id = ?`) | Low |
| `DELETE /api/me/documents/{doc_id}` (`routes_history.py:296`) | Patient owner (`current_user`) | yes (`WHERE id = ? AND user_id = ? AND uploaded_by = 'patient'`) | Low |
| `GET /api/me/appointments/{appointment_id}/history-share` (`routes_history.py:312`) | Patient appointment owner (`current_user`) | yes (`WHERE id = ? AND user_id = ?`) | Low |
| `PUT /api/me/appointments/{appointment_id}/history-share` (`routes_history.py:323`) | Patient appointment owner (`current_user`) | yes (`WHERE id = ? AND user_id = ?`, and `clean_share` filters `documentIds` by `user_id = ?`) | Low |
| `POST /api/me/history-requests/{request_id}/respond` (`routes_history.py:347`) | Patient recipient (`current_user`) | yes (`WHERE id = ? AND user_id = ?`) | Low |
| `POST /api/doctor/patients/{user_id}/history-requests` (`routes_history.py:386`) | Practitioner with `confirmed`/`completed` non-anonymous appointment | no (uses `effective_share` at line 105 checking `status != 'cancelled'` instead of `status IN ('confirmed', 'completed')`, allowing unpaid `pending_payment` bookings to create requests and probe patient state) | Medium |
| `GET /api/insurance/receipt/{appointment_id}` (`routes_insurance.py:123`) | Patient owner of `confirmed`/`completed` appointment (`current_user`) | yes (`WHERE a.id = ? AND a.user_id = ?` + `status IN ('confirmed', 'completed')` + `anonymous` masking) | Low |
| `POST /api/intake/{form_id}` (`routes_intake.py:39`, body `appointmentId`) | Authenticated patient (`current_user`), owning `appointmentId` if provided | yes (`form_id` checked against `FORM_IDS`; `appointmentId` verified with `user_id = ?`) | Low |
| `GET /api/intake/{form_id}/latest` (`routes_intake.py:88`) | Authenticated patient (`current_user`) | yes (`WHERE user_id = ? AND form_id = ?`) | Low |
| `DELETE /api/intake/{submission_id}` (`routes_intake.py:103`) | Patient owner (`current_user`) | yes (`WHERE id = ? AND user_id = ?`) | Low |
| `PATCH /api/me/medications/{med_id}` (`routes_meds.py:251`) | Patient owner (`current_user`) | yes (`WHERE id = ? AND user_id = ?`) | Low |
| `POST /api/me/medications/{med_id}/stop` (`routes_meds.py:271`) | Patient owner (`current_user`) | yes (`WHERE id = ? AND user_id = ?`) | Low |
| `POST /api/me/medications/{med_id}/doses` (`routes_meds.py:285`) | Patient owner (`current_user`) | yes (`WHERE id = ? AND user_id = ?`) | Low |
| `DELETE /api/me/medications/{med_id}/doses` (`routes_meds.py:302`) | Patient owner (`current_user`) | yes (`WHERE user_id = ? AND medication_id = ?`) | Low |
| `PUT /api/me/cycle/logs/{day}` (`routes_me.py:300`) | Patient owner (`current_user`) | yes (scoped to `(user["id"], day)`) | Low |
| `POST /api/mood` (`routes_mood.py:103`, body `journalId`) | Authenticated patient (`current_user`), owning `journalId` if provided | no (`body.journalId` stored on `mood_logs` without checking `journal_entries WHERE id = ? AND user_id = ?`, though no cross-user data is read back from that column) | Low |
| `DELETE /api/mood/{mood_id}` (`routes_mood.py:157`) | Patient owner (`current_user`) | yes (`WHERE id = ? AND user_id = ?`) | Low |
| `DELETE /api/me/conditions/{condition}` (`routes_pcos.py:99`) | Patient owner (`current_user`) | yes (updates `patient_charts` for `user["id"]`) | Low |
| `DELETE /api/me/sos/contacts/{contact_id}` (`routes_sos.py:86`) | Patient owner (`current_user`) | yes (`WHERE id = ? AND user_id = ?`) | Low |

## Additional Scope Observations (Non-ID-Param Routes & Deferred Items)

- `GET /api/doctor/patients` (`routes_doctor.py:394`) and `GET /api/doctor/me` (`routes_doctor.py:131`, line 146): filter `COALESCE(anonymous, 0) = 0`, but do not filter `status IN ('confirmed', 'completed')`, exposing patients whose bookings were `cancelled` or `pending_payment`.
- `effective_share` (`routes_history.py:103`) checks `status != 'cancelled'` rather than `status IN ('confirmed', 'completed')`; chart routes remain guarded by `_require_relationship`, while `/doctor/patients/{user_id}/history-requests` is exposed to `pending_payment`.
- Payment-related files (`payments.py`, `routes_bookings.py`, `routes_care.py`) were intentionally excluded per task instructions.
