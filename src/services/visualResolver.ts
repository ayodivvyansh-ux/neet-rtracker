/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { QuestionVisual, QuestionImage } from '../types';

export interface ResolvedVisualState {
  imageUrl: string | null;
  loading: boolean;
  error: boolean;
}

export function extractVisualStorageDetails(
  visualObj: QuestionVisual | QuestionImage | null | undefined
): {
  bucket: string;
  storagePath: string | null;
  dataUrl: string | null;
  hasVisual: boolean;
} {
  if (!visualObj) {
    return { bucket: 'neet-source-pdfs', storagePath: null, dataUrl: null, hasVisual: false };
  }

  const v = visualObj as any;

  if (v.hasVisual === false || v.has_visual === false) {
    return { bucket: 'neet-source-pdfs', storagePath: null, dataUrl: null, hasVisual: false };
  }

  const bucket = v.storage_bucket || v.storageBucket || 'neet-source-pdfs';
  const storagePath = v.storage_path || v.storagePath || v.imagePath || v.image_path || null;
  const dataUrl = v.data_url || v.dataUrl || null;

  const hasVisual = Boolean(
    v.hasVisual ||
      v.has_visual ||
      storagePath ||
      dataUrl ||
      v.structuredTable ||
      (v.options && v.options.length > 0)
  );

  return { bucket, storagePath, dataUrl, hasVisual };
}

/**
 * Custom hook to securely resolve private Supabase Storage signed URLs or fallback data URLs.
 * Priority:
 * 1. storage_path -> supabase.storage.from(bucket).createSignedUrl(storage_path, 3600)
 * 2. data_url -> inline base64 data URL
 * 3. Error state if resolution fails or asset is missing
 */
export function useResolvedVisualUrl(
  visualObj: QuestionVisual | QuestionImage | null | undefined
): ResolvedVisualState {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  const details = extractVisualStorageDetails(visualObj);

  useEffect(() => {
    let cancelled = false;

    async function resolveVisual() {
      setImageUrl(null);
      setError(false);

      if (!details.hasVisual && !details.storagePath && !details.dataUrl) {
        setLoading(false);
        return;
      }

      // Priority A: Storage Path -> createSignedUrl()
      if (details.storagePath) {
        if (
          details.storagePath.startsWith('http://') ||
          details.storagePath.startsWith('https://') ||
          details.storagePath.startsWith('data:')
        ) {
          setImageUrl(details.storagePath);
          setLoading(false);
          return;
        }

        setLoading(true);

        try {
          const { data, error: signedErr } = await supabase.storage
            .from(details.bucket)
            .createSignedUrl(details.storagePath, 3600);

          if (cancelled) return;

          setLoading(false);

          if (signedErr || !data?.signedUrl) {
            console.warn(
              `[VisualResolver] Signed URL error for bucket "${details.bucket}" path "${details.storagePath}":`,
              signedErr?.message
            );
            setError(true);
            return;
          }

          setImageUrl(data.signedUrl);
          return;
        } catch (err: any) {
          if (cancelled) return;
          console.error('[VisualResolver] Exception creating signed URL:', err);
          setLoading(false);
          setError(true);
          return;
        }
      }

      // Priority B: Data URL
      if (details.dataUrl) {
        setImageUrl(details.dataUrl);
        setLoading(false);
        return;
      }

      setError(true);
    }

    resolveVisual();

    return () => {
      cancelled = true;
    };
  }, [
    details.hasVisual,
    details.bucket,
    details.storagePath,
    details.dataUrl
  ]);

  return { imageUrl, loading, error };
}
