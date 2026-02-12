

# Referral Marketing Software — Full Implementation Plan

## Overview
A PWA mobile app for field staff + web admin panel for the Marketing Head, built with React, Supabase backend, and installable on Android phones from the browser.

---

## 1. Authentication & User Management
- **Employee ID + password login** — Admin creates staff accounts
- Role-based access: **Marketing Head (Admin)** and **Field Executive (Staff)**
- Staff are locked to their assigned centre upon account creation
- Roles stored in a separate `user_roles` table (security best practice)

## 2. Centre & Staff Setup
- 8 pre-configured hospital centres across Kerala with GPS coordinates for geo-fencing
- Fixed staff-to-centre mapping (Ashik → KH Malappuram, Athul → KH Kochi, etc.)
- Each staff gets a unique Employee ID
- Centre assignment is immutable — staff cannot change it

## 3. Centre Check-in (Geo-fenced)
- **"Start Day" button** captures one-time GPS location + timestamp
- System validates location is within **200 meters** of assigned centre
- If outside geo-fence → blocked with message to reach centre first
- All daily features (visits, KM, referrals) are **locked until check-in**
- **No background or continuous tracking** — battery-friendly and privacy-respecting
- **"End Day" check-out** captures final GPS location + timestamp

## 4. Daily Visit Management
- After check-in, staff can log multiple visits per day
- Each visit captures:
  - Check-in/check-out time, visitor type (Doctor/Lab/Ambulance Driver/Hospital/Other)
  - Visitor name, designation, contact number
  - Purpose of visit, notes/remarks
  - Optional: one-time location capture, photo upload (visiting card, clinic photo)
- Date and centre are auto-filled
- Photos stored in Supabase Storage (not in the database)

## 5. KM Tracking
- **GPS-assisted (preferred):** Auto-calculates distance from centre check-in to end-of-day check-out location
- **Manual entry (fallback):** Start KM & End KM fields, requires admin approval
- All edits are audit-logged with timestamps

## 6. Referral Entry
- Log referrals with: Yes/No toggle, patient name (optional), service type (Lab/OPD/Scan/Admission), estimated value, referral date, and referral centre

## 7. TA & DA Auto-Calculation
- **DA:** ₹150/KM — only if ≥5 doctor visits that day, otherwise ₹0
- **TA:** ₹4/KM — no minimum visit requirement
- System auto-computes daily: total KM, doctor visit count, DA eligibility, DA amount, TA amount, total daily allowance
- Displayed to staff in their daily summary

## 8. Admin Dashboard (Web Panel)
- **Live status view:** Centre-wise staff check-in status with timestamps
- **Daily summary:** KM travelled, visit count, TA/DA per staff
- **Centre-wise reports:** Individual performance reports for each centre/staff combination
- **Monthly TA & DA report:** Working days, total KM, doctor visits, DA-eligible days, DA total, TA total, grand total payable per staff
- **Export:** Download reports as Excel and PDF

## 9. Approval Workflow
- Staff submits monthly TA/DA claim
- Admin reviews and approves/rejects with comments
- Approved data is locked from further edits
- All overrides require a reason and are audit-logged

## 10. Notifications
- Centre check-in reminder (morning)
- Doctor visit shortage alert (when <5 visits by evening)
- Missing KM entry alert
- No activity alert (if no visits logged by a certain time)
- Monthly claim submission reminder
- Implemented as in-app notifications (toast/badge)

## 11. Offline Support & PWA
- App installable from browser to Android home screen
- Offline data entry for visits, referrals, and KM — auto-syncs when back online
- Fast, simple mobile-first UI optimized for field use

## 12. Security & Audit
- Row-Level Security (RLS) — staff can only see their own data
- Admin has full read access across all centres
- All KM edits and data changes are audit-logged
- GPS permission requested only at check-in moments
- No continuous location tracking

