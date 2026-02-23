const express = require('express');
const { auth } = require('../config/firebase');
const { flexibleAuth } = require('../middleware/serviceAuth');
const {
  getPillarVisuals,
  savePillarVisuals,
  normalizeColorToken
} = require('../services/pillarVisuals');

const router = express.Router();

const DEPRECATED_VISUAL_FIELDS = Object.freeze(['hex', 'systemName']);

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

async function requireVisualWriteAuth(req, res, next) {
  try {
    const bearerToken = getBearerToken(req);
    if (!bearerToken) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
    if (internalSecret && bearerToken === internalSecret) {
      req.visualActor = 'internal-service';
      return next();
    }

    const decodedToken = await auth.verifyIdToken(bearerToken);
    const role = typeof decodedToken.role === 'string' ? decodedToken.role : null;
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Admin role required' });
    }

    req.visualActor = decodedToken.uid;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
}

function normalizeLabel(rawValue, fallback) {
  if (typeof rawValue !== 'string') {
    return fallback;
  }
  const trimmed = rawValue.trim();
  return trimmed || fallback;
}

function normalizeOrder(rawValue, fallback) {
  if (!Number.isFinite(rawValue)) {
    return fallback;
  }
  const rounded = Math.round(rawValue);
  return rounded < 0 ? 0 : rounded;
}

function normalizeIsActive(rawValue, fallback = true) {
  if (typeof rawValue === 'boolean') {
    return rawValue;
  }
  return fallback;
}

function nextOrder(rows) {
  const maxOrder = rows.reduce((max, row) => {
    if (!Number.isFinite(row?.order)) {
      return max;
    }
    return Math.max(max, row.order);
  }, 0);
  return maxOrder + 10;
}

function deprecatedFieldError(fieldName) {
  return `${fieldName} is no longer supported for pillar visuals. Clients render tokens locally.`;
}

function findDeprecatedField(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  for (const field of DEPRECATED_VISUAL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      return field;
    }
  }
  return null;
}

function normalizeColorPayload(payload, { requireId = true } = {}) {
  const deprecatedField = findDeprecatedField(payload);
  if (deprecatedField) {
    return { error: deprecatedFieldError(deprecatedField) };
  }

  const id = normalizeColorToken(payload?.id);
  if (requireId && !id) {
    return { error: 'Color id is required' };
  }

  return {
    value: {
      id,
      label: normalizeLabel(payload?.label, id || ''),
      order: payload?.order,
      isActive: payload?.isActive
    }
  };
}

function normalizeIconPayload(payload, { requireId = true } = {}) {
  const deprecatedField = findDeprecatedField(payload);
  if (deprecatedField) {
    return { error: deprecatedFieldError(deprecatedField) };
  }

  const id = normalizeColorToken(payload?.id);
  if (requireId && !id) {
    return { error: 'Icon id is required' };
  }

  return {
    value: {
      id,
      label: normalizeLabel(payload?.label, id || ''),
      defaultColorToken: normalizeColorToken(payload?.defaultColorToken),
      order: payload?.order,
      isActive: payload?.isActive
    }
  };
}

function maybeRejectDeprecatedBody(req, res) {
  const deprecatedField = findDeprecatedField(req.body || {});
  if (!deprecatedField) {
    return false;
  }
  res.status(400).json({ error: deprecatedFieldError(deprecatedField) });
  return true;
}

