const GICS_CODE_ALIASES: Record<string, string> = {
  '45102020': '20202030',
  '20304020': '20304030',
  '255020': '255030',
  '25502020': '25503030',
  '601020': '602010',
};

function normalizeSubIndustryAlias(code: string): string {
  if (/^6010201\d$/.test(code)) {
    return `6020101${code.slice(-1)}`;
  }
  return code;
}

function normalizeGicsCode(code: string): string {
  const aliasedCode = GICS_CODE_ALIASES[code] ?? code;
  return normalizeSubIndustryAlias(aliasedCode);
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

export function resolveGicsCode(code: string, knownCodes: Set<string>): string | null {
  const normalizedCode = normalizeGicsCode(code);
  return closestKnownGicsCode(normalizedCode, knownCodes);
}
