const admin = require('firebase-admin');
const crypto = require('crypto');

function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function extractApiKey(req, bearerToken) {
  const headerApiKey = req.headers['x-api-key'];
  if (typeof headerApiKey === 'string' && headerApiKey.trim().length > 0) {
    return headerApiKey.trim();
  }

  // Allow API keys in Authorization: Bearer <api-key> for simpler agent integration.
  if (typeof bearerToken === 'string' && bearerToken.startsWith('plr_')) {
    return bearerToken;
  }

  return null;
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Middleware that accepts either:
 * 1. Regular Firebase ID tokens (from client apps)
 * 2. Custom tokens with service claims (from internal services)
 * 3. Service-to-service auth with shared secret
 * 4. User-specific API keys (x-api-key / Bearer plr_*)
 */
async function verifyServiceToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = extractBearerToken(authHeader);
    const apiKey = extractApiKey(req, bearerToken);

    if (!bearerToken && !apiKey) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    if (apiKey) {
      const hashedKey = hashApiKey(apiKey);
      const keySnapshot = await admin
        .firestore()
        .collection('users')
        .where('apiKey.hash', '==', hashedKey)
        .limit(1)
        .get();

      if (keySnapshot.empty) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      const keyDoc = keySnapshot.docs[0];
      const keyData = keyDoc.data();
      const nowIso = new Date().toISOString();

      const existingApiKey = keyData.apiKey && typeof keyData.apiKey === 'object'
        ? keyData.apiKey
        : {};

      await keyDoc.ref.set(
        {
          apiKey: {
            ...existingApiKey,
            lastUsedAt: nowIso
          }
        },
        { merge: true }
      );

      req.user = {
        uid: keyDoc.id,
        source: 'api-key',
        apiKeyPrefix: existingApiKey.prefix || null
      };
      return next();
    }

    if (!bearerToken) {
      return res.status(401).json({ error: 'No bearer token provided' });
    }

    // First try to verify as a regular Firebase ID token
    try {
      const decodedToken = await admin.auth().verifyIdToken(bearerToken);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        source: 'firebase'
      };
      return next();
    } catch (firebaseError) {
      // Not a valid Firebase ID token, try custom token verification
    }
    
    // Check if it's a service token (custom token with service claims)
    try {
      // For service-to-service calls, we use a custom token that includes
      // the userId and service identifier
      const decodedToken = await admin.auth().verifyIdToken(bearerToken, true);
      
      // Check if this is a service token
      if (decodedToken.service) {
        req.user = {
          uid: decodedToken.uid || decodedToken.sub,
          service: decodedToken.service,
          source: 'service'
        };
        return next();
      }
    } catch (customTokenError) {
      // Not a valid custom token either
    }
    
    // As a last resort, check for internal service secret
    // This is for server-to-server calls within our own infrastructure
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
    if (internalSecret && bearerToken === internalSecret) {
      // For internal service calls, we need to get the user ID from the request
      const userId = req.headers['x-user-id'] || req.body.userId;
      
      if (!userId) {
        return res.status(400).json({ 
          error: 'User ID required for service authentication' 
        });
      }
      
      req.user = {
        uid: userId,
        source: 'internal-service'
      };
      return next();
    }
    
    // None of the authentication methods worked
    return res.status(401).json({ 
      error: 'Invalid authentication token' 
    });
    
  } catch (error) {
    console.error('Service auth error:', error);
    return res.status(401).json({ 
      error: 'Authentication failed',
      details: error.message 
    });
  }
}

/**
 * Middleware for endpoints that should accept both user and service tokens
 */
async function flexibleAuth(req, res, next) {
  return verifyServiceToken(req, res, next);
}

module.exports = {
  verifyServiceToken,
  flexibleAuth
};
