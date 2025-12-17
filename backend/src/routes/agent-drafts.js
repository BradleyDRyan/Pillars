/**
 * Agent Drafts Routes
 * 
 * View and manage drafts from agent workspaces.
 * As the editor-in-chief, you can approve, reject, and publish drafts.
 */

const express = require('express');
const router = express.Router();
const { AgentDraft, Agent, OnboardingPillar, OnboardingPrinciple } = require('../models');
const { logger } = require('../config/firebase');

// Note: Auth disabled for admin UI. In production, add proper admin auth.
// const { verifyToken } = require('../middleware/auth');
// router.use(verifyToken);

// Default admin user ID
const ADMIN_USER_ID = 'admin';

// ============================================
// VIEW DRAFTS
// ============================================

/**
 * GET /api/agent-drafts
 * List all drafts pending review across all agents
 */
router.get('/', async (req, res) => {
  try {
    const status = req.query.status || 'pending_review';
    const limit = parseInt(req.query.limit) || 50;
    
    let drafts;
    
    if (status === 'pending_review') {
      drafts = await AgentDraft.findPendingReview(limit);
    } else {
      // Get drafts from all agents (requires iterating - could optimize with collectionGroup)
      const agents = await Agent.findAll(true);
      drafts = [];
      
      for (const agent of agents) {
        const agentDrafts = await AgentDraft.findByAgentId(agent.id, { status, limit: 20 });
        drafts.push(...agentDrafts);
      }
      
      // Sort by creation time
      drafts.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return bTime - aTime;
      });
      
      drafts = drafts.slice(0, limit);
    }
    
    // Enrich with agent info
    const enrichedDrafts = await Promise.all(drafts.map(async (draft) => {
      const agent = await Agent.findById(draft.agentId);
      return {
        ...draft.toJSON(),
        agent: agent ? { id: agent.id, name: agent.name, handle: agent.handle } : null
      };
    }));
    
    res.json({ drafts: enrichedDrafts });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to list drafts');
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agent-drafts/by-agent/:agentId
 * List drafts for a specific agent
 */
router.get('/by-agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const status = req.query.status;
    const limit = parseInt(req.query.limit) || 50;
    
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const drafts = await AgentDraft.findByAgentId(agentId, { status, limit });
    
    res.json({
      agent: { id: agent.id, name: agent.name, handle: agent.handle },
      drafts: drafts.map(d => d.toJSON())
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to list agent drafts');
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agent-drafts/:agentId/:draftId
 * Get a specific draft
 */
router.get('/:agentId/:draftId', async (req, res) => {
  try {
    const { agentId, draftId } = req.params;
    
    const draft = await AgentDraft.findById(agentId, draftId);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    
    const agent = await Agent.findById(agentId);
    
    res.json({
      draft: draft.toJSON(),
      agent: agent ? { id: agent.id, name: agent.name, handle: agent.handle } : null
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get draft');
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// REVIEW ACTIONS
// ============================================

/**
 * POST /api/agent-drafts/:agentId/:draftId/submit
 * Submit a draft for review (agent action, but can also be done manually)
 */
router.post('/:agentId/:draftId/submit', async (req, res) => {
  try {
    const { agentId, draftId } = req.params;
    
    const draft = await AgentDraft.findById(agentId, draftId);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    
    await draft.submitForReview();
    
    res.json({ draft: draft.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to submit draft');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent-drafts/:agentId/:draftId/approve
 * Approve a draft (editor action)
 */
router.post('/:agentId/:draftId/approve', async (req, res) => {
  try {
    const { agentId, draftId } = req.params;
    const { notes } = req.body;
    
    const draft = await AgentDraft.findById(agentId, draftId);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    
    await draft.approve(ADMIN_USER_ID, notes);
    
    res.json({ draft: draft.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to approve draft');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent-drafts/:agentId/:draftId/reject
 * Reject a draft (editor action)
 */
router.post('/:agentId/:draftId/reject', async (req, res) => {
  try {
    const { agentId, draftId } = req.params;
    const { notes } = req.body;
    
    const draft = await AgentDraft.findById(agentId, draftId);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    
    if (!notes) {
      return res.status(400).json({ error: 'Rejection notes are required' });
    }
    
    await draft.reject(ADMIN_USER_ID, notes);
    
    res.json({ draft: draft.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to reject draft');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent-drafts/:agentId/:draftId/publish
 * Publish an approved draft to the target system
 * Body can include { pillarId } for principles
 */
router.post('/:agentId/:draftId/publish', async (req, res) => {
  try {
    const { agentId, draftId } = req.params;
    const { pillarId } = req.body; // Optional pillarId from request body
    
    const draft = await AgentDraft.findById(agentId, draftId);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    
    if (draft.status !== 'approved') {
      return res.status(400).json({ error: 'Draft must be approved before publishing' });
    }
    
    // Publish based on content type
    let publishedRef = null;
    
    switch (draft.contentType) {
      case 'onboarding_pillar': {
        const pillar = await OnboardingPillar.create({
          title: draft.content.text || draft.title,
          description: draft.content.description || '',
          isActive: true
        });
        publishedRef = { collection: 'onboardingPillars', id: pillar.id };
        break;
      }
      
      case 'onboarding_principle': {
        // Use pillarId from body, then from draft content
        const targetPillarId = pillarId || draft.content.pillarId;
        if (!targetPillarId) {
          return res.status(400).json({ error: 'Principle must have a pillarId (pass in request body or set in draft content)' });
        }
        
        const principle = await OnboardingPrinciple.create({
          pillarId: targetPillarId,
          text: draft.content.text || draft.title,
          isActive: true,
          isDraft: false // Published, not draft
        });
        publishedRef = { collection: 'onboardingPrinciples', id: principle.id };
        break;
      }
      
      default:
        return res.status(400).json({ error: `Cannot publish content type: ${draft.contentType}` });
    }
    
    await draft.markPublished(publishedRef);
    
    res.json({
      draft: draft.toJSON(),
      publishedRef
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to publish draft');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent-drafts/bulk/approve
 * Bulk approve drafts
 */
router.post('/bulk/approve', async (req, res) => {
  try {
    const { drafts, notes } = req.body;
    
    if (!Array.isArray(drafts) || drafts.length === 0) {
      return res.status(400).json({ error: 'drafts array is required' });
    }
    
    const results = [];
    
    for (const { agentId, draftId } of drafts) {
      try {
        const draft = await AgentDraft.findById(agentId, draftId);
        if (draft) {
          await draft.approve(ADMIN_USER_ID, notes);
          results.push({ agentId, draftId, status: 'approved' });
        } else {
          results.push({ agentId, draftId, status: 'not_found' });
        }
      } catch (error) {
        results.push({ agentId, draftId, status: 'error', error: error.message });
      }
    }
    
    res.json({ results });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to bulk approve drafts');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent-drafts/bulk/publish
 * Bulk publish approved drafts
 */
router.post('/bulk/publish', async (req, res) => {
  try {
    const { drafts } = req.body;
    
    if (!Array.isArray(drafts) || drafts.length === 0) {
      return res.status(400).json({ error: 'drafts array is required' });
    }
    
    const results = [];
    
    for (const { agentId, draftId } of drafts) {
      try {
        const draft = await AgentDraft.findById(agentId, draftId);
        if (!draft) {
          results.push({ agentId, draftId, status: 'not_found' });
          continue;
        }
        
        if (draft.status !== 'approved') {
          results.push({ agentId, draftId, status: 'not_approved' });
          continue;
        }
        
        // Publish based on content type
        let publishedRef = null;
        
        switch (draft.contentType) {
          case 'onboarding_pillar': {
            const pillar = await OnboardingPillar.create({
              title: draft.content.text || draft.title,
              description: draft.content.description || '',
              isActive: true
            });
            publishedRef = { collection: 'onboardingPillars', id: pillar.id };
            break;
          }
          
          case 'onboarding_principle': {
            if (!draft.content.pillarId) {
              results.push({ agentId, draftId, status: 'error', error: 'Missing pillarId' });
              continue;
            }
            
            const principle = await OnboardingPrinciple.create({
              pillarId: draft.content.pillarId,
              text: draft.content.text || draft.title,
              isActive: true,
              isDraft: false
            });
            publishedRef = { collection: 'onboardingPrinciples', id: principle.id };
            break;
          }
          
          default:
            results.push({ agentId, draftId, status: 'error', error: `Unknown contentType: ${draft.contentType}` });
            continue;
        }
        
        await draft.markPublished(publishedRef);
        results.push({ agentId, draftId, status: 'published', publishedRef });
        
      } catch (error) {
        results.push({ agentId, draftId, status: 'error', error: error.message });
      }
    }
    
    res.json({ results });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to bulk publish drafts');
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/agent-drafts/:agentId/:draftId
 * Delete a draft
 */
router.delete('/:agentId/:draftId', async (req, res) => {
  try {
    const { agentId, draftId } = req.params;
    
    const draft = await AgentDraft.findById(agentId, draftId);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    
    await draft.delete();
    
    res.status(204).send();
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to delete draft');
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

