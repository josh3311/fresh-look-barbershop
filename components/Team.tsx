import Image from "next/image";
import Link from "next/link";
import type { StaffMember } from "@/lib/catalog";
import { t } from "@/lib/i18n";

const sideLabel = { men: t.team.men, women: t.team.women, both: t.team.both };

export function Avatar({ person, size = 96 }: { person: StaffMember; size?: number }) {
  const initials = person.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
  return person.photoUrl ? (
    <Image
      src={person.photoUrl}
      alt={person.name}
      width={size}
      height={size}
      className="rounded-full object-cover ring-2 ring-gold"
    />
  ) : (
    <span
      className="grid place-items-center rounded-full bg-oak font-serif text-ink ring-2 ring-gold"
      style={{ width: size, height: size, fontSize: size / 3 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function TeamGrid({ people }: { people: StaffMember[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {people.map((p) => {
        const side = p.side === "women" ? "women" : "men";
        return (
          <li key={p.id} className="flex flex-col items-center rounded-xl border border-line bg-surface p-5 text-center">
            <Avatar person={p} />
            <p className="mt-3 font-serif text-lg">{p.name}</p>
            <span
              className={`mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                p.side === "women" ? "bg-rose/25 text-rose-text" : "bg-gold/20 text-gold-text"
              }`}
            >
              {sideLabel[p.side]}
            </span>
            <Link
              href={`/book?side=${side}&staff=${p.id}`}
              className="mt-4 rounded-full border border-ink px-4 py-2 text-sm font-medium transition hover:bg-ink hover:text-paper"
            >
              {t.team.bookWith} {p.name}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
