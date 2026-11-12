import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Only these deliberate messages may cross the connector boundary.
export class ConnectorError extends Error {}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]):\d+$/;

function setting(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || !value.trim()) throw new ConnectorError(`Missing setting: ${name}.`);
  return value;
}

export function readSettings(env = process.env) {
  const email = setting(env, 'WORKBENCH_OWNER_EMAIL').trim().toLowerCase();
  if (env.FIRESTORE_EMULATOR_HOST !== undefined || env.FIREBASE_AUTH_EMULATOR_HOST !== undefined) {
    for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
      if (!LOCAL_HOST.test(setting(env, name))) throw new ConnectorError(`Invalid setting: ${name}. Use a local emulator.`);
    }
    return { email, projectId: 'demo-workspace' };
  }
  const encoded = setting(env, 'FIREBASE_SERVICE_ACCOUNT');
  try {
    const account = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    if (!account.project_id || !account.client_email || !account.private_key) throw new Error();
    return { email, projectId: account.project_id, credential: cert(account) };
  } catch {
    throw new ConnectorError('Invalid setting: FIREBASE_SERVICE_ACCOUNT. Use base64-encoded service-account JSON.');
  }
}

let app, workbench;

// The identity is resolved once per warm instance. A failed lookup may be retried.
export function getWorkbench(settings) {
  if (!workbench) {
    workbench = (async () => {
      app ||= initializeApp({ projectId: settings.projectId, ...(settings.credential && { credential: settings.credential }) }, 'workbench-mcp');
      const db = getFirestore(app);
      const auth = getAuth(app);
      return { db, auth, owner: await findOwner(auth, settings.email) };
    })().catch(error => {
      workbench = undefined;
      throw error;
    });
  }
  return workbench;
}

async function findOwner(auth, email) {
  try {
    const user = await auth.getUserByEmail(email);
    if (user.disabled) throw new Error();
    return { uid: user.uid, name: user.displayName || 'Workbench owner' };
  } catch {
    throw new ConnectorError('Could not resolve WORKBENCH_OWNER_EMAIL. Check the setting and the owner account.');
  }
}
