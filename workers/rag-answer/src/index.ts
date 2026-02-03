/**
 * Quoth RAG Answer Worker
 * Receives reranked search results + query, returns human-readable AI answer
 * Model: @cf/meta/llama-3.2-3b-instruct (Cloudflare Workers AI)
 */

interface Env {
  AI: Ai;
  RAG_API_KEY: string; // Shared secret for auth
}

interface RAGContext {
  title: string;
  path: string;
  content: string;
  relevance: number;
}

interface RequestBody {
  query: string;
  contexts: RAGContext[];
}

interface RAGAnswer {
  answer: string;
  sources: { title: string; path: string }[];
  relatedQuestions: string[];
}

function buildPrompt(query: string, contexts: RAGContext[]): string {
  const contextDocs = contexts
    .slice(0, 5)
    .map(
      (ctx, i) =>
        `[Document ${i + 1}: "${ctx.title}" (${Math.round(ctx.relevance * 100)}% relevant)]\n${ctx.content}\n`
    )
    .join("\n");

  return `You are Quoth, a technical documentation assistant. Answer the user's question based ONLY on the retrieved documents below. If the documents don't contain enough information, say so explicitly.

DOCUMENTS:
${contextDocs}

QUESTION: ${query}

RULES:
- Use markdown: code blocks with language tags, bullet lists, bold for emphasis.
- Be concise and actionable.
- Reference which document you're citing.
- At the end, suggest exactly 3 follow-up questions on separate lines starting with "Q: ".

ANSWER:`;
}

function extractRelatedQuestions(text: string): { cleaned: string; questions: string[] } {
  const lines = text.split("\n");
  const questions: string[] = [];
  const answerLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("Q: ") || trimmed.startsWith("Q:")) {
      questions.push(trimmed.replace(/^Q:\s*/, "").trim());
    } else {
      answerLines.push(line);
    }
  }

  // Fallback: grab lines ending with ?
  if (questions.length === 0) {
    for (const line of lines) {
      const t = line.trim();
      if (t.endsWith("?") && t.length > 10 && t.length < 150) {
        questions.push(t.replace(/^[-•*\d.]\s*/, ""));
      }
    }
  }

  return {
    cleaned: answerLines.join("\n").trim(),
    questions: questions.slice(0, 3),
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // Auth check
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${env.RAG_API_KEY}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const body = (await request.json()) as RequestBody;

      if (!body.query || !body.contexts || body.contexts.length === 0) {
        return Response.json(
          { error: "query and contexts are required" },
          { status: 400 }
        );
      }

      const prompt = buildPrompt(body.query, body.contexts);

      const response = await env.AI.run("@cf/mistralai/mistral-small-3.1-24b-instruct", {
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0.3,
      });

      const rawAnswer = (response as { response?: string }).response || "";
      const { cleaned, questions } = extractRelatedQuestions(rawAnswer);

      const sources = body.contexts.slice(0, 5).map((ctx) => ({
        title: ctx.title,
        path: ctx.path,
      }));

      const result: RAGAnswer = {
        answer: cleaned,
        sources,
        relatedQuestions: questions,
      };

      return Response.json(result, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("RAG Worker error:", error);
      return Response.json(
        {
          error: "Failed to generate answer",
          detail: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  },
};
