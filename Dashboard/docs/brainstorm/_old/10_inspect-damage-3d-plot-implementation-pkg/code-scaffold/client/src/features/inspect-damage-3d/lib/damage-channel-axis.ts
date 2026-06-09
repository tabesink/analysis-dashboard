import type { DamageChannelDefinition } from './damage-plot-types';

export const DAMAGE_CHANNELS: readonly DamageChannelDefinition[] = [
  { key: 'bj_x_force', label: 'BJ X Force', shortLabel: 'BJ X', order: 1 },
  { key: 'bj_y_force', label: 'BJ Y Force', shortLabel: 'BJ Y', order: 2 },
  { key: 'bj_z_force', label: 'BJ Z Force', shortLabel: 'BJ Z', order: 3 },
  { key: 'shock_x_force', label: 'Shock X Force', shortLabel: 'Shock X', order: 4 },
  { key: 'shock_y_force', label: 'Shock Y Force', shortLabel: 'Shock Y', order: 5 },
  { key: 'shock_z_force', label: 'Shock Z Force', shortLabel: 'Shock Z', order: 6 },
  { key: 'bushing_f_x_momt', label: 'Bushing F X Momt', shortLabel: 'Bush F X', order: 7 },
  { key: 'bushing_f_y_momt', label: 'Bushing F Y Momt', shortLabel: 'Bush F Y', order: 8 },
  { key: 'bushing_f_z_momt', label: 'Bushing F Z Momt', shortLabel: 'Bush F Z', order: 9 },
  { key: 'bushing_r_x_momt', label: 'Bushing R X Momt', shortLabel: 'Bush R X', order: 10 },
  { key: 'bushing_r_y_momt', label: 'Bushing R Y Momt', shortLabel: 'Bush R Y', order: 11 },
  { key: 'bushing_r_z_momt', label: 'Bushing R Z Momt', shortLabel: 'Bush R Z', order: 12 },
] as const;
