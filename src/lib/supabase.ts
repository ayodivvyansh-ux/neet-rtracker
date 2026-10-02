/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Access VITE_ environment variables using static dot notation required by Vite bundler
const getSupabaseUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) {
    return import.meta.env.VITE_SUPABASE_URL;
  }
  const globalObj = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
  if (globalObj.process?.env?.VITE_SUPABASE_URL) {
    return globalObj.process.env.VITE_SUPABASE_URL;
  }
  return '';
};

const getSupabaseAnonKey = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
      return import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    }
    if (import.meta.env.VITE_SUPABASE_ANON_KEY) {
      return import.meta.env.VITE_SUPABASE_ANON_KEY;
    }
  }
  const globalObj = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
  if (globalObj.process?.env?.VITE_SUPABASE_PUBLISHABLE_KEY) {
    return globalObj.process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  }
  if (globalObj.process?.env?.VITE_SUPABASE_ANON_KEY) {
    return globalObj.process.env.VITE_SUPABASE_ANON_KEY;
  }
  return '';
};

const rawUrl = getSupabaseUrl();
const rawKey = getSupabaseAnonKey();

export const supabaseUrl = (rawUrl || '').trim();
export const supabaseAnonKey = (rawKey || '').trim();

export interface SupabaseConfigDiagnostics {
  isConfigured: boolean;
  hasUrl: boolean;
  hasKey: boolean;
  urlIsPlaceholder: boolean;
  keyIsPlaceholder: boolean;
  statusMessage: string;
}

export const getSupabaseConfigDiagnostics = (): SupabaseConfigDiagnostics => {
  const hasUrl = Boolean(supabaseUrl && supabaseUrl.length > 0);
  const hasKey = Boolean(supabaseAnonKey && supabaseAnonKey.length > 0);
  const urlIsPlaceholder =
    supabaseUrl.includes('your-project.supabase.co') ||
    supabaseUrl.includes('placeholder.supabase.co');
  const keyIsPlaceholder =
    supabaseAnonKey === 'your-anon-publishable-key' ||
    supabaseAnonKey === 'placeholder-anon-key';

  const isConfigured = hasUrl && hasKey && !urlIsPlaceholder && !keyIsPlaceholder;

  let statusMessage = 'Supabase environment configured.';
  if (!hasUrl && !hasKey) {
    statusMessage = 'Missing both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY environment variables.';
  } else if (!hasUrl) {
    statusMessage = 'Missing VITE_SUPABASE_URL environment variable.';
  } else if (!hasKey) {
    statusMessage = 'Missing VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) environment variable.';
  } else if (urlIsPlaceholder || keyIsPlaceholder) {
    statusMessage = 'Environment contains placeholder Supabase credentials.';
  }

  return {
    isConfigured,
    hasUrl,
    hasKey,
    urlIsPlaceholder,
    keyIsPlaceholder,
    statusMessage
  };
};

export const isSupabaseConfigured = (): boolean => {
  return getSupabaseConfigDiagnostics().isConfigured;
};

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (clientInstance) {
    return clientInstance;
  }

  const diagnostics = getSupabaseConfigDiagnostics();

  if (!diagnostics.isConfigured) {
    console.warn(`[Supabase Environment Diagnostics] ${diagnostics.statusMessage}`);
    clientInstance = createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-anon-key',
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      }
    );
    return clientInstance;
  }

  clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  return clientInstance;
}

export const supabase = getSupabaseClient();
