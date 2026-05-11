/**
 * Lightweight token estimation: ~4 characters per token (GPT-style BPE approximation).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into chunks of at most `maxTokensPerChunk` tokens,
 * preferring paragraph boundaries, falling back to sentence boundaries.
 */
export function chunkText(text: string, maxTokensPerChunk = 3000): string[] {
  const maxChars = maxTokensPerChunk * 4;

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
      // Single paragraph too long: split by sentences
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
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[...content truncated to fit context window]';
}
