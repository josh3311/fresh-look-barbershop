"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

export interface Photo {
  src: string;
  alt: string;
}

export function Portfolio({ photos, strip = false }: { photos: Photo[]; strip?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, photos.length]);

  return (
    <>
      <ul
        className={
          strip
            ? "no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4"
            : "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3"
        }
      >
        {photos.map((p, i) => (
          <li key={p.src} className={strip ? "w-44 shrink-0 snap-start sm:w-56" : ""}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="group relative block aspect-[4/5] w-full overflow-hidden rounded-lg bg-oak"
              aria-label={`${t.portfolio.open}: ${p.alt}`}
            >
              <Image
                src={p.src}
                alt={p.alt}
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      {open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={photos[open].alt}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl text-ivory"
            aria-label={t.portfolio.close}
            autoFocus
          >
            ×
          </button>
          <div className="relative h-[80dvh] w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <Image src={photos[open].src} alt={photos[open].alt} fill sizes="100vw" className="object-contain" />
          </div>
        </div>
      )}
    </>
  );
}
