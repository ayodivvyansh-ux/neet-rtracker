/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, supabaseUrl } from '../lib/supabase';
import { QuestionBankImageItem } from '../types';

// Cache temporarily disabled during development verification as requested
const ENABLE_CACHE = false;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export interface ImageResolutionResult {
  url: string | null;
  source: 'signed_storage' | 'legacy_data' | 'public_url' | 'unavailable' | 'error';
  error?: string | null;
  rawResult?: any;
}

/**
 * Normalizes an image path or URL to its base filename for identity matching.
 */
export function getImageBasename(urlOrPath: string): string {
  if (!urlOrPath) return '';
  const clean = decodeURIComponent(urlOrPath).trim().split('?')[0].split('#')[0];
  const parts = clean.split('/');
  return parts[parts.length - 1] || clean;
}

/**
 * Extracts base filename without file extension (e.g. "img_08857" from "img_08857.webp" or "img_08857.png").
 */
export function getImageStem(urlOrPath: string): string {
  const base = getImageBasename(urlOrPath);
  return base.replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase();
}

/**
 * Extracts all possible matching identity keys for an image item.
 */
export function extractImageIdentifiers(
  item: string | QuestionBankImageItem | null | undefined
): string[] {
  if (!item) return [];

  const ids = new Set<string>();

  const addVariants = (val?: string | null) => {
    if (!val || typeof val !== 'string') return;
    const trimmed = val.trim();
    if (!trimmed) return;
    ids.add(trimmed);
    ids.add(trimmed.toLowerCase());
    const base = getImageBasename(trimmed);
    if (base) {
      ids.add(base);
      ids.add(base.toLowerCase());
    }
    const stem = getImageStem(trimmed);
    if (stem) {
      ids.add(stem);
    }
    const stripped = trimmed.replace(/^\/+/, '');
    ids.add(stripped);
    ids.add(stripped.toLowerCase());
  };

  if (typeof item === 'string') {
    addVariants(item);
    return Array.from(ids);
  }

  addVariants(item.source_original_url);
  addVariants(item.original_url);
  addVariants(item.source_local_path);
  addVariants(item.local_path);
  addVariants(item.storage_path);
  addVariants(item.storagePath);
  addVariants(item.caption);
  addVariants(item.alt_text);
  if (item.id) ids.add(item.id);

  return Array.from(ids).filter(Boolean);
}

/**
 * Checks if a given URL or identifier matches a question image item.
 */
