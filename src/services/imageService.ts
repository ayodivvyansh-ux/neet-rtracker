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
}

/**
 * Normalizes an image path or URL to its base filename for identity matching.
 */
export function getImageBasename(urlOrPath: string): string {
  if (!urlOrPath) return '';
  const clean = urlOrPath.trim().split('?')[0].split('#')[0];
  const parts = clean.split('/');
  return parts[parts.length - 1] || clean;
}

/**
 * Extracts all possible matching identity keys for an image item.
 */
export function extractImageIdentifiers(
  item: string | QuestionBankImageItem | null | undefined
): string[] {
  if (!item) return [];

  const ids = new Set<string>();

  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (trimmed) {
      ids.add(trimmed);
      ids.add(getImageBasename(trimmed));
      ids.add(trimmed.replace(/^\/+/, ''));
    }
    return Array.from(ids);
  }

  if (item.source_original_url) {
    ids.add(item.source_original_url);
    ids.add(getImageBasename(item.source_original_url));
    ids.add(item.source_original_url.replace(/^\/+/, ''));
  }

  if (item.original_url) {
    ids.add(item.original_url);
    ids.add(getImageBasename(item.original_url));
    ids.add(item.original_url.replace(/^\/+/, ''));
  }

  if (item.source_local_path) {
    ids.add(item.source_local_path);
    ids.add(getImageBasename(item.source_local_path));
  }

  if (item.local_path) {
    ids.add(item.local_path);
    ids.add(getImageBasename(item.local_path));
  }

  if (item.storage_path) {
    ids.add(item.storage_path);
    ids.add(getImageBasename(item.storage_path));
    ids.add(item.storage_path.replace(/^\/+/, ''));
  }

  if (item.storagePath) {
    ids.add(item.storagePath);
    ids.add(getImageBasename(item.storagePath));
    ids.add(item.storagePath.replace(/^\/+/, ''));
  }

  if (item.id) {
    ids.add(item.id);
  }

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
  const targetClean = targetUrlOrIdentifier.trim().replace(/^\/+/, '').toLowerCase();

  const itemIdentifiers = extractImageIdentifiers(imageItem);
  for (const id of itemIdentifiers) {
    const idLower = id.toLowerCase();
    const idBasename = getImageBasename(id).toLowerCase();

    if (
      targetClean === idLower ||
      targetBasename === idBasename ||
      targetClean.endsWith(idLower) ||
      idLower.endsWith(targetClean)
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
      result.add(getImageBasename(src));
      result.add(src.replace(/^\/+/, ''));
    }
  }

  // Also check for alt tags containing filenames
  const altRegex = /<img[^>]+alt=["']([^"']+)["'][^>]*>/gi;
  while ((match = altRegex.exec(html)) !== null) {
    const alt = match[1];
    if (alt && (alt.endsWith('.png') || alt.endsWith('.jpg') || alt.endsWith('.jpeg') || alt.endsWith('.webp') || alt.endsWith('.svg'))) {
      result.add(alt);
      result.add(getImageBasename(alt));
    }
  }

  return result;
}

/**
 * Filters question images to only standalone diagrams that are NOT already embedded in question_html.
 * Prevents duplicate rendering of the same visual asset.
 */
