/**
 * Onboarding Content Management Routes
 * 
 * Admin routes for managing pillars, themes (one things), and principles
 * that users select during onboarding.
 */

const express = require('express');
const router = express.Router();
const { OnboardingPillar, OnboardingTheme, OnboardingPrinciple } = require('../models');
const { logger } = require('../config/firebase');
const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic client
const anthropic = new Anthropic();

// Simple admin auth check - in production, use proper admin authentication
const checkAdmin = async (req, res, next) => {
  // For now, allow all requests - add proper auth later
  // TODO: Implement admin authentication
  next();
};

router.use(checkAdmin);

// ============================================
// PILLARS (Top-level categories)
// ============================================

/**
 * GET /api/onboarding-content/pillars
 * Get all pillars
 */
router.get('/pillars', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const pillars = await OnboardingPillar.findAll(includeInactive);
    res.json({ pillars: pillars.map(p => p.toJSON()) });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get pillars');
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/onboarding-content/pillars/:id
 * Get single pillar with its themes
 */
router.get('/pillars/:id', async (req, res) => {
  try {
    const pillar = await OnboardingPillar.findById(req.params.id);
    if (!pillar) {
      return res.status(404).json({ error: 'Pillar not found' });
    }
    
    const includeInactive = req.query.includeInactive === 'true';
    const themes = await OnboardingTheme.findByPillarId(pillar.id, includeInactive);
    
    res.json({ 
      pillar: pillar.toJSON(),
      themes: themes.map(t => t.toJSON())
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get pillar');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding-content/pillars
 * Create a new pillar
 */
router.post('/pillars', async (req, res) => {
  try {
    const { title, description, icon, color, order, isActive } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const pillar = await OnboardingPillar.create({
      title: title.trim(),
      description: description?.trim() || '',
      icon: icon || null,
      color: color || '#6366f1',
      order: order || 0,
      isActive: isActive !== false
    });
    
    res.status(201).json({ pillar: pillar.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create pillar');
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/onboarding-content/pillars/:id
 * Update a pillar
 */
router.put('/pillars/:id', async (req, res) => {
  try {
    const pillar = await OnboardingPillar.findById(req.params.id);
    if (!pillar) {
      return res.status(404).json({ error: 'Pillar not found' });
    }
    
    const { title, description, icon, color, order, isActive } = req.body;
    
    if (title !== undefined) pillar.title = title.trim();
    if (description !== undefined) pillar.description = description?.trim() || '';
    if (icon !== undefined) pillar.icon = icon;
    if (color !== undefined) pillar.color = color;
    if (order !== undefined) pillar.order = order;
    if (isActive !== undefined) pillar.isActive = isActive;
    
    await pillar.save();
    
    res.json({ pillar: pillar.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to update pillar');
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/onboarding-content/pillars/:id
 * Delete a pillar and all its themes/principles
 */
router.delete('/pillars/:id', async (req, res) => {
  try {
    const pillar = await OnboardingPillar.findById(req.params.id);
    if (!pillar) {
      return res.status(404).json({ error: 'Pillar not found' });
    }
    
    await pillar.delete();
    res.status(204).send();
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to delete pillar');
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// THEMES (The "one thing" under each pillar)
// ============================================

/**
 * GET /api/onboarding-content/themes
 * Get all themes (optionally filtered by pillarId)
 */
router.get('/themes', async (req, res) => {
  try {
    const { pillarId, includeInactive } = req.query;
    let themes;
    
    if (pillarId) {
      themes = await OnboardingTheme.findByPillarId(pillarId, includeInactive === 'true');
    } else {
      themes = await OnboardingTheme.findAll(includeInactive === 'true');
    }
    
    res.json({ themes: themes.map(t => t.toJSON()) });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get themes');
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/onboarding-content/themes/:id
 * Get single theme with its principles
 */
router.get('/themes/:id', async (req, res) => {
  try {
    const theme = await OnboardingTheme.findById(req.params.id);
    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    
    const includeInactive = req.query.includeInactive === 'true';
    const includeDrafts = req.query.includeDrafts === 'true';
    const principles = await OnboardingPrinciple.findByThemeId(theme.id, includeInactive, includeDrafts);
    
    res.json({ 
      theme: theme.toJSON(),
      principles: principles.map(p => p.toJSON())
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get theme');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding-content/themes
 * Create a new theme
 */
router.post('/themes', async (req, res) => {
  try {
    const { pillarId, title, description, order, isActive } = req.body;
    
    if (!pillarId) {
      return res.status(400).json({ error: 'Pillar ID is required' });
    }
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    // Verify pillar exists
    const pillar = await OnboardingPillar.findById(pillarId);
    if (!pillar) {
      return res.status(400).json({ error: 'Invalid pillar' });
    }
    
    const theme = await OnboardingTheme.create({
      pillarId,
      title: title.trim(),
      description: description?.trim() || '',
      order: order || 0,
      isActive: isActive !== false
    });
    
    res.status(201).json({ theme: theme.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create theme');
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/onboarding-content/themes/:id
 * Update a theme
 */
router.put('/themes/:id', async (req, res) => {
  try {
    const theme = await OnboardingTheme.findById(req.params.id);
    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    
    const { pillarId, title, description, order, isActive } = req.body;
    
    if (pillarId !== undefined) {
      const pillar = await OnboardingPillar.findById(pillarId);
      if (!pillar) {
        return res.status(400).json({ error: 'Invalid pillar' });
      }
      theme.pillarId = pillarId;
    }
    
    if (title !== undefined) theme.title = title.trim();
    if (description !== undefined) theme.description = description?.trim() || '';
    if (order !== undefined) theme.order = order;
    if (isActive !== undefined) theme.isActive = isActive;
    
    await theme.save();
    
    res.json({ theme: theme.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to update theme');
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/onboarding-content/themes/:id
 * Delete a theme and all its principles
 */
router.delete('/themes/:id', async (req, res) => {
  try {
    const theme = await OnboardingTheme.findById(req.params.id);
    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    
    await theme.delete();
    res.status(204).send();
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to delete theme');
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PRINCIPLES (The specific statements)
// ============================================

/**
 * GET /api/onboarding-content/principles
 * Get all principles (optionally filtered by themeId)
 */
router.get('/principles', async (req, res) => {
  try {
    const { themeId, includeInactive, includeDrafts } = req.query;
    let principles;
    
    if (themeId) {
      principles = await OnboardingPrinciple.findByThemeId(
        themeId, 
        includeInactive === 'true',
        includeDrafts === 'true'
      );
    } else {
      principles = await OnboardingPrinciple.findAll(
        includeInactive === 'true',
        includeDrafts === 'true'
      );
    }
    
    res.json({ principles: principles.map(p => p.toJSON()) });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get principles');
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/onboarding-content/principles/:id
 * Get single principle
 */
router.get('/principles/:id', async (req, res) => {
  try {
    const principle = await OnboardingPrinciple.findById(req.params.id);
    if (!principle) {
      return res.status(404).json({ error: 'Principle not found' });
    }
    
    res.json({ principle: principle.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get principle');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding-content/principles
 * Create a new principle
 */
router.post('/principles', async (req, res) => {
  try {
    const { themeId, text, order, isActive, isDraft } = req.body;
    
    if (!themeId) {
      return res.status(400).json({ error: 'Theme ID is required' });
    }
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // Verify theme exists
    const theme = await OnboardingTheme.findById(themeId);
    if (!theme) {
      return res.status(400).json({ error: 'Invalid theme' });
    }
    
    const principle = await OnboardingPrinciple.create({
      themeId,
      text: text.trim(),
      order: order || 0,
      isActive: isActive !== false,
      isDraft: isDraft === true
    });
    
    res.status(201).json({ principle: principle.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create principle');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding-content/principles/bulk
 * Create multiple principles at once
 */
router.post('/principles/bulk', async (req, res) => {
  try {
    const { themeId, principles, isDraft } = req.body;
    
    if (!themeId) {
      return res.status(400).json({ error: 'Theme ID is required' });
    }
    
    if (!Array.isArray(principles) || principles.length === 0) {
      return res.status(400).json({ error: 'Principles array is required' });
    }
    
    // Verify theme exists
    const theme = await OnboardingTheme.findById(themeId);
    if (!theme) {
      return res.status(400).json({ error: 'Invalid theme' });
    }
    
    // Get existing principles to determine order
    const existing = await OnboardingPrinciple.findByThemeId(themeId, true, true);
    let maxOrder = existing.length > 0 ? Math.max(...existing.map(p => p.order)) : -1;
    
    const created = [];
    for (const text of principles) {
      if (text && text.trim()) {
        maxOrder++;
        const principle = await OnboardingPrinciple.create({
          themeId,
          text: text.trim(),
          order: maxOrder,
          isActive: true,
          isDraft: isDraft === true
        });
        created.push(principle.toJSON());
      }
    }
    
    res.status(201).json({ principles: created });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create principles');
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/onboarding-content/principles/:id
 * Update a principle
 */
router.put('/principles/:id', async (req, res) => {
  try {
    const principle = await OnboardingPrinciple.findById(req.params.id);
    if (!principle) {
      return res.status(404).json({ error: 'Principle not found' });
    }
    
    const { themeId, text, order, isActive, isDraft } = req.body;
    
    if (themeId !== undefined) {
      const theme = await OnboardingTheme.findById(themeId);
      if (!theme) {
        return res.status(400).json({ error: 'Invalid theme' });
      }
      principle.themeId = themeId;
    }
    
    if (text !== undefined) principle.text = text.trim();
    if (order !== undefined) principle.order = order;
    if (isActive !== undefined) principle.isActive = isActive;
    if (isDraft !== undefined) principle.isDraft = isDraft;
    
    await principle.save();
    
    res.json({ principle: principle.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to update principle');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding-content/principles/:id/approve
 * Approve a draft principle
 */
router.post('/principles/:id/approve', async (req, res) => {
  try {
    const principle = await OnboardingPrinciple.findById(req.params.id);
    if (!principle) {
      return res.status(404).json({ error: 'Principle not found' });
    }
    
    await principle.approve();
    
    res.json({ principle: principle.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to approve principle');
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/onboarding-content/principles/:id
 * Delete a principle
 */
router.delete('/principles/:id', async (req, res) => {
  try {
    const principle = await OnboardingPrinciple.findById(req.params.id);
    if (!principle) {
      return res.status(404).json({ error: 'Principle not found' });
    }
    
    await principle.delete();
    res.status(204).send();
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to delete principle');
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LLM GENERATION ENDPOINTS
// ============================================

/**
 * POST /api/onboarding-content/generate/themes
 * Generate theme suggestions for a pillar using LLM
 */
router.post('/generate/themes', async (req, res) => {
  try {
    const { pillarId, count = 5 } = req.body;
    
    if (!pillarId) {
      return res.status(400).json({ error: 'Pillar ID is required' });
    }
    
    const pillar = await OnboardingPillar.findById(pillarId);
    if (!pillar) {
      return res.status(400).json({ error: 'Invalid pillar' });
    }
    
    // Get existing themes to avoid duplicates
    const existingThemes = await OnboardingTheme.findByPillarId(pillarId, true);
    const existingTitles = existingThemes.map(t => t.title);
    
    const prompt = `You are helping create content for a life coaching app called "Pillars". Users go through an onboarding flow where they:
1. Pick a pillar (area of life) - in this case: "${pillar.title}"
2. Pick the "one thing" they most want to get right (these are called "themes")
3. Pick a principle that describes how they'll live that out

Generate ${count} theme suggestions for the "${pillar.title}" pillar. These should be short 1-2 word labels that represent different areas of focus within this pillar.

${existingTitles.length > 0 ? `Existing themes to avoid duplicating: ${existingTitles.join(', ')}` : ''}

Examples of good themes:
- For "Finances": Awareness, Debt Freedom, Security, Investing, Generosity, Contentment
- For "Marriage": Communication, Forgiveness, Teamwork, Intimacy, Faith, Boundaries

Return ONLY a JSON array of strings with the theme titles. No explanation, just the JSON array.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    
    // Parse the JSON array from the response
    let suggestions;
    try {
      // Try to extract JSON array from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found in response');
      }
    } catch (parseError) {
      logger.error({ error: parseError.message, response: responseText }, 'Failed to parse LLM response');
      return res.status(500).json({ error: 'Failed to parse LLM response' });
    }
    
    res.json({ suggestions, pillarTitle: pillar.title });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to generate themes');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding-content/generate/principles
 * Generate principle suggestions for a theme using LLM
 */
router.post('/generate/principles', async (req, res) => {
  try {
    const { themeId, count = 4 } = req.body;
    
    if (!themeId) {
      return res.status(400).json({ error: 'Theme ID is required' });
    }
    
    const theme = await OnboardingTheme.findById(themeId);
    if (!theme) {
      return res.status(400).json({ error: 'Invalid theme' });
    }
    
    const pillar = await OnboardingPillar.findById(theme.pillarId);
    
    // Get existing principles to avoid duplicates
    const existingPrinciples = await OnboardingPrinciple.findByThemeId(themeId, true, true);
    const existingTexts = existingPrinciples.map(p => p.text);
    
    const prompt = `You are helping create content for a life coaching app called "Pillars". Users go through an onboarding flow where they select principles that describe how they want to live.

Context:
- Pillar (area of life): "${pillar?.title || 'Unknown'}"
- Theme (the one thing they want to get right): "${theme.title}"

Generate ${count} principle statements for the "${theme.title}" theme. These should be:
- First-person statements ("I..." format)
- Actionable and specific
- 1-2 sentences max
- Inspiring but practical
- The kind of statement someone would want to live by

${existingTexts.length > 0 ? `Existing principles to avoid duplicating:\n${existingTexts.map(t => `- ${t}`).join('\n')}` : ''}

Examples of good principles:
- "Track every dollar, every week. No mystery money—I know where it all goes."
- "I speak up instead of shutting down. My voice matters in this marriage."
- "I show up even when I don't feel like it. Discipline beats motivation."

Return ONLY a JSON array of strings with the principle texts. No explanation, just the JSON array.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    
    // Parse the JSON array from the response
    let suggestions;
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found in response');
      }
    } catch (parseError) {
      logger.error({ error: parseError.message, response: responseText }, 'Failed to parse LLM response');
      return res.status(500).json({ error: 'Failed to parse LLM response' });
    }
    
    res.json({ 
      suggestions, 
      themeTitle: theme.title,
      pillarTitle: pillar?.title 
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to generate principles');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding-content/generate/pillars
 * Generate pillar suggestions using LLM
 */
router.post('/generate/pillars', async (req, res) => {
  try {
    const { count = 3 } = req.body;
    
    // Get existing pillars to avoid duplicates
    const existingPillars = await OnboardingPillar.findAll(true);
    const existingTitles = existingPillars.map(p => p.title);
    
    const prompt = `You are helping create content for a life coaching app called "Pillars". Users go through an onboarding flow where they pick a pillar (major area of life) to focus on.

Generate ${count} new pillar suggestions. These should be:
- Major life domains that people want to improve
- Single words or short phrases (1-3 words)
- Universal enough that most adults would relate to them

${existingTitles.length > 0 ? `Existing pillars to avoid duplicating: ${existingTitles.join(', ')}` : ''}

Common pillars include: Family, Marriage, Parenting, Faith, Fitness, Finances, Work, Friendships, Home, Self

Return ONLY a JSON array of objects with "title" and "description" fields. Example:
[{"title": "Career", "description": "Professional growth and work satisfaction"}]

No explanation, just the JSON array.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    
    let suggestions;
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found in response');
      }
    } catch (parseError) {
      logger.error({ error: parseError.message, response: responseText }, 'Failed to parse LLM response');
      return res.status(500).json({ error: 'Failed to parse LLM response' });
    }
    
    res.json({ suggestions });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to generate pillars');
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// FULL CONTENT EXPORT (for mobile app)
// ============================================

/**
 * GET /api/onboarding-content/full
 * Get all active content in a nested structure for the mobile app
 */
router.get('/full', async (req, res) => {
  try {
    const pillars = await OnboardingPillar.findAll(false);
    
    const fullContent = await Promise.all(pillars.map(async (pillar) => {
      const themes = await OnboardingTheme.findByPillarId(pillar.id, false);
      
      const themesWithPrinciples = await Promise.all(themes.map(async (theme) => {
        const principles = await OnboardingPrinciple.findByThemeId(theme.id, false, false);
        return {
          ...theme.toJSON(),
          principles: principles.map(p => p.text)
        };
      }));
      
      return {
        ...pillar.toJSON(),
        themes: themesWithPrinciples
      };
    }));
    
    res.json({ content: fullContent });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get full content');
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
