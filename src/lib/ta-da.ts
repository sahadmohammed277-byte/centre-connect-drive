/** TA & DA Calculation */
export const DA_RATE_PER_KM = 150;
export const TA_RATE_PER_KM = 4;
export const MIN_DOCTOR_VISITS_FOR_DA = 5;

export function calculateTA(totalKm: number): number {
  return totalKm * TA_RATE_PER_KM;
}

export function calculateDA(totalKm: number, doctorVisitCount: number): number {
  if (doctorVisitCount < MIN_DOCTOR_VISITS_FOR_DA) return 0;
  return totalKm * DA_RATE_PER_KM;
}

export function calculateDailySummary(totalKm: number, doctorVisitCount: number) {
  const ta = calculateTA(totalKm);
  const da = calculateDA(totalKm, doctorVisitCount);
  return {
    totalKm,
    doctorVisitCount,
    daEligible: doctorVisitCount >= MIN_DOCTOR_VISITS_FOR_DA,
    ta,
    da,
    total: ta + da,
  };
}
