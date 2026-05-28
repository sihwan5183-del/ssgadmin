import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, User, Phone, Smartphone, Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "sale" | "inquiry";
  customer_name: string | null;
  phone: string | null;
  device_model: string | null;
  channel: string | null;
  open_date: string | null;
  status: string | null;
}

const DEBOUNCE_MS = 300;
const MAX_RESULTS = 15;

function normalizePhone(raw: string) {
  return raw.replace(/[^0-9]/g, "");
}

export function GlobalSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);

    const isNumeric = /^\d+$/.test(normalizePhone(trimmed));
    const phoneDigits = normalizePhone(trimmed);

    try {
      // Search sales
      let salesQ = supabase
        .from("sales")
        .select("id, customer_name, phone, device_model, channel, open_date, status")
        .limit(MAX_RESULTS);

      if (isNumeric && phoneDigits.length >= 3) {
        salesQ = salesQ.ilike("phone", `%${phoneDigits.slice(-4).padStart(4, phoneDigits[0])}%`);
      } else {
        salesQ = salesQ.ilike("customer_name", `%${trimmed}%`);
      }

      // Search inquiries
      let inqQ = supabase
        .from("inquiries")
        .select("id, customer_name, phone, channel, status")
        .limit(MAX_RESULTS);

      if (isNumeric && phoneDigits.length >= 3) {
        inqQ = inqQ.ilike("phone", `%${phoneDigits.slice(-4).padStart(4, phoneDigits[0])}%`);
      } else {
        inqQ = inqQ.ilike("customer_name", `%${trimmed}%`);
      }

      const [salesRes, inqRes] = await Promise.all([salesQ, inqQ]);

      const mapped: SearchResult[] = [
        ...(salesRes.data ?? []).map((s: any) => ({
          id: s.id,
          type: "sale" as const,
          customer_name: s.customer_name,
          phone: s.phone,
          device_model: s.device_model,
          channel: s.channel,
          open_date: s.open_date,
          status: s.status,
        })),
        ...(inqRes.data ?? []).map((i: any) => ({
          id: i.id,
          type: "inquiry" as const,
          customer_name: i.customer_name,
          phone: i.phone,
          device_model: null,
          channel: i.channel,
          open_date: null,
          status: i.status,
        })),
      ].slice(0, MAX_RESULTS);

      setResults(mapped);
      setOpen(true);
      setActiveIdx(-1);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useCallback(
    (q: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => search(q), DEBOUNCE_MS);
    },
    [search],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    debouncedSearch(val);
  };

  const goTo = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    if (r.type === "sale") {
      navigate(`/activities?sale=${r.id}`);
    } else {
      navigate(`/leads?inquiry=${r.id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) {
      if (e.key === "Enter") {
        search(query);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      goTo(results[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length > 0 && results.length > 0 && setOpen(true)}
          placeholder="고객명 · 연락처 검색…"
          className="h-9 pl-9 pr-8 bg-input/60 text-sm"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
        )}
        {!loading && query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-border/60 bg-popover shadow-lg max-h-[360px] overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-4 text-center space-y-2">
              <p className="text-sm text-muted-foreground">검색 결과가 없습니다</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  navigate("/input");
                }}
              >
                <Plus className="size-3.5 mr-1" /> 신규 등록
              </Button>
            </div>
          ) : (
            <ul className="py-1">
              {results.map((r, idx) => (
                <li key={`${r.type}-${r.id}`}>
                  <button
                    onClick={() => goTo(r)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={cn(
                      "w-full text-left px-3 py-2 flex items-center gap-3 text-sm hover:bg-muted/40 transition-colors",
                      activeIdx === idx && "bg-muted/40",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <User className="size-3 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{r.customer_name ?? "(이름없음)"}</span>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                          {r.type === "sale" ? "실적" : "상담"}
                        </Badge>
                        {r.status && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                            {r.status}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                        {r.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="size-3" /> {r.phone}
                          </span>
                        )}
                        {r.device_model && (
                          <span className="flex items-center gap-1">
                            <Smartphone className="size-3" /> {r.device_model}
                          </span>
                        )}
                        {r.channel && <span>{r.channel}</span>}
                        {r.open_date && <span>{r.open_date}</span>}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}