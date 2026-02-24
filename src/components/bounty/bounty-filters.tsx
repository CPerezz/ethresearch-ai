"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";

type Category = { slug: string; name: string };

export function BountyFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const type = searchParams.get("type") ?? "all";
  const minEth = searchParams.get("minEth") ?? "";
  const category = searchParams.get("category") ?? "all";

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    for (const [k, v] of Object.entries(overrides)) {
      if (!v || v === "all") {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    }
    const qs = params.toString();
    return `/bounties${qs ? `?${qs}` : ""}`;
  }

  function navigate(overrides: Record<string, string>) {
    router.push(buildUrl(overrides));
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <FilterDropdown
        label="Type"
        value={type === "eth" ? "ETH Bounty" : type === "rep" ? "Rep Only" : "All Types"}
        options={[
          { label: "All Types", value: "all" },
          { label: "ETH Bounty", value: "eth" },
          { label: "Rep Only", value: "rep" },
        ]}
        onSelect={(v) => {
          const overrides: Record<string, string> = { type: v };
          if (v !== "eth") overrides.minEth = "";
          navigate(overrides);
        }}
        active={type !== "all"}
      />

      {type === "eth" && (
        <MinEthInput
          value={minEth}
          onApply={(v) => navigate({ minEth: v })}
        />
      )}

      <FilterDropdown
        label="Category"
        value={categories.find((c) => c.slug === category)?.name ?? "All Categories"}
        options={[
          { label: "All Categories", value: "all" },
          ...categories.map((c) => ({ label: c.name, value: c.slug })),
        ]}
        onSelect={(v) => navigate({ category: v })}
        active={category !== "all"}
      />

      {(type !== "all" || category !== "all" || minEth) && (
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("type");
            params.delete("minEth");
            params.delete("category");
            params.delete("page");
            const qs = params.toString();
            router.push(`/bounties${qs ? `?${qs}` : ""}`);
          }}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function FilterDropdown({
  label,
  value,
  options,
  onSelect,
  active,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onSelect: (value: string) => void;
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
          active
            ? "border-primary/30 bg-primary/5 text-foreground"
            : "border-border bg-card text-muted-foreground hover:text-foreground"
        }`}
      >
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}:</span>
        {value}
        <svg className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-border bg-background py-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onSelect(opt.value);
                setOpen(false);
              }}
              className={`block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent ${
                value === opt.label ? "font-semibold text-foreground" : "text-muted-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MinEthInput({
  value,
  onApply,
}: {
  value: string;
  onApply: (value: string) => void;
}) {
  const [input, setInput] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setInput(value), [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const apply = useCallback(() => {
    onApply(input);
    setOpen(false);
  }, [input, onApply]);

  const presets = ["0.01", "0.05", "0.1", "0.5", "1"];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
          value
            ? "border-primary/30 bg-primary/5 text-foreground"
            : "border-border bg-card text-muted-foreground hover:text-foreground"
        }`}
      >
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Min:</span>
        {value ? `${value} ETH` : "Any amount"}
        <svg className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-background p-2 shadow-lg">
          <div className="mb-2 flex flex-wrap gap-1">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => { onApply(p); setOpen(false); }}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                  value === p
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {p} ETH
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="number"
              step="0.001"
              min="0"
              placeholder="Custom ETH"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
            />
            <button
              onClick={apply}
              className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
            >
              Go
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
