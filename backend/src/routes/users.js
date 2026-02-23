const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { auth, firestore } = require('../config/firebase');
const { verifyToken, requireRole, requireVerifiedEmail } = require('../middleware/auth');

function generateApiKey() {
  return `plr_${crypto.randomBytes(32).toString('base64url')}`;
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function getApiKeyPrefix(apiKey) {
  return apiKey.slice(0, 12);
}

function normalizeFactsPayload(rawFacts) {
  if (rawFacts === undefined) {
    return { provided: false };
  }
  if (rawFacts === null) {
    return { provided: true, value: null };
  }
  const rawList = Array.isArray(rawFacts)
    ? rawFacts
    : (typeof rawFacts === 'string' ? rawFacts.split(/\r?\n/) : null);

  if (!rawList) {
    return { error: 'facts must be a string or array of strings' };
  }

  const normalized = [];
  const dedup = new Set();
  for (const item of rawList) {
    if (typeof item !== 'string') {
      return { error: 'facts must contain only strings' };
    }
    const value = item.trim().replace(/\s+/g, ' ');
    if (!value) {
      continue;
    }
    const capped = value.slice(0, 200);
    const dedupKey = capped.toLowerCase();
    if (dedup.has(dedupKey)) {
      continue;
    }
    dedup.add(dedupKey);
    normalized.push(capped);
    if (normalized.length >= 25) {
      break;
    }
  }

  return { provided: true, value: normalized };
}

router.get('/profile', verifyToken, async (req, res) => {
  try {
    const userRecord = await auth.getUser(req.user.uid);
    
    const userDoc = await firestore.collection('users').doc(req.user.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    res.json({
      uid: userRecord.uid,
      email: userRecord.email,
      emailVerified: userRecord.emailVerified,
      displayName: userRecord.displayName,
      photoURL: userRecord.photoURL,
      phoneNumber: userRecord.phoneNumber,
      disabled: userRecord.disabled,
      metadata: {
        creationTime: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime,
        lastRefreshTime: userRecord.metadata.lastRefreshTime
      },
      customClaims: userRecord.customClaims || {},
      profileData: userData
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { displayName, photoURL, phoneNumber, additionalData, facts } = req.body;
    
    const updateData = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (photoURL !== undefined) updateData.photoURL = photoURL;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    
    if (Object.keys(updateData).length > 0) {
      await auth.updateUser(req.user.uid, updateData);
    }
    
    const normalizedFacts = normalizeFactsPayload(facts);
    if (normalizedFacts.error) {
      return res.status(400).json({ error: normalizedFacts.error });
    }

    if (additionalData || normalizedFacts.provided) {
      const profilePayload = {
        updatedAt: new Date().toISOString()
      };
      if (additionalData && typeof additionalData === 'object' && !Array.isArray(additionalData)) {
        Object.assign(profilePayload, additionalData);
      }
      if (normalizedFacts.provided) {
        profilePayload.facts = normalizedFacts.value;
      }

      await firestore.collection('users').doc(req.user.uid).set(profilePayload, { merge: true });
    }
    
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

router.post('/verify-email', verifyToken, async (req, res) => {
  try {
    const link = await auth.generateEmailVerificationLink(req.user.email);
    
    res.json({ 
      success: true,
      message: 'Verification email link generated',
      link 
    });
  } catch (error) {
    console.error('Error generating verification link:', error);
    res.status(500).json({ error: 'Failed to generate verification link' });
  }
});

// Create or rotate API key for the current user.
// Returns plaintext key once so the client can copy/store it.
router.post('/api-key', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = getApiKeyPrefix(apiKey);
    const nowIso = new Date().toISOString();

    await firestore.collection('users').doc(userId).set(
      {
        apiKey: {
          hash: keyHash,
          prefix: keyPrefix,
          createdAt: nowIso,
          rotatedAt: nowIso,
          lastUsedAt: null
        },
        updatedAt: nowIso
      },
      { merge: true }
    );

    res.status(201).json({
      apiKey,
      keyPrefix,
      createdAt: nowIso
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// Return API key metadata (never returns plaintext key).
router.get('/api-key', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userDoc = await firestore.collection('users').doc(userId).get();
    const apiKeyData = userDoc.exists ? userDoc.data()?.apiKey : null;
    const hasKey = Boolean(apiKeyData?.hash);

    res.json({
      hasKey,
      keyPrefix: hasKey ? apiKeyData.prefix || null : null,
      createdAt: hasKey ? apiKeyData.createdAt || null : null,
      rotatedAt: hasKey ? apiKeyData.rotatedAt || null : null,
      lastUsedAt: hasKey ? apiKeyData.lastUsedAt || null : null
    });
  } catch (error) {
    console.error('Error fetching API key metadata:', error);
    res.status(500).json({ error: 'Failed to fetch API key metadata' });
  }
});

// Revoke API key for the current user.
router.delete('/api-key', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const nowIso = new Date().toISOString();

    await firestore.collection('users').doc(userId).set(
      {
        apiKey: {
          hash: null,
          prefix: null,
          createdAt: null,
          rotatedAt: null,
          lastUsedAt: null,
          revokedAt: nowIso
        },
        updatedAt: nowIso
      },
      { merge: true }
    );

    res.status(204).send();
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

router.post('/set-custom-claims', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { userId, claims } = req.body;
    
    if (!userId || !claims) {
      return res.status(400).json({ error: 'userId and claims are required' });
    }
    
    await auth.setCustomUserClaims(userId, claims);
    
    res.json({ 
      success: true,
      message: 'Custom claims set successfully',
      userId,
      claims
    });
  } catch (error) {
    console.error('Error setting custom claims:', error);
    res.status(500).json({ error: 'Failed to set custom claims' });
  }
});

router.get('/list', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { pageToken, maxResults = 100 } = req.query;
    
    const listUsersResult = await auth.listUsers(maxResults, pageToken);
    
    const users = listUsersResult.users.map(user => ({
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.displayName,
      photoURL: user.photoURL,
      disabled: user.disabled,
      metadata: user.metadata,
      customClaims: user.customClaims
    }));
    
    res.json({
      users,
      pageToken: listUsersResult.pageToken,
      hasMore: !!listUsersResult.pageToken
    });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

router.post('/disable', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { userId, disabled } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    await auth.updateUser(userId, { disabled: !!disabled });
    
    res.json({ 
      success: true,
      message: `User ${disabled ? 'disabled' : 'enabled'} successfully`,
      userId
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

router.delete('/delete-account', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    
    await firestore.collection('users').doc(req.user.uid).delete();
    
    await auth.deleteUser(req.user.uid);
    
    res.json({ 
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

router.post('/revoke-tokens', verifyToken, async (req, res) => {
  try {
    await auth.revokeRefreshTokens(req.user.uid);
    
    res.json({ 
      success: true,
      message: 'All refresh tokens revoked'
    });
  } catch (error) {
    console.error('Error revoking tokens:', error);
    res.status(500).json({ error: 'Failed to revoke tokens' });
  }
});

module.exports = router;