export function getStandaloneQuestionImages(
  images?: QuestionBankImageItem[] | null,
  questionHtml?: string | null
): QuestionBankImageItem[] {
  if (!images || images.length === 0) return [];
  if (!questionHtml) return images;

  const embedded = detectEmbeddedImageIdentifiers(questionHtml);
  if (embedded.size === 0) return images;

  return images.filter((img) => {
    const ids = extractImageIdentifiers(img);
    for (const id of ids) {
      if (embedded.has(id) || embedded.has(getImageBasename(id))) {
        // Already embedded in HTML statement!
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
      return { url: signedUrl, source: 'signed_storage' };
    }

    // Strictly return error without fabricating fake unsigned URLs
    return {
      url: null,
      source: 'error',
      error: resolverError?.message || 'Storage object could not be signed'
    };
  }

  // 2. Priority B: Legacy data_url
  if (imageItem.data_url?.startsWith('data:')) {
    return { url: imageItem.data_url, source: 'legacy_data' };
  }
  if (imageItem.url?.startsWith('data:')) {
    return { url: imageItem.url, source: 'legacy_data' };
  }

  // Direct external HTTPS URL if provided (and not a local/wegenz source path)
  if (
    imageItem.url &&
    (imageItem.url.startsWith('https://') || imageItem.url.startsWith('http://')) &&
    !imageItem.url.includes('/neet/figures/') &&
    !imageItem.url.includes('/jee/figures/')
  ) {
    return { url: imageItem.url, source: 'public_url' };
  }

  // 3. Priority C: Unavailable state (clean error, never raw Wegenz URLs)
  return { url: null, source: 'unavailable', error: 'No storage asset available' };
}

/**
 * Resolves all images embedded in an HTML string (such as question_html or option_html).
 * Replaces matching embedded <img src="..."> with the signed Supabase Storage URL.
 *
 * Temporarily logs debug info according to instructions:
 * { questionCode, embeddedImageSrc, matchedImageId, storageBucket, storagePath, isAvailable, signedUrlCreated, duplicateDetected, finalRenderedSrc }
 */
export async function transformEmbeddedHtmlImages(
  rawHtml: string | null | undefined,
  questionImages?: QuestionBankImageItem[] | null,
  questionCode: string = 'UNKNOWN',
  isOption: boolean = false
): Promise<string> {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  const imgTagRegex = /<img([^>]+)>/gi;
  const srcAttrRegex = /\bsrc=["']([^"']+)["']/i;

  let hasMatches = false;
  const promises: Promise<{ originalTag: string; replacementTag: string }>[] = [];

  // Match all <img> tags
  let match: RegExpExecArray | null;
  while ((match = imgTagRegex.exec(rawHtml)) !== null) {
    const fullImgTag = match[0];
    const srcMatch = srcAttrRegex.exec(fullImgTag);
    if (!srcMatch) continue;

    const originalSrc = srcMatch[1];
    hasMatches = true;

    promises.push(
      (async () => {
        // If already signed or data URL, preserve as-is
        if (originalSrc.includes('/storage/v1/object/sign/') || originalSrc.startsWith('data:')) {
          return { originalTag: fullImgTag, replacementTag: fullImgTag };
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
            signedUrlCreated: true,
            duplicateDetected: true,
            finalRenderedSrc: cachedSigned
          });
          return {
            originalTag: fullImgTag,
            replacementTag: fullImgTag.replace(srcMatch[0], `src="${cachedSigned}"`)
          };
        }

        // 2. Find matching image from metadata
        const matched = findMatchingImage(originalSrc, questionImages);

        if (matched) {
          const res = await resolveQuestionImage(matched, questionCode);

          console.log({
            questionCode,
            embeddedImageSrc: originalSrc,
            matchedImageId: matched.id || 'matched',
            storageBucket: matched.storage_bucket || 'neet-source-pdfs',
            storagePath: matched.storage_path || 'unknown',
            isAvailable: matched.is_available !== false,
            signedUrlCreated: Boolean(res.url),
            duplicateDetected: true,
            finalRenderedSrc: res.url
          });

          if (res.url) {
            return {
              originalTag: fullImgTag,
              replacementTag: fullImgTag.replace(srcMatch[0], `src="${res.url}"`)
            };
          }
        }

        // 3. Fallback: if no valid signed URL could be generated
        if (isOption) {
          // In options, do not render a broken 404 URL
          return { originalTag: fullImgTag, replacementTag: '' };
        }

        // In question statement, remove unresolvable img tag to prevent broken image icon + alt text
        console.log({
          questionCode,
          embeddedImageSrc: originalSrc,
          matchedImageId: null,
          storageBucket: null,
          storagePath: null,
          isAvailable: false,
          signedUrlCreated: false,
          duplicateDetected: false,
          finalRenderedSrc: null
        });

        return { originalTag: fullImgTag, replacementTag: '' };
      })()
    );
  }

  if (!hasMatches || promises.length === 0) {
    return rawHtml;
  }

  const replacements = await Promise.all(promises);
  let transformed = rawHtml;

  for (const { originalTag, replacementTag } of replacements) {
    transformed = transformed.replace(originalTag, replacementTag);
  }

  return transformed;
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

