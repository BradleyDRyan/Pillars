const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();

const SKILL_ID = 'openclaw-pillars-api';
const SKILL_NAME = 'pillars_api';
const SKILL_VERSION = '2026.02.23.01';
const SKILL_UPDATED_AT = '2026-02-23T00:00:00.000Z';
const BASE_URL = process.env.APP_URL || 'https://pillars-phi.vercel.app';
const SKILL_FILE_PATH = path.join(__dirname, '..', 'skills', 'openclaw', 'SKILL.md');

async function readSkillFile() {
  const contents = await fs.readFile(SKILL_FILE_PATH, 'utf8');
  const checksum = crypto.createHash('sha256').update(contents).digest('hex');
  return {
    contents,
    checksum
  };
}

router.get('/openclaw/manifest.json', async (req, res) => {
  try {
    const skill = await readSkillFile();
    res.json({
      id: SKILL_ID,
      name: SKILL_NAME,
      version: SKILL_VERSION,
      updatedAt: SKILL_UPDATED_AT,
      checksum: skill.checksum,
      files: {
        skill: `${BASE_URL}/api/skills/openclaw/SKILL.md`
      }
    });
  } catch (error) {
    console.error('[skills] GET /openclaw/manifest.json error:', error);
    res.status(500).json({ error: 'Failed to load skill manifest' });
  }
});

router.get('/openclaw/SKILL.md', async (req, res) => {
  try {
    const skill = await readSkillFile();
    res.set('Content-Type', 'text/markdown; charset=utf-8');
    res.set('ETag', `"${skill.checksum}"`);
    res.send(skill.contents);
  } catch (error) {
    console.error('[skills] GET /openclaw/SKILL.md error:', error);
    res.status(500).json({ error: 'Failed to load skill file' });
  }
});

module.exports = router;
