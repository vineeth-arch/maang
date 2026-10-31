// Turnover bands for the "Who are you?" step. Value is a representative annual revenue in ₹ for tierFor().
export const BANDS = [
  { id: 'under_40l', label: 'Under ₹40 lakh a year', value: 20_00_000 },
  { id: '40l_5cr', label: '₹40 lakh to ₹5 crore a year', value: 1_00_00_000 },
  { id: '5cr_50cr', label: '₹5 crore to ₹50 crore a year', value: 20_00_00_000 },
  { id: 'over_50cr', label: 'Above ₹50 crore a year', value: 100_00_00_000 },
] as const;
export type BandId = (typeof BANDS)[number]['id'];
