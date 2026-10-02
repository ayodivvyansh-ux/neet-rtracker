/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { resolveQuestionImage } from '../services/imageService';
import { QuestionBankImageItem } from '../types';
import { AlertCircle, Image as ImageIcon, Loader2, Maximize2, RefreshCw, X } from 'lucide-react';

interface QuestionImageProps {
  image: string | QuestionBankImageItem | null | undefined;
  alt?: string;
  className?: string;
  maxHeight?: string;
  questionCode?: string;
}

export const QuestionImage: React.FC<QuestionImageProps> = ({
  image,
  alt = 'Question diagram',
  className = '',
  maxHeight = 'max-h-[520px]',
  questionCode
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);

    if (!image) {
      setLoading(false);
      setResolvedUrl(null);
      return;
    }

    resolveQuestionImage(image, questionCode)
      .then((res) => {
        if (!isMounted) return;
        if (res.url) {
          setResolvedUrl(res.url);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setError(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [image, questionCode, retryCount]);

  if (!image) {
    return null;
  }

  const caption = typeof image === 'object' && image ? image.caption || image.alt_text : null;

  return (
    <>
      <div className={`relative my-3 rounded-lg border border-slate-200 bg-slate-50/70 p-2 overflow-hidden ${className}`}>
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            <span className="text-xs font-medium">Loading diagram...</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center bg-amber-50/50 rounded border border-amber-200 text-amber-800 space-y-2">
            <div className="flex items-center space-x-1.5 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Diagram asset could not be loaded</span>
            </div>
            <p className="text-[11px] text-amber-700/80 max-w-sm">
              The question diagram exists but could not be retrieved from the storage source.
            </p>
            <button
              onClick={() => {
                setLoading(true);
                setError(false);
                setRetryCount((c) => c + 1);
              }}
              className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium bg-white border border-amber-300 rounded shadow-xs hover:bg-amber-50 text-amber-900 transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {!loading && !error && resolvedUrl && (
          <div className="group relative flex flex-col items-center">
            <div className="relative overflow-hidden rounded bg-white max-w-full">
              <img
                src={resolvedUrl}
                alt={caption || alt}
                onError={() => setError(true)}
                referrerPolicy="no-referrer"
                style={{ width: 'min(100%, 680px)', height: 'auto', maxHeight: '520px', objectFit: 'contain' }}
                className={`w-auto ${maxHeight} object-contain mx-auto block cursor-pointer transition-transform hover:scale-[1.005]`}
                onClick={() => setModalOpen(true)}
              />
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="absolute top-2 right-2 p-1.5 bg-slate-900/70 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-900 shadow-sm"
                title="View full diagram"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {caption && (
              <span className="text-[11px] text-slate-500 font-medium mt-1.5 text-center">
                {caption}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Zoom Modal */}
      {modalOpen && resolvedUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-xl max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 bg-slate-50">
              <span className="text-xs font-semibold text-slate-700">
                {caption || alt || 'Diagram Preview'}
              </span>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center bg-slate-100">
              <img
                src={resolvedUrl}
                alt={caption || alt}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[75vh] object-contain block mx-auto bg-white rounded shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
