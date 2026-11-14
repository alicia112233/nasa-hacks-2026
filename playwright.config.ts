import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--enable-webgl', '--use-angle=swiftshader'];

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  webServer: [
    { command: 'npm run dev -- --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
    { command: 'npm run preview -- --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    channel: 'chrome',
    viewport: { width: 1440, height: 1050 },
    timezoneId: 'Asia/Singapore',
    launchOptions: { args },
  },
  projects: [
    { name: 'app', testIgnore: /scan-video/ },
    // The webcam shows a Blender render of the reference body (scripts/calibrate-scan.mjs), so the scan runs end to end.
    { name: 'scan-video', testMatch: /scan-video/, use: { launchOptions: { args: [...args, `--use-file-for-fake-video-capture=${resolve('tests/fixtures/scan-reference.mjpeg')}`] } } },
  ],
});
