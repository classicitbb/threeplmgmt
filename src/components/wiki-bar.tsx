import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, List } from "lucide-react";

import { type HelpArticle } from "@/lib/help-content";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Stable slug derived from a section title for use in DOM ids. */
export function sectionSlug(title: string): string {
  return title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

/** Deterministic module ordering for the TOC sidebar. */
function moduleOrder(mod: string): number {
  const order: Record<string, number> = {
    help: 1,
    dashboard: 2,
    receiving: 3,
    putaway: 4,
    inventory: 5,
    "pick-lists": 6,
    transfers: 7,
    "location-moves": 8,
    "cycle-counts": 9,
    status: 10,
    reports: 11,
    zones: 12,
    locations: 13,
    products: 14,
    "packaging-profiles": 15,
    clients: 16,
    users: 17,
    settings: 18,
    "system-log": 19,
    "email-log": 20,
    "setup-wizard": 21,
  };
  return order[mod] ?? 99;
}

type HelpTocProps = {
  articles: HelpArticle[];
  collapsed: boolean;
  onNavigate: (articleId: string, sectionTitle?: string) => void;
};

export function WikiBar({ articles, collapsed, onNavigate }: HelpTocProps) {
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [activeSectionSlug, setActiveSectionSlug] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Initialise all modules as expanded
  useEffect(() => {
    const modules = [...new Set(articles.map((a) => a.module))];
    setExpandedModules((prev) => {
      const next = { ...prev };
      for (const mod of modules) {
        if (!(mod in next)) next[mod] = true;
      }
      return next;
    });
  }, [articles]);

  // IntersectionObserver – track which article / section is in view
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    const els: Element[] = [];
    for (const a of articles) {
      const articleEl = document.getElementById(`article-${a.id}`);
      if (articleEl) els.push(articleEl);
      for (const s of a.sections) {
        const slug = sectionSlug(s.title);
        const sectionEl = document.getElementById(`sect-${a.id}__${slug}`);
        if (sectionEl) els.push(sectionEl);
      }
    }
    if (els.length === 0) return;

    const root = document.getElementById("help-articles");

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const { tocType, tocId, tocArticle, tocSection } = (
            entry.target as HTMLElement
          ).dataset;
          if (tocType === "article") {
            setActiveArticleId(tocId ?? null);
            setActiveSectionSlug(null);
          } else if (tocType === "section") {
            setActiveArticleId(tocArticle ?? null);
            setActiveSectionSlug(tocSection ?? null);
          }
        }
      },
      { root, rootMargin: "-80px 0px -65% 0px", threshold: 0 },
    );

    for (const el of els) observerRef.current.observe(el);
    return () => observerRef.current?.disconnect();
  }, [articles]);

  // Group articles by module
  const grouped = useMemo(() => {
    const map = new Map<string, HelpArticle[]>();
    for (const article of articles) {
      const list = map.get(article.module) ?? [];
      list.push(article);
      map.set(article.module, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => moduleOrder(a) - moduleOrder(b))
      .map(([mod, list]) => [
        mod,
        [...list].sort((a, b) => a.title.localeCompare(b.title)),
      ]) as [string, HelpArticle[]][];
  }, [articles]);

  const handleArticleClick = useCallback(
    (articleId: string) => {
      onNavigate(articleId);
      setSheetOpen(false);
    },
    [onNavigate],
  );

  const handleSectionClick = useCallback(
    (articleId: string, sectionTitle: string) => {
      onNavigate(articleId, sectionTitle);
      setSheetOpen(false);
    },
    [onNavigate],
  );

  const toggleModule = useCallback((mod: string) => {
    setExpandedModules((prev) => ({ ...prev, [mod]: !prev[mod] }));
  }, []);

  /** Shared TOC tree rendered both in the desktop sidebar and mobile sheet. */
  const tocTree = (
    <nav className="space-y-4" aria-label="Table of contents">
      {grouped.map(([mod, modArticles]) => (
        <div key={mod}>
          <button
            onClick={() => toggleModule(mod)}
            className="flex w-full items-center gap-1 px-1 py-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors text-left rounded-sm uppercase tracking-wider"
          >
            {expandedModules[mod] ? (
              <ChevronDown className="h-3 w-3 shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0" />
            )}
            {mod}
          </button>
          {expandedModules[mod] && (
            <div className="ml-4 space-y-0.5 mt-0.5">
              {modArticles.map((article) => (
                <div key={article.id}>
                  <button
                    onClick={() => handleArticleClick(article.id)}
                    className={cn(
                      "block w-full text-left px-2 py-1 rounded text-sm transition-colors",
                      activeArticleId === article.id
                        ? "font-semibold text-primary bg-primary/5"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    {article.title}
                  </button>
                  {article.sections.length > 0 && (
                    <div className="ml-3 space-y-0.5">
                      {article.sections.map((section) => {
                        const slug = sectionSlug(section.title);
                        return (
                          <button
                            key={`${article.id}-${slug}`}
                            onClick={() => handleSectionClick(article.id, section.title)}
                            className={cn(
                              "block w-full text-left px-2 py-0.5 rounded text-xs transition-colors",
                              activeArticleId === article.id && activeSectionSlug === slug
                                ? "text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted",
                            )}
                          >
                            {section.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );

  /* Desktop sidebar — toggle button is now rendered in HelpCenter heading */
  const sidebar = (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-r border-border bg-background transition-all duration-200",
        collapsed ? "w-0 overflow-hidden border-0 p-0 min-w-0" : "w-64 shrink-0",
      )}
    >
      <div className="flex items-center justify-end px-3 py-2 border-b border-border shrink-0">
        <span className={cn("text-xs font-semibold text-muted-foreground", collapsed && "hidden")}>
          Wiki Bar
        </span>
      </div>
      <ScrollArea className="flex-1 px-3 py-2">{tocTree}</ScrollArea>
    </aside>
  );

  /* Mobile floating button + bottom sheet */
  const mobileToc = (
    <div className="lg:hidden">
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg z-50"
            aria-label="Open table of contents"
          >
            <List className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="help-center-light max-h-[80vh] rounded-t-xl px-4 pb-8 pt-4"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Table of Contents</SheetTitle>
          </SheetHeader>
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
          <ScrollArea className="max-h-[calc(80vh-6rem)]">{tocTree}</ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );

  return (
    <>
      {sidebar}
      {mobileToc}
    </>
  );
}

