# Docs, Blog & Changelog Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete MDX-based content system with Blog, Changelog, and Documentation pages.

**Architecture:** MDX files in `/content` directory, loaded via gray-matter, rendered with custom components. Blog and Changelog are public marketing pages. Docs has sidebar + TOC layout.

**Tech Stack:** Next.js 16, MDX, gray-matter (already installed), next-mdx-remote, rehype/remark plugins, Lucide icons.

---

## Task 1: Install MDX Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install the MDX dependencies**

Run: `npm install next-mdx-remote@5 @mdx-js/react@3 remark-gfm@4 rehype-slug@6 rehype-autolink-headings@7`

Expected: Packages installed successfully

**Step 2: Verify installation**

Run: `npm ls next-mdx-remote`
Expected: Shows next-mdx-remote@5.x.x

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add MDX dependencies for content system"
```

---

## Task 2: Create Content Directory Structure

**Files:**
- Create: `content/blog/.gitkeep`
- Create: `content/changelog/.gitkeep`
- Create: `content/docs/getting-started/.gitkeep`
- Create: `content/docs/guides/.gitkeep`
- Create: `content/docs/reference/.gitkeep`
- Create: `content/docs/dashboard/.gitkeep`

**Step 1: Create the directory structure**

```bash
mkdir -p content/blog content/changelog content/docs/getting-started content/docs/guides content/docs/reference content/docs/dashboard
touch content/blog/.gitkeep content/changelog/.gitkeep content/docs/getting-started/.gitkeep content/docs/guides/.gitkeep content/docs/reference/.gitkeep content/docs/dashboard/.gitkeep
```

**Step 2: Verify directories exist**

Run: `ls -la content/`
Expected: Shows blog, changelog, docs directories

**Step 3: Commit**

```bash
git add content/
git commit -m "chore: create content directory structure for MDX"
```

---

## Task 3: Create Content Type Definitions

**Files:**
- Create: `src/lib/content/types.ts`

**Step 1: Write the TypeScript types**

```typescript
// src/lib/content/types.ts

export interface BlogPost {
  title: string;
  description: string;
  date: string;
  author: string;
  slug: string;
  tags?: string[];
  image?: string;
  featured?: boolean;
  draft?: boolean;
  readingTime?: number;
  content: string;
}

export interface ChangelogEntry {
  date: string;
  version?: string;
  title?: string;
  content: string;
}

export interface DocHeading {
  level: number;
  text: string;
  slug: string;
}

export interface DocPage {
  title: string;
  description: string;
  slug: string[];
  order?: number;
  icon?: string;
  draft?: boolean;
  content: string;
  headings: DocHeading[];
}

export interface DocSection {
  title: string;
  slug: string;
  pages: Pick<DocPage, 'title' | 'slug' | 'order'>[];
}
```

**Step 2: Verify file created**

Run: `cat src/lib/content/types.ts | head -20`
Expected: Shows the interface definitions

**Step 3: Commit**

```bash
git add src/lib/content/types.ts
git commit -m "feat(content): add TypeScript types for blog, changelog, docs"
```

---

## Task 4: Create Blog Content Loader

**Files:**
- Create: `src/lib/content/blog.ts`

**Step 1: Write the blog content loader**

```typescript
// src/lib/content/blog.ts

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { BlogPost } from './types';

const BLOG_DIR = path.join(process.cwd(), 'content/blog');

function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

export async function getAllPosts(): Promise<BlogPost[]> {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.mdx'));

  const posts = files.map(filename => {
    const filePath = path.join(BLOG_DIR, filename);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { data, content } = matter(fileContent);

    return {
      ...data,
      slug: filename.replace('.mdx', ''),
      content,
      readingTime: data.readingTime || calculateReadingTime(content),
    } as BlogPost;
  });

  return posts
    .filter(p => !p.draft)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);

  if (!fs.existsSync(filePath)) return null;

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(fileContent);

  return {
    ...data,
    slug,
    content,
    readingTime: data.readingTime || calculateReadingTime(content),
  } as BlogPost;
}

export async function getFeaturedPost(): Promise<BlogPost | null> {
  const posts = await getAllPosts();
  return posts.find(p => p.featured) || posts[0] || null;
}

export async function getRelatedPosts(currentSlug: string, tags: string[] = [], limit = 3): Promise<BlogPost[]> {
  const posts = await getAllPosts();
  return posts
    .filter(p => p.slug !== currentSlug)
    .filter(p => p.tags?.some(t => tags.includes(t)))
    .slice(0, limit);
}
```

**Step 2: Verify file created**

Run: `cat src/lib/content/blog.ts | head -20`
Expected: Shows the imports and BLOG_DIR constant

**Step 3: Commit**

```bash
git add src/lib/content/blog.ts
git commit -m "feat(content): add blog content loader with reading time calculation"
```

---

## Task 5: Create Changelog Content Loader

**Files:**
- Create: `src/lib/content/changelog.ts`

**Step 1: Write the changelog content loader**

```typescript
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
```

**Step 2: Verify file created**

Run: `cat src/lib/content/changelog.ts | head -20`
Expected: Shows the imports and CHANGELOG_DIR constant

**Step 3: Commit**

```bash
git add src/lib/content/changelog.ts
git commit -m "feat(content): add changelog content loader with month grouping"
```

---

## Task 6: Create Docs Content Loader

**Files:**
- Create: `src/lib/content/docs.ts`

**Step 1: Write the docs content loader**

```typescript
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
```

**Step 2: Verify file created**

Run: `cat src/lib/content/docs.ts | head -20`
Expected: Shows the imports and DOCS_DIR constant

**Step 3: Commit**

```bash
git add src/lib/content/docs.ts
git commit -m "feat(content): add docs content loader with sidebar and TOC extraction"
```

---

## Task 7: Create Content Index Export

**Files:**
- Create: `src/lib/content/index.ts`

**Step 1: Write the barrel export**

```typescript
// src/lib/content/index.ts

