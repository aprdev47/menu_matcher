import type { MenuItem } from '../types';

// Calculate Levenshtein distance between two strings
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// Calculate similarity confidence score (0-100)
export function calculateConfidence(source: string, target: string): number {
  const s1 = source.toLowerCase().trim();
  const s2 = target.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 100;

  // Calculate normalized similarity
  const maxLength = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  const similarity = ((maxLength - distance) / maxLength) * 100;

  // Additional boost for partial matches
  if (s1.includes(s2) || s2.includes(s1)) {
    return Math.min(100, similarity + 10);
  }

  // Check for word-level matches
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w));

  if (commonWords.length > 0) {
    const wordBoost = (commonWords.length / Math.max(words1.length, words2.length)) * 20;
    return Math.min(100, similarity + wordBoost);
  }

  return Math.max(0, similarity);
}

// Find best match for a source item from target items
export function findBestMatch(
  sourceItem: MenuItem,
  targetItems: MenuItem[],
  threshold: number = 70
): { item: MenuItem; confidence: number } | null {
  let bestMatch: { item: MenuItem; confidence: number } | null = null;

  for (const targetItem of targetItems) {
    const confidence = calculateConfidence(sourceItem.name, targetItem.name);

    if (confidence >= threshold && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = { item: targetItem, confidence };
    }
  }

  return bestMatch;
}
