import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import http from 'http';
import apiRouter from '../src/server/routes/api.js';

test('HomeHub — Complete Autopilot Removal Verification Suite', async (t) => {
  const rootDir = process.cwd();

  // 1. Filesystem Verification: Autopilot-exclusive files are completely eradicated
  await t.test('Autopilot-exclusive files do not exist on filesystem', () => {
    const eradicatedFiles = [
      path.join(rootDir, 'src', 'pages', 'AutopilotWorkspace.tsx'),
      path.join(rootDir, 'src', 'server', 'routes', 'autopilot.ts'),
      path.join(rootDir, 'src', 'server', 'services', 'ai-autopilot.ts'),
      path.join(rootDir, 'src', 'server', 'repositories', 'ai-autopilot.ts'),
      path.join(rootDir, 'src', 'server', 'services', 'ai-policy.ts'),
      path.join(rootDir, 'src', 'types', 'ai-autopilot.ts'),
    ];

    for (const filePath of eradicatedFiles) {
      assert.strictEqual(
        fs.existsSync(filePath),
        false,
        `File ${path.relative(rootDir, filePath)} must be deleted from filesystem`
      );
    }
  });

  // 2. Navigation and UI Verification: Layout and Owner Workspace clean of Autopilot entry points
  await t.test('Layout.tsx and OwnerWorkspace.tsx have zero active Autopilot entry points', () => {
    const layoutContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'Layout.tsx'), 'utf-8');
    assert.strictEqual(
      layoutContent.includes('/workspace/autopilot'),
      false,
      'Layout.tsx must not contain any link to /workspace/autopilot'
    );

    const ownerContent = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'OwnerWorkspace.tsx'), 'utf-8');
    assert.strictEqual(
      ownerContent.includes('/workspace/autopilot'),
      false,
      'OwnerWorkspace.tsx must not contain any button or link to /workspace/autopilot'
    );
    assert.strictEqual(
      ownerContent.includes('AI Autopilot Active'),
      false,
      'OwnerWorkspace.tsx must not display "AI Autopilot Active"'
    );
  });

  // 3. Routing Verification: App.tsx redirects /workspace/autopilot to home
  await t.test('App.tsx cleanly redirects /workspace/autopilot to root', () => {
    const appContent = fs.readFileSync(path.join(rootDir, 'src', 'App.tsx'), 'utf-8');
    assert.strictEqual(
      appContent.includes('AutopilotWorkspacePage'),
      false,
      'App.tsx must not import or render AutopilotWorkspacePage'
    );
    assert.match(
      appContent,
      /<Route path="workspace\/autopilot" element=\{<Navigate to="\/" replace \/>\} \/>/,
      'App.tsx must redirect workspace/autopilot to /'
    );
  });

  // 4. API Endpoints Verification: All /api/autopilot routes are non-existent (404)
  await t.test('All /api/autopilot routes return 404 (Unmounted and Non-Existent)', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', apiRouter);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}/api`;

    try {
      const endpoints = [
        { method: 'GET', path: '/autopilot' },
        { method: 'GET', path: '/autopilot/actions' },
        { method: 'POST', path: '/autopilot/actions/propose' },
        { method: 'POST', path: '/autopilot/actions/execute-auto' },
        { method: 'GET', path: '/autopilot/policy' },
        { method: 'PUT', path: '/autopilot/policy' },
      ];

      for (const ep of endpoints) {
        const res = await fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: { 'Content-Type': 'application/json' },
          body: ep.method === 'POST' ? JSON.stringify({}) : undefined,
        });

        assert.strictEqual(
          res.status,
          404,
          `Endpoint ${ep.method} ${ep.path} must return 404 Not Found, got ${res.status}`
        );
      }
    } finally {
      server.close();
    }
  });

  // 5. Preserved Features Verification: Agent AI Co-Pilot and Vendor AI Co-Pilot remain intact
  await t.test('Agent and Vendor AI Co-Pilot features remain 100% intact and unaffected', () => {
    const agentRouterContent = fs.readFileSync(path.join(rootDir, 'src', 'server', 'routes', 'agent.ts'), 'utf-8');
    assert.match(
      agentRouterContent,
      /\/ai\/assist/,
      'Agent router must preserve AI Assistant Co-Pilot endpoint (/ai/assist)'
    );

    const agentServiceContent = fs.readFileSync(path.join(rootDir, 'src', 'server', 'services', 'agent.ts'), 'utf-8');
    assert.match(
      agentServiceContent,
      /processAiQuery/,
      'Agent service must preserve processAiQuery method'
    );

    const vendorRouterContent = fs.readFileSync(path.join(rootDir, 'src', 'server', 'routes', 'vendor.ts'), 'utf-8');
    assert.match(
      vendorRouterContent,
      /\/ai\/assist/,
      'Vendor router must preserve AI Assistant Co-Pilot endpoint (/ai/assist)'
    );

    const vendorServiceContent = fs.readFileSync(path.join(rootDir, 'src', 'server', 'services', 'vendor.ts'), 'utf-8');
    assert.match(
      vendorServiceContent,
      /processAiQuery/,
      'Vendor service must preserve processAiQuery method'
    );
  });
});
