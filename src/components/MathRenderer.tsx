/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
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
      'mroot', 'msqrt', 'mtable', 'mtr', 'mtd', 'img', 'svg', 'path', 'span', 'div'
    ],
    ADD_ATTR: [
      'aria-hidden', 'xmlns', 'viewBox', 'preserveAspectRatio', 'encoding',
      'mathvariant', 'display', 'class', 'style', 'loading', 'decoding',
      'src', 'alt', 'width', 'height', 'referrerpolicy', 'd', 'fill', 'stroke',
      'stroke-width', 'stroke-linecap', 'stroke-linejoin'
    ]
  });
}

/**
 * Processes inline image tags during synchronous rendering.
 * - Leaves signed URLs and data URLs intact.
 * - Applies cached signed URLs if available.
 * - While asynchronous resolution is pending, renders a neutral loading placeholder
 *   so the browser does not attempt to fetch unresolvable raw source paths.
 * - NEVER deletes or strips image elements.
 */
function cleanInlineImages(html: string, isOption: boolean = false): string {
  if (!html) return '';

  return html.replace(/<img([^>]*)src=["']([^"']+)["']([^>]*)>/gi, (match, before, src, after) => {
    // If it is already a signed URL or data URL, leave intact
    if (src.includes('/storage/v1/object/sign/') || src.startsWith('data:')) {
      return match;
    }

    // Try resolving from cache if available
    const cachedSigned = getCachedSignedUrl(src);
    if (cachedSigned) {
      return `<img${before}src="${cachedSigned}"${after}>`;
    }

    // While asynchronous transformation is pending, show neutral loading placeholder
    if (
      src.includes('/figures/') ||
      src.includes('/neet/') ||
      src.includes('/jee/') ||
      src.startsWith('images/') ||
      src.includes('cdn.jsdelivr.net')
    ) {
      if (isOption) {
        return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-slate-400 font-sans">[Loading diagram...]</span>`;
      }
      return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 my-1.5 bg-slate-100/90 border border-slate-200 rounded text-xs text-slate-500 font-sans"><svg class="animate-spin w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Loading diagram...</span></span>`;
    }

    return match;
  });
}

/**
 * Renders trusted question HTML with KaTeX and MathML preservation.
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
 * Renders trusted option HTML with KaTeX and MathML preservation.
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
 * Unified Component: exactly ONE authoritative content rendering path.
 * If html is provided and non-empty: renders html with async image transformation.
 * If image resolution is pending, renders neutral loading state without deleting the image.
 * Uses a cancellation guard (currentKeyRef) to prevent races across question navigation.
 * Otherwise renders text through math renderer.
 */
export const MathRenderer: React.FC<MathRendererProps> = ({
  text,
  html,
  className = '',
  as = 'div',
  images,
  questionCode = 'UNKNOWN',
  isOption = false
}) => {
  const hasEmbeddedImg = Boolean(html && /<img\b[^>]*>/i.test(html));
  const [resolvedHtml, setResolvedHtml] = useState<string | null>(null);
  const currentKeyRef = useRef<string>('');

  useEffect(() => {
    const activeKey = `${questionCode}::${html || ''}`;
    currentKeyRef.current = activeKey;

    if (!html || !html.trim()) {
      setResolvedHtml(null);
      return;
    }

    if (!hasEmbeddedImg) {
      setResolvedHtml(null);
      return;
    }

    let isCurrent = true;
    transformEmbeddedHtmlImages(html, images, questionCode, isOption)
      .then((transformed) => {
        if (isCurrent && currentKeyRef.current === activeKey) {
          setResolvedHtml(transformed);
        }
      })
      .catch((err) => {
        console.warn('[MathRenderer] Image transform error:', err);
        if (isCurrent && currentKeyRef.current === activeKey) {
          setResolvedHtml(html);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [html, images, questionCode, isOption, hasEmbeddedImg]);

  const content = useMemo(() => {
    // 1. Primary path: HTML provided
    if (html && html.trim()) {
      // If we have an embedded image and resolution is ready, use resolvedHtml
      const htmlToRender = resolvedHtml !== null ? resolvedHtml : html;
      return isOption
        ? renderTrustedOptionHtml(htmlToRender)
        : renderTrustedQuestionHtml(htmlToRender);
    }

    // 2. Pure text fallback path: when html does NOT exist
    if (text && text.trim()) {
      return renderMathText(text);
    }

    return '';
  }, [html, resolvedHtml, text, isOption]);

  const Component = as;

  return (
    <Component
      className={`math-content font-sans leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};
