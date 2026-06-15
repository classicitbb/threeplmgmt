import { useCallback, useEffect, useMemo, useState } from "react";

import { searchHelpArticles, setupWizardSteps } from "@/lib/help-content";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlags, STARTER_MODULES, type ModuleKey } from "@/hooks/use-feature-flags";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { WikiBar, sectionSlug } from "@/components/wiki-bar";
import { ChevronUp, List, Search } from "lucide-react";

const KNOWN_MODULE_KEYS = Object.keys(STARTER_MODULES) as ModuleKey[];

// Map help article module strings to ModuleKey (some differ in naming)
function articleModuleKey(mod: string): ModuleKey | null {
  if (KNOWN_MODULE_KEYS.includes(mod as ModuleKey)) return mod as ModuleKey;
  if (mod === "packaging-profiles") return "packaging";
  return null;
}

export default function HelpCenterPage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("help-toc-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [accordionValues, setAccordionValues] = useState<string[]>([]);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const { isEnabled } = useFeatureFlags();
  const { roles } = useAuth();

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem("help-toc-collapsed", String(collapsed));
  }, [collapsed]);

  // Scroll listener for back-to-top (scoped to articles container)
  useEffect(() => {
    const el = document.getElementById("help-articles");
    if (!el) return;
    const handleScroll = () => setShowBackToTop(el.scrollTop > 400);
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  const results = useMemo(() => {
    const all = searchHelpArticles(query);
    return all.filter((article) => {
      const modKey = articleModuleKey(article.module);
      if (modKey && !isEnabled(modKey)) return false;
      // Admin-only articles
      if (article.audience === "Admins" || article.audience === "Admins and IT") {
        return roles.includes("admin");
      }
      return true;
    });
  }, [query, isEnabled, roles]);

  const handleTocNavigate = useCallback((articleId: string, sectionTitle?: string) => {
    const targetId = sectionTitle
      ? `sect-${articleId}__${sectionSlug(sectionTitle)}`
      : `article-${articleId}`;
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Expand setup-wizard accordion steps when navigating to that article
    if (articleId === "warehouse-setup") {
      setAccordionValues(setupWizardSteps.map((_, i) => `step-${i + 1}`));
    }
  }, []);

  return (
    <div className="help-center-light bg-background text-foreground flex gap-0 relative h-full overflow-hidden">
      <WikiBar
        articles={results}
        collapsed={collapsed}
        onNavigate={handleTocNavigate}
      />
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* Pinned header area: heading, toggle, search */}
        <div className="shrink-0 z-10 bg-background border-b border-border px-4 pb-3 pt-3 sm:px-5 lg:px-6">
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex h-7 w-7 shrink-0"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Show wiki bar" : "Hide wiki bar"}
              data-testid="toc-toggle"
            >
              <List className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-2xl font-semibold">Help Center</h2>
              <p className="text-sm text-muted-foreground">
                Search the operator wiki for setup, receiving, stock control, user access, and reporting guidance.
              </p>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              className="pl-10"
              placeholder="Search help articles, modules, or workflow terms"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {results.length} result{results.length === 1 ? "" : "s"} for your role and active modules.
          </p>
        </div>
        {/* Scrollable articles area — light mode */}
        <div id="help-articles" className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 sm:px-5 lg:px-6">
          <div className="grid gap-4 pt-4">
        {results.map((article) => (
          <Card id={`article-${article.id}`} data-toc-type="article" data-toc-id={article.id} key={article.id} className="scroll-mt-4">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{article.title}</CardTitle>
                <Badge variant="secondary">{article.module}</Badge>
                <Badge variant="outline">{article.audience}</Badge>
              </div>
              <CardDescription>{article.keywords.join(" • ")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {article.acronyms ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(article.acronyms).map(([term, explanation]) => (
                    <Tooltip key={term}>
                      <TooltipTrigger asChild>
                        <Badge className="cursor-help" variant="outline">{term}</Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">{explanation}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              ) : null}
              {article.sections.map((section) => {
                const slug = sectionSlug(section.title);
                return (
                <div id={`sect-${article.id}__${slug}`} data-toc-type="section" data-toc-article={article.id} data-toc-section={slug} key={`${article.id}-${section.title}`} className="grid gap-2 scroll-mt-4">
                  <h3 className="font-medium">{section.title}</h3>
                  {article.id === "warehouse-setup" && section.title === "Step Sequence" ? (
                    <Accordion type="multiple" className="w-full" value={accordionValues} onValueChange={setAccordionValues}>
                      {setupWizardSteps.map((step) => (
                        <AccordionItem key={step.number} value={`step-${step.number}`}>
                          <AccordionTrigger className="text-sm">
                            <span className="text-left">
                              <span className="font-medium">Step {step.number}: {step.title}</span>
                              <span className="ml-2 text-muted-foreground">{step.summary}</span>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <ul className="grid gap-2 pl-4 text-sm text-muted-foreground">
                              {step.details.map((detail) => (
                                <li key={detail} className="list-disc">{detail}</li>
                              ))}
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  ) : (
                    section.content.map((line) => (
                      <p key={line} className="text-sm text-muted-foreground">
                        {line}
                      </p>
                    ))
                  )}
                </div>
              );})}
              {article.references?.length ? (
                <div className="grid gap-2 border-t border-border pt-4">
                  <h3 className="font-medium">References and search links</h3>
                  {article.references.map((reference) => (
                    <a
                      key={reference.url}
                      className="rounded-md border border-border px-3 py-2 text-sm text-primary underline-offset-4 hover:underline"
                      href={reference.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {reference.label}
                      <span className="block text-xs text-muted-foreground">{reference.reason}</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
      </div>

      {showBackToTop && (
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-20 right-4 h-10 w-10 rounded-full shadow-lg z-50 lg:bottom-6 lg:right-6"
          onClick={() => document.getElementById("help-articles")?.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
