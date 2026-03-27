import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

const cache = new Map<string, string>();

/** Get the syntax directory — works in both dev and packaged modes */
function getSyntaxDir(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return join(app.getAppPath(), 'resources', 'syntax');
  }
  return join(process.resourcesPath, 'syntax');
}

function readCached(filePath: string): string | null {
  if (cache.has(filePath)) return cache.get(filePath)!;
  try {
    const content = readFileSync(filePath, 'utf-8');
    cache.set(filePath, content);
    return content;
  } catch {
    return null;
  }
}

/** Returns the guidelines.md content (cached) */
export function getSyntaxGuidelines(): string {
  return readCached(join(getSyntaxDir(), 'guidelines.md')) ?? '';
}

/** Returns a compact topic listing built from index.md (cached) */
export function getSyntaxIndex(): string {
  return readCached(join(getSyntaxDir(), 'index.md')) ?? '';
}

/** Returns a single syntax file's content by topic name */
export function getSyntaxFile(topic: string): string | null {
  // Sanitize: only allow alphanumeric, hyphens, underscores
  const safe = topic.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe) return null;

  const filePath = join(getSyntaxDir(), `${safe}.md`);
  return readCached(filePath);
}

/** List all available syntax topic names */
export function listSyntaxTopics(): string[] {
  try {
    return readdirSync(getSyntaxDir())
      .filter((f) => f.endsWith('.md') && f !== 'index.md' && f !== 'guidelines.md')
      .map((f) => f.replace(/\.md$/, ''))
      .sort();
  } catch {
    return [];
  }
}
