import type {
  CellValue,
  FinancialHeader,
  FinancialRow,
  FinancialSection,
  ParsedFinancials,
  SectionKey,
} from './types';
import { SECTION_HEADING_MAP } from './types';
import { matchMetricKeyFromLabel, type MetricKey } from '../domain/financials/metricAliases';

/**
 * Parse a European-formatted number string into a JS number.
 *
 * European format: dots as thousand separators, comma as decimal separator.
 * Examples:
 *   "215.639,00"   -> 215639.00
 *   "(131.376,00)" -> -131376.00
 *   "-1,26%"       -> -0.0126  (when isPercent=true)
 *   "39,1%"        -> 0.391   (when isPercent=true)
 *   "2,08"         -> 2.08
 *   "US$274.62"    -> 274.62  (American-style when no European comma detected)
 */
export function parseNumber(raw: string): CellValue {
  if (!raw) return null;

  let s = raw.trim();
  if (!s || s === '—' || s === '-' || s === 'N/A' || s === 'n/a') return null;

  // Detect negative: parentheses format e.g. (123,45) or (7,7%)
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1).trim();
  }

  // Detect percentage (after stripping parens, since format can be (7,7%))
  const isPercent = s.endsWith('%');
  if (isPercent) s = s.slice(0, -1).trim();

  // Detect negative: leading minus
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1).trim();
  }

  // Strip currency prefixes like US$, CA$, EUR, etc.
  s = s.replace(/^[A-Z]{0,3}\$?\s*/i, '').trim();
  // Also strip trailing currency
  s = s.replace(/\s*[A-Z]{2,3}$/i, '').trim();

  if (!s) return null;

  // Determine if the number uses European format (comma as decimal sep)
  // Heuristic: if there's a comma followed by exactly 1-2 digits at the end,
  // and dots appear before it, it's European format.
  // If there's a dot followed by exactly 1-2 digits at the end and commas before,
  // it's American format.
  const europeanMatch = s.match(/^[\d.]+,\d{1,2}$/);
  const americanMatch = s.match(/^[\d,]+\.\d{1,2}$/);

  let num: number;
  if (europeanMatch) {
    // European: dots are thousands, comma is decimal
    num = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  } else if (americanMatch) {
    // American: commas are thousands, dot is decimal
    num = parseFloat(s.replace(/,/g, ''));
  } else if (s.includes(',') && !s.includes('.')) {
    // Only commas, no dots – treat comma as decimal
    num = parseFloat(s.replace(',', '.'));
  } else {
    // Plain number or only dots (could be thousands or decimals)
    // If the number has a single dot, treat as decimal point
    num = parseFloat(s.replace(/,/g, ''));
  }

  if (Number.isNaN(num)) return null;

  if (negative) num = -num;
  if (isPercent) num = num / 100;

  return num;
}

/**
 * Parse the markdown header lines to extract ticker, price, etc.
 */
