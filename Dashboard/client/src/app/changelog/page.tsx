import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Candidate paths for Dashboard/CHANGELOG.md (dev vs Docker standalone). */
const CHANGELOG_PATHS = [
  // Production Docker: WORKDIR /app, file copied next to server.js
  resolve(process.cwd(), "CHANGELOG.md"),
  // Local dev / npm run dev: cwd is Dashboard/client
  resolve(process.cwd(), "..", "CHANGELOG.md"),
];

async function getChangelogMarkdown(): Promise<{ markdown: string | null; sourcePath?: string }> {
  let lastAttemptedPath: string | undefined;

  for (const path of CHANGELOG_PATHS) {
    try {
      const markdown = await readFile(path, "utf8");
      return { markdown, sourcePath: path };
    } catch {
      lastAttemptedPath = path;
      // Try the next candidate path.
    }
  }

  return { markdown: null, sourcePath: lastAttemptedPath };
}

export default async function ChangelogPage() {
  const { markdown, sourcePath } = await getChangelogMarkdown();

  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-8 md:px-8 md:py-10">
      {markdown ? (
        <article className="prose prose-neutral max-w-none prose-headings:scroll-mt-24 prose-a:text-primary hover:prose-a:opacity-80">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children, ...props }) => {
                const isExternal = Boolean(href && /^https?:\/\//.test(href));
                if (!href) {
                  return <a {...props}>{children}</a>;
                }

                if (isExternal) {
                  return (
                    <a href={href} target="_blank" rel="noreferrer" {...props}>
                      {children}
                    </a>
                  );
                }

                return <a href={href} {...props}>{children}</a>;
              },
            }}
          >
            {markdown}
          </ReactMarkdown>
        </article>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Unable to load changelog content. Expected `Dashboard/CHANGELOG.md` in
          development or `/app/CHANGELOG.md` in the production container.
          {sourcePath ? ` Last attempted path: ${sourcePath}.` : ""}
        </div>
      )}
    </section>
  );
}
