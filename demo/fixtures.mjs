/**
 * Everything the demo shows: the web page text and the canned "AI" answers.
 * Shared by the demo site and the mock LLM server so they always agree.
 */

export const PAGE_TITLE = 'Why platform teams stopped hand-feeding their servers';

// The sentence the "Explain" scene selects. The paragraph around it is what
// gives it meaning — that is the point of the demo.
export const EXPLAIN_SENTENCE =
  'This is why most platform teams now treat a cluster as a replaceable unit rather than a pet.';

export const TRANSLATE_SENTENCE =
  'Teams that automate their deployments ship faster and sleep better.';

export const BROKEN_TEXT =
  'Hi team, i has finish the report yesterday and send it to the manager, please to check it.';
export const FIXED_TEXT =
  'Hi team, I finished the report yesterday and sent it to the manager. Please check it.';

export const MANUAL_INPUT = 'Where can I find the release notes for this version?';

export const ANSWERS = {
  explain: `**In this context:** the earlier lines describe servers that engineers named and nursed back to health by hand — the "pet" model.

So the sentence means: because rebuilding is now cheap and automated, teams replace a cluster instead of protecting it.`,

  translate: 'تیم‌هایی که استقرارهای خود را خودکار می‌کنند، سریع‌تر عرضه می‌کنند و آسوده‌تر می‌خوابند.',

  manual: 'نسخه‌ی یادداشت‌های انتشار این نسخه را کجا می‌توانم پیدا کنم؟',

  summary: `**Summary**
The article explains why platform teams moved from hand-maintained servers to clusters that are created, replaced, and discarded automatically.

**Key Points**
- Hand-fed "pet" servers are slow to repair and risky to lose.
- Automated builds make clusters cheap to recreate.
- Declarative configuration keeps every environment consistent.
- Faster, safer deployments free teams to ship more often.

**Action Items**
- Describe your infrastructure as code.
- Rebuild instead of repairing.`,

  fixGrammar: new Map([[BROKEN_TEXT, FIXED_TEXT]]),
};
