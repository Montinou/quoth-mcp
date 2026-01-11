Quoth Architecture: Supabase Vector Integration
"The Semantic Cortex" Implementation Plan (Gemini Edition)
1. Executive Summary
La integración de Supabase transforma a Quoth de un "Lector de Archivos" a un "Motor de Búsqueda Semántica".
Arquitectura Definitiva (Costo Cero):
Indexación: Google Gemini API (text-embedding-004) para generar vectores.
Almacenamiento: Supabase (Free Tier) con pgvector.
Dimensión: 768 dimensiones (Específico para Gemini 004).
2. Database Schema (The Codex)
Ejecuta este SQL en el Editor de Supabase para preparar la base de datos.
-- 1. Habilitar la extensión de vectores
create extension if not exists vector;

-- 2. Tabla de Proyectos (Multi-tenant)
create table projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, -- ej: "exolar-backend"
  github_repo text not null, -- "org/repo"
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Tabla de Documentos (Archivos Markdown)
create table documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  file_path text not null, -- ej: "patterns/backend-unit.md"
  title text not null,
  content text not null, -- Contenido crudo para lectura rápida
  checksum text not null, -- Hash para evitar re-indexar si no hay cambios
  last_updated timestamp with time zone default timezone('utc'::text, now()),
  
  unique(project_id, file_path)
);

-- 4. Tabla de Embeddings (Vectores Semánticos)
create table document_embeddings (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  content_chunk text not null, -- El fragmento de texto indexado
  -- CRÍTICO: 768 dimensiones es el output fijo de Gemini text-embedding-004
  embedding vector(768), 
  metadata jsonb -- ej: { "section": "Anti-Patterns" }
);

-- 5. Función de Búsqueda (RPC)
-- Esta función será llamada por el cliente de Supabase desde la Tool
create or replace function match_documents (
  query_embedding vector(768), 
  match_threshold float,
  match_count int,
  filter_project_id uuid
)
returns table (
  id uuid,
  document_id uuid,
  content_chunk text,
  similarity float,
  file_path text,
  title text
)
language plpgsql stable
as $$
begin
  return query
  select
    de.id,
    de.document_id,
    de.content_chunk,
    1 - (de.embedding <=> query_embedding) as similarity,
    d.file_path,
    d.title
  from document_embeddings de
  join documents d on de.document_id = d.id
  where d.project_id = filter_project_id
  and 1 - (de.embedding <=> query_embedding) > match_threshold
  order by de.embedding <=> query_embedding
  limit match_count;
end;
$$;


3. Implementation Steps (Paso a Paso)
Sigue estos pasos para conectar tu servidor MCP con esta arquitectura.
Paso 1: Instalación de Dependencias
Necesitas el SDK de Google AI y el cliente de Supabase.
npm install @google/generative-ai @supabase/supabase-js


Paso 2: Variables de Entorno
Configura esto en tu .env (Next.js) o entorno de despliegue.
# Supabase (Obtener en Project Settings > API)
NEXT_PUBLIC_SUPABASE_URL="[https://your-project.supabase.co](https://your-project.supabase.co)"
SUPABASE_SERVICE_ROLE_KEY="eyJh... (IMPORTANTE: Usar Service Role para poder escribir/borrar)"

# Google AI Studio (Obtener API Key Gratis)
GOOGLE_API_KEY="AIza..."


Paso 3: Servicio de Embeddings (lib/ai.ts)
Crea un helper para generar vectores de manera consistente.
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

export async function generateEmbedding(text: string): Promise<number[]> {
  // Limpieza básica para mejorar calidad semántica
  const cleanText = text.replace(/\n/g, " ");
  
  const result = await model.embedContent(cleanText);
  return result.embedding.values; // Retorna array de 768 números
}


Paso 4: Lógica de Sincronización (Sync Logic)
Este código corre cuando recibes un Webhook de GitHub indicando un push.
// lib/sync.ts
import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "./ai";

// Usar Service Role para tener permisos de escritura
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function syncDocument(projectId: string, filePath: string, content: string) {
  // 1. Guardar/Actualizar el Documento Padre
  const { data: doc, error } = await supabase.from('documents').upsert({
    project_id: projectId,
    file_path: filePath,
    title: filePath.split('/').pop()?.replace('.md', '') || 'Untitled',
    content: content,
    checksum: 'implement-hash-logic-here' // TODO: md5 hash
  }, { onConflict: 'project_id, file_path' }).select().single();

  if (error) throw error;

  // 2. Limpiar embeddings viejos de este documento (para re-generar)
  await supabase.from('document_embeddings').delete().eq('document_id', doc.id);

  // 3. Chunking (Dividir por encabezados H2 es una buena estrategia simple)
  const chunks = content.split(/^## /gm).map(c => c.trim()).filter(c => c.length > 50);

  // 4. Generar Vectores y Guardar
  // Nota: Hacer esto en serie o batch pequeño para no saturar el rate limit gratuito
  for (const chunk of chunks) {
    const vector = await generateEmbedding(chunk);
    
    await supabase.from('document_embeddings').insert({
      document_id: doc.id,
      content_chunk: chunk,
      embedding: vector,
      metadata: { source: 'markdown-split' }
    });
  }
}


4. Updated MCP Tools Logic
Así es como las herramientas consumen este sistema.
Tool: quoth_search_index (Lectura)
// mcp/tools/search.ts
export async function searchIndex(query: string, projectId: string) {
  // 1. Convertir la pregunta del usuario en números (Vector)
  const queryVector = await generateEmbedding(query);

  // 2. Buscar en Supabase usando la función RPC
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryVector,
    match_threshold: 0.7, // Ajustar sensibilidad (0.7 es buen punto de partida)
    match_count: 5,
    filter_project_id: projectId
  });

  if (error) throw error;

  // 3. Formatear para Claude (Markdown)
  return data.map((match: any) => ({
    file: match.file_path,
    topic: match.title,
    snippet: match.content_chunk,
    relevance: Math.round(match.similarity * 100) + '%'
  }));
}


Tool: quoth_read_doc (Lectura Directa)
No usa vectores, busca por path exacto para leer el archivo completo.
export async function readDoc(filePath: string, projectId: string) {
  const { data } = await supabase
    .from('documents')
    .select('content')
    .eq('project_id', projectId)
    .eq('file_path', filePath)
    .single();
    
  return data?.content || "Document not found.";
}


5. Resumen de Costos y Límites
Supabase Database: 500MB gratis. Suficiente para ~100,000 páginas de documentación vectorial.
Gemini API: Gratis. Rate limit de 15 Request/Minute (RPM).
Impacto: La búsqueda es instantánea (1 request). La indexación inicial puede ser lenta si tienes miles de archivos (hay que poner un delay entre chunks), pero como ocurre en background (CI/CD), no afecta al usuario.
Esta arquitectura es robusta, semántica y completamente gratuita de operar.