export function parseHeader(text: string): FinancialHeader {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let ticker = '';
  let companyName = '';
  let price: number | null = null;
  let currency = 'USD';
  let extractedAt = '';
  let period = 'annual';

  for (const line of lines) {
    // Match the title line: # TICKER – Company Name or # – TICKER ...
    if (line.startsWith('#') && !line.startsWith('##')) {
      const cleaned = line.replace(/^#+\s*/, '').trim();

      // Try pattern: "TICKER – Company Name" or "– TICKER price ..."
      const dashParts = cleaned.split(/\s*[–—-]\s*/);

      if (dashParts.length >= 2) {
        // Could be "AAPL US$274.62 ..." or "CSU" in first part
        const firstPart = dashParts[0].trim();
        const secondPart = dashParts[1].trim();

        if (!firstPart) {
          // Pattern: "– AAPL US$274.62 ..."
          const tokens = secondPart.split(/\s+/);
          ticker = tokens[0] ?? '';
          // Try to find price
          const priceToken = tokens.find((t) => /[A-Z]{0,3}\$[\d.,]+/.test(t));
          if (priceToken) {
            const currMatch = priceToken.match(/^([A-Z]{0,3}\$)/);
            if (currMatch) currency = currMatch[1].replace('$', '') || 'USD';
            price = parseNumber(priceToken);
          }
        } else if (firstPart.match(/^[A-Z]{1,10}$/)) {
          // Pattern: "CSU – Constellation Software Inc."
          ticker = firstPart;
          companyName = secondPart.replace(/\s*[-–—]\s*TIKR\s*Terminal\s*/i, '').trim();
        } else {
          // First part may contain ticker + price
          const tokens = firstPart.split(/\s+/);
          ticker = tokens[0] ?? '';
          const priceToken = tokens.find((t) => /[A-Z]{0,3}\$[\d.,]+/.test(t));
          if (priceToken) {
            const currMatch = priceToken.match(/^([A-Z]{0,3}\$)/);
            if (currMatch) currency = currMatch[1].replace('$', '') || 'USD';
            price = parseNumber(priceToken);
          }
        }
      }
    }

    // Match "Price: CA$2,470.03 | Extracted: ..."
    const priceMatch = line.match(/Price:\s*([A-Z]{0,3}\$?[\d.,]+)\s*\|\s*Extracted:\s*(.+)/i);
    if (priceMatch) {
      const priceStr = priceMatch[1];
      const currMatch = priceStr.match(/^([A-Z]{0,3})\$/);
      if (currMatch && currMatch[1]) currency = currMatch[1];
      price = parseNumber(priceStr);
      extractedAt = priceMatch[2].trim();
    }

    // Match standalone "Price:" line
    if (!priceMatch) {
      const simplePriceMatch = line.match(/Price:\s*([A-Z]{0,3}\$?[\d.,]+)/i);
      if (simplePriceMatch) {
        const priceStr = simplePriceMatch[1];
        const currMatch = priceStr.match(/^([A-Z]{0,3})\$/);
        if (currMatch && currMatch[1]) currency = currMatch[1];
        price = parseNumber(priceStr);
      }
      const extractMatch = line.match(/Extracted:\s*(.+)/i);
      if (extractMatch) extractedAt = extractMatch[1].trim();
    }

    // Match "Period: annual | Sections: 7"
    const periodMatch = line.match(/Period:\s*(\w+)/i);
    if (periodMatch) period = periodMatch[1];
  }

  return { ticker, companyName, price, currency, extractedAt, period };
}

/**
 * Parse a markdown table into rows of data.
 * Returns periods (column headers) and data rows.
 */
export function parseMarkdownTable(tableLines: string[]): {
  periods: string[];
  rows: FinancialRow[];
} {
  // Find the header row (first row with | separators)
  const headerIdx = tableLines.findIndex((l) => l.trim().startsWith('|'));
  if (headerIdx === -1) return { periods: [], rows: [] };

  const headerLine = tableLines[headerIdx];
  const headers = headerLine
    .split('|')
    .map((h) => h.trim())
    .filter(Boolean);

  // First header is the label column, rest are periods
  const periods = headers
    .slice(1)
    .map((h) => h.replace(/\\?\|/g, '').replace(/TIKR\.com/gi, '').trim())
    .filter(Boolean);

  // Skip the separator row (---) and parse data rows
  const dataRows: FinancialRow[] = [];
  for (let i = headerIdx + 1; i < tableLines.length; i++) {
    const line = tableLines[i].trim();
    if (!line.startsWith('|')) continue;
    // Skip separator rows
    if (/^\|[\s-:|]+\|$/.test(line)) continue;
    if (/^[\s|:-]+$/.test(line)) continue;

    // Handle trailing empty from split
    const rawCells = line.split('|');
    const trimmedCells: string[] = [];
    for (let j = 1; j < rawCells.length; j++) {
      trimmedCells.push(rawCells[j].trim());
    }
    // Remove trailing empty cell if line ends with |
    if (line.endsWith('|') && trimmedCells.length > 0 && trimmedCells[trimmedCells.length - 1] === '') {
      trimmedCells.pop();
    }

    if (trimmedCells.length === 0) continue;

    const label = (trimmedCells[0] ?? '')
      .replace(/\\?\|/g, '')
      .replace(/TIKR\.com/gi, '')
      .trim();

    if (!label) continue;
    // Skip section header labels that are just categories
    if (label.endsWith(':') && trimmedCells.slice(1).every((c) => !c.trim())) continue;

    const values: Record<string, CellValue> = {};
    for (let p = 0; p < periods.length; p++) {
      const cellRaw = trimmedCells[p + 1] ?? '';
      values[periods[p]] = parseNumber(cellRaw);
    }

    dataRows.push({ label, values });
  }

  return { periods, rows: dataRows };
}

/**
 * Normalise a section heading into a SectionKey.
 */
function normaliseSectionHeading(heading: string): SectionKey | null {
  const lower = heading.toLowerCase().trim();
  // Direct match
  if (SECTION_HEADING_MAP[lower]) return SECTION_HEADING_MAP[lower];
  // Partial match
  for (const [key, val] of Object.entries(SECTION_HEADING_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

/**
 * Split markdown text into sections by ## headings.
 */
function splitSections(text: string): Array<{ heading: string; body: string }> {
  const sections: Array<{ heading: string; body: string }> = [];
  const lines = text.split('\n');
  let currentHeading = '';
  let currentBody: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      if (currentHeading) {
        sections.push({ heading: currentHeading, body: currentBody.join('\n') });
      }
      currentHeading = headingMatch[1].trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  if (currentHeading) {
    sections.push({ heading: currentHeading, body: currentBody.join('\n') });
  }

  return sections;
}

/**
 * Main entry point: parse a full TIKR markdown document into structured data.
 */
export function parseFinancialMarkdown(markdown: string): ParsedFinancials {
  // Split off the header (everything before first ##)
  const firstSectionIdx = markdown.indexOf('\n##');
  const headerText = firstSectionIdx >= 0 ? markdown.slice(0, firstSectionIdx) : markdown;
  const header = parseHeader(headerText);

  const rawSections = splitSections(markdown);
  const sections: Record<string, FinancialSection> = {};

  for (const { heading, body } of rawSections) {
    const sectionKey = normaliseSectionHeading(heading);
    if (!sectionKey) continue;

    const tableLines = body.split('\n').filter((l) => l.trim().startsWith('|') || /^\|[\s-:|]+\|$/.test(l.trim()));
    if (tableLines.length === 0) continue;

    const { periods, rows } = parseMarkdownTable(tableLines);
    if (periods.length === 0) continue;

    sections[sectionKey] = {
      name: heading,
      periods,
      rows,
    };
  }

  return { header, sections };
}

/**
 * Utility: look up a row value by label (case-insensitive partial match).
 */
export function findRow(section: FinancialSection | undefined, ...labelPatterns: string[]): FinancialRow | undefined {
  if (!section) return undefined;
  for (const pattern of labelPatterns) {
    const lower = pattern.toLowerCase();
    const row = section.rows.find((r) => r.label.toLowerCase().includes(lower));
    if (row) return row;
  }
  return undefined;
}

/**
 * Utility: look up a row by canonical metric key using alias matching.
 */
export function findRowByMetricKey(section: FinancialSection | undefined, metricKey: MetricKey): FinancialRow | undefined {
  if (!section) return undefined;
  return section.rows.find((row) => matchMetricKeyFromLabel(row.label) === metricKey);
}

/**
 * Get the value of a row for a specific period.
 */
export function getRowValue(
  section: FinancialSection | undefined,
  period: string,
  ...labelPatterns: string[]
): number | null {
  const row = findRow(section, ...labelPatterns);
  if (!row) return null;
  return row.values[period] ?? null;
}
