Quoth: Brand Identity & Design System

1. Visual Manifesto: "Intellectual Neo-Noir"

Quoth is not just another management tool; it is an arbiter of truth. The aesthetic rejects the current trend of "friendly, colorful SaaS" (Stripe-like) to embrace a severe, mysterious, and precise elegance.

Core Concept: The Digital Scriptorium. A place where ancient knowledge (documentation) meets modern speed (code).

Vibe: Silent, Dark, Observant. Like coding late at night with rain outside.

Keywords: Precision, Penumbra, Revelation, Wisdom.

2. Color Palette: "The Midnight Spectrum"

We do not use pure black (#000000) because it causes eye strain on modern displays. We use a scale of deep grays with warm temperatures, contrasted with "ultraviolet" light.

2.1 Backgrounds (The Void)

The foundation of the interface. It must feel deep, not flat.

|

| Name | Hex | Usage |
| Obsidian Deep | #050505 | Global background (<body>). |
| Charcoal Surface | #121212 | Panels, cards, modals. |
| Graphite Border | #262626 | Subtle borders, dividers. |

2.2 Accents (The Magic)

We use violet not as decoration, but as an indicator of AI action and "magic".

| Name | Hex | Usage |
| Spectral Violet | #8B5CF6 | Primary buttons, AI icons, loaders. |
| UV Glow | #7C3AED | Glow effects (box-shadow), spotlights. |
| Ghost Lilac | #DDD6FE | Text on violet backgrounds. |

2.3 Semantics (The Truth)

Status colors are muted and metallic, not loud.

| Name | Hex | Usage |
| Emerald Muted | #10B981 | "Consistent" (Tests pass, Doc aligned). |
| Amber Warning | #F59E0B | "Drift Detected" (Slight mismatch). |
| Crimson Void | #991B1B | "Violation" (Code breaks critical rules). |

3. Typography: "Editorial Code"

The font pairing is what sells the "Literature + Code" idea.

3.1 Headings (Display): Cinzel or Playfair Display

Used for the logo and large headers (h1, h2). Provides classic authority.

Rule: Use with slightly open tracking.

CSS: font-family: 'Cinzel', serif; letter-spacing: 0.05em;

3.2 Interface (UI): Geist Sans (or Inter)

Used for buttons, menus, and explanatory text. Maximum readability.

Rule: Light weights (300, 400) to maintain elegance.

3.3 Code: Geist Mono (or JetBrains Mono)

Used for code blocks and diffs.

Rule: Ligatures must be active so => looks like a real arrow.

4. Logotype & Iconography

4.1 Logo Construction

The isotype must be a geometric abstraction that works at small sizes (favicon).

The Concept: "The Glitched Quill".

Shape: The silhouette of an antique writing quill, but the bottom tip decomposes into square pixels or block cursors (█).

Meaning: The transition from classic writing to the digital era.

Alternate Version: A minimalist eye formed by two code brackets < > stylized to look like an eyelid, with a central dot (the pupil/lens).

4.2 UI Icons

Use fine-line icons (1.5px stroke) style Lucide React or Phosphor Icons.

Inactive icons are dark gray (#525252).

Active icons "ignite" with a soft violet glow.

5. UI Components & "The Lens of Truth"

The interface should feel like an advanced HUD (Head-Up Display).

5.1 The "Reveal" Effect (Drift Reveal)

When Quoth detects a discrepancy between code and documentation, it doesn't show a simple ugly red border.

Effect: The affected code block darkens slightly, and the problematic text glows with an "Ultraviolet Light" effect (bright white text with violet/purple shadow).

Metaphor: Like using forensic light to see stains invisible to the naked eye.

/* CSS Example for the reveal effect */
.quoth-drift-highlight {
  color: #FFFFFF;
  text-shadow: 0 0 8px rgba(139, 92, 246, 0.6);
  background: rgba(139, 92, 246, 0.1);
  border-bottom: 1px dashed #8B5CF6;
}



5.2 "Glass" Buttons

Buttons are not solid and flat. They have subtle transparency and a fine border, evoking smoked glass.

Background: rgba(255, 255, 255, 0.03)

Border: 1px solid rgba(255, 255, 255, 0.1)

Hover: The border lights up to Spectral Violet.

5.3 Documentation Panels

Should look like pages from a high-end digital book.

Generous padding.

Relaxed line-height (1.6 to 1.8).

Controlled max-width for reading (65ch).

6. Voice & Tone (UX Writing)

Quoth is not your "friendly assistant." It is your Senior Auditor. Its personality is stoic, precise, and slightly literary.

Bad: "Oops! Looks like you made a mistake here." (Too childish).

Bad: "Error on line 40." (Too robotic).

Quoth Voice: "Discrepancy detected. Implementation pattern diverges from the canon established in contracts/auth.md."

Microcopy Examples:

Scan Button: "Audit Codebase" (Not "Check code").

Empty State: "Silence. Awaiting input."

Success: "Consistency verified."

Loading: "Consulting the index..."

7. Visual References (Moodboard)

To inspire the design/frontend team:

Linear.app: For its use of dark mode and subtle gradients.

"Control" (Remedy Game): For the brutalist typography and bureaucratic mystery atmosphere.

"Tron: Legacy" Movie: Specifically the dark color palette with precise neon lights (swapping cyan blue for spectral violet).

Code Editor "Zen Mode": The interface must disappear to let the content take center stage.