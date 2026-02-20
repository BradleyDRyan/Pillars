const admin = require('firebase-admin');
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      : undefined
});

let firebaseAdmin;

const initializeFirebase = () => {
  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  const hasIndividualCreds = Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );

  const hasServiceAccountJson = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);

  if (hasIndividualCreds && hasServiceAccountJson) {
    logger.warn(
      'Both FIREBASE_SERVICE_ACCOUNT and individual credential variables detected. Using individual credentials.'
    );
  }

  let initMode = 'default-credentials';

  try {
    if (hasIndividualCreds) {
      initMode = 'individual-credentials';
      // Sanitize env vars - remove any accidental whitespace/newlines
      const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
      const serviceAccount = {
        projectId,
        clientEmail,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        storageBucket:
          process.env.FIREBASE_STORAGE_BUCKET || 'squirrel-2.firebasestorage.app'
      });
    } else if (hasServiceAccountJson) {
      initMode = 'service-account-json';
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        storageBucket:
          process.env.FIREBASE_STORAGE_BUCKET || 'squirrel-2.firebasestorage.app'
      });
    } else {
      initMode = 'default-app';
      admin.initializeApp({
        storageBucket:
          process.env.FIREBASE_STORAGE_BUCKET || 'squirrel-2.firebasestorage.app'
      });
    }
  } catch (error) {
    logger.error({ err: error, initMode }, 'Failed to initialize Firebase Admin');
    throw error;
  }

  firebaseAdmin = admin;

  const app = firebaseAdmin.app();
  const rawOptions = app.options || {};
  const credential = rawOptions.credential;
  const projectId =
    rawOptions.projectId ||
    credential?.projectId ||
    credential?.cert?.projectId ||
    credential?.tenantId;

  const info = {
    initMode,
    projectId: projectId || null,
    databaseURL: rawOptions.databaseURL || null,
    storageBucket: rawOptions.storageBucket || null,
    clientEmail: credential?.clientEmail || null
  };

  logger.info(info, 'Firebase Admin initialized');

  if (!projectId) {
    logger.warn(
      'Firebase Admin projectId is missing. Ensure the correct credentials are provided.'
    );
  }

  return firebaseAdmin;
};

const firebaseInstance = initializeFirebase();
const firestoreDb = firebaseInstance.firestore();

module.exports = {
  admin: firebaseInstance,
  auth: firebaseInstance.auth(),
  firestore: firestoreDb,
  db: firestoreDb, // alias for convenience
  FieldValue: firebaseInstance.firestore.FieldValue,
  logger
};
