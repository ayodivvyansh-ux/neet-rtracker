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

async function startServer() {
  const app = express();
  app.use(express.json());

  // 1. Secure Server-Side Admin Bootstrap Endpoint
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
