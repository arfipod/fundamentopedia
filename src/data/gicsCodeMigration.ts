const LEGACY_GICS_CODE_MAP: Record<string, string> = {
  '45102020': '20202030',
  '20304020': '20304030',
  '255020': '255030',
  '25502020': '25503030',
  '601020': '602010',
};

function mapLegacy601020SubIndustry(code: string): string {
  if (/^6010201\d$/.test(code)) {
    return `6020101${code.slice(-1)}`;
  }
  return code;
}

function migrateLegacyGicsCode(code: string): string {
  const mapped = LEGACY_GICS_CODE_MAP[code] ?? code;
  return mapLegacy601020SubIndustry(mapped);
}

export function closestKnownGicsCode(code: string, knownCodes: Set<string>): string | null {
  if (knownCodes.has(code)) return code;

  let candidate = code;
  while (candidate.length > 2) {
    candidate = candidate.slice(0, -2);
    if (knownCodes.has(candidate)) return candidate;
  }
  return knownCodes.has(candidate) ? candidate : null;
}

export function migrateAndResolveGicsCode(code: string, knownCodes: Set<string>): string | null {
  const migrated = migrateLegacyGicsCode(code);
  return closestKnownGicsCode(migrated, knownCodes);
}

