/**
 * How skill names are compared. Two spellings mean the same skill when their
 * keys are equal: case, spaces, dots, dashes and slashes don't matter, and a
 * trailing "js" is dropped ("React.js", "ReactJS" and "react" are all
 * "react"; "Node.js" and "node-js" are "node"). "+" and "#" are kept as words
 * so "C++" and "C#" stay apart from "C".
 */
export function skillKey(value: string): string {
  const key = String(value ?? '')
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
  // "reactjs" -> "react", but "js" on its own stays "js".
  return key.length > 2 && key.endsWith('js') ? key.slice(0, -2) : key;
}

/** The URL-friendly id of a skill: "Node.js" -> "node-js". */
export function skillSlug(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/#/g, ' sharp ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "react, node-js,,React " -> ["react", "node-js", "React"] (trimmed, no blanks). */
export function splitSkillList(value: string | string[] | undefined): string[] {
  const parts = Array.isArray(value) ? value : String(value ?? '').split(',');
  return parts.map((part) => String(part).trim()).filter(Boolean);
}