router.get('/', flexibleAuth, async (req, res) => {
  try {
    const visuals = await getPillarVisuals();
    return res.json(visuals);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.put('/', requireVisualWriteAuth, async (req, res) => {
  try {
    const colors = Array.isArray(req.body?.colors) ? req.body.colors : null;
    const icons = Array.isArray(req.body?.icons) ? req.body.icons : null;
    if (!colors || !icons) {
      return res.status(400).json({ error: 'colors and icons arrays are required' });
    }

    const normalizedColors = [];
    const colorIdSet = new Set();
    for (let index = 0; index < colors.length; index += 1) {
      const row = colors[index];
      const normalized = normalizeColorPayload(row, { requireId: true });
      if (normalized.error) {
        return res.status(400).json({ error: `colors[${index}]: ${normalized.error}` });
      }
      if (colorIdSet.has(normalized.value.id)) {
        return res.status(409).json({ error: `Duplicate color id: ${normalized.value.id}` });
      }
      colorIdSet.add(normalized.value.id);
      normalizedColors.push({
        id: normalized.value.id,
        label: normalized.value.label,
        order: normalizeOrder(normalized.value.order, index * 10),
        isActive: normalizeIsActive(normalized.value.isActive, true)
      });
    }

    const normalizedIcons = [];
    const iconIdSet = new Set();
    for (let index = 0; index < icons.length; index += 1) {
      const row = icons[index];
      const normalized = normalizeIconPayload(row, { requireId: true });
      if (normalized.error) {
        return res.status(400).json({ error: `icons[${index}]: ${normalized.error}` });
      }
      if (iconIdSet.has(normalized.value.id)) {
        return res.status(409).json({ error: `Duplicate icon id: ${normalized.value.id}` });
      }
      if (normalized.value.defaultColorToken && !colorIdSet.has(normalized.value.defaultColorToken)) {
        return res.status(400).json({
          error: `icons[${index}]: defaultColorToken must reference a valid color id`
        });
      }

      iconIdSet.add(normalized.value.id);
      normalizedIcons.push({
        id: normalized.value.id,
        label: normalized.value.label,
        defaultColorToken: normalized.value.defaultColorToken,
        order: normalizeOrder(normalized.value.order, index * 10),
        isActive: normalizeIsActive(normalized.value.isActive, true)
      });
    }

    if (normalizedColors.length === 0) {
      return res.status(409).json({ error: 'At least one color is required' });
    }
    if (normalizedIcons.length === 0) {
      return res.status(409).json({ error: 'At least one icon is required' });
    }

    const updated = await savePillarVisuals({
      colors: normalizedColors,
      icons: normalizedIcons,
      updatedBy: req.visualActor || null
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/colors', requireVisualWriteAuth, async (req, res) => {
  try {
    const payload = normalizeColorPayload(req.body || {}, { requireId: true });
    if (payload.error) {
      return res.status(400).json({ error: payload.error });
    }

    const visuals = await getPillarVisuals();
    if (visuals.colors.some(color => color.id === payload.value.id)) {
      return res.status(409).json({ error: 'Color id already exists' });
    }

    const nextColors = [
      ...visuals.colors,
      {
        id: payload.value.id,
        label: payload.value.label,
        order: normalizeOrder(payload.value.order, nextOrder(visuals.colors)),
        isActive: normalizeIsActive(payload.value.isActive, true)
      }
    ];

    const updated = await savePillarVisuals({
      colors: nextColors,
      icons: visuals.icons,
      updatedBy: req.visualActor || null
    });
    return res.status(201).json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.patch('/colors/:colorId', requireVisualWriteAuth, async (req, res) => {
  try {
    if (maybeRejectDeprecatedBody(req, res)) {
      return;
    }

    const colorId = normalizeColorToken(req.params.colorId);
    if (!colorId) {
      return res.status(400).json({ error: 'Invalid color id' });
    }

    const visuals = await getPillarVisuals();
    const index = visuals.colors.findIndex(color => color.id === colorId);
    if (index < 0) {
      return res.status(404).json({ error: 'Color not found' });
    }

    const current = visuals.colors[index];
    const nextColor = {
      ...current,
      label: Object.prototype.hasOwnProperty.call(req.body || {}, 'label')
        ? normalizeLabel(req.body?.label, current.id)
        : current.label,
      order: Object.prototype.hasOwnProperty.call(req.body || {}, 'order')
        ? normalizeOrder(req.body?.order, current.order)
        : current.order,
      isActive: Object.prototype.hasOwnProperty.call(req.body || {}, 'isActive')
        ? normalizeIsActive(req.body?.isActive, current.isActive !== false)
        : current.isActive !== false
    };

    const nextColors = [...visuals.colors];
    nextColors[index] = nextColor;

    const updated = await savePillarVisuals({
      colors: nextColors,
      icons: visuals.icons,
      updatedBy: req.visualActor || null
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.delete('/colors/:colorId', requireVisualWriteAuth, async (req, res) => {
  try {
    const colorId = normalizeColorToken(req.params.colorId);
    if (!colorId) {
      return res.status(400).json({ error: 'Invalid color id' });
    }

    const visuals = await getPillarVisuals();
    if (!visuals.colors.some(color => color.id === colorId)) {
      return res.status(404).json({ error: 'Color not found' });
    }
    if (visuals.colors.length <= 1) {
      return res.status(409).json({ error: 'At least one color is required' });
    }

    const nextColors = visuals.colors.filter(color => color.id !== colorId);
    const updated = await savePillarVisuals({
      colors: nextColors,
      icons: visuals.icons,
      updatedBy: req.visualActor || null
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/icons', requireVisualWriteAuth, async (req, res) => {
  try {
    const payload = normalizeIconPayload(req.body || {}, { requireId: true });
    if (payload.error) {
      return res.status(400).json({ error: payload.error });
    }

    const visuals = await getPillarVisuals();
    if (visuals.icons.some(icon => icon.id === payload.value.id)) {
      return res.status(409).json({ error: 'Icon id already exists' });
    }
    if (payload.value.defaultColorToken
      && !visuals.colors.some(color => color.id === payload.value.defaultColorToken)) {
      return res.status(400).json({ error: 'defaultColorToken must reference a valid color id' });
    }

    const nextIcons = [
      ...visuals.icons,
      {
        id: payload.value.id,
        label: payload.value.label,
        defaultColorToken: payload.value.defaultColorToken,
        order: normalizeOrder(payload.value.order, nextOrder(visuals.icons)),
        isActive: normalizeIsActive(payload.value.isActive, true)
      }
    ];

    const updated = await savePillarVisuals({
      colors: visuals.colors,
      icons: nextIcons,
      updatedBy: req.visualActor || null
    });
    return res.status(201).json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.patch('/icons/:iconId', requireVisualWriteAuth, async (req, res) => {
  try {
    if (maybeRejectDeprecatedBody(req, res)) {
      return;
    }

    const iconId = normalizeColorToken(req.params.iconId);
    if (!iconId) {
      return res.status(400).json({ error: 'Invalid icon id' });
    }

    const visuals = await getPillarVisuals();
    const index = visuals.icons.findIndex(icon => icon.id === iconId);
    if (index < 0) {
      return res.status(404).json({ error: 'Icon not found' });
    }

    const current = visuals.icons[index];
    const nextDefaultColorToken = Object.prototype.hasOwnProperty.call(req.body || {}, 'defaultColorToken')
      ? normalizeColorToken(req.body?.defaultColorToken)
      : current.defaultColorToken;

    if (nextDefaultColorToken && !visuals.colors.some(color => color.id === nextDefaultColorToken)) {
      return res.status(400).json({ error: 'defaultColorToken must reference a valid color id' });
    }

    const nextIcon = {
      ...current,
      label: Object.prototype.hasOwnProperty.call(req.body || {}, 'label')
        ? normalizeLabel(req.body?.label, current.id)
        : current.label,
      defaultColorToken: nextDefaultColorToken,
      order: Object.prototype.hasOwnProperty.call(req.body || {}, 'order')
        ? normalizeOrder(req.body?.order, current.order)
        : current.order,
      isActive: Object.prototype.hasOwnProperty.call(req.body || {}, 'isActive')
        ? normalizeIsActive(req.body?.isActive, current.isActive !== false)
        : current.isActive !== false
    };

    const nextIcons = [...visuals.icons];
    nextIcons[index] = nextIcon;

    const updated = await savePillarVisuals({
      colors: visuals.colors,
      icons: nextIcons,
      updatedBy: req.visualActor || null
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.delete('/icons/:iconId', requireVisualWriteAuth, async (req, res) => {
  try {
    const iconId = normalizeColorToken(req.params.iconId);
    if (!iconId) {
      return res.status(400).json({ error: 'Invalid icon id' });
    }

    const visuals = await getPillarVisuals();
    if (!visuals.icons.some(icon => icon.id === iconId)) {
      return res.status(404).json({ error: 'Icon not found' });
    }
    if (visuals.icons.length <= 1) {
      return res.status(409).json({ error: 'At least one icon is required' });
    }

    const nextIcons = visuals.icons.filter(icon => icon.id !== iconId);
    const updated = await savePillarVisuals({
      colors: visuals.colors,
      icons: nextIcons,
      updatedBy: req.visualActor || null
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router;