export * from './types';
export * from './blog';
export * from './changelog';
export * from './docs';
```

**Step 2: Verify file created**

Run: `cat src/lib/content/index.ts`
Expected: Shows the export statements

**Step 3: Commit**

```bash
git add src/lib/content/index.ts
git commit -m "feat(content): add barrel export for content utilities"
```

---

## Task 8: Create Callout MDX Component

**Files:**
- Create: `src/components/mdx/Callout.tsx`

**Step 1: Write the Callout component**

```typescript
// src/components/mdx/Callout.tsx

import { Info, AlertTriangle, Lightbulb, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type CalloutType = 'info' | 'warning' | 'tip' | 'danger';

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}

const styles: Record<CalloutType, { icon: typeof Info; bg: string; border: string; text: string }> = {
  info: {
    icon: Info,
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
  },
  tip: {
    icon: Lightbulb,
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
  },
  danger: {
    icon: AlertCircle,
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
  },
};

export function Callout({ type = 'info', title, children }: CalloutProps) {
  const style = styles[type];
  const Icon = style.icon;

  return (
    <div className={cn(style.bg, style.border, 'border rounded-lg p-4 my-4')}>
      <div className="flex items-start gap-3">
        <Icon className={cn('w-5 h-5 mt-0.5 shrink-0', style.text)} strokeWidth={1.5} />
        <div className="flex-1 min-w-0">
          {title && <p className={cn('font-semibold mb-1', style.text)}>{title}</p>}
          <div className="text-gray-400 text-sm [&>p]:mb-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify file created**

Run: `cat src/components/mdx/Callout.tsx | head -20`
Expected: Shows the imports and type definitions

**Step 3: Commit**

```bash
git add src/components/mdx/Callout.tsx
git commit -m "feat(mdx): add Callout component with info/warning/tip/danger variants"
```

---

## Task 9: Create Steps MDX Component

**Files:**
- Create: `src/components/mdx/Steps.tsx`

**Step 1: Write the Steps and Step components**

```typescript
// src/components/mdx/Steps.tsx

'use client';

import React from 'react';

interface StepsProps {
  children: React.ReactNode;
}

interface StepProps {
  title: string;
  children: React.ReactNode;
}

export function Steps({ children }: StepsProps) {
  const childArray = React.Children.toArray(children);

  return (
    <div className="my-6">
      {childArray.map((child, index) => {
        if (React.isValidElement<StepProps>(child)) {
          return React.cloneElement(child, {
            ...child.props,
            // @ts-expect-error - injecting step number
            _stepNumber: index + 1,
            _isLast: index === childArray.length - 1,
          });
        }
        return child;
      })}
    </div>
  );
}

interface StepInternalProps extends StepProps {
  _stepNumber?: number;
  _isLast?: boolean;
}

export function Step({ title, children, _stepNumber = 1, _isLast = false }: StepInternalProps) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-violet-spectral/20 border border-violet-spectral/30 flex items-center justify-center text-violet-ghost font-semibold text-sm shrink-0">
          {_stepNumber}
        </div>
        {!_isLast && <div className="w-px flex-1 bg-violet-spectral/20 mt-2" />}
      </div>
      <div className={`flex-1 ${_isLast ? '' : 'pb-6'}`}>
        <h4 className="font-semibold text-white mb-2">{title}</h4>
        <div className="text-gray-400 text-sm [&>p]:mb-2 [&>pre]:my-2">{children}</div>
      </div>
    </div>
  );
}
```

**Step 2: Verify file created**

Run: `cat src/components/mdx/Steps.tsx | head -20`
Expected: Shows the imports and interface definitions

**Step 3: Commit**

```bash
git add src/components/mdx/Steps.tsx
git commit -m "feat(mdx): add Steps component with automatic numbering"
```

---

## Task 10: Create Card MDX Components

**Files:**
- Create: `src/components/mdx/Card.tsx`

**Step 1: Write the Card and CardGrid components**

```typescript
// src/components/mdx/Card.tsx

import Link from 'next/link';
import { ArrowRight, LucideIcon } from 'lucide-react';
import * as Icons from 'lucide-react';

interface CardProps {
  title: string;
  description: string;
  href: string;
  icon?: string;
}

export function Card({ title, description, href, icon }: CardProps) {
  const Icon = icon ? (Icons as Record<string, LucideIcon>)[icon] : null;

  return (
    <Link
      href={href}
      className="block glass-panel rounded-xl p-5 group hover:border-violet-spectral/30 transition-all duration-300"
    >
      {Icon && (
        <div className="p-2 rounded-lg bg-violet-spectral/15 w-fit mb-3">
          <Icon className="w-5 h-5 text-violet-spectral" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="font-semibold text-white mb-1 group-hover:text-violet-ghost transition-colors">
        {title}
      </h3>
      <p className="text-sm text-gray-500 mb-3">{description}</p>
      <span className="text-sm text-violet-spectral flex items-center gap-1">
        Learn more <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
      </span>
    </Link>
  );
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
      {children}
    </div>
  );
}
```

**Step 2: Verify file created**

Run: `cat src/components/mdx/Card.tsx | head -20`
Expected: Shows the imports and interfaces

**Step 3: Commit**

```bash
git add src/components/mdx/Card.tsx
git commit -m "feat(mdx): add Card and CardGrid components with dynamic icons"
```

---

## Task 11: Create MDX Components Provider

**Files:**
- Create: `src/components/mdx/MDXComponents.tsx`
- Create: `src/components/mdx/index.ts`

**Step 1: Write the MDX components mapping**

```typescript
// src/components/mdx/MDXComponents.tsx

import { Callout } from './Callout';
import { Steps, Step } from './Steps';
import { Card, CardGrid } from './Card';

export const mdxComponents = {
  // Override default elements with neo-noir styling
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-3xl font-bold font-cinzel text-white mt-8 mb-4" {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-2xl font-bold font-cinzel text-white mt-8 mb-3 scroll-mt-20" {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-xl font-semibold text-white mt-6 mb-2 scroll-mt-20" {...props} />
  ),
  h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4 className="text-lg font-semibold text-white mt-4 mb-2" {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-gray-400 leading-relaxed mb-4" {...props} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="text-violet-ghost hover:text-violet-spectral transition-colors underline underline-offset-2" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc list-inside text-gray-400 mb-4 space-y-1 ml-2" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal list-inside text-gray-400 mb-4 space-y-1 ml-2" {...props} />
  ),
  li: (props: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li className="text-gray-400" {...props} />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code className="bg-charcoal px-1.5 py-0.5 rounded text-violet-ghost text-sm font-mono" {...props} />
  ),
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre className="bg-charcoal border border-violet-spectral/20 rounded-lg p-4 overflow-x-auto my-4 text-sm" {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="border-l-2 border-violet-spectral pl-4 italic text-gray-500 my-4" {...props} />
  ),
  hr: () => <hr className="border-violet-spectral/20 my-8" />,
  table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm text-gray-400" {...props} />
    </div>
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="border-b border-violet-spectral/20 px-4 py-2 text-left text-white font-semibold" {...props} />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="border-b border-violet-spectral/10 px-4 py-2" {...props} />
  ),
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-white" {...props} />
  ),

  // Custom components
  Callout,
  Steps,
  Step,
  Card,
  CardGrid,
};
```

**Step 2: Write the barrel export**

```typescript
// src/components/mdx/index.ts

export { Callout } from './Callout';
export { Steps, Step } from './Steps';
export { Card, CardGrid } from './Card';
export { mdxComponents } from './MDXComponents';
```

**Step 3: Verify files created**

Run: `ls src/components/mdx/`
Expected: Callout.tsx, Card.tsx, index.ts, MDXComponents.tsx, Steps.tsx

**Step 4: Commit**

```bash
git add src/components/mdx/
git commit -m "feat(mdx): add MDX component provider with neo-noir styling"
```

---

## Task 12: Create MDX Renderer Component

**Files:**
- Create: `src/components/mdx/MDXContent.tsx`

**Step 1: Write the MDX renderer component**

```typescript
// src/components/mdx/MDXContent.tsx

import { MDXRemote } from 'next-mdx-remote/rsc';
import { mdxComponents } from './MDXComponents';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

interface MDXContentProps {
  source: string;
}

export async function MDXContent({ source }: MDXContentProps) {
  return (
    <MDXRemote
      source={source}
      components={mdxComponents}
      options={{
        mdxOptions: {
          remarkPlugins: [remarkGfm],
          rehypePlugins: [
            rehypeSlug,
            [rehypeAutolinkHeadings, { behavior: 'wrap' }],
          ],
        },
      }}
    />
  );
}
```

**Step 2: Update barrel export**

Add to `src/components/mdx/index.ts`:

```typescript
export { MDXContent } from './MDXContent';
```

**Step 3: Verify file created**

Run: `cat src/components/mdx/MDXContent.tsx`
Expected: Shows the MDXRemote component with plugins

**Step 4: Commit**

```bash
git add src/components/mdx/
git commit -m "feat(mdx): add MDXContent renderer with remark/rehype plugins"
```

---

## Task 13: Create Blog Listing Page

**Files:**
- Create: `src/app/blog/page.tsx`

**Step 1: Write the blog listing page**

```typescript
// src/app/blog/page.tsx

import { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts, getFeaturedPost } from '@/lib/content/blog';
import { Navbar } from '@/components/quoth/Navbar';
import { Footer } from '@/components/quoth/Footer';
import { Calendar, Clock, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog | Quoth',
  description: 'Announcements, tutorials, and thoughts on AI-native documentation',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function BlogPage() {
  const posts = await getAllPosts();
  const featured = await getFeaturedPost();
  const otherPosts = posts.filter(p => p.slug !== featured?.slug);

  return (
    <div className="min-h-screen bg-obsidian">
      <Navbar />

      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold font-cinzel text-white mb-4">
              Quoth Blog
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Announcements, tutorials, and thoughts on AI-native documentation
            </p>
          </div>

          {/* Featured Post */}
          {featured && (
            <Link
              href={`/blog/${featured.slug}`}
              className="block glass-panel rounded-2xl p-8 mb-12 group hover:border-violet-spectral/30 transition-all duration-300"
            >
              <div className="flex flex-wrap gap-2 mb-4">
                {featured.tags?.map(tag => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-xs font-medium rounded-full bg-violet-spectral/15 text-violet-ghost border border-violet-spectral/30"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h2 className="text-2xl md:text-3xl font-bold font-cinzel text-white mb-3 group-hover:text-violet-ghost transition-colors">
                {featured.title}
              </h2>
              <p className="text-gray-400 mb-4 line-clamp-2">
                {featured.description}
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" strokeWidth={1.5} />
                  {formatDate(featured.date)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" strokeWidth={1.5} />
                  {featured.readingTime} min read
                </span>
                <span className="ml-auto text-violet-spectral flex items-center gap-1">
                  Read more <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </Link>
          )}

          {/* Posts Grid */}
          {otherPosts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherPosts.map(post => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="glass-panel rounded-xl p-6 group hover:border-violet-spectral/30 transition-all duration-300"
                >
                  <div className="flex flex-wrap gap-2 mb-3">
                    {post.tags?.slice(0, 2).map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs font-medium rounded-full bg-violet-spectral/10 text-violet-ghost"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-violet-ghost transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                    {post.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-600">
                    <span>{formatDate(post.date)}</span>
                    <span>•</span>
                    <span>{post.readingTime} min</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Empty State */}
          {posts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-500">No blog posts yet. Check back soon!</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
```

**Step 2: Verify file created**

Run: `cat src/app/blog/page.tsx | head -20`
Expected: Shows the imports and metadata

**Step 3: Commit**

```bash
git add src/app/blog/page.tsx
git commit -m "feat(blog): add blog listing page with featured post"
```

---

## Task 14: Create Blog Post Page

**Files:**
- Create: `src/app/blog/[slug]/page.tsx`

**Step 1: Write the blog post page**

```typescript
// src/app/blog/[slug]/page.tsx

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPostBySlug, getAllPosts, getRelatedPosts } from '@/lib/content/blog';
import { MDXContent } from '@/components/mdx';
import { Navbar } from '@/components/quoth/Navbar';
import { Footer } from '@/components/quoth/Footer';
import { Calendar, Clock, ArrowLeft, ArrowRight } from 'lucide-react';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map(post => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) return { title: 'Post Not Found' };

  return {
    title: `${post.title} | Quoth Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      images: post.image ? [post.image] : ['/og-default.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) notFound();

  const relatedPosts = await getRelatedPosts(slug, post.tags || []);

  return (
    <div className="min-h-screen bg-obsidian">
      <Navbar />

      <main className="pt-24 pb-16 px-4 sm:px-6">
        <article className="max-w-3xl mx-auto">
          {/* Back link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-violet-ghost transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            Back to Blog
          </Link>

          {/* Header */}
          <header className="mb-8">
            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags?.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 text-xs font-medium rounded-full bg-violet-spectral/15 text-violet-ghost border border-violet-spectral/30"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-bold font-cinzel text-white mb-4">
              {post.title}
            </h1>

            {/* Description */}
            <p className="text-xl text-gray-400 mb-6">
              {post.description}
            </p>

            {/* Meta */}
            <div className="flex items-center gap-4 text-sm text-gray-500 pb-6 border-b border-violet-spectral/20">
              <span className="text-white font-medium">{post.author}</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" strokeWidth={1.5} />
                {formatDate(post.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" strokeWidth={1.5} />
                {post.readingTime} min read
              </span>
            </div>
          </header>

          {/* Content */}
          <div className="prose-quoth">
            <MDXContent source={post.content} />
          </div>
        </article>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="max-w-3xl mx-auto mt-16 pt-8 border-t border-violet-spectral/20">
            <h2 className="text-xl font-bold font-cinzel text-white mb-6">Related Posts</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {relatedPosts.map(related => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="glass-panel rounded-lg p-4 group hover:border-violet-spectral/30 transition-all"
                >
                  <h3 className="font-semibold text-white mb-1 group-hover:text-violet-ghost transition-colors line-clamp-2">
                    {related.title}
                  </h3>
                  <p className="text-xs text-gray-500">{related.readingTime} min read</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
```

**Step 2: Verify file created**

Run: `cat src/app/blog/[slug]/page.tsx | head -20`
Expected: Shows the imports and Props interface

**Step 3: Commit**

```bash
git add src/app/blog/
git commit -m "feat(blog): add individual blog post page with MDX rendering"
```

---

## Task 15: Create Changelog Page

**Files:**
- Create: `src/app/changelog/page.tsx`

**Step 1: Write the changelog page**

```typescript
// src/app/changelog/page.tsx

import { Metadata } from 'next';
import { getAllChangelogs, groupChangelogsByMonth, formatChangelogDate } from '@/lib/content/changelog';
import { MDXContent } from '@/components/mdx';
import { Navbar } from '@/components/quoth/Navbar';
import { Footer } from '@/components/quoth/Footer';
import { Rss } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Changelog | Quoth',
  description: 'Track the evolution of Quoth - new features, improvements, and fixes',
};

export default async function ChangelogPage() {
  const entries = await getAllChangelogs();
  const grouped = groupChangelogsByMonth(entries);

  return (
    <div className="min-h-screen bg-obsidian">
      <Navbar />

      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-12">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold font-cinzel text-white mb-4">
                Changelog
              </h1>
              <p className="text-gray-400 text-lg">
                Track Quoth&apos;s evolution
              </p>
            </div>
            <a
              href="/changelog/rss.xml"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-violet-ghost glass-panel rounded-lg transition-colors"
            >
              <Rss className="w-4 h-4" strokeWidth={1.5} />
              RSS
            </a>
          </div>

          {/* Timeline */}
          {Object.entries(grouped).map(([monthYear, monthEntries]) => (
            <div key={monthYear} className="mb-12">
              {/* Month Header */}
              <h2 className="text-lg font-semibold text-gray-500 mb-6 pb-2 border-b border-violet-spectral/20">
                {monthYear}
              </h2>

              {/* Entries */}
              <div className="space-y-8">
                {monthEntries.map((entry, index) => {
                  const { month, day } = formatChangelogDate(entry.date);

                  return (
                    <div key={entry.date + index} className="flex gap-6">
                      {/* Date Column */}
                      <div className="w-16 shrink-0 text-center">
                        <div className="text-sm text-gray-500">{month}</div>
                        <div className="text-2xl font-bold text-white">{day}</div>
                        {/* Timeline dot and line */}
                        <div className="relative mt-3">
                          <div className="w-3 h-3 rounded-full bg-violet-spectral mx-auto" />
                          {index < monthEntries.length - 1 && (
                            <div className="absolute left-1/2 -translate-x-1/2 top-3 w-px h-full bg-violet-spectral/20" style={{ height: 'calc(100% + 2rem)' }} />
                          )}
                        </div>
                      </div>

                      {/* Content Column */}
                      <div className="flex-1 glass-panel rounded-xl p-6">
                        {/* Version badge and title */}
                        <div className="flex items-center gap-3 mb-4">
                          {entry.version && (
                            <span className="px-3 py-1 text-sm font-mono font-medium rounded-full bg-violet-spectral/20 text-violet-ghost border border-violet-spectral/30">
                              v{entry.version}
                            </span>
                          )}
                          {entry.title && (
                            <h3 className="text-xl font-bold text-white">{entry.title}</h3>
                          )}
                        </div>

                        {/* MDX Content */}
                        <div className="prose-quoth text-sm [&>h2]:text-base [&>h2]:mt-4 [&>h2]:mb-2 [&>ul]:my-2">
                          <MDXContent source={entry.content} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Empty State */}
          {entries.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-500">No changelog entries yet.</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
```

**Step 2: Verify file created**

Run: `cat src/app/changelog/page.tsx | head -20`
Expected: Shows the imports and metadata

**Step 3: Commit**

```bash
git add src/app/changelog/page.tsx
git commit -m "feat(changelog): add changelog timeline page with month grouping"
```

---

## Task 16: Create Docs Layout with Sidebar

**Files:**
- Create: `src/app/docs/layout.tsx`
- Create: `src/components/docs/DocsSidebar.tsx`

**Step 1: Write the docs sidebar component**

```typescript
// src/components/docs/DocsSidebar.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import type { DocSection } from '@/lib/content/types';

interface DocsSidebarProps {
  sections: DocSection[];
}

export function DocsSidebar({ sections }: DocsSidebarProps) {
  const pathname = usePathname();

  return (
    <nav className="w-64 shrink-0 hidden lg:block">
      <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pb-8 pr-4">
        {sections.map(section => (
          <div key={section.slug} className="mb-6">
            <h3 className="text-sm font-semibold text-white mb-2 px-3">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.pages.map(page => {
                const href = `/docs/${page.slug.join('/')}`;
                const isActive = pathname === href;

                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors',
                        isActive
                          ? 'bg-violet-spectral/15 text-violet-ghost border-l-2 border-violet-spectral'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      )}
                    >
                      <ChevronRight className={cn(
                        'w-3 h-3 transition-transform',
                        isActive && 'text-violet-spectral'
                      )} strokeWidth={1.5} />
                      {page.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
```

**Step 2: Write the docs layout**

```typescript
// src/app/docs/layout.tsx

import { getDocsSidebar } from '@/lib/content/docs';
import { Navbar } from '@/components/quoth/Navbar';
import { Footer } from '@/components/quoth/Footer';
import { DocsSidebar } from '@/components/docs/DocsSidebar';

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sections = await getDocsSidebar();

  return (
    <div className="min-h-screen bg-obsidian">
      <Navbar />

      <div className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex gap-8">
          <DocsSidebar sections={sections} />
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
```

**Step 3: Verify files created**

Run: `ls src/app/docs/ && ls src/components/docs/`
Expected: layout.tsx and DocsSidebar.tsx

**Step 4: Commit**

```bash
git add src/app/docs/layout.tsx src/components/docs/DocsSidebar.tsx
git commit -m "feat(docs): add docs layout with collapsible sidebar navigation"
```

---

## Task 17: Create Docs Index Page

**Files:**
- Create: `src/app/docs/page.tsx`

**Step 1: Write the docs index page**

```typescript
// src/app/docs/page.tsx

import { Metadata } from 'next';
import Link from 'next/link';
import { getDocsSidebar } from '@/lib/content/docs';
import { BookOpen, Zap, Code, BarChart, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Documentation | Quoth',
  description: 'Learn how to use Quoth - the documentation layer for AI-native development',
};

const sectionIcons: Record<string, typeof BookOpen> = {
  'getting-started': Zap,
  'guides': BookOpen,
  'reference': Code,
  'dashboard': BarChart,
};

export default async function DocsPage() {
  const sections = await getDocsSidebar();

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold font-cinzel text-white mb-4">
          Documentation
        </h1>
        <p className="text-gray-400 text-lg">
          Learn how to use Quoth to keep your AI in sync with your codebase.
        </p>
      </div>

      {/* Quick Start CTA */}
      <Link
        href="/docs/getting-started/quick-start"
        className="block glass-panel rounded-xl p-6 mb-12 group hover:border-violet-spectral/30 transition-all"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white mb-2 group-hover:text-violet-ghost transition-colors">
              Quick Start
            </h2>
            <p className="text-gray-400">Get Quoth running in 5 minutes</p>
          </div>
          <ArrowRight className="w-6 h-6 text-violet-spectral group-hover:translate-x-2 transition-transform" strokeWidth={1.5} />
        </div>
      </Link>

      {/* Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map(section => {
          const Icon = sectionIcons[section.slug] || BookOpen;
          const firstPage = section.pages[0];

          return (
            <div key={section.slug} className="glass-panel rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-violet-spectral/15">
                  <Icon className="w-5 h-5 text-violet-spectral" strokeWidth={1.5} />
                </div>
                <h2 className="text-lg font-bold text-white">{section.title}</h2>
              </div>
              <ul className="space-y-2">
                {section.pages.map(page => (
                  <li key={page.slug.join('/')}>
                    <Link
                      href={`/docs/${page.slug.join('/')}`}
                      className="text-gray-400 hover:text-violet-ghost transition-colors text-sm flex items-center gap-2"
                    >
                      <span className="w-1 h-1 rounded-full bg-gray-600" />
                      {page.title}
                    </Link>
                  </li>
                ))}
              </ul>
              {firstPage && (
                <Link
                  href={`/docs/${firstPage.slug.join('/')}`}
                  className="inline-flex items-center gap-1 mt-4 text-sm text-violet-spectral hover:text-violet-ghost transition-colors"
                >
                  Get started <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {sections.length === 0 && (
        <div className="text-center py-16 glass-panel rounded-xl">
          <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-gray-500">Documentation coming soon!</p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify file created**

Run: `cat src/app/docs/page.tsx | head -20`
Expected: Shows the imports and metadata

**Step 3: Commit**

```bash
git add src/app/docs/page.tsx
git commit -m "feat(docs): add docs index page with section overview"
```

---

## Task 18: Create Docs Dynamic Page with TOC

**Files:**
- Create: `src/app/docs/[...slug]/page.tsx`
- Create: `src/components/docs/TableOfContents.tsx`

**Step 1: Write the table of contents component**

```typescript
// src/components/docs/TableOfContents.tsx

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { DocHeading } from '@/lib/content/types';

interface TableOfContentsProps {
  headings: DocHeading[];
}

export function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-80px 0px -80% 0px' }
    );

    headings.forEach(heading => {
      const element = document.getElementById(heading.slug);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav className="w-56 shrink-0 hidden xl:block">
      <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
        <h4 className="text-sm font-semibold text-white mb-3">On this page</h4>
        <ul className="space-y-2 text-sm">
          {headings.map(heading => (
            <li
              key={heading.slug}
              style={{ paddingLeft: `${(heading.level - 2) * 0.75}rem` }}
            >
              <a
                href={`#${heading.slug}`}
                className={cn(
                  'block py-1 transition-colors',
                  activeId === heading.slug
                    ? 'text-violet-ghost'
                    : 'text-gray-500 hover:text-gray-300'
                )}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
```

**Step 2: Write the dynamic docs page**

```typescript
// src/app/docs/[...slug]/page.tsx

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDocBySlug, getDocsSidebar, getAdjacentDocs } from '@/lib/content/docs';
import { MDXContent } from '@/components/mdx';
import { TableOfContents } from '@/components/docs/TableOfContents';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  params: Promise<{ slug: string[] }>;
}

export async function generateStaticParams() {
  const sections = await getDocsSidebar();
  return sections.flatMap(section =>
    section.pages.map(page => ({ slug: page.slug }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDocBySlug(slug);

  if (!doc) return { title: 'Page Not Found' };

  return {
    title: `${doc.title} | Quoth Docs`,
    description: doc.description,
  };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const doc = await getDocBySlug(slug);

  if (!doc) notFound();

  const { prev, next } = await getAdjacentDocs(slug);

  return (
    <div className="flex gap-8">
      {/* Main Content */}
      <article className="flex-1 min-w-0 max-w-3xl">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/docs" className="hover:text-violet-ghost transition-colors">
            Docs
          </Link>
          {slug.map((part, i) => (
            <span key={i} className="flex items-center gap-2">
              <ChevronRight className="w-3 h-3" />
              <span className={i === slug.length - 1 ? 'text-gray-300' : ''}>
                {part.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </span>
            </span>
          ))}
        </nav>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold font-cinzel text-white mb-3">
            {doc.title}
          </h1>
          <p className="text-gray-400 text-lg">
            {doc.description}
          </p>
        </header>

        {/* Content */}
        <div className="prose-quoth">
          <MDXContent source={doc.content} />
        </div>

        {/* Prev/Next Navigation */}
        <nav className="flex items-center justify-between mt-12 pt-6 border-t border-violet-spectral/20">
          {prev ? (
            <Link
              href={`/docs/${prev.slug.join('/')}`}
              className="flex items-center gap-2 text-gray-400 hover:text-violet-ghost transition-colors"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
              <div>
                <div className="text-xs text-gray-600">Previous</div>
                <div className="font-medium">{prev.title}</div>
              </div>
            </Link>
          ) : <div />}
          {next ? (
            <Link
              href={`/docs/${next.slug.join('/')}`}
              className="flex items-center gap-2 text-gray-400 hover:text-violet-ghost transition-colors text-right"
            >
              <div>
                <div className="text-xs text-gray-600">Next</div>
                <div className="font-medium">{next.title}</div>
              </div>
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </Link>
          ) : <div />}
        </nav>
      </article>

      {/* Table of Contents */}
      <TableOfContents headings={doc.headings} />
    </div>
  );
}
```

**Step 3: Create components/docs barrel export**

```typescript
// src/components/docs/index.ts

export { DocsSidebar } from './DocsSidebar';
export { TableOfContents } from './TableOfContents';
```

**Step 4: Verify files created**

Run: `ls src/app/docs/ && ls src/components/docs/`
Expected: Shows [slug] directory and component files

**Step 5: Commit**

```bash
git add src/app/docs/ src/components/docs/
git commit -m "feat(docs): add dynamic doc page with TOC and prev/next navigation"
```

---

## Task 19: Update Navigation Links

**Files:**
- Modify: `src/components/quoth/Navbar.tsx`
- Modify: `src/components/quoth/Footer.tsx`

**Step 1: Update Navbar default links**

In `src/components/quoth/Navbar.tsx`, change lines 26-31:

```typescript
const defaultLinks: NavLink[] = [
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Blog" },
  { href: "/changelog", label: "Changelog" },
  { href: "/pricing", label: "Pricing" },
];
```

**Step 2: Update Footer default links**

In `src/components/quoth/Footer.tsx`, change lines 17-22:

```typescript
const defaultLinks: FooterLink[] = [
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Blog" },
  { href: "/changelog", label: "Changelog" },
  { href: "/pricing", label: "Pricing" },
];
```

**Step 3: Verify changes**

Run: `grep -A4 "defaultLinks" src/components/quoth/Navbar.tsx`
Expected: Shows the new navigation links

**Step 4: Commit**

```bash
git add src/components/quoth/Navbar.tsx src/components/quoth/Footer.tsx
git commit -m "feat(nav): update navigation with Docs, Blog, Changelog links"
```

---

## Task 20: Create Sample Blog Post

**Files:**
- Create: `content/blog/2026-01-23-introducing-quoth.mdx`

**Step 1: Write sample blog post**

```mdx
---
title: "Introducing Quoth: The Documentation Layer for AI"
description: "Your AI hallucinates because it doesn't know your codebase. Quoth fixes that."
date: 2026-01-23
author: "Agustin Montoya"
tags: ["announcement", "ai", "documentation"]
featured: true
---

Your AI assistant hallucinates because it doesn't know your codebase. It guesses at patterns, invents APIs, and confidently suggests code that doesn't match your architecture.

**Quoth changes that.**

## What is Quoth?

Quoth is an MCP server that acts as your codebase's "Single Source of Truth." It provides AI agents with verified documentation about your:

- **Architecture patterns** - How your codebase is structured
- **Testing conventions** - How tests should be written
- **API contracts** - What endpoints exist and their schemas
- **Code standards** - Your team's agreed-upon practices

<Callout type="tip" title="The Result">
  When your AI searches Quoth before writing code, it follows *your* patterns instead of generic ones.
</Callout>

## How It Works

<Steps>
  <Step title="Install Quoth MCP">
    Connect Quoth to Claude Code with one command:

    ```bash
    claude mcp add quoth
    ```
  </Step>

  <Step title="Run Genesis">
    Bootstrap your documentation in minutes:

    ```bash
    /prompt quoth_architect
    Run Genesis on this project
    ```
  </Step>

  <Step title="Write Better Code">
    Now every AI interaction is documentation-aware. Your AI searches Quoth automatically before generating code.
  </Step>
</Steps>

## Key Features

### Genesis: Bootstrap Docs in Minutes

Genesis analyzes your codebase and generates initial documentation automatically. Choose your depth:

- **Minimal** (3 docs, ~3 min) - Quick overview
- **Standard** (5 docs, ~7 min) - Team onboarding
- **Comprehensive** (11 docs, ~20 min) - Full audit

### Semantic Search

Find relevant patterns instantly with AI-powered search. Quoth uses embeddings and reranking to return the most relevant documentation for any query.

### Living Documentation

Documentation drifts from code over time. Quoth helps you keep them in sync with:

- Drift detection
- Proposal system for updates
- Coverage metrics

## Get Started

Ready to stop the hallucinations?

<CardGrid>
  <Card
    title="Quick Start"
    description="Get Quoth running in 5 minutes"
    href="/docs/getting-started/quick-start"
    icon="Zap"
  />
  <Card
    title="Core Concepts"
    description="Understand how Quoth works"
    href="/docs/getting-started/core-concepts"
    icon="BookOpen"
  />
</CardGrid>
```

**Step 2: Verify file created**

Run: `cat content/blog/2026-01-23-introducing-quoth.mdx | head -20`
Expected: Shows the frontmatter

**Step 3: Commit**

```bash
git add content/blog/
git commit -m "content(blog): add introductory blog post"
```

---

## Task 21: Create Sample Changelog Entry

**Files:**
- Create: `content/changelog/2026-01-23.mdx`

**Step 1: Write sample changelog entry**

```mdx
---
date: 2026-01-23
version: "0.1.0"
title: "Initial Release"
---

## Added

- **MCP Server**: Full Model Context Protocol implementation
  - `quoth_search_index` - Semantic vector search
  - `quoth_read_doc` - Document retrieval
  - `quoth_propose_update` - Documentation proposals
  - `quoth_genesis` - Bootstrap documentation

- **Genesis**: Automatic documentation generation
  - Three depth levels: minimal, standard, comprehensive
  - Phase-based prompts for structured output
  - AST-aware code chunking

- **Dashboard**: Web interface for documentation management
  - Knowledge base browser
  - Proposal review system
  - Team collaboration features

- **Authentication**: Multi-tenant OAuth system
  - API key generation
  - Role-based access control
  - Team invitations

## Technical

- Vector search with Jina embeddings (512d)
- Cohere reranking for improved relevance
- Supabase for storage and RLS
- Next.js 16 with App Router
```

**Step 2: Verify file created**

Run: `cat content/changelog/2026-01-23.mdx | head -20`
Expected: Shows the frontmatter

**Step 3: Commit**

```bash
git add content/changelog/
git commit -m "content(changelog): add initial release changelog entry"
```

---

## Task 22: Create Sample Docs Pages

**Files:**
- Create: `content/docs/getting-started/what-is-quoth.mdx`
- Create: `content/docs/getting-started/quick-start.mdx`

**Step 1: Write "What is Quoth" doc**

```mdx
---
title: "What is Quoth?"
description: "An MCP server that acts as your codebase's Single Source of Truth"
order: 1
---

# What is Quoth?

Quoth is an MCP (Model Context Protocol) server that acts as a "Single Source of Truth" auditor for codebases. It enforces consistency between code and documentation by providing AI agents with verified patterns to follow.

## The Problem

AI coding assistants are powerful, but they share a fundamental limitation: **they don't know your codebase**.

When you ask an AI to write code, it:
- Guesses at your architecture patterns
- Invents API endpoints that don't exist
- Suggests testing approaches that don't match your conventions
- Hallucinates confidently about things it doesn't know

## The Solution

Quoth provides your AI with verified documentation about your codebase. Before generating code, the AI searches Quoth for:

- **Architecture patterns** - How your codebase is structured
- **Testing conventions** - How tests should be written
- **API contracts** - What endpoints exist and their schemas
- **Code standards** - Your team's agreed-upon practices

<Callout type="info">
  Think of Quoth as giving your AI a "memory" of your codebase that persists across sessions.
</Callout>

## How It Works

1. **Connect Quoth** to your AI tool via MCP
2. **Run Genesis** to bootstrap documentation from your codebase
3. **AI searches Quoth** automatically before writing code
4. **Keep docs updated** as your codebase evolves

## Key Features

### Genesis

Automatically analyze your codebase and generate initial documentation. Choose your depth level based on your needs.

### Semantic Search

AI-powered search finds the most relevant patterns for any query, using embeddings and reranking.

### Living Documentation

Track coverage, detect drift, and keep documentation in sync with your code through proposals and reviews.

## Next Steps

<CardGrid>
  <Card
    title="Quick Start"
    description="Get Quoth running in 5 minutes"
    href="/docs/getting-started/quick-start"
    icon="Zap"
  />
  <Card
    title="Core Concepts"
    description="Understand patterns, drift, and coverage"
    href="/docs/getting-started/core-concepts"
    icon="BookOpen"
  />
</CardGrid>
```

**Step 2: Write "Quick Start" doc**

```mdx
---
title: "Quick Start"
description: "Get Quoth running in 5 minutes"
order: 2
---

# Quick Start

Get Quoth integrated with Claude Code in under 5 minutes.

## Prerequisites

- Node.js 18 or higher
- Claude Code CLI installed
- A codebase you want to document

## Installation

<Steps>
  <Step title="Add Quoth MCP Server">
    Run this command in your terminal:

    ```bash
    claude mcp add quoth
    ```

    This adds Quoth as an MCP server to your Claude Code configuration.
  </Step>

  <Step title="Authenticate">
    When prompted, click "Authenticate" to connect your Quoth account via OAuth.

    <Callout type="info">
      No account yet? One will be created automatically during authentication.
    </Callout>
  </Step>

  <Step title="Verify Connection">
    Start a new Claude Code session and type:

    ```
    /mcp
    ```

    You should see `quoth` listed as a connected server.
  </Step>

  <Step title="Run Genesis">
    Bootstrap your documentation by activating the architect persona:

    ```
    /prompt quoth_architect
    ```

    Then ask Claude to run Genesis:

    ```
    Run Genesis to document this project
    ```

    Genesis will analyze your codebase and create initial documentation.
  </Step>
</Steps>

## What's Next?

After Genesis completes, your AI will automatically search Quoth before writing code. Try it out:

```
Create a new API endpoint following our patterns
```

Claude will search your documentation and follow your established conventions.

<Callout type="tip" title="Pro Tip">
  Use `/prompt quoth_architect` at the start of coding sessions to ensure Claude always consults your documentation.
</Callout>

## Next Steps

<CardGrid>
  <Card
    title="Core Concepts"
    description="Understand patterns, drift, and coverage"
    href="/docs/getting-started/core-concepts"
    icon="BookOpen"
  />
  <Card
    title="Genesis Guide"
    description="Customize your documentation depth"
    href="/docs/guides/genesis"
    icon="Sparkles"
  />
</CardGrid>
```

**Step 3: Verify files created**

Run: `ls content/docs/getting-started/`
Expected: what-is-quoth.mdx, quick-start.mdx

**Step 4: Commit**

```bash
git add content/docs/
git commit -m "content(docs): add Getting Started documentation pages"
```

---

## Task 23: Build and Test

**Files:**
- None (verification only)

**Step 1: Run build to verify everything compiles**

Run: `npm run build`

Expected: Build completes successfully with no errors

**Step 2: Test dev server**

Run: `npm run dev`

Then manually verify:
- `/blog` - Shows blog listing with sample post
- `/blog/2026-01-23-introducing-quoth` - Shows full blog post
- `/changelog` - Shows timeline with sample entry
- `/docs` - Shows docs overview
- `/docs/getting-started/what-is-quoth` - Shows doc page with sidebar and TOC

**Step 3: Stop dev server and commit if any fixes needed**

If all works:
```bash
git add -A
git commit -m "fix: resolve any build/lint issues"
```

---

## Task 24: Final Cleanup and Summary Commit

**Files:**
- None

**Step 1: Remove .gitkeep files (now have real content)**

```bash
rm content/blog/.gitkeep content/changelog/.gitkeep content/docs/getting-started/.gitkeep content/docs/guides/.gitkeep content/docs/reference/.gitkeep content/docs/dashboard/.gitkeep 2>/dev/null || true
```

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat: complete Docs, Blog & Changelog content system

- Add MDX infrastructure with custom components (Callout, Steps, Card)
- Create Blog with listing page and individual post pages
- Create Changelog with timeline view and month grouping
- Create Docs with sidebar navigation and table of contents
- Update navigation links in Navbar and Footer
- Add sample content: blog post, changelog entry, 2 doc pages

Implements design from docs/plans/2026-01-23-docs-blog-changelog-design.md"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] `/blog` loads and shows the sample post
- [ ] `/blog/2026-01-23-introducing-quoth` renders MDX correctly with custom components
- [ ] `/changelog` shows timeline with version badges
- [ ] `/docs` shows section overview
- [ ] `/docs/getting-started/what-is-quoth` renders with sidebar and TOC
- [ ] `/docs/getting-started/quick-start` shows Steps and Callout components
- [ ] Navbar links to Docs, Blog, Changelog, Pricing
- [ ] Footer links match Navbar
- [ ] Build succeeds with no errors

---

**End of Implementation Plan**
