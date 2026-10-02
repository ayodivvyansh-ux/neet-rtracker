/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ParsedOptionDisplay {
  selectable: boolean;
  letter: 'A' | 'B' | 'C' | 'D' | null;
  displayText: string;
}

/**
 * Decodes escaped literal control markers in display text:
 * "¤¤" -> "¤"
 */
export function decodeLiteralControlMarkers(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/¤¤/g, '¤');
}

/**
 * Escapes literal "¤" characters in source text for storage/importer:
 * "¤" -> "¤¤"
 */
export function escapeLiteralControlMarkers(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/¤+/g, (match) => {
    if (match.length % 2 !== 0) {
      return match + '¤';
    }
    return match;
  });
}

/**
 * Master Option Display Parser using the Reserved Control Marker Protocol (`¤`).
 *
 * SELECTABLE syntax rule:
 * Must begin with EXACTLY ONE leading '¤' followed immediately by [a-d] or [1-4],
 * e.g., "¤a. Thrombin", "¤b) Renin", "¤c (A), (C) and (D)", "¤d. Something"
 *
 * NON-SELECTABLE strings:
 * - "¤¤a. Literal text starting with double marker" (Escaped literal)
 * - "a. Statement without marker"
 * - "A. Statement one"
 *
 * FALLBACK BEHAVIOR:
 * NO marker = NOT selectable. There is zero fallback selectability based on key position or option layout.
 */
export function parseOptionDisplay(text: string): ParsedOptionDisplay {
  if (!text || typeof text !== 'string') {
    return {
      selectable: false,
      letter: null,
      displayText: ''
    };
  }

  const trimmed = text.trim();

  // Check if string starts with "¤¤" (Escaped literal, NOT a selectable marker!)
  if (trimmed.startsWith('¤¤')) {
    return {
      selectable: false,
      letter: null,
      displayText: decodeLiteralControlMarkers(trimmed)
    };
  }

  // Check if string starts with exactly one "¤" followed by option prefix Syntax:
  const SELECTABLE_REGEX = /^¤\s*([a-dA-D1-4])\s*[\.\)\:]?\s*/;
  const match = SELECTABLE_REGEX.exec(trimmed);

  if (!match) {
    // Does NOT begin with exact reserved marker syntax -> NOT SELECTABLE
    return {
      selectable: false,
      letter: null,
      displayText: decodeLiteralControlMarkers(trimmed)
    };
  }

  // Found single '¤' marker + option prefix!
  const rawChar = match[1].toUpperCase();
  let letter: 'A' | 'B' | 'C' | 'D' | null = null;
  if (rawChar === 'A' || rawChar === '1') letter = 'A';
  else if (rawChar === 'B' || rawChar === '2') letter = 'B';
  else if (rawChar === 'C' || rawChar === '3') letter = 'C';
  else if (rawChar === 'D' || rawChar === '4') letter = 'D';

  // Strip leading marker and prefix (e.g. "¤a. ")
  const rawDisplayText = trimmed.substring(match[0].length);

  // Decode any remaining escaped "¤¤" -> "¤"
  const cleanDisplayText = decodeLiteralControlMarkers(rawDisplayText);

  return {
    selectable: true,
    letter,
    displayText: cleanDisplayText
  };
}
