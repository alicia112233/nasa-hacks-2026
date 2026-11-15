import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const recordingDate = '2026-01-02T03:04:05.000Z';

async function expectCrew(page: Page, name: string) {
  await page.goto('/#body');
  await expect(page.locator('.crew-switch-btn')).toContainText(name);
  await page.goto('/#mission');
}

async function seedPersonalData(page: Page) {
  await page.goto('/#mission');
  await expect(page.getByRole('heading', { name: 'Data' })).toBeVisible();
  await page.evaluate(date => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('ghostpilot-mission');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['mission', 'recordings'], 'readwrite');
      const store = tx.objectStore('mission');
      const request = store.get('state');
      request.onsuccess = () => {
        const state = request.result;
        state.profile = { ...state.profile, name: 'Private Crew', heightCm: 181, massKg: 81 };
        state.checkIns.push({ ...state.checkIns[0], id: 'personal-check', simulated: false });
        state.actions = [false, true].map(simulated => ({
          id: `action-${simulated}`, simulated, title: 'Private follow-up', notes: 'Private note',
          kind: 'attention', checklist: [], createdAt: date, scheduledAt: date, status: 'scheduled',
        }));
        state.packets = [false, true].map(simulated => ({
          id: `packet-${simulated}`, source: simulated ? 'simulated' : 'recorded', context: 'Private note',
        }));
        store.put(state, 'state');
        tx.objectStore('recordings').put({
          id: 'personal-video', date, sol: 9, blob: new Blob(['private video'], { type: 'video/webm' }),
          frames: [], leftRange: 123, rightRange: 127,
        });
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), recordingDate);
  await page.reload();
  await expectCrew(page, 'Private Crew');
}

async function storedPersonalData(page: Page) {
  return page.evaluate(() => new Promise<{ name: string; personal: number; actions: number; packets: number; videos: number }>((resolve, reject) => {
    const open = indexedDB.open('ghostpilot-mission');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['mission', 'recordings']);
      const state = tx.objectStore('mission').get('state');
      const videos = tx.objectStore('recordings').count();
      tx.oncomplete = () => {
        db.close();
        resolve({ name: state.result.profile.name, personal: state.result.checkIns.filter((c: { simulated: boolean }) => !c.simulated).length,
          actions: state.result.actions.length, packets: state.result.packets.length, videos: videos.result });
      };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
}

test('confirmed deletion removes videos, pose data, profile and personal records across reloads', async ({ page }) => {
  await seedPersonalData(page);
  await page.getByRole('button', { name: 'Clear personal records' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await storedPersonalData(page)).toMatchObject({ name: 'Private Crew', personal: 1, videos: 1 });
  await page.getByRole('button', { name: 'Clear personal records' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Personal records, videos and profile cleared.' })).toBeVisible();
  await expectCrew(page, 'Alex Morgan');
  const cleared = { name: 'Alex Morgan', personal: 0, actions: 0, packets: 0, videos: 0 };
  expect(await storedPersonalData(page)).toEqual(cleared);
  await page.reload();
  await expectCrew(page, 'Alex Morgan');
  expect(await storedPersonalData(page)).toEqual(cleared);
});

test('an aborted deletion preserves records and reports failure', async ({ page }) => {
  await seedPersonalData(page);
  await page.evaluate(() => {
    const clear = IDBObjectStore.prototype.clear;
    IDBObjectStore.prototype.clear = function () {
      const request = clear.call(this);
      if (this.name === 'recordings') this.transaction.abort();
      return request;
    };
  });
  await page.getByRole('button', { name: 'Clear personal records' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not delete personal records');
  expect(await storedPersonalData(page)).toMatchObject({ name: 'Private Crew', personal: 1, actions: 2, packets: 2, videos: 1 });
  await page.reload();
  await expectCrew(page, 'Private Crew');
});

test('demo reports and movement views exclude personal recordings while personal reports retain them', async ({ page }) => {
  await seedPersonalData(page);
  // The seeded handoff fixtures are irrelevant to this export and have no display fields.
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('ghostpilot-mission');
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('mission', 'readwrite');
      const store = tx.objectStore('mission');
      const request = store.get('state');
      request.onsuccess = () => store.put({ ...request.result, packets: [] }, 'state');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
    open.onerror = () => reject(open.error);
  }));
  await page.reload();
  await page.getByRole('link', { name: 'Handoff', exact: true }).click();
  const downloadReport = async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Markdown', exact: true }).click()]);
    return readFile((await download.path())!, 'utf8');
  };
  const demo = await downloadReport();
  expect(demo).toContain('SIMULATED DEMO');
  expect(demo).not.toContain(recordingDate);
  expect(demo).not.toContain('123°');
  await page.getByRole('link', { name: 'Body', exact: true }).click();
  await page.getByRole('button', { name: /^E Arms/ }).click();
  await page.getByRole('button', { name: /Shoulder range/ }).click();
  await page.getByRole('button', { name: 'Compare movement', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Synthetic movement example.', { exact: false })).toBeVisible();
  await expect(page.locator('.gaussian-stage')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Mission', exact: true }).click();
  await page.getByRole('button', { name: 'My records', exact: true }).click();
  await page.getByRole('link', { name: 'Handoff', exact: true }).click();
  const personal = await downloadReport();
  expect(personal).toContain('Personal records on this device');
  expect(personal).toContain(recordingDate);
  expect(personal).toContain('123°');
});
