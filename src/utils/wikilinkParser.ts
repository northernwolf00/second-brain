export function extractWikilinks(body: string): string[] {
  const regex = /\[\[([^\[\]]+)\]\]/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(body)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}
