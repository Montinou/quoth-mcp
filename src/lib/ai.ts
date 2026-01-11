import { GoogleGenerativeAI } from "@google/generative-ai";

// Use GEMINIAI_API_KEY (as configured in Vercel) or fall back to GOOGLE_API_KEY
const apiKey = process.env.GEMINIAI_API_KEY || process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.warn("Warning: No Gemini API key found (GEMINIAI_API_KEY or GOOGLE_API_KEY)");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const model = genAI?.getGenerativeModel({ model: "text-embedding-004" });

/**
 * Generate a 768-dimensional embedding vector for text
 * Uses Google Gemini text-embedding-004 model
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!model) {
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

  const result = await model.embedContent(cleanText);
  return result.embedding.values; // Returns array of 768 numbers
}

/**
 * Check if AI embedding service is configured
 */
export function isAIConfigured(): boolean {
  return !!apiKey;
}

/**
 * Batch generate embeddings with rate limiting
 * Gemini free tier: 15 RPM, so we add delay between requests
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  delayMs: number = 4200 // ~14 requests per minute to stay under 15 RPM limit
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
