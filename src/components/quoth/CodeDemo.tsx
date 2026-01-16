/**
 * CodeDemo Component
 * Showcases Quoth analysis in action on the landing page
 */

import {
  CodeBlock,
  CodeLine,
  CodeKeyword,
  CodeSuggestion,
} from "./CodeBlock";

export function CodeDemo() {
  return (
    <CodeBlock
      filename="UserService.test.ts"
      status="auditing"
      className="max-w-2xl mx-auto mt-16"
    >
      <div className="mb-4 text-gray-500">
        // <span className="text-violet-spectral">Quoth Analysis:</span> 1
        Violation Detected
      </div>

      <div>
        <CodeKeyword>import</CodeKeyword> {"{"} describe, it, expect {"}"}{" "}
        <CodeKeyword>from</CodeKeyword>{" "}
        <CodeKeyword type="string">&apos;vitest&apos;</CodeKeyword>;
      </div>
      <div>
        <CodeKeyword>import</CodeKeyword> {"{"} UserService {"}"}{" "}
        <CodeKeyword>from</CodeKeyword>{" "}
        <CodeKeyword type="string">&apos;./UserService&apos;</CodeKeyword>;
      </div>
      <br />

      <div className="opacity-50">
        describe(<CodeKeyword type="string">&apos;UserService&apos;</CodeKeyword>, () ={">"}{" "}
        {"{"}
      </div>
      <CodeLine indent={1} className="opacity-50">
        it(<CodeKeyword type="string">&apos;should fetch user&apos;</CodeKeyword>,{" "}
        <CodeKeyword>async</CodeKeyword> () ={">"} {"{"}
      </CodeLine>

      <CodeLine indent={2} highlight>
        <CodeKeyword>const</CodeKeyword> mock = jest.fn();{" "}
        <span className="text-xs uppercase tracking-widest text-violet-ghost ml-4 font-sans border border-violet-spectral/50 px-2 py-0.5 rounded bg-violet-spectral/20">
          Violation
        </span>
      </CodeLine>

      <CodeLine indent={2} className="opacity-50">
        ...
      </CodeLine>

      <CodeSuggestion source="According to 'patterns/backend-unit-vitest.md', Jest globals are forbidden. Use Vitest native utilities.">
        <CodeKeyword>const</CodeKeyword> mock = vi.fn();
      </CodeSuggestion>
    </CodeBlock>
  );
}
