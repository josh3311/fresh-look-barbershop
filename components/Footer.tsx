import Image from "next/image";
import Link from "next/link";
import { shop } from "@/lib/catalog";
import { t } from "@/lib/i18n";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-oak-soft">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="overflow-hidden rounded-md bg-white ring-1 ring-line">
            <Image src="/brand/logo.jpg" alt="" width={56} height={56} />
          </span>
          <div className="text-sm text-muted">
            <p className="font-serif text-base text-ink">{shop.name}</p>
            <p>{shop.address}</p>
            <a href={`mailto:${shop.email}`} className="hover:text-gold-text">
              {shop.email}
            </a>
          </div>
        </div>
        <div className="flex items-center justify-between gap-6 text-xs text-muted sm:flex-col sm:items-end">
          <span>{t.footer.rights}</span>
          <Link href="/staff/login" className="underline-offset-4 hover:underline">
            {t.footer.staffLogin}
          </Link>
        </div>
      </div>
    </footer>
  );
}
