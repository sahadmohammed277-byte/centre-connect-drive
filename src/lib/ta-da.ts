/** TA & DA Calculation
 *  TA = km × TA_RATE_PER_KM (default ₹5)
 *  DA = flat DA_AMOUNT (default ₹150) if total visits >= MIN_VISITS_FOR_DA (default 5), else 0
 */
export const DA_AMOUNT = 150;
export const TA_RATE_PER_KM = 5;
export const MIN_VISITS_FOR_DA = 5;
// Back-compat alias used in some legacy components
export const MIN_DOCTOR_VISITS_FOR_DA = MIN_VISITS_FOR_DA;
export const DA_RATE_PER_KM = DA_AMOUNT; // legacy alias (now flat amount)
export const MAX_DAILY_KM = 300;

export function calculateTA(totalKm: number, rate: number = TA_RATE_PER_KM): number {
  const km = Math.max(0, Math.min(totalKm || 0, MAX_DAILY_KM));
  return Math.round(km * rate);
}

export function calculateDA(
  visitCount: number,
  daAmount: number = DA_AMOUNT,
  threshold: number = MIN_VISITS_FOR_DA,
): number {
  return visitCount >= threshold ? daAmount : 0;
}

/** Backwards-compatible: 2nd arg is now interpreted as TOTAL visits (not just doctor). */
export function calculateDailySummary(totalKm: number, visitCount: number) {
  const ta = calculateTA(totalKm);
  const da = calculateDA(visitCount);
  return {
    totalKm: Math.max(0, Math.min(totalKm || 0, MAX_DAILY_KM)),
    doctorVisitCount: visitCount,
    visitCount,
    daEligible: visitCount >= MIN_VISITS_FOR_DA,
    ta,
    da,
    total: ta + da,
  };
}
