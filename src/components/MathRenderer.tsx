/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import katex from 'katex';
import DOMPurify from 'dompurify';
import {
  getCachedSignedUrl,
  transformEmbeddedHtmlImages
} from '../services/imageService';
import { QuestionBankImageItem } from '../types';

export interface MathRendererProps {
  text?: string | null;
  html?: string | null;
  className?: string;
  as?: 'div' | 'span' | 'p';
  images?: QuestionBankImageItem[] | null;
  questionCode?: string;
  isOption?: boolean;
}

/**
 * Configure DOMPurify to allow MathML, SVG, and KaTeX visual structures safely.
 */
function sanitizeTrustedHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  if (typeof window === 'undefined') return rawHtml;

  return DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true, mathMl: true, svg: true },
    ADD_TAGS: [
      'math', 'semantics', 'annotation', 'annotation-xml', 'mrow', 'mn', 'mi', 'mo', 'ms',
      'mspace', 'mover', 'munder', 'munderover', 'msup', 'msub', 'msubsup', 'mfrac',
      'mroot', 'msqrt', 'mtable', 'mtr', 'mtd', 'img'
    ],
    ADD_ATTR: [
      'aria-hidden', 'xmlns', 'viewBox', 'preserveAspectRatio', 'encoding',
      'mathvariant', 'display', 'class', 'style', 'loading', 'decoding',
      'src', 'alt', 'width', 'height', 'referrerpolicy'
    ]
  });
}

/**
 * Processes inline image tags to replace raw Wegenz URLs with signed URLs if available,
 * or removes unresolvable inline question images so QuestionImage can handle them cleanly.
 */
function cleanInlineImages(html: string, isOption: boolean = false): string {
  if (!html) return '';

  return html.replace(/<img([^>]*)src=["']([^"']+)["']([^>]*)>/gi, (match, before, src, after) => {
    // If it is already a signed URL or data URL, leave intact
    if (src.includes('/storage/v1/object/sign/') || src.startsWith('data:')) {
      return match;
    }

    // Try resolving from cache
    const cachedSigned = getCachedSignedUrl(src);
    if (cachedSigned) {
      return `<img${before}src="${cachedSigned}"${after}>`;
    }

    // For options, if not signed yet, keep structure without breaking
    if (isOption) {
      return match;
    }

    // In question body, remove the raw unresolvable img tag because QuestionImage
    // is rendered dedicatedly with caption, zoom, and fallback state below the question text.
    // This prevents the browser from showing a broken image icon with raw filename alt text.
    if (src.includes('/figures/') || src.includes('/neet/') || src.includes('/jee/') || src.startsWith('images/')) {
      return '';
    }

    return match;
  });
}

/**
 * Renders trusted question HTML.
 * If HTML is already compiled with KaTeX/MathML, sanitizes and returns.
 * If it contains raw LaTeX delimiters without KaTeX markup, compiles them.
 */
export function renderTrustedQuestionHtml(rawHtml: string): string {
  if (!rawHtml || !rawHtml.trim()) return '';

  const cleanedHtml = cleanInlineImages(rawHtml, false);

  // If already contains compiled KaTeX or MathML markup, do not mangle it
  if (cleanedHtml.includes('class="katex"') || cleanedHtml.includes('<math')) {
    return sanitizeTrustedHtml(cleanedHtml);
  }

  // Otherwise, compile any embedded LaTeX delimiters
  const compiled = renderLatexInHtmlSnippet(cleanedHtml);
  return sanitizeTrustedHtml(compiled);
}

/**
 * Renders trusted option HTML.
 */
export function renderTrustedOptionHtml(rawHtml: string): string {
  if (!rawHtml || !rawHtml.trim()) return '';

  const cleanedHtml = cleanInlineImages(rawHtml, true);

  if (cleanedHtml.includes('class="katex"') || cleanedHtml.includes('<math')) {
    return sanitizeTrustedHtml(cleanedHtml);
  }

  const compiled = renderLatexInHtmlSnippet(cleanedHtml);
  return sanitizeTrustedHtml(compiled);
}

/**
 * Primary single-source renderer for trusted HTML content.
 */
export function renderTrustedHtml(rawHtml: string): string {
  return renderTrustedQuestionHtml(rawHtml);
}

/**
 * Parses and renders LaTeX expressions inside plain text strings using KaTeX.
 * Used ONLY when HTML representation is absent.
 */
