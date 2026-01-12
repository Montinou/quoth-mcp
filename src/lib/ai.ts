import { GoogleGenerativeAI } from "@google/generative-ai";

// Use GEMINIAI_API_KEY (as configured in Vercel) or fall back to GOOGLE_API_KEY
const googleApiKey = process.env.GEMINIAI_API_KEY || process.env.GOOGLE_API_KEY;
const jinaApiKey = process.env.JINA_API_KEY;

if (!googleApiKey) {
  console.warn("Warning: No Gemini API key found (GEMINIAI_API_KEY or GOOGLE_API_KEY)");
}

if (!jinaApiKey) {
  console.warn("Warning: No Jina API key found (JINA_API_KEY). Semantic search for code will fail.");
}

const genAI = googleApiKey ? new GoogleGenerativeAI(googleApiKey) : null;
const googleModel = genAI?.getGenerativeModel({ model: "text-embedding-004" });

// Gemini 2.0 Flash for generative responses (RAG answers)
const flashModel = genAI?.getGenerativeModel({
  model: "gemini-2.0-flash-exp",
  generationConfig: {
    temperature: 0.3,  // Lower for more factual responses
    topP: 0.8,
    maxOutputTokens: 1024,
  }
});

/**
 * Generate embedding using Jina Embeddings v3 (optimized for code)
 */
export async function generateJinaEmbedding(text: string): Promise<number[]> {
  if (!jinaApiKey) {
    throw new Error("Jina API not configured. Set JINA_API_KEY");
  }

  const cleanText = text.replace(/\n+/g, " ").trim();
  if (!cleanText) return [];

  const response = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jinaApiKey}`
    },
    body: JSON.stringify({
      model: 'jina-embeddings-v3',
      task: 'retrieval.passage', // optimized for storing docs
      dimensions: 512, // Matryoshka optimized
      late_chunking: false, // keeping it simple for now as per plan
      input: [cleanText]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jina API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embedding for search query using Jina
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
   if (!jinaApiKey) {
    throw new Error("Jina API not configured. Set JINA_API_KEY");
  }

  const response = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jinaApiKey}`
    },
    body: JSON.stringify({
      model: 'jina-embeddings-v3',
      task: 'retrieval.query', // optimized for queries
      dimensions: 512,
      input: [query]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jina API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Legacy/Fallback: Generate a 768-dimensional embedding vector for text
 * Uses Google Gemini text-embedding-004 model
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Prefer Jina if available for this new architecture
  if (jinaApiKey) {
    try {
      return await generateJinaEmbedding(text);
    } catch (e) {
      console.warn("Jina generation failed, falling back to Gemini", e);
    }
  }

  if (!googleModel) {
    throw new Error("Gemini API not configured. Set GEMINIAI_API_KEY or GOOGLE_API_KEY");
  }

  // Clean text for better semantic quality
  const cleanText = text
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanText) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const result = await googleModel.embedContent(cleanText);
  return result.embedding.values; // Returns array of 768 numbers
}

/**
 * Check if AI embedding service is configured
 */
export function isAIConfigured(): boolean {
  return !!googleApiKey || !!jinaApiKey;
}

/**
 * Batch generate embeddings with rate limiting
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  delayMs: number = 1000
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    const embedding = await generateEmbedding(texts[i]);
    embeddings.push(embedding);

    // Add delay between requests (except for last one)
    if (i < texts.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return embeddings;
}

// ============================================
// Gemini 2.0 Flash - RAG Answer Generation
// ============================================

export interface RAGContext {
  title: string;
  path: string;
  content: string;
  relevance: number;
}

export interface RAGAnswer {
  answer: string;
  sources: { title: string; path: string }[];
  relatedQuestions: string[];
}

/**
 * Generate an AI answer using Gemini 2.0 Flash based on retrieved context
 */
