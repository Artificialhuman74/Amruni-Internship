/** Small text helpers shared across screens. */

/**
 * "a" or "an" for a word. Vowel-initial only — English has exceptions ("a
 * university", "an hour") but none of them appear in the therapy list, and a
 * pronunciation dictionary to cover words we do not use would be worse than
 * the rule.
 */
export function article(word) {
  return /^[aeiou]/i.test(String(word ?? '').trim()) ? 'an' : 'a';
}
