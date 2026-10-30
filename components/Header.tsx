"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { t } from "@/lib/i18n";

const links = [
  { href: "/men", label: t.nav.men },
  { href: "/women", label: t.nav.women },
  { href: "/#team", label: t.nav.team },
  { href: "/#visit", label: t.nav.contact },
];

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 sm:gap-3" onClick={() => setOpen(false)}>
          <span className="overflow-hidden rounded-md bg-white ring-1 ring-line">
            <Image src="/brand/logo.jpg" alt="Fresh Look logo" width={36} height={36} priority />
          </span>
          <span className="whitespace-nowrap font-serif text-lg tracking-wide">Fresh Look</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm md:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted transition hover:text-gold-text">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/book"
            className="whitespace-nowrap rounded-full bg-gold px-3 py-2 text-xs font-semibold text-onyx shadow-sm transition hover:brightness-110 sm:px-4 sm:text-sm"
          >
            {t.nav.book}
          </Link>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-line md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t.nav.close : t.nav.menu}
            onClick={() => setOpen((o) => !o)}
          >
            <span aria-hidden className="relative block h-3 w-4">
              <span className={`absolute left-0 h-px w-4 bg-ink transition ${open ? "top-1.5 rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 top-1.5 h-px w-4 bg-ink transition ${open ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 h-px w-4 bg-ink transition ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" className="border-t border-line bg-paper md:hidden" aria-label="Mobile">
          <ul className="mx-auto max-w-6xl px-4 py-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="block border-b border-line py-3 font-serif text-lg last:border-0"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
