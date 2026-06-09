export type DamageChannelKey =
  | 'bj_x_force'
  | 'bj_y_force'
  | 'bj_z_force'
  | 'shock_x_force'
  | 'shock_y_force'
  | 'shock_z_force'
  | 'bushing_f_x_momt'
  | 'bushing_f_y_momt'
  | 'bushing_f_z_momt'
  | 'bushing_r_x_momt'
  | 'bushing_r_y_momt'
  | 'bushing_r_z_momt';

export type DamageChannelDefinition = {
  key: DamageChannelKey;
  label: string;
  shortLabel: string;
  order: number;
};

export type DamagePlotDamageCell = {
  damage: number | null;
  status: string;
  error?: string | null;
};

export type InspectDamagePlotRow = {
  event_id: string;
  job_number?: string | null;
  work_order?: string | null;
  program_id?: string | null;
  version: string;
  damages: Partial<Record<DamageChannelKey, DamagePlotDamageCell | undefined>>;
};

export type DamagePlotCell = {
  eventId: string;
  eventLabel: string;
  eventIndex: number;
  version: string;
  channelKey: DamageChannelKey;
  channelLabel: string;
  channelIndex: number;
  damage: number;
  metadata: {
    job_number?: string | null;
    work_order?: string | null;
    program_id?: string | null;
  };
};

export type DamagePlotBar = DamagePlotCell & {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
};

export type DamagePlotLayout = {
  bars: DamagePlotBar[];
  channelLabels: string[];
  eventLabels: string[];
  cellSpacing: number;
  minDamage: number;
  maxDamage: number;
  bounds: {
    width: number;
    depth: number;
    height: number;
  };
  center: [number, number, number];
};
