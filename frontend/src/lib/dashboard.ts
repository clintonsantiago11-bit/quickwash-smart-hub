export interface SupplyItem {
  label: string;
  level: number | null;
  color: string;
}

const SUPPLY_TANKS = [
  { label: 'Water Tank', color: '#00B4D8' },
  { label: 'Soap Tank A', color: '#F6AD55' },
  { label: 'Soap Tank B', color: '#00F5A0' },
] as const;

/**
 * The dashboard shows exactly three gauges. The API once shipped a fourth
 * "Wax Tank" row, so unknown labels are dropped here instead of being trusted.
 */
export function normalizeSupplies(
  raw: { label: string; level?: unknown }[] | null | undefined,
): SupplyItem[] {
  const byLabel = new Map((raw ?? []).map((item) => [item.label, item.level]));
  return SUPPLY_TANKS.map((tank) => {
    const level = byLabel.get(tank.label);
    return {
      label: tank.label,
      level:
        typeof level === 'number' && Number.isFinite(level)
          ? Math.min(100, Math.max(0, level))
          : null,
      color: tank.color,
    };
  });
}

export type BayStatus = 'active' | 'available' | 'error';

/**
 * The wash bay card follows whichever machine is actually reporting. A jam or a
 * running cycle from the wash controller wins; otherwise a reachable NAEK
 * 3-in-1 timer means the bay is up and idle. With nothing live the card stays
 * unknown rather than claiming a status it cannot prove.
 */
export function resolveBayStatus(input: {
  esp32Status: BayStatus | null;
  naekOnline: boolean;
}): { status: BayStatus; hasStatus: boolean; online: boolean } {
  if (input.esp32Status) {
    return { status: input.esp32Status, hasStatus: true, online: true };
  }
  if (input.naekOnline) return { status: 'available', hasStatus: true, online: true };
  return { status: 'available', hasStatus: false, online: false };
}

/**
 * A NAEK "sale" event is a usage-counter delta, which the bridge already logs
 * as a finished cycle — so it names the last cycle rather than faking an
 * in-progress state the device never reported.
 */
export function naekLastCycle(events: { type?: string; product?: string }[] | null | undefined): string | null {
  const sale = (events ?? []).find((event) => event?.type === 'sale');
  return sale?.product || null;
}
