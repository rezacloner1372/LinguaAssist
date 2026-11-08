/**
 * "Replace in place": remember where the user's selection lives so a result
 * (grammar fix, rewrite, translation…) can be written back over it later,
 * after focus has moved into the LinguaAssist panel.
 */

export interface ReplaceTarget {
  /** Write `text` over the original selection. Returns false if it can't be done safely. */
  apply(text: string): boolean;
}

export type TextField = HTMLInputElement | HTMLTextAreaElement;

const TEXT_INPUT_TYPES = /^(text|search|url|email|tel)?$/;

/** Plain-text <input>/<textarea> (not password, number, date…). */
export function isTextField(el: Element | null): el is TextField {
  return (
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && TEXT_INPUT_TYPES.test(el.type))
  );
}

/** Keep the original selection's surrounding whitespace (the model gets trimmed text). */
function withOriginalPadding(original: string, replacement: string): string {
  const lead = original.match(/^\s*/)?.[0] ?? '';
  const trail = original.match(/\s*$/)?.[0] ?? '';
  return lead + replacement.trim() + trail;
}

/**
 * Set a field's value the way a user edit would. Frameworks like React track
 * the value via the prototype setter, so assigning `el.value` directly can
 * be silently ignored on the next render.
 */
function setFieldValue(field: TextField, value: string): void {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(field, value);
  else field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Target for a selection inside an <input>/<textarea>. */
export function makeFieldTarget(field: TextField, start: number, end: number): ReplaceTarget | undefined {
  if (field.readOnly || field.disabled || end <= start) return undefined;
  const original = field.value.slice(start, end);

  return {
    apply(text: string): boolean {
      // Bail if the user edited the field since selecting — don't clobber their changes
      if (!field.isConnected || field.value.slice(start, end) !== original) return false;
      const replacement = withOriginalPadding(original, text);
      setFieldValue(field, field.value.slice(0, start) + replacement + field.value.slice(end));
      field.focus();
      const caret = start + replacement.length;
      field.setSelectionRange(caret, caret);
      return true;
    },
  };
}

/** Closest ancestor that is an editable rich-text host (Gmail, Notion, Slack…). */
function findEditableHost(node: Node | null): HTMLElement | null {
  let el: Element | null = node instanceof Element ? node : node?.parentElement ?? null;
  while (el) {
    if (el instanceof HTMLElement && el.isContentEditable) {
      // isContentEditable is inherited; walk up to the outermost editing host
      let host: HTMLElement = el;
      while (host.parentElement?.isContentEditable) host = host.parentElement;
      return host;
    }
    el = el.parentElement;
  }
  return null;
}

/** Target for a selection inside a contenteditable region. */
export function makeEditableTarget(selection: Selection): ReplaceTarget | undefined {
  if (selection.rangeCount === 0 || selection.isCollapsed) return undefined;
  const range = selection.getRangeAt(0).cloneRange();
  const host = findEditableHost(range.commonAncestorContainer);
  if (!host) return undefined;
  const original = range.toString();

  return {
    apply(text: string): boolean {
      if (!host.isConnected || range.toString() !== original) return false;
      const replacement = withOriginalPadding(original, text);

      host.focus();
      const sel = window.getSelection();
      if (!sel) return false;
      sel.removeAllRanges();
      sel.addRange(range);

      // execCommand keeps the editor's undo stack and fires the events rich
      // editors listen for; it is deprecated but still the reliable path.
      if (document.execCommand('insertText', false, replacement)) return true;

      // Fallback: raw DOM edit (editors may not notice, but the text changes)
      range.deleteContents();
      range.insertNode(document.createTextNode(replacement));
      host.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    },
  };
}
