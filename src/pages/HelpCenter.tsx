import { useMemo, useState } from "react";

import { helpArticles, searchHelpArticles } from "@/lib/help-content";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function HelpCenterPage() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchHelpArticles(query), [query]);

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
          {results.length} result{results.length === 1 ? "" : "s"} shown out of {helpArticles.length} articles.
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
              {article.sections.map((section) => (
                <div key={`${article.id}-${section.title}`} className="grid gap-2">
                  <h3 className="font-medium">{section.title}</h3>
                  {section.content.map((line) => (
                    <p key={line} className="text-sm text-muted-foreground">
                      {line}
                    </p>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
