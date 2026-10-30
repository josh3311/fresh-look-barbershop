"use client";

import { useState } from "react";

export function Tabs({
  tabs,
  accent = "gold",
}: {
  tabs: { id: string; label: string; content: React.ReactNode }[];
  accent?: "gold" | "rose";
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  const activeCls = accent === "rose" ? "border-rose text-ink" : "border-gold text-ink";
  return (
    <div>
      <div role="tablist" className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto border-b border-line px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActive(tab.id)}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition ${
              active === tab.id ? activeCls : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`} hidden={active !== tab.id}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
