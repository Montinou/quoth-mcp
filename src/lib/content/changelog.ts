// src/lib/content/changelog.ts

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { ChangelogEntry } from './types';

const CHANGELOG_DIR = path.join(process.cwd(), 'content/changelog');

export async function getAllChangelogs(): Promise<ChangelogEntry[]> {
  if (!fs.existsSync(CHANGELOG_DIR)) return [];

  const files = fs.readdirSync(CHANGELOG_DIR).filter(f => f.endsWith('.mdx'));

  const entries = files.map(filename => {
    const filePath = path.join(CHANGELOG_DIR, filename);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { data, content } = matter(fileContent);

    return {
      ...data,
      date: data.date || filename.replace('.mdx', ''),
      content,
    } as ChangelogEntry;
  });

  return entries.sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function groupChangelogsByMonth(entries: ChangelogEntry[]): Record<string, ChangelogEntry[]> {
  const grouped: Record<string, ChangelogEntry[]> = {};

  entries.forEach(entry => {
    const date = new Date(entry.date);
    const monthKey = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });

    if (!grouped[monthKey]) grouped[monthKey] = [];
    grouped[monthKey].push(entry);
  });

  return grouped;
}

export function formatChangelogDate(dateStr: string): { month: string; day: string; year: string } {
  const date = new Date(dateStr);
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    day: date.getDate().toString(),
    year: date.getFullYear().toString(),
  };
}
