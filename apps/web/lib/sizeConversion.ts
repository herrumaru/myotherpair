export type SizeSystem = 'UK' | 'US' | 'EU';

interface SizeRow {
  uk: number;
  us: number;
  eu: number;
}

/** Mens / unisex conversion table (UK as canonical). */
const SIZE_TABLE: SizeRow[] = [
  { uk: 3,    us: 4,    eu: 36 },
  { uk: 3.5,  us: 4.5,  eu: 36 },
  { uk: 4,    us: 5,    eu: 37 },
  { uk: 4.5,  us: 5.5,  eu: 38 },
  { uk: 5,    us: 6,    eu: 38 },
  { uk: 5.5,  us: 6.5,  eu: 39 },
  { uk: 6,    us: 7,    eu: 39 },
  { uk: 6.5,  us: 7.5,  eu: 40 },
  { uk: 7,    us: 8,    eu: 41 },
  { uk: 7.5,  us: 8.5,  eu: 41 },
  { uk: 8,    us: 9,    eu: 42 },
  { uk: 8.5,  us: 9.5,  eu: 42 },
  { uk: 9,    us: 10,   eu: 43 },
  { uk: 9.5,  us: 10.5, eu: 44 },
  { uk: 10,   us: 11,   eu: 44 },
  { uk: 10.5, us: 11.5, eu: 45 },
  { uk: 11,   us: 12,   eu: 45 },
  { uk: 11.5, us: 12.5, eu: 46 },
  { uk: 12,   us: 13,   eu: 46 },
  { uk: 12.5, us: 13.5, eu: 47 },
  { uk: 13,   us: 14,   eu: 47 },
  { uk: 14,   us: 15,   eu: 49 },
  { uk: 15,   us: 16,   eu: 50 },
];

/** Returns all size values for the given system (as strings). */
export function getSizes(system: SizeSystem): string[] {
  const key = system.toLowerCase() as 'uk' | 'us' | 'eu';
  return SIZE_TABLE.map(row => String(row[key]));
}

/** Find a row by exact value + system, falling back to nearest-neighbor. */
function findRow(value: string, system: SizeSystem): SizeRow | undefined {
  const key = system.toLowerCase() as 'uk' | 'us' | 'eu';
  const num = parseFloat(value);
  if (isNaN(num)) return undefined;

  const exact = SIZE_TABLE.find(r => r[key] === num);
  if (exact) return exact;

  // Nearest-neighbor — never show '—' for a valid number
  let nearest: SizeRow | undefined;
  let minDiff = Infinity;
  for (const r of SIZE_TABLE) {
    const diff = Math.abs(r[key] - num);
    if (diff < minDiff) { minDiff = diff; nearest = r; }
  }
  return nearest;
}

/**
 * Returns the equivalent sizes in all three systems for a given value+system.
 * Uses nearest-neighbor when exact match is not found — never returns null for a valid number.
 */
export function getEquivalents(
  value: string,
  system: SizeSystem,
): { uk: string; us: string; eu: string } | null {
  const row = findRow(value, system);
  if (!row) return null;
  return {
    uk: String(row.uk),
    us: String(row.us),
    eu: String(row.eu),
  };
}

/**
 * Formats a size option label showing the primary size and equivalents.
 * e.g. "UK 7 (US 8 · EU 41)"
 */
export function formatSizeLabel(value: string, system: SizeSystem): string {
  const eq = getEquivalents(value, system);
  if (!eq) return `${system} ${value}`;
  const others = (['UK', 'US', 'EU'] as SizeSystem[])
    .filter(s => s !== system)
    .map(s => `${s} ${eq[s.toLowerCase() as 'uk' | 'us' | 'eu']}`);
  return `${system} ${value}  (${others.join(' · ')})`;
}

/**
 * Convert a size value from one system to UK canonical number for DB storage.
 * Falls back to parseFloat(value) if not found.
 */
export function toUKCanonical(value: string, system: SizeSystem): number {
  const row = findRow(value, system);
  return row ? row.uk : parseFloat(value);
}

/**
 * Detect preferred size system from browser locale.
 * UK → en-GB / en-AU / en-NZ / en-IE
 * US → en-US / en-CA
 * EU → everything else
 */
export function detectSizeSystem(): SizeSystem {
  if (typeof navigator === 'undefined') return 'UK';
  const lang = navigator.language ?? '';
  if (/^en-(GB|AU|NZ|IE)/i.test(lang)) return 'UK';
  if (/^en-(US|CA)/i.test(lang)) return 'US';
  return 'EU';
}
