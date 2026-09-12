import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PAGES, render } from "@/legal/render.mjs";
import { LegalFooter } from "@/components/LegalFooter";

/**
 * /terms, /privacy, /acceptable-use, /refunds, /accessibility — the five
 * policies, rendered from legal/*.md at build time. Public (the middleware
 * lists them): a policy nobody can read before signing in is not published.
 * The static site serves the same markdown through the same renderer, so
 * the two hosts never disagree on a clause.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES.find((p) => p.slug === slug);
  return { title: page ? page.title : "Not found" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES.find((p) => p.slug === slug);
  if (!page) notFound();
  const md = fs.readFileSync(path.join(process.cwd(), "legal", `${page.slug}.md`), "utf8");
  const html = render(md);
  return (
    <main className="fc fc-legal">
      <header className="fc-legal-top">
        <a href="https://www.thefutureclips.com" className="fc-brand">
          <span className="fc-mark" aria-hidden />
          <span><small>The</small><b>futureclips</b></span>
        </a>
        <Link href="/app" className="fc-btn" data-variant="ghost">Open the app</Link>
      </header>
      <nav className="fc-legal-nav" aria-label="Trust and Legal">
        {PAGES.map((p) => (
          <Link key={p.slug} href={`/${p.slug}`} aria-current={p.slug === page.slug ? "page" : undefined}>{p.short}</Link>
        ))}
      </nav>
      {/* The markup is produced by our own renderer from files in this repo — no user input reaches it. */}
      <article className="fc-legal-body" dangerouslySetInnerHTML={{ __html: html }} />
      <LegalFooter />
    </main>
  );
}