export function renderMathText(rawText: string): string {
  if (!rawText || !rawText.trim()) return '';

  const trimmed = rawText.trim();
  // If the whole string is a bare LaTeX formula without explicit delimiters
  if (
    !trimmed.includes('$') &&
    !trimmed.includes('\\(') &&
    !trimmed.includes('\\[') &&
    (trimmed.startsWith('\\') ||
      trimmed.includes('\\sqrt') ||
      trimmed.includes('\\frac') ||
      trimmed.includes('\\mathrm') ||
      trimmed.includes('\\times'))
  ) {
    try {
      const rendered = katex.renderToString(trimmed, {
        displayMode: false,
        throwOnError: false,
        output: 'htmlAndMathml'
      });
      return sanitizeTrustedHtml(rendered);
    } catch {
      // Fall through to regex delimiter matching
    }
  }

  // Escape HTML characters before converting math delimiters to ensure safety
  const escaped = escapeHtml(rawText);

  // Regex to match block math $$...$$, \[...\], and inline math $...$, \(...\)
  const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\$\n]+?\$|\\\([\s\S]+?\\\))/g;

  const result = escaped.replace(regex, (match) => {
    let formula = '';
    let isBlock = false;

    if (match.startsWith('$$') && match.endsWith('$$')) {
      formula = unescapeHtml(match.slice(2, -2).trim());
      isBlock = true;
    } else if (match.startsWith('\\[') && match.endsWith('\\]')) {
      formula = unescapeHtml(match.slice(2, -2).trim());
      isBlock = true;
    } else if (match.startsWith('\\(') && match.endsWith('\\)')) {
      formula = unescapeHtml(match.slice(2, -2).trim());
      isBlock = false;
    } else if (match.startsWith('$') && match.endsWith('$')) {
      formula = unescapeHtml(match.slice(1, -1).trim());
      isBlock = false;
    } else {
      formula = unescapeHtml(match);
    }

    try {
      return katex.renderToString(formula, {
        displayMode: isBlock,
        throwOnError: false,
        output: 'htmlAndMathml'
      });
    } catch {
      return match;
    }
  });

  return sanitizeTrustedHtml(result);
}

/**
 * Helper to compile raw LaTeX delimiters inside an HTML snippet
 */
function renderLatexInHtmlSnippet(html: string): string {
  const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\$\n<]+?\$|\\\([\s\S]+?\\\))/g;

  return html.replace(regex, (match) => {
    let formula = '';
    let isBlock = false;

    if (match.startsWith('$$') && match.endsWith('$$')) {
      formula = match.slice(2, -2).trim();
      isBlock = true;
    } else if (match.startsWith('\\[') && match.endsWith('\\]')) {
      formula = match.slice(2, -2).trim();
      isBlock = true;
    } else if (match.startsWith('\\(') && match.endsWith('\\)')) {
      formula = match.slice(2, -2).trim();
      isBlock = false;
    } else if (match.startsWith('$') && match.endsWith('$')) {
      formula = match.slice(1, -1).trim();
      isBlock = false;
    } else {
      formula = match;
    }

    try {
      return katex.renderToString(formula, {
        displayMode: isBlock,
        throwOnError: false,
        output: 'htmlAndMathml'
      });
    } catch {
      return match;
    }
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function unescapeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

/**
 * Unified Component: exactly ONE content rendering path.
 * If html is provided and non-empty: renders html ONLY.
 * Otherwise renders text through math renderer.
 * Never renders both.
 */
export const MathRenderer: React.FC<MathRendererProps> = ({
  text,
  html,
  className = '',
  as = 'div',
  images,
  questionCode,
  isOption = false
}) => {
  const [asyncHtml, setAsyncHtml] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (html && html.includes('<img')) {
      transformEmbeddedHtmlImages(html, images, questionCode, isOption).then((transformed) => {
        if (active) {
          setAsyncHtml(transformed);
        }
      });
    } else {
      setAsyncHtml(null);
    }
    return () => {
      active = false;
    };
  }, [html, images, questionCode, isOption]);

  const content = useMemo(() => {
    const effectiveHtml = asyncHtml !== null ? asyncHtml : html;

    // 1. Primary path: if html is present and non-empty, render HTML ONLY
    if (effectiveHtml && effectiveHtml.trim()) {
      return isOption
        ? renderTrustedOptionHtml(effectiveHtml)
        : renderTrustedQuestionHtml(effectiveHtml);
    }

    // 2. Pure text fallback path: when html does NOT exist
    if (text && text.trim()) {
      return renderMathText(text);
    }

    return '';
  }, [asyncHtml, html, text, isOption]);

  const Component = as;

  return (
    <Component
      className={`math-content font-sans leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};
