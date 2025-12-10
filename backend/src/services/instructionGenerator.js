const { logger } = require('../config/firebase');

/**
 * Generates agent instructions from a user's description.
 * Uses a simple template-based approach for fast, consistent results.
 */
const generateInstructions = async (description) => {
  if (!description || !description.trim()) {
    throw new Error('Description is required to generate instructions');
  }

  logger.info({ descriptionLength: description.length }, '[instruction-generator] Generating instructions');

  // Simple template-based approach - no LLM call needed
  const trimmedDescription = description.trim();
  
  // Create concise, actionable instructions
  const instructions = `Your task is to: ${trimmedDescription}

Search for relevant information, analyze your findings, and report back with clear, actionable results.
Keep your responses brief and focused. If you find nothing new or relevant, indicate that clearly.

CRITICAL TOOL USAGE RULES:
- Maximum 3-5 tool calls TOTAL per response (not per tool type)
- For Amazon searches: Use ONLY 1-2 search queries maximum. Do NOT search for every variation or model.
- Combine related queries into a single, comprehensive search when possible
- If you need multiple searches, prioritize the most important ones
- After getting results, analyze them and report - do NOT keep searching endlessly
- If initial searches don't yield results, report that rather than trying many variations`;

  logger.info(
    { instructionsLength: instructions.length },
    '[instruction-generator] Successfully generated instructions'
  );

  return instructions;
};

module.exports = {
  generateInstructions
};

