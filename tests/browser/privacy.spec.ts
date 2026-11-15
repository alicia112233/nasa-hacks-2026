import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const recordingDate = '2026-01-02T03:04:05.000Z';

async function expectCrew(page: Page, name: string) {
  await page.goto('/#body');
  await expect(page.locator('.crew-switch-btn')).toContainText(name);
  await page.goto('/#sources');
}

async function seedPersonalData(page: Page) {
  await page.goto('/#sources');
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
        state.crew = state.crew.map((c: { id: string }) => c.id === state.crewId ? state.profile : c);
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
        resolve({ name: state.result.profile.name, personal: state.result.checkIns.filter((c: { id: string }) => c.id === 'personal-check').length,
          actions: state.result.actions.length, packets: state.result.packets.length, videos: videos.result });
      };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
}

test('confirmed deletion removes videos, pose data, profiles and records across reloads, and restores the sample crew', async ({ page }) => {
  await seedPersonalData(page);
  await page.getByRole('button', { name: 'Delete all records' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await storedPersonalData(page)).toMatchObject({ name: 'Private Crew', personal: 1, videos: 1 });
  await page.getByRole('button', { name: 'Delete all records' }).click();
  await page.getByRole('button', { name: 'Delete everything', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'All records deleted. Sample crew restored.' })).toBeVisible();
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
  await page.getByRole('button', { name: 'Delete all records' }).click();
  await page.getByRole('button', { name: 'Delete everything', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not delete the records');
  expect(await storedPersonalData(page)).toMatchObject({ name: 'Private Crew', personal: 1, actions: 2, packets: 2, videos: 1 });
  await page.reload();
  await expectCrew(page, 'Private Crew');
});

test('a crew member\'s report carries their own recordings and never another member\'s', async ({ page }) => {
  await seedPersonalData(page);
  // The seeded handoff fixtures have no display fields and are irrelevant to this export.
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
  await page.getByRole('link', { name: 'Report', exact: true }).click();
  const downloadReport = async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Markdown', exact: true }).click()]);
    return readFile((await download.path())!, 'utf8');
  };
  const own = await downloadReport();
  expect(own).toContain('Personal records on this device');
  expect(own).toContain(recordingDate);
  expect(own).toContain('123°');
  await page.locator('.crew-switch-btn').click();
  await page.getByRole('list', { name: 'Crew' }).getByRole('button', { name: /Jordan Lee/ }).click();
  const other = await downloadReport();
  expect(other).not.toContain(recordingDate);
  expect(other).not.toContain('123°');
});
