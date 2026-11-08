/**
 * Lightweight token estimation: ~4 characters per token (GPT-style BPE approximation).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / charsPerToken(text));
}

/**
 * Arabic-script text (Persian, Arabic) tokenizes at roughly 2 chars/token,
 * far denser than English's ~4, so a flat /4 undercounts it and overflows
 * the context window. Sample the head of the text to pick a ratio.
 */
export function charsPerToken(text: string): number {
  const sample = text.slice(0, 2000);
  if (!sample) return 4;
  const arabic = (sample.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g) ?? []).length;
  return arabic / sample.length > 0.3 ? 2 : 4;
}

/**
 * Split text into chunks of at most `maxTokensPerChunk` tokens,
 * preferring paragraph boundaries, falling back to sentence boundaries.
 */
export function chunkText(text: string, maxTokensPerChunk = 3000): string[] {
  const maxChars = Math.floor(maxTokensPerChunk * charsPerToken(text));

  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let current = '';

  const paragraphs = text.split(/\n\n+/);

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length <= maxChars) {
      current = current ? `${current}\n\n${para}` : para;
    } else {
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      // Single paragraph too long: split by sentences.
      // The lookbehind includes ؟ (Arabic question mark) for Persian/Farsi content.
      // Known limitation: may split incorrectly on abbreviations (e.g. "Dr.") or
      // decimal numbers; sentence chunking is best-effort for context management.
      if (para.length > maxChars) {
        const sentences = para.split(/(?<=[.!?؟])\s+/);
        for (const sentence of sentences) {
          if ((current + ' ' + sentence).length <= maxChars) {
            current = current ? `${current} ${sentence}` : sentence;
          } else {
            if (current) chunks.push(current.trim());
            // Single sentence longer than limit: hard-truncate
            current = sentence.length > maxChars
              ? sentence.slice(0, maxChars)
              : sentence;
          }
        }
      } else {
        current = para;
      }
    }
  }

  if (current) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

/**
 * Truncate text to a maximum number of tokens, appending an ellipsis note if cut.
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = Math.floor(maxTokens * charsPerToken(text));
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[...content truncated to fit context window]';
}
