const EMAIL = process.env.TEST_EMAIL || '';
const PASSWORD = process.env.TEST_PASSWORD || '';

if (!EMAIL || !PASSWORD) {
  console.warn('WARNING: TEST_EMAIL or TEST_PASSWORD not set — auth tests will fail');
}

// Unique per CI run so tests never collide with leftover data
const RUN_ID = process.env.GITHUB_RUN_ID || Date.now();
const TEST_PREFIX = `[TEST-${RUN_ID}]`;

async function login(page) {
  await page.goto('/');
  await page.waitForSelector('#auth-screen', { state: 'visible' });
  await page.fill('#auth-email', EMAIL);
  await page.fill('#auth-pw', PASSWORD);
  await page.click('#auth-btn');
  await page.waitForSelector('#auth-screen', { state: 'hidden', timeout: 15000 });
  await page.waitForSelector('#sidebar', { state: 'visible' });
}

module.exports = { login, EMAIL, PASSWORD, TEST_PREFIX };
