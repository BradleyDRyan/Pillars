const express = require('express');
const router = express.Router();
const { db, FieldValue } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// GET - Get user's coach preferences
router.get('/', async (req, res) => {
  try {
    const doc = await db.collection('coachPreferences').doc(req.user.uid).get();
    
    if (!doc.exists) {
      // Return defaults if no preferences exist
      return res.json({
        id: req.user.uid,
        userId: req.user.uid,
        communicationStyle: 'Balanced',
        tone: 'Supportive',
        checkInFrequency: 'When I reach out',
        preferredTime: 'Anytime',
        focusAreas: ['Goals', 'Habits'],
        useEmojis: true,
        messageLength: 'Concise',
        proactiveCheckIns: false
      });
    }
    
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error getting coach preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update coach preferences
router.put('/', async (req, res) => {
  try {
    const {
      communicationStyle,
      tone,
      checkInFrequency,
      preferredTime,
      focusAreas,
      useEmojis,
      messageLength,
      proactiveCheckIns
    } = req.body;
    
    const preferences = {
      userId: req.user.uid,
      communicationStyle: communicationStyle || 'Balanced',
      tone: tone || 'Supportive',
      checkInFrequency: checkInFrequency || 'When I reach out',
      preferredTime: preferredTime || 'Anytime',
      focusAreas: focusAreas || ['Goals', 'Habits'],
      useEmojis: useEmojis !== undefined ? useEmojis : true,
      messageLength: messageLength || 'Concise',
      proactiveCheckIns: proactiveCheckIns || false,
      updatedAt: FieldValue.serverTimestamp()
    };
    
    // Check if document exists
    const docRef = db.collection('coachPreferences').doc(req.user.uid);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      preferences.createdAt = FieldValue.serverTimestamp();
    }
    
    await docRef.set(preferences, { merge: true });
    
    res.json({ id: req.user.uid, ...preferences });
  } catch (error) {
    console.error('Error saving coach preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate prompt instructions from preferences
function generatePromptInstructions(preferences) {
  const instructions = [];
  
  // Communication style
  switch (preferences.communicationStyle) {
    case 'Direct':
      instructions.push('Be direct and to-the-point. Skip pleasantries and get straight to actionable advice.');
      break;
    case 'Gentle':
      instructions.push('Be warm, gentle, and encouraging. Take time to acknowledge feelings before offering guidance.');
      break;
    case 'Balanced':
    default:
      instructions.push('Balance warmth with directness. Be friendly but focused.');
  }
  
  // Tone
  switch (preferences.tone) {
    case 'Motivational':
      instructions.push('Use a motivational, energizing tone. Celebrate wins and push for growth.');
      break;
    case 'Analytical':
      instructions.push('Be analytical and logical. Focus on data, patterns, and systematic approaches.');
      break;
    case 'Challenging':
      instructions.push('Be challenging and push back constructively. Ask tough questions to promote growth.');
      break;
    case 'Supportive':
    default:
      instructions.push('Be supportive and understanding. Prioritize emotional support and validation.');
  }
  
  // Focus areas
  if (preferences.focusAreas && preferences.focusAreas.length > 0) {
    instructions.push(`Focus coaching on: ${preferences.focusAreas.join(', ')}.`);
  }
  
  // Message length
  switch (preferences.messageLength) {
    case 'Brief':
      instructions.push('Keep responses very brief (1-2 sentences max).');
      break;
    case 'Detailed':
      instructions.push('Provide detailed responses with examples when helpful.');
      break;
    case 'Concise':
    default:
      instructions.push('Keep responses concise (2-4 sentences).');
  }
  
  // Emojis
  if (preferences.useEmojis) {
    instructions.push('Feel free to use emojis occasionally to add warmth.');
  } else {
    instructions.push('Avoid using emojis.');
  }
  
  return instructions.join(' ');
}

// Export both router and helper
module.exports = router;
module.exports.generatePromptInstructions = generatePromptInstructions;


