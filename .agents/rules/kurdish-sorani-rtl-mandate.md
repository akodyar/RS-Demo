# HomeHub — Permanent Invariant: Strict Right-to-Left (RTL) Kurdish Sorani Standard

## Core Directive
Whenever communicating, reporting, explaining, or writing in Kurdish Sorani (`ku`) (or Arabic `ar`), the agent MUST ALWAYS write and format strictly from right to left (RTL). This applies to all paragraphs, headings, bullet lists, numbers, brackets, punctuation, and code references.

## 1. Chat Communication Standards
1. **Explicit RTL Wrapper Mandate**:
   - Every response written in Kurdish Sorani must be wrapped in a `<div dir="rtl" style="text-align: right; direction: rtl;">...</div>` block.
   - This ensures the chat interface does NOT default to LTR alignment.
2. **Numbers and Enumeration**:
   - Ordered lists and bullet points must align strictly to the right margin.
   - Numbers (whether Kurdish/Eastern Arabic or Latin numerals) within Kurdish sentences must flow naturally from right to left without breaking sentence layout.
3. **Brackets and Parentheses**:
   - Parenthetical expressions, English translations, acronyms, and bracketed notes `(...)` or `[...]` must strictly maintain right-to-left orientation without flipping or hanging detached at line edges.
4. **Punctuation and Colons**:
   - Colons (`:`), full stops (`.` / `۔`), question marks (`؟`), exclamation marks (`!`), and dashes must correctly dock to the RTL sentence without punctuation dislocation.
5. **LTR Isolation for Technical Entities**:
   - When technical terms, file paths (`src/...`), command names, git hashes, or phone numbers (`+964...`) appear within Kurdish prose, they must be isolated using inline code backticks (`` `...` ``) or `<span dir="ltr">...</span>` so they do not distort the surrounding Kurdish RTL flow.

## 2. Web Application UI Standards
- Document root (`<html dir="rtl" lang="ku">`) must always be set when Kurdish is active.
- All form inputs, modal dialogs, buttons, cards, tables, and navigation elements must strictly honor RTL layout.

