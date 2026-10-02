/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const PORT = 3000;
const supabaseUrl = (process.env.VITE_SUPABASE_URL || 'https://pgesdqfpaujhalithcfw.supabase.co').trim();
const supabaseAnonKey = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_e7NfwQaV0Dg0MNu_PgHxbQ').trim();

interface CachedChapter {
  chapter_slug: string;
  chapter_name: string;
  display_name: string;
  subject: string;
  count: number;
}

let chaptersCache: {
  data: CachedChapter[];
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

async function computeDistinctChapters(): Promise<CachedChapter[]> {
  const supabaseServerClient = createClient(supabaseUrl, supabaseAnonKey);
  const subjects = ['PHYSICS', 'CHEMISTRY', 'BOTANY', 'ZOOLOGY'];
  
  const fetchSubjectRows = async (subj: string) => {
    const pageSize = 1000;
    const { count } = await supabaseServerClient
      .from('question_bank')
      .select('*', { count: 'exact', head: true })
      .ilike('subject', `%${subj}%`);
    const pages = Math.ceil((count || 1000) / pageSize);
    const promises = Array.from({ length: pages }, (_, i) =>
      supabaseServerClient
        .from('question_bank')
        .select('chapter_slug, chapter_name, subject')
        .ilike('subject', `%${subj}%`)
        .range(i * pageSize, (i + 1) * pageSize - 1)
    );
    const res = await Promise.all(promises);
    return res.flatMap(r => r.data || []);
  };

  const allSubjResults = await Promise.all(subjects.map(fetchSubjectRows));
  const allRows = allSubjResults.flat();

  const map = new Map<string, CachedChapter>();
  for (const item of allRows) {
    const slug = item.chapter_slug || item.chapter_name?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'general';
    const rawName = item.chapter_name || slug.replace(/_/g, ' ');
    let subj = item.subject || 'General';
    if (slug === 'biomolecules-b') subj = 'Biology';

    let displayName = rawName;
    const normSlug = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normSubj = subj.toLowerCase();

    if (
      normSlug === 'biomoleculesb' ||
      (normSlug === 'biomolecules' && (normSubj.includes('botany') || normSubj.includes('zoology') || normSubj.includes('bio'))) ||
      (normName === 'biomolecules' && (normSubj.includes('botany') || normSubj.includes('zoology') || normSubj.includes('bio')))
    ) {
      displayName = 'Biomolecules (Bio)';
    } else if (
      normSlug === 'biomolecules' ||
      normName === 'biomolecules' ||
      normName.includes('biomolecules')
    ) {
      displayName = 'Biomolecules (Chem)';
    }

    const key = `${subj}::${slug}`;
    if (!map.has(key)) {
      map.set(key, {
        chapter_slug: slug,
        chapter_name: rawName,
        display_name: displayName,
        subject: subj,
        count: 1
      });
    } else {
      map.get(key)!.count++;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.display_name.localeCompare(b.display_name));
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // 1. Lightweight Distinct Chapters API with in-memory caching
  app.get('/api/chapters', async (_req, res) => {
    try {
      const now = Date.now();
      if (chaptersCache && now - chaptersCache.timestamp < CACHE_TTL_MS) {
        return res.json({ chapters: chaptersCache.data, cached: true });
      }

      const freshChapters = await computeDistinctChapters();
      chaptersCache = {
        data: freshChapters,
        timestamp: now
      };
      return res.json({ chapters: freshChapters, cached: false });
    } catch (err: any) {
      console.error('[API /api/chapters] Error computing chapters:', err);
      if (chaptersCache) {
        return res.json({ chapters: chaptersCache.data, cached: true, warning: 'Serving stale cache' });
      }
      return res.status(500).json({ error: err.message || 'Failed to fetch chapters' });
    }
  });

  // 2. Secure Server-Side Admin Bootstrap Endpoint
  app.post('/api/admin/bootstrap', async (req, res) => {
    const { serviceRoleKey, password } = req.body;
    if (!serviceRoleKey || !password) {
      return res.status(400).json({ error: 'Missing serviceRoleKey or password' });
    }

    try {
      const adminClient = createClient(supabaseUrl, serviceRoleKey.trim(), {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      console.log(`[Bootstrap] Fetching user list...`);
      const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
      if (listError) {
        return res.status(500).json({ error: `Supabase Auth Admin API failed: ${listError.message}` });
      }

      const existingUser = users.find(u => u.email === 'admin@zenengram.app');
      
      if (existingUser) {
        console.log(`[Bootstrap] Updating existing admin user...`);
        const { error: updateError } = await adminClient.auth.admin.updateUserById(existingUser.id, {
          password: password,
          app_metadata: { role: 'admin' },
          user_metadata: { role: 'admin' },
          email_confirm: true
        });
        if (updateError) {
          return res.status(500).json({ error: `Failed to update user role metadata: ${updateError.message}` });
        }
        return res.json({ message: 'Success! Existing admin user has been promoted and password updated successfully.' });
      } else {
        console.log(`[Bootstrap] Creating brand new admin user...`);
        const { error: createError } = await adminClient.auth.admin.createUser({
          email: 'admin@zenengram.app',
          password: password,
          email_confirm: true,
          app_metadata: { role: 'admin' },
          user_metadata: { role: 'admin' }
        });
        if (createError) {
          return res.status(500).json({ error: `Failed to create secure admin user: ${createError.message}` });
        }
        return res.json({ message: 'Success! New admin user (admin@zenengram.app) created with strict role metadata.' });
      }
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Internal server error occurred.' });
    }
  });

  // 2. Initialize Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });

  // Use Vite's connect instance as middleware
  app.use(vite.middlewares);

  // 3. Fallback to serve index.html for Single Page Application client-side routing
  app.use(async (req, res, next) => {
    const url = req.originalUrl;
    try {
      // Always read the fresh index.html template
      let template = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
      
      // Transform index.html with Vite HMR
      template = await vite.transformIndexHtml(url, template);
      
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  app.listen(PORT, () => {
    console.log(`[CBT Simulator Server] Secure backend running at http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
