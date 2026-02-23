const express = require('express');
const { auth } = require('../config/firebase');
const { flexibleAuth } = require('../middleware/serviceAuth');
const {
  normalizeTemplateType,
  listPillarTemplates,
  getPillarTemplateByType,
  createPillarTemplate,
  patchPillarTemplate,
  deactivatePillarTemplate,
  restorePillarTemplate,
  addTemplateRubricItem,
  patchTemplateRubricItem,
  removeTemplateRubricItem
} = require('../services/pillarTemplates');

const router = express.Router();

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

async function requireTemplateWriteAuth(req, res, next) {
  try {
    const bearerToken = getBearerToken(req);
    if (!bearerToken) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
    if (internalSecret && bearerToken === internalSecret) {
      req.templateActor = 'internal-service';
      return next();
    }

    const decodedToken = await auth.verifyIdToken(bearerToken);
    const role = typeof decodedToken.role === 'string' ? decodedToken.role : null;
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Admin role required' });
    }

    req.templateActor = decodedToken.uid;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
}

function handleTemplateError(res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  if (status >= 500) {
    return res.status(status).json({ error: error.message || 'Internal server error' });
  }
  return res.status(status).json({ error: error.message || 'Request failed' });
}

router.get('/', flexibleAuth, async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const templates = await listPillarTemplates({ includeInactive });
    return res.json(templates.map(template => template.toJSON()));
  } catch (error) {
    return handleTemplateError(res, error);
  }
});

router.get('/:pillarType', flexibleAuth, async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const template = await getPillarTemplateByType(req.params.pillarType, {
      includeInactive
    });
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    return res.json(template.toJSON());
  } catch (error) {
    return handleTemplateError(res, error);
  }
});

router.post('/', requireTemplateWriteAuth, async (req, res) => {
  try {
    const template = await createPillarTemplate(req.body || {}, req.templateActor || null);
    return res.status(201).json(template.toJSON());
  } catch (error) {
    return handleTemplateError(res, error);
  }
});

router.patch('/:pillarType', requireTemplateWriteAuth, async (req, res) => {
  try {
    const normalized = normalizeTemplateType(req.params.pillarType, { required: true });
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }
    const template = await patchPillarTemplate(normalized.value, req.body || {}, req.templateActor || null);
    return res.json(template.toJSON());
  } catch (error) {
    return handleTemplateError(res, error);
  }
});

router.delete('/:pillarType', requireTemplateWriteAuth, async (req, res) => {
  try {
    const normalized = normalizeTemplateType(req.params.pillarType, { required: true });
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }
    const template = await deactivatePillarTemplate(normalized.value, req.templateActor || null);
    return res.json(template.toJSON());
  } catch (error) {
    return handleTemplateError(res, error);
  }
});

router.post('/:pillarType/restore', requireTemplateWriteAuth, async (req, res) => {
  try {
    const normalized = normalizeTemplateType(req.params.pillarType, { required: true });
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }
    const template = await restorePillarTemplate(normalized.value, req.templateActor || null);
    return res.json(template.toJSON());
  } catch (error) {
    return handleTemplateError(res, error);
  }
});

router.post('/:pillarType/rubric', requireTemplateWriteAuth, async (req, res) => {
  try {
    const normalized = normalizeTemplateType(req.params.pillarType, { required: true });
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }
    const template = await addTemplateRubricItem(normalized.value, req.body || {}, req.templateActor || null);
    return res.status(201).json(template.toJSON());
  } catch (error) {
    return handleTemplateError(res, error);
  }
});

router.patch('/:pillarType/rubric/:rubricItemId', requireTemplateWriteAuth, async (req, res) => {
  try {
    const normalized = normalizeTemplateType(req.params.pillarType, { required: true });
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }
    const template = await patchTemplateRubricItem(
      normalized.value,
      req.params.rubricItemId,
      req.body || {},
      req.templateActor || null
    );
    return res.json(template.toJSON());
  } catch (error) {
    return handleTemplateError(res, error);
  }
});

router.delete('/:pillarType/rubric/:rubricItemId', requireTemplateWriteAuth, async (req, res) => {
  try {
    const normalized = normalizeTemplateType(req.params.pillarType, { required: true });
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }
    const template = await removeTemplateRubricItem(
      normalized.value,
      req.params.rubricItemId,
      req.templateActor || null
    );
    return res.json(template.toJSON());
  } catch (error) {
    return handleTemplateError(res, error);
  }
});

module.exports = router;
