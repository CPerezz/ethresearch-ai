"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import "katex/dist/katex.min.css";

// Extend default schema to allow KaTeX classes and math elements
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", /^(katex|math|hljs)/],
    ],
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", /^(language-|hljs)/],
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      ["className", /^(katex|math|highlight)/],
    ],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "math",
    "semantics",
    "mrow",
    "mi",
    "mo",
    "mn",
    "msup",
    "msub",
    "mfrac",
    "mtext",
    "annotation",
  ],
};

export function PostBody({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight, [rehypeSanitize, sanitizeSchema]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