export function matchesImage(
  targetUrlOrIdentifier: string,
  imageItem: QuestionBankImageItem
): boolean {
  if (!targetUrlOrIdentifier || !imageItem) return false;

  const targetBasename = getImageBasename(targetUrlOrIdentifier).toLowerCase();
  const targetStem = getImageStem(targetUrlOrIdentifier);
  const targetClean = targetUrlOrIdentifier.trim().replace(/^\/+/, '').toLowerCase();

  const itemIdentifiers = extractImageIdentifiers(imageItem);
  for (const id of itemIdentifiers) {
    const idLower = id.toLowerCase();
    const idBasename = getImageBasename(id).toLowerCase();
    const idStem = getImageStem(id);

    if (
      targetClean === idLower ||
      targetBasename === idBasename ||
      (targetStem && idStem && targetStem === idStem) ||
      targetClean.endsWith(idLower) ||
      idLower.endsWith(targetClean) ||
      targetClean.includes(idBasename) ||
      idLower.includes(targetBasename)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Finds a matching image item from an array of question image metadata.
 */
export function findMatchingImage(
  srcOrFilename: string,
  images?: QuestionBankImageItem[] | null
): QuestionBankImageItem | null {
  if (!srcOrFilename || !images || images.length === 0) return null;

  for (const img of images) {
    if (matchesImage(srcOrFilename, img)) {
      return img;
    }
  }

  return null;
}

/**
 * Detects all image sources and filenames embedded directly inside HTML.
 */
export function detectEmbeddedImageIdentifiers(html?: string | null): Set<string> {
  const result = new Set<string>();
  if (!html || typeof html !== 'string') return result;

  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (src && !src.startsWith('data:')) {
      result.add(src);
      result.add(src.toLowerCase());
      const base = getImageBasename(src);
      result.add(base);
      result.add(base.toLowerCase());
      const stem = getImageStem(src);
      if (stem) result.add(stem);
      result.add(src.replace(/^\/+/, ''));
    }
  }

  // Also check for alt tags containing filenames
  const altRegex = /<img[^>]+alt=["']([^"']+)["'][^>]*>/gi;
  while ((match = altRegex.exec(html)) !== null) {
    const alt = match[1];
    if (alt) {
      result.add(alt);
      result.add(alt.toLowerCase());
      const base = getImageBasename(alt);
      result.add(base);
      result.add(base.toLowerCase());
      const stem = getImageStem(alt);
      if (stem) result.add(stem);
    }
  }

  return result;
}

/**
 * Filters question images to only standalone diagrams that are NOT already embedded in question_html or option_html.
 * Prevents duplicate rendering of the same visual asset.
 */
export function getStandaloneQuestionImages(
  images?: QuestionBankImageItem[] | null,
  questionHtml?: string | null,
  options?: any[] | null
): QuestionBankImageItem[] {
  if (!images || images.length === 0) return [];

  const allHtmlParts = [questionHtml || ''];
  if (options && Array.isArray(options)) {
    for (const opt of options) {
      if (typeof opt === 'string') {
        allHtmlParts.push(opt);
      } else if (opt && typeof opt === 'object') {
        allHtmlParts.push(opt.option_html || opt.optionHtml || opt.option_text || opt.optionText || '');
      }
    }
  }

  const combinedHtml = allHtmlParts.join(' ');
  const embedded = detectEmbeddedImageIdentifiers(combinedHtml);
  if (embedded.size === 0) return images;

  return images.filter((img) => {
    const ids = extractImageIdentifiers(img);
    for (const id of ids) {
      if (
        embedded.has(id) ||
        embedded.has(id.toLowerCase()) ||
        embedded.has(getImageBasename(id)) ||
        embedded.has(getImageBasename(id).toLowerCase()) ||
        embedded.has(getImageStem(id))
      ) {
        // Already embedded in HTML statement or option!
        return false;
      }
    }
    return true;
  });
}

/**
 * Checks cache for a previously resolved signed URL.
 */
export function getCachedSignedUrl(key: string): string | null {
  if (!ENABLE_CACHE || !key) return null;
  const cleanKey = key.trim();
  const cached = signedUrlCache.get(cleanKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  const stripped = cleanKey.replace(/^\/+/, '');
  const cachedStripped = signedUrlCache.get(stripped);
  if (cachedStripped && cachedStripped.expiresAt > Date.now()) {
    return cachedStripped.url;
  }
  return null;
}

/**
 * Stores a signed URL in memory cache ONLY when generated directly by Supabase createSignedUrl.
 */
export function cacheSignedUrl(
  url: string,
  primaryKey: string,
  aliasKeys: string[] = []
): void {
  if (!ENABLE_CACHE || !url || !url.includes('token=')) return;
  const expiresAt = Date.now() + 50 * 60 * 1000; // 50 mins
  signedUrlCache.set(primaryKey, { url, expiresAt });
  signedUrlCache.set(primaryKey.replace(/^\/+/, ''), { url, expiresAt });

  for (const alias of aliasKeys) {
    if (alias) {
      signedUrlCache.set(alias, { url, expiresAt });
      signedUrlCache.set(alias.replace(/^\/+/, ''), { url, expiresAt });
      signedUrlCache.set(getImageBasename(alias), { url, expiresAt });
    }
  }
}

/**
 * Core image resolution function: Single source of truth.
 *
 * Priority:
 * 1. Private Supabase Storage asset:
 *    if storage_bucket exists, storage_path exists, and is_available === true
 *    -> createSignedUrl() -> render signed URL
 * 2. Legacy data_url
 * 3. No valid source -> null / error state (NEVER fabricated fake URLs)
 */
export async function resolveQuestionImage(
  imageItem: string | QuestionBankImageItem | null | undefined,
  contextQuestionCode?: string
): Promise<ImageResolutionResult> {
  if (!imageItem) {
    return { url: null, source: 'unavailable', error: 'No image specified' };
  }

  // Handle direct string input
  if (typeof imageItem === 'string') {
    if (imageItem.startsWith('data:')) {
      return { url: imageItem, source: 'legacy_data' };
    }
    if (imageItem.includes('/storage/v1/object/sign/')) {
      return { url: imageItem, source: 'signed_storage' };
    }
    // Check if string matches a cached signed URL
    const cached = getCachedSignedUrl(imageItem);
    if (cached) {
      return { url: cached, source: 'signed_storage' };
    }
    // If it is a raw Wegenz URL, do not use it as the final image src
    if (imageItem.includes('/figures/') || imageItem.includes('/neet/') || imageItem.includes('/jee/')) {
      return { url: null, source: 'unavailable', error: 'Unresolved source original URL' };
    }
    // Assume string is a storage path
    return resolveQuestionImage({
      storage_bucket: 'neet-source-pdfs',
      storage_path: imageItem,
      question_code: contextQuestionCode
    });
  }

  const questionCode = imageItem.question_code || imageItem.questionCode || contextQuestionCode || 'UNKNOWN';
  const storageBucket = imageItem.storage_bucket || imageItem.storageBucket || 'neet-source-pdfs';
  const storagePath = imageItem.storage_path || imageItem.storagePath;
  const isAvailable = imageItem.is_available ?? imageItem.isAvailable ?? Boolean(storagePath);

  // Check if image object already has a verified signed URL with a real token
  if (imageItem.url && imageItem.url.includes('/storage/v1/object/sign/') && imageItem.url.includes('token=')) {
    return { url: imageItem.url, source: 'signed_storage' };
  }

  // 1. Priority A: Private Supabase Storage asset
  if (storagePath && isAvailable) {
    const cleanPath = storagePath.trim().replace(/^\/+/, '');
    const cacheKey = `${storageBucket}:${cleanPath}`;
    const cached = getCachedSignedUrl(cacheKey);

    if (cached) {
      console.log({
        questionCode,
        storageBucket,
        storagePath: cleanPath,
        createSignedUrlError: null,
        createSignedUrlData: { signedUrl: cached },
        currentUser: false,
        supabaseSignedUrlCreated: true,
        cacheHit: true,
        fallbackUsed: false
      });
      return { url: cached, source: 'signed_storage' };
    }

    let signedUrl: string | null = null;
    let resolverError: any = null;
    let createSignedUrlData: any = null;

    try {
      const { data, error } = await supabase.storage
        .from(storageBucket)
        .createSignedUrl(cleanPath, 3600);

      createSignedUrlData = data;
      if (data?.signedUrl) {
        signedUrl = data.signedUrl;
      } else if (error) {
        resolverError = error;
      }
    } catch (err: any) {
      resolverError = err;
    }

    let currentUser = false;
    try {
      const { data: authData } = await supabase.auth.getUser();
      currentUser = Boolean(authData?.user);
    } catch {
      currentUser = false;
    }

    const rawResult = signedUrl
      ? { signedUrl }
      : (resolverError ? { message: resolverError.message, status: resolverError.status, code: resolverError.code } : createSignedUrlData);

    console.log({
      questionCode,
      storageBucket,
      storagePath: cleanPath,
      createSignedUrlError: resolverError
        ? { message: resolverError.message, status: resolverError.status, code: resolverError.code }
        : null,
      createSignedUrlData,
      currentUser,
      supabaseSignedUrlCreated: Boolean(signedUrl),
      cacheHit: false,
      fallbackUsed: false
    });

    if (signedUrl) {
      cacheSignedUrl(signedUrl, cacheKey, [
        cleanPath,
        imageItem.source_original_url || '',
        imageItem.original_url || '',
        imageItem.local_path || '',
        imageItem.source_local_path || ''
      ]);
      return { url: signedUrl, source: 'signed_storage', rawResult };
    }

    // Strictly return error without fabricating fake unsigned URLs
    return {
      url: null,
      source: 'error',
      error: resolverError?.message || 'Storage object could not be signed',
      rawResult
    };
  }

  // 2. Priority B: Legacy data_url
  if (imageItem.data_url?.startsWith('data:')) {
    return { url: imageItem.data_url, source: 'legacy_data', rawResult: { data_url: true } };
  }
  if (imageItem.url?.startsWith('data:')) {
    return { url: imageItem.url, source: 'legacy_data', rawResult: { url: true } };
  }

  // Direct external HTTPS URL if provided (and not a local/wegenz source path)
  if (
    imageItem.url &&
    (imageItem.url.startsWith('https://') || imageItem.url.startsWith('http://')) &&
    !imageItem.url.includes('/neet/figures/') &&
    !imageItem.url.includes('/jee/figures/')
  ) {
    return { url: imageItem.url, source: 'public_url', rawResult: { public_url: imageItem.url } };
  }

  // 3. Priority C: Unavailable state (clean error, never raw Wegenz URLs)
  return { url: null, source: 'unavailable', error: 'No storage asset available', rawResult: null };
}

/**
 * Helper to escape HTML attributes safely.
 */
function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Helper to construct a responsive, aspect-ratio-preserving <img> tag.
 * - Width: min(100%, 680px) for statement diagrams, min(100%, 340px) for option diagrams
 * - Height: auto (never distorted or stretched)
 * - Max-height: 520px (statement) / 220px (option)
 * - Object-fit: contain (no cropping)
 */
function buildResponsiveImgTag(
  signedUrl: string,
  altText: string,
  isOption: boolean
): string {
  if (isOption) {
    return `<img src="${signedUrl}" alt="${escapeHtmlAttr(altText || 'Option diagram')}" loading="lazy" decoding="async" class="object-contain my-1.5 rounded border border-slate-200 bg-white p-1 shadow-xs" style="max-width: min(100%, 340px); max-height: 220px; height: auto; object-fit: contain;" />`;
  }

  return `<img src="${signedUrl}" alt="${escapeHtmlAttr(altText || 'Question diagram')}" loading="lazy" decoding="async" class="w-auto max-w-full max-h-[520px] object-contain block mx-auto my-3 rounded-xl border border-slate-200 bg-white p-2 shadow-xs transition-transform hover:scale-[1.005]" style="width: min(100%, 680px); height: auto; max-height: 520px; object-fit: contain;" />`;
}

/**
 * Resolves all images embedded in an HTML string (such as question_html or option_html).
 * Replaces matching embedded <img src="..."> with the signed Supabase Storage URL.
 * Supports multiple embedded images independently and preserves exact ordering.
 *
 * Temporarily logs debug info according to instructions:
 * { questionCode, embeddedImageSrc, matchedImageId, storageBucket, storagePath, isAvailable, createSignedUrlResult, finalRenderedSrc }
 */
export async function transformEmbeddedHtmlImages(
  rawHtml: string | null | undefined,
  questionImages?: QuestionBankImageItem[] | null,
  questionCode: string = 'UNKNOWN',
  isOption: boolean = false
): Promise<string> {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  const imgTagRegex = /<img\b([^>]*?)>/gi;
  const srcAttrRegex = /\bsrc=["']([^"']+)["']/i;
  const altAttrRegex = /\balt=["']([^"']+)["']/i;

  const matches: { fullImgTag: string; src: string; alt: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = imgTagRegex.exec(rawHtml)) !== null) {
    const fullImgTag = m[0];
    const srcMatch = srcAttrRegex.exec(fullImgTag);
    if (srcMatch) {
      const altMatch = altAttrRegex.exec(fullImgTag);
      matches.push({
        fullImgTag,
        src: srcMatch[1],
        alt: altMatch ? altMatch[1] : '',
        index: m.index
      });
    }
  }

  if (matches.length === 0) {
    return rawHtml;
  }

  // Resolve each image independently in parallel
  const resolvedReplacements = await Promise.all(
    matches.map(async (item) => {
      const originalSrc = item.src;
      const originalAlt = item.alt;

      // If already a signed URL or data URL, preserve as-is with responsive tag
      if (originalSrc.includes('/storage/v1/object/sign/') || originalSrc.startsWith('data:')) {
        console.log({
          questionCode,
          embeddedImageSrc: originalSrc,
          matchedImageId: 'already_signed',
          storageBucket: 'direct',
          storagePath: 'direct',
          isAvailable: true,
          createSignedUrlResult: { signedUrl: originalSrc },
          finalRenderedSrc: originalSrc
        });
        const cleanTag = buildResponsiveImgTag(originalSrc, originalAlt, isOption);
        return {
          ...item,
          replacementTag: cleanTag
        };
      }

      // 1. Try cache first
      const cachedSigned = getCachedSignedUrl(originalSrc);
      if (cachedSigned) {
        console.log({
          questionCode,
          embeddedImageSrc: originalSrc,
          matchedImageId: 'cached',
          storageBucket: 'cached',
          storagePath: 'cached',
          isAvailable: true,
          createSignedUrlResult: { signedUrl: cachedSigned },
          finalRenderedSrc: cachedSigned
        });
        const cleanTag = buildResponsiveImgTag(cachedSigned, originalAlt, isOption);
        return {
          ...item,
          replacementTag: cleanTag
        };
      }

      // 2. Find matching image from metadata (using src, alt, and fallback if only 1 image exists)
      let matched = findMatchingImage(originalSrc, questionImages);
      if (!matched && originalAlt) {
        matched = findMatchingImage(originalAlt, questionImages);
      }
      if (!matched && questionImages && questionImages.length === 1 && !isOption) {
        matched = questionImages[0];
      }

      let res: ImageResolutionResult | null = null;
      if (matched) {
        res = await resolveQuestionImage(matched, questionCode);
      }

      console.log({
        questionCode,
        embeddedImageSrc: originalSrc,
        matchedImageId: matched ? (matched.id || 'matched') : null,
        storageBucket: matched?.storage_bucket || matched?.storageBucket || null,
        storagePath: matched?.storage_path || matched?.storagePath || null,
        isAvailable: matched ? (matched.is_available ?? matched.isAvailable ?? true) : false,
        createSignedUrlResult: res?.rawResult || (res?.url ? { signedUrl: res.url } : res?.error || null),
        finalRenderedSrc: res?.url || null
      });

      if (res?.url) {
        const cleanTag = buildResponsiveImgTag(res.url, originalAlt, isOption);
        return {
          ...item,
          replacementTag: cleanTag
        };
      }

      // 3. Fallback: if no valid signed URL could be generated, show explicit unavailable state for this specific image (DO NOT delete)
      if (isOption) {
        const fallbackOptionNotice = `<span class="inline-flex items-center space-x-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded"><span>[Diagram unavailable]</span></span>`;
        return {
          ...item,
          replacementTag: fallbackOptionNotice
        };
      }

      const basename = getImageBasename(originalSrc) || getImageBasename(originalAlt) || 'diagram';
      const fallbackNotice = `<div class="my-3 p-3.5 rounded-lg border border-amber-200 bg-amber-50/90 text-amber-800 text-xs flex items-center space-x-2.5 max-w-xl mx-auto shadow-xs"><svg class="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><span>Diagram unavailable (${escapeHtmlAttr(basename)})</span></div>`;

      return {
        ...item,
        replacementTag: fallbackNotice
      };
    })
  );

  // Replace from end to start by index to preserve exact positions
  let result = rawHtml;
  for (let i = resolvedReplacements.length - 1; i >= 0; i--) {
    const item = resolvedReplacements[i];
    result =
      result.slice(0, item.index) +
      item.replacementTag +
      result.slice(item.index + item.fullImgTag.length);
  }

  return result;
}

/**
 * Single source of truth convenience alias for resolving question image URL.
 */
export async function resolveQuestionImageUrl(
  imageItem: string | QuestionBankImageItem | null | undefined,
  contextQuestionCode?: string
): Promise<string | null> {
  const res = await resolveQuestionImage(imageItem, contextQuestionCode);
  return res.url;
}

