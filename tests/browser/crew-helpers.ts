import { expect, type Page } from '@playwright/test';

/** The selected crew member's id, as saved on the device. */
export const savedCrewId = (page: Page) => page.evaluate(() => new Promise<string>(resolve => {
  const open = indexedDB.open('ghostpilot-mission');
  open.onsuccess = () => {
    const db = open.result;
    const request = db.transaction('mission').objectStore('mission').get('state');
    request.onsuccess = () => { db.close(); resolve(request.result?.crewId ?? ''); };
  };
}));

/** A new crew member with nothing recorded yet, selected and saved, on the Body page. */
export async function freshMember(page: Page, path = '/#body') {
  await page.goto(path);
  await page.locator('.crew-switch-btn').click();
  await page.getByRole('button', { name: 'Add crew member', exact: true }).click();
  await page.getByRole('dialog', { name: 'Edit profile' }).getByRole('button', { name: 'Done', exact: true }).click();
  // Tests that seed the database write to whoever is saved as selected, so wait for the new member to be saved.
  await expect.poll(() => savedCrewId(page)).toMatch(/^crew-(?!alex$|jordan$|mei$|diego$)/);
}
