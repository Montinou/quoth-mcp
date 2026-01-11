#!/usr/bin/env npx tsx
/**
 * Index Knowledge Base Script
 *
 * Reads all markdown files from quoth-knowledge-base/ and indexes them
 * into Supabase with Gemini embeddings.
 *
 * Usage: npx tsx scripts/index-knowledge-base.ts
 *
 * Required env vars:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - GEMINIAI_API_KEY (or GOOGLE_API_KEY)
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { createHash } from "crypto";

// Load env from .env.local
import { config } from "dotenv";
config({ path: ".env.local" });

// Configuration
const KNOWLEDGE_BASE_PATH = "./quoth-knowledge-base";
const PROJECT_SLUG = "quoth-knowledge-base";
const GITHUB_REPO = "quoth/quoth-mcp";

// Validate environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GEMINIAI_API_KEY || process.env.GOOGLE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials");
  console.error("Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!geminiKey) {
  console.error("❌ Missing Gemini API key");
  console.error("Required: GEMINIAI_API_KEY or GOOGLE_API_KEY");
  process.exit(1);
}

// Initialize clients
const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(geminiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// Helper functions
function calculateChecksum(content: string): string {
  return createHash("md5").update(content).digest("hex");
}

function chunkByHeaders(content: string, minChunkLength: number = 50): string[] {
  const chunks = content.split(/^## /gm);
  return chunks.map((c) => c.trim()).filter((c) => c.length >= minChunkLength);
}

async function generateEmbedding(text: string): Promise<number[]> {
  const cleanText = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  const result = await embeddingModel.embedContent(cleanText);
  return result.embedding.values;
}

function getMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

async function main() {
  console.log("🦅 Quoth Knowledge Base Indexer\n");

  // 1. Get or create project
  console.log(`📁 Project: ${PROJECT_SLUG}`);
  const { data: existingProject } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", PROJECT_SLUG)
    .single();

  let projectId: string;

  if (existingProject) {
    projectId = existingProject.id;
    console.log(`   Found existing project: ${projectId}`);
  } else {
    const { data: newProject, error } = await supabase
      .from("projects")
      .insert({ slug: PROJECT_SLUG, github_repo: GITHUB_REPO })
      .select()
      .single();

    if (error) {
      console.error("❌ Failed to create project:", error.message);
      process.exit(1);
    }

    projectId = newProject.id;
    console.log(`   Created new project: ${projectId}`);
  }

  // 2. Get all markdown files
  const files = getMarkdownFiles(KNOWLEDGE_BASE_PATH);
  console.log(`\n📄 Found ${files.length} markdown files\n`);

  let totalChunks = 0;
  let skipped = 0;

  // 3. Process each file
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const relativePath = path.relative(KNOWLEDGE_BASE_PATH, filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    const checksum = calculateChecksum(content);

    console.log(`[${i + 1}/${files.length}] ${relativePath}`);

    // Parse frontmatter
    const { data: frontmatter, content: markdownContent } = matter(content);
    const title = frontmatter.id || path.basename(filePath, ".md");

    // Check if document exists and hasn't changed
    const { data: existingDoc } = await supabase
      .from("documents")
      .select("id, checksum")
      .eq("project_id", projectId)
      .eq("file_path", relativePath)
      .single();

    if (existingDoc && existingDoc.checksum === checksum) {
      console.log(`   ⏭️  Unchanged, skipping`);
      skipped++;
      continue;
    }

    // Upsert document
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .upsert(
        {
          project_id: projectId,
          file_path: relativePath,
          title,
          content: markdownContent,
          checksum,
          last_updated: new Date().toISOString(),
        },
        { onConflict: "project_id, file_path" }
      )
      .select()
      .single();

    if (docError) {
      console.error(`   ❌ Failed to upsert document:`, docError.message);
      continue;
    }

    // Delete old embeddings
    await supabase
      .from("document_embeddings")
      .delete()
      .eq("document_id", doc.id);

    // Chunk content
    let chunks = chunkByHeaders(markdownContent);
    if (chunks.length === 0) {
      chunks = [markdownContent];
    }

    console.log(`   📊 ${chunks.length} chunks to embed`);

    // Generate embeddings for each chunk
    for (let j = 0; j < chunks.length; j++) {
      const chunk = chunks[j];

      try {
        const embedding = await generateEmbedding(chunk);

        await supabase.from("document_embeddings").insert({
          document_id: doc.id,
          content_chunk: chunk,
          embedding,
          metadata: { chunk_index: j, source: "markdown-h2-split" },
        });

        process.stdout.write(`   ✓ Chunk ${j + 1}/${chunks.length}\r`);
        totalChunks++;

        // Rate limiting: 4s delay (15 RPM = 4s per request)
        if (j < chunks.length - 1) {
          await new Promise((r) => setTimeout(r, 4000));
        }
      } catch (error) {
        console.error(`\n   ❌ Chunk ${j + 1} failed:`, error);
      }
    }

    console.log(`   ✅ Indexed ${chunks.length} chunks`);

    // Small delay between files
    if (i < files.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Indexing Complete");
  console.log(`   Files processed: ${files.length}`);
  console.log(`   Files skipped (unchanged): ${skipped}`);
  console.log(`   Total chunks indexed: ${totalChunks}`);
  console.log("=".repeat(50));
}

main().catch(console.error);
