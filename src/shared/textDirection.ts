/**
 * RTL / language helpers for Persian-English bilingual content.
 * Direction is always derived from the TEXT itself (first strong character),
 * never from which action produced it — mixed-language output is common.
 */

/** First-strong-character RTL detection: Arabic/Persian blocks vs Latin letters. */
export function isRTL(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    // Arabic (0600–06FF), Arabic Supplement (0750–077F), Arabic Presentation Forms (FB50–FDFF, FE70–FEFF)
    if ((code >= 0x0600 && code <= 0x077f) || (code >= 0xfb50 && code <= 0xfdff) || (code >= 0xfe70 && code <= 0xfeff)) {
      return true;
    }
    // Basic Latin letters — digits and punctuation are neutral, keep scanning
    if ((code >= 0x0041 && code <= 0x005a) || (code >= 0x0061 && code <= 0x007a)) {
      return false;
    }
  }
  return false;
}

/** BCP-47 tag for TTS: Persian voice for RTL text, English otherwise. */
export function detectLangTag(text: string): string {
  return isRTL(text) ? 'fa-IR' : 'en-US';
}

/** 'en→fa' style pair label for vocabulary entries. */
export function langPairLabel(source: string, translation: string): string {
  const from = isRTL(source) ? 'fa' : 'en';
  const to = isRTL(translation) ? 'fa' : 'en';
  return `${from}→${to}`;
}
