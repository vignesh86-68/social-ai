/**
 * Extract unique, valid lowercase hashtags from text.
 * Matches #tag where tag starts with a letter and contains alphanumeric/underscore characters.
 */
const extractHashtags = (text) => {
  if (!text || typeof text !== 'string') return [];
  const regex = /#([a-zA-Z][a-zA-Z0-9_]{1,49})/g;
  const matches = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.add(match[1].toLowerCase());
  }
  return Array.from(matches);
};

/**
 * Extract unique, valid usernames mentioned in text via @username syntax.
 * Matches @username (3-30 chars, letters, numbers, underscores).
 */
const extractMentions = (text) => {
  if (!text || typeof text !== 'string') return [];
  const regex = /@([a-zA-Z0-9_]{3,30})/g;
  const matches = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.add(match[1].toLowerCase());
  }
  return Array.from(matches);
};

module.exports = {
  extractHashtags,
  extractMentions,
};

