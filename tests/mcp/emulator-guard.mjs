const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]):\d+$/;

export function assertEmulatorEnv(env = process.env) {
  for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    if (!LOCAL.test(env[name] || '')) throw new Error(`${name} must name a local emulator. Run npm run test:mcp.`);
  }
  const projects = [env.GCLOUD_PROJECT, env.GOOGLE_CLOUD_PROJECT].filter(Boolean);
  if (!projects.length || projects.some(project => !/^demo-\S+$/.test(project))) {
    throw new Error('The MCP tests require a demo- project. Run npm run test:mcp.');
  }
}
