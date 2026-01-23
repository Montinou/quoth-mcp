// src/lib/content/docs.ts

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { DocPage, DocSection, DocHeading } from './types';

const DOCS_DIR = path.join(process.cwd(), 'content/docs');

const SECTION_TITLES: Record<string, string> = {
  'getting-started': 'Getting Started',
  'guides': 'Guides',
  'reference': 'Reference',
  'dashboard': 'Dashboard',
};

function extractHeadings(content: string): DocHeading[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const headings: DocHeading[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2],
      slug: match[2].toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
    });
  }

  return headings;
}

export async function getDocsSidebar(): Promise<DocSection[]> {
  const sections = ['getting-started', 'guides', 'reference', 'dashboard'];

  return sections.map(section => {
    const sectionDir = path.join(DOCS_DIR, section);

    if (!fs.existsSync(sectionDir)) {
      return { title: SECTION_TITLES[section], slug: section, pages: [] };
    }

    const files = fs.readdirSync(sectionDir).filter(f => f.endsWith('.mdx'));

    const pages = files.map(filename => {
      const filePath = path.join(sectionDir, filename);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(fileContent);

      return {
        title: data.title || filename.replace('.mdx', ''),
        slug: [section, filename.replace('.mdx', '')],
        order: data.order || 99,
      };
    }).sort((a, b) => (a.order || 99) - (b.order || 99));

    return {
      title: SECTION_TITLES[section],
      slug: section,
      pages,
    };
  }).filter(section => section.pages.length > 0);
}

export async function getDocBySlug(slugParts: string[]): Promise<DocPage | null> {
  const filePath = path.join(DOCS_DIR, ...slugParts) + '.mdx';

  if (!fs.existsSync(filePath)) return null;

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(fileContent);

  const headings = extractHeadings(content);

  return {
    ...data,
    slug: slugParts,
    content,
    headings,
  } as DocPage;
}

export async function getAdjacentDocs(currentSlug: string[]): Promise<{
  prev: Pick<DocPage, 'title' | 'slug'> | null;
  next: Pick<DocPage, 'title' | 'slug'> | null;
}> {
  const sidebar = await getDocsSidebar();
  const allPages = sidebar.flatMap(section => section.pages);

  const currentIndex = allPages.findIndex(
    page => page.slug.join('/') === currentSlug.join('/')
  );

  return {
    prev: currentIndex > 0 ? allPages[currentIndex - 1] : null,
    next: currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null,
  };
}
