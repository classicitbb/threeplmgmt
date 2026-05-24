import { useMemo, useState } from "react";

import { searchHelpArticles, setupWizardSteps } from "@/lib/help-content";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlags, STARTER_MODULES, type ModuleKey } from "@/hooks/use-feature-flags";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const KNOWN_MODULE_KEYS = Object.keys(STARTER_MODULES) as ModuleKey[];

// Map help article module strings to ModuleKey (some differ in naming)
function articleModuleKey(mod: string): ModuleKey | null {
  if (KNOWN_MODULE_KEYS.includes(mod as ModuleKey)) return mod as ModuleKey;
  if (mod === "packaging-profiles") return "packaging";
  return null;
}

export default function HelpCenterPage() {
  const [query, setQuery] = useState("");
  const { isEnabled } = useFeatureFlags();
  const { roles } = useAuth();

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

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Help Center</h2>
          <p className="text-sm text-muted-foreground">
            Search the operator wiki for setup, receiving, stock control, user access, and reporting guidance.
          </p>
        </div>
        <Input
          placeholder="Search help articles, modules, or workflow terms"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {results.length} result{results.length === 1 ? "" : "s"} for your role and active modules.
        </p>
      </div>

      <div className="grid gap-4">
        {results.map((article) => (
          <Card key={article.id}>
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
              {article.sections.map((section) => (
                <div key={`${article.id}-${section.title}`} className="grid gap-2">
                  <h3 className="font-medium">{section.title}</h3>
                  {article.id === "warehouse-setup" && section.title === "Step Sequence" ? (
                    <Accordion type="multiple" className="w-full">
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
              ))}
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
  );
}
