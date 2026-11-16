"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PaperRow } from "@/lib/view";

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [papers, setPapers] = useState<PaperRow[]>([]);

  // Refresh the list when the page changes and whenever a paper moves to a new stage.
  useEffect(() => {
    // Signed out on the sign-in page: there is no list to load.
    if (path === "/login") return;
    let alive = true;
    const load = () =>
      fetch("/api/papers")
        .then((r) => (r.ok ? r.json() : { papers: [] }))
        .then((d) => alive && setPapers(d.papers ?? []))
        .catch(() => {});
    load();
    window.addEventListener("papers-changed", load);
    return () => {
      alive = false;
      window.removeEventListener("papers-changed", load);
    };
  }, [path]);

  if (path === "/login") return null;

  return (
    <aside className="side">
      <Link href="/" className="brand">
        <span className="mark" aria-hidden="true">S</span>
        Study copilot
      </Link>
      <nav className="nav" aria-label="Main">
        <Link href="/" className={path === "/" ? "on" : ""}>Upload a paper</Link>
        <Link href="/work-on" className={path === "/work-on" ? "on" : ""}>What to work on</Link>
        <Link href="/self-test" className={path.startsWith("/self-test") ? "on" : ""}>Practice</Link>
        <Link href="/report" className={path === "/report" ? "on" : ""}>Report</Link>
      </nav>
      {papers.length > 0 && (
        <nav className="nav papers" aria-label="Your papers">
          <div className="side-label">Your papers</div>
          {papers.slice(0, 8).map((p) => (
            <Link key={p.id} href={`/papers/${p.id}`} className={path === `/papers/${p.id}` ? "on" : ""}>
              {p.title}
              <span className="small">{p.line}</span>
            </Link>
          ))}
        </nav>
      )}
      <div className="side-foot">
        <button
          type="button"
          className="linkish"
          onClick={async () => {
            await fetch("/api/logout", { method: "POST" }).catch(() => {});
            router.replace("/login");
            router.refresh();
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
