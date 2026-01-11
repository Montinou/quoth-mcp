# **Quoth Genesis: The Persona Injection Protocol**

## **Estrategia de Bootstrapping mediante Instrucciones Guiadas**

### **1\. El Concepto: "Teacher-Student Pattern"**

El servidor MCP no analiza el código. El servidor MCP actúa como el "Maestro" que entrega una guía paso a paso al "Estudiante" (Claude Code/Cursor), quien tiene acceso directo a los archivos locales.

**El Flujo:**

1. **Trigger:** Usuario ejecuta la tool quoth\_genesis.  
2. **Injection:** La tool devuelve un **System Prompt Masivo** (El Protocolo).  
3. **Execution:** La IA del usuario (Claude) adopta la persona de "Quoth Architect", lee los archivos locales, detecta patrones y genera los Markdowns.  
4. **Ingestion:** La IA llama a quoth\_propose\_update para enviar los resultados a Supabase.  
5. **Versioning:** Supabase detecta si el documento existe, crea backup y reindexa.

### **2\. La Tool MCP: quoth\_genesis**

Esta herramienta no hace nada más que devolver texto. Es un "Prompt Delivery System".

// src/lib/mcp/tools/genesis.ts

server.registerTool(  
  'quoth\_genesis',  
  {  
    title: 'Initialize Quoth Protocol',  
    description: 'Injects the Genesis Persona into the current AI session to bootstrap documentation.',  
    inputSchema: {  
      focus: z.enum(\['full\_scan', 'update\_only'\]).default('full\_scan'),  
      language\_hint: z.string().optional()  
    }  
  },  
  async ({ focus }) \=\> {  
    // Retornamos el prompt como instrucción directa al modelo  
    return {  
      content: \[{  
        type: "text",  
        text: GENESIS\_PERSONA\_PROMPT // Ver sección 3  
      }\]  
    };  
  }  
);

### **3\. El "Prompt Persona" (El Cerebro)**

Este es el activo más valioso. Debe ser un XML estricto que obligue a Claude a comportarse como un analista riguroso.

\<genesis\_protocol\>  
    \<role\>  
        You are now the \*\*Quoth Genesis Architect\*\*. Your goal is to analyze the local codebase and strictly formalize its architectural patterns into the Quoth Knowledge Base.  
    \</role\>

    \<prime\_directive\>  
        DO NOT invent rules. Only document what you see implemented in code.  
        If a pattern is inconsistent, document the dominant pattern.  
    \</prime\_directive\>

    \<execution\_steps\>  
        \<step id="1"\>  
            \*\*Skeleton Scan:\*\* Read \`package.json\`, \`tsconfig.json\`, and root config files.   
            Identify: Framework, ORM, Test Runner, Auth Provider.  
        \</step\>  
        \<step id="2"\>  
            \*\*Structure Analysis:\*\* List the \`src/\` directory. Deduce the architectural pattern (e.g., MVC, Hexagonal, Feature-based).  
        \</step\>  
        \<step id="3"\>  
            \*\*Pattern Extraction:\*\* Read 2-3 files from key directories (\`controllers\`, \`components\`, \`tests\`).  
            Extract: Naming conventions, mandatory imports, error handling patterns.  
        \</step\>  
        \<step id="4"\>  
            \*\*Ingestion:\*\* For each identified pattern, construct a Markdown file and call the \`quoth\_propose\_update\` tool.  
        \</step\>  
    \</execution\_steps\>

    \<output\_template\>  
        For every document, you MUST use this format:  
          
        \---  
        id: \[unique-slug\]  
        type: \[pattern|architecture|contract\]  
        status: active  
        \---  
        \# \[Title\]  
          
        \#\# The Rule  
        \[Explanation\]  
          
        \#\# Evidence  
        \[Snippet from codebase\]  
    \</output\_template\>

    \<instruction\>  
        Start immediately by executing Step 1\. Use your file reading capabilities to scan the current directory.  
    \</instruction\>  
\</genesis\_protocol\>

### **4\. Supabase Backend: Versioning & Indexing**

Aquí es donde manejamos tu requerimiento de "Copia de Respaldo y Reindexado".

Necesitamos una tabla de historial y un Trigger en Postgres (o lógica en la API) para manejar el UPSERT inteligente.

#### **4.1 Schema Update (History)**

\-- Tabla de Historial (Backups)  
create table document\_history (  
  id uuid primary key default uuid\_generate\_v4(),  
  document\_id uuid references documents(id) on delete cascade,  
  content text not null,  
  version int not null,  
  archived\_at timestamptz default now()  
);

\-- Trigger Function para Auto-Backup  
create or replace function backup\_document\_before\_update()  
returns trigger as $$  
begin  
  \-- Antes de que el update ocurra, guardamos la versión vieja  
  insert into document\_history (document\_id, content, version)  
  values (OLD.id, OLD.content, OLD.version);  
    
  \-- Incrementamos la versión del documento vivo  
  NEW.version \= OLD.version \+ 1;  
  NEW.last\_updated \= now();  
  return NEW;  
end;  
$$ language plpgsql;

create trigger on\_document\_update  
  before update on documents  
  for each row execute procedure backup\_document\_before\_update();

#### **4.2 Lógica de Reindexado (En la API quoth\_propose\_update)**

Cuando la tool quoth\_propose\_update recibe los datos de Claude:

// src/lib/mcp/tools/write.ts

// 1\. Upsert en la tabla documents  
const { data: doc } \= await supabase  
  .from('documents')  
  .upsert({  
    project\_id: projectId,  
    file\_path: args.file\_path,  
    content: args.content,  
    // El trigger de Postgres se encarga del backup y version++  
  })  
  .select()  
  .single();

// 2\. Re-Indexado Vectorial (Crítico)  
// Borramos vectores viejos de este documento específico  
await supabase  
  .from('document\_embeddings')  
  .delete()  
  .eq('document\_id', doc.id);

// Generamos nuevos vectores con Gemini y guardamos  
await generateAndStoreEmbeddings(doc.id, doc.content);

### **5\. Resumen del Flujo de Usuario**

1. **User:** \> quoth run genesis  
2. **Quoth (MCP):** "Entendido. Aquí tienes el protocolo de análisis. Empieza a leer." (Envía Prompt).  
3. **Claude (Client):** "Leyendo package.json... Veo que usas Next.js. Leyendo src/..."  
4. **Claude (Client):** "He detectado un patrón de API Routes. Generando patterns/api-routes.md..."  
5. **Claude (Client):** Llama a quoth\_propose\_update.  
6. **Supabase:**  
   * ¿Existe api-routes.md? Sí.  
   * **Backup:** Mueve el contenido viejo a document\_history.  
   * **Update:** Guarda el nuevo contenido en documents.  
   * **Index:** Gemini re-calcula los vectores.  
7. **Resultado:** La base de conocimiento está actualizada y el historial preservado, sin que el servidor Quoth haya tocado una sola línea de código del usuario.