export async function generateRAGAnswer(
  query: string,
  contexts: RAGContext[]
): Promise<RAGAnswer> {
  if (!flashModel) {
    throw new Error("Gemini API not configured. Set GEMINIAI_API_KEY or GOOGLE_API_KEY");
  }

  if (contexts.length === 0) {
    return {
      answer: "No relevant documentation found for your query.",
      sources: [],
      relatedQuestions: [],
    };
  }

  // Build context string from retrieved documents
  const contextStr = contexts
    .slice(0, 5) // Use top 5 most relevant
    .map((ctx, i) => `[Source ${i + 1}: ${ctx.title}]\n${ctx.content}`)
    .join("\n\n---\n\n");

  const prompt = `You are a helpful documentation assistant. Answer the user's question based ONLY on the provided documentation context. Be concise, accurate, and cite your sources.

## Rules:
1. Only use information from the provided context
2. If the context doesn't contain enough information, say so
3. Use markdown formatting for code snippets and lists
4. Keep the answer focused and actionable
5. Suggest 2-3 related questions the user might want to ask

## Documentation Context:
${contextStr}

## User Question:
${query}

## Response Format:
Provide your answer, then list related questions the user might want to explore.`;

  try {
    const result = await flashModel.generateContent(prompt);
    const response = result.response.text();

    // Extract sources from contexts used
    const sources = contexts.slice(0, 5).map(ctx => ({
      title: ctx.title,
      path: ctx.path,
    }));

    // Try to extract related questions from the response
    const relatedQuestions = extractRelatedQuestions(response);

    // Clean the answer (remove the related questions section if we extracted them)
    const cleanedAnswer = cleanAnswer(response);

    return {
      answer: cleanedAnswer,
      sources,
      relatedQuestions,
    };
  } catch (error) {
    console.error("Gemini 2.0 Flash generation failed:", error);
    throw new Error("Failed to generate AI answer");
  }
}

/**
 * Extract related questions from the AI response
 */
function extractRelatedQuestions(response: string): string[] {
  const questions: string[] = [];

  // Look for common patterns like "Related questions:" or bullet points with ?
  const patterns = [
    /related questions?:?\s*([\s\S]*?)(?:$|\n\n)/i,
    /you might also (?:want to )?ask:?\s*([\s\S]*?)(?:$|\n\n)/i,
    /other questions?:?\s*([\s\S]*?)(?:$|\n\n)/i,
  ];

  for (const pattern of patterns) {
    const match = response.match(pattern);
    if (match) {
      const section = match[1];
      // Extract bullet points or numbered items
      const items = section.match(/[-•*\d.]\s*(.+\?)/g);
      if (items) {
        questions.push(...items.map(q => q.replace(/^[-•*\d.]\s*/, '').trim()));
      }
    }
  }

  // Fallback: find any lines ending with ?
  if (questions.length === 0) {
    const lines = response.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.endsWith('?') && trimmed.length > 10 && trimmed.length < 150) {
        // Skip the original question if it appears
        if (!trimmed.toLowerCase().includes('user question')) {
          questions.push(trimmed.replace(/^[-•*\d.]\s*/, ''));
        }
      }
    }
  }

  return questions.slice(0, 3); // Max 3 related questions
}

/**
 * Clean the answer by removing extracted sections
 */
function cleanAnswer(response: string): string {
  // Remove related questions section if present
  const patterns = [
    /\n+(?:##?\s*)?related questions?:?\s*[\s\S]*$/i,
    /\n+(?:##?\s*)?you might also (?:want to )?ask:?\s*[\s\S]*$/i,
    /\n+(?:##?\s*)?other questions?:?\s*[\s\S]*$/i,
  ];

  let cleaned = response;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

/**
 * Generate a TL;DR summary for a document
 */
export async function generateDocumentSummary(
  title: string,
  content: string
): Promise<string> {
  if (!flashModel) {
    throw new Error("Gemini API not configured");
  }

  const prompt = `Summarize this documentation in 2-3 sentences. Focus on the key points and practical takeaways.

Title: ${title}

Content:
${content.slice(0, 4000)} ${content.length > 4000 ? '...' : ''}

TL;DR:`;

  try {
    const result = await flashModel.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("Summary generation failed:", error);
    return ""; // Return empty on failure, UI can handle gracefully
  }
}

/**
 * Check if generative AI is available
 */
export function isGenerativeAIConfigured(): boolean {
  return !!flashModel;
}
