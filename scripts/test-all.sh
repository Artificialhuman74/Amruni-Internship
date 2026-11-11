#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -x "$ROOT_DIR/server/.venv/bin/python" ]]; then
  PYTHON="$ROOT_DIR/server/.venv/bin/python"
else
  PYTHON="$(command -v python3)"
fi

echo "==> [1/6] Python bytecode check (server/app & server/tests)"
"$PYTHON" -m py_compile server/app/*.py server/tests/*.py

echo "==> [2/6] Backend unittest suite (server/tests)"
"$PYTHON" -m unittest discover -s server/tests -v

echo "==> [3/6] Frontend Node test suite (amruni-app/tests)"
node --test amruni-app/tests/*.test.js

echo "==> [4/6] Frontend TypeScript check (amruni-app)"
npm --prefix amruni-app run typecheck

echo "==> [5/6] Frontend targeted ESLint (hardened & tested files)"
npx --prefix amruni-app eslint \
  amruni-app/src/apps/PatientApp.jsx \
  amruni-app/src/components/ModerationNotice.jsx \
  amruni-app/src/lib/offline.js \
  amruni-app/src/lib/otpHelpers.js \
  amruni-app/src/screens/Community.jsx \
  amruni-app/src/screens/CommunityThread.jsx \
  amruni-app/src/screens/ConsultationSummary.jsx \
  amruni-app/src/screens/JournalEntry.jsx \
  amruni-app/src/screens/OTPVerify.jsx \
  amruni-app/src/screens/PhoneEntry.jsx \
  amruni-app/src/screens/VerifyPrescription.jsx \
  amruni-app/src/services/api.js \
  amruni-app/src/services/appointmentApi.js \
  amruni-app/tests/offline.test.js \
  amruni-app/tests/otp.test.js \
  amruni-app/tests/prescription.test.js

echo "==> [6/6] Frontend multi-app production build (patient, doctor, admin)"
npm --prefix amruni-app run build:all

echo "==> All checks in scripts/test-all.sh passed."

