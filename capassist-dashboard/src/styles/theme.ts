// Central theme tokens. The palette is an original design inspired by TVS's red, blue and white
// motorsport identity. These are not official corporate colour specifications.
export const BRAND = {
  navy: '#071F46', blue: '#0B3A83', electric: '#2474D2', racing: '#E11B22', white: '#FFFFFF',
  light: '#F4F7FB', charcoal: '#182230', grey: '#66758B', border: '#E2E8F0', soft: '#F0F4F9',
} as const;

export const SIGNAL = {
  full: '#16A34A', denied: '#DC2626', cold: '#EAB308', regen: '#F59E0B', uc: '#0891B2',
  lead: '#64748B', lithium: '#7C3AED', converter: '#2563EB', fallback: '#F97316', inactive: '#94A3B8',
  partial: '#F59E0B', speed: '#0B3A83', assist: '#16A34A', generator: '#2563EB', fuel: '#E11B22', temp: '#F97316',
} as const;

export const OUTCOME_COLOR: Record<string, string> = {
  full: SIGNAL.full, cut_short: SIGNAL.partial, denied: SIGNAL.denied, engine_cold: SIGNAL.cold,
};
export const OUTCOME_LABEL: Record<string, string> = {
  full: 'Full boost', cut_short: 'Cut short', denied: 'Denied (energy store)', engine_cold: 'Refused: engine cold',
};
export const FAMILY_COLOR: Record<string, string> = {
  conventional: SIGNAL.inactive, stock: SIGNAL.lead, capassist: SIGNAL.uc, lithium: SIGNAL.lithium,
};
