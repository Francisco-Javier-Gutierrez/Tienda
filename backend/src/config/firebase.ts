import { initializeApp, cert, App, ServiceAccount } from 'firebase-admin/app';
import { getMessaging as getAdminMessaging, Messaging } from 'firebase-admin/messaging';
import fs from 'fs';
import path from 'path';

let firebaseApp: App | null = null;

export function getFirebaseAdmin(): App | null {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    let credentialData: ServiceAccount | null = null;

    if (process.env.FCM_CREDENTIALS_JSON) {
      try {
        credentialData = JSON.parse(process.env.FCM_CREDENTIALS_JSON);
      } catch (err) {
        console.warn('[FCM] Error parseando FCM_CREDENTIALS_JSON desde variables de entorno:', err);
      }
    }

    if (!credentialData) {
      const credsPath = path.join(__dirname, 'fcm-credentials.json');
      if (fs.existsSync(credsPath)) {
        credentialData = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      }
    }

    if (credentialData) {
      firebaseApp = initializeApp({
        credential: cert(credentialData),
        projectId: credentialData.projectId || 'donapaty',
      });
      console.log('[FCM] Firebase Admin inicializado exitosamente.');
      return firebaseApp;
    } else {
      return null;
    }
  } catch (error) {
    console.error('[FCM] Error inicializando Firebase Admin:', error);
    return null;
  }
}

export function getMessaging(): Messaging | null {
  const app = getFirebaseAdmin();
  return app ? getAdminMessaging(app) : null;
}
