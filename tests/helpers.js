/**
 * Shared helpers for Playwright tests.
 * Credentials come from env vars set as GitHub Secrets:
 *   TEST_EMAIL, TEST_PASSWORD
 */

const EMAIL = process.env.TEST_EMAIL || '';
const PASSWORD = process.env.TEST_PASSWORD || '';

if (!EMAIL || !PASSWORD) {
  console.warn('WARNING: TEST_EMAIL or TEST_PASSWORD not set — auth tests will fail');
}

/**
 * Log in and wait for the app to fully load (sidebar visible, sync dot green).
 */
async function login(page) {
  await page.goto('/');
  await page.waitForSelector('#auth-screen', { state: 'visible' });
  await page.fill('#auth-email', EMAIL);
  await page.fill('#auth-pw', PASSWORD);
  await page.click('#auth-btn');
  // Wait for auth screen to disappear and sidebar to appear
  await page.waitForSelector('#auth-screen', { state: 'hidden', timeout: 15000 });
  await page.waitForSelector('#sidebar', { state: 'visible' });
}

module.exports = { login, EMAIL, PASSWORD };
