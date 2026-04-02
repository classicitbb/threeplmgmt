import { Link } from "react-router-dom";
import { HelpCircle } from "lucide-react";

import { getArticleById, getRouteHelp } from "@/lib/help-content";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function HelpSidebar({ pathname }: { pathname: string }) {
  const help = getRouteHelp(pathname);
  const linkedArticles = help.wikiArticleIds.map((articleId) => getArticleById(articleId)).filter(Boolean);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <HelpCircle data-icon="inline-start" />
          Help
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{help.title}</SheetTitle>
          <SheetDescription>{help.summary}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="mt-6 h-[calc(100vh-9rem)] pr-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Key Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm text-muted-foreground">
                {help.keyActions.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Common Mistakes</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm text-muted-foreground">
                {help.commonMistakes.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Permissions</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{help.permissions}</CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Related Wiki Articles</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {linkedArticles.map((article) => (
                  <div key={article?.id} className="rounded-lg border border-border p-3">
                    <p className="font-medium">{article?.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{article?.audience}</p>
                  </div>
                ))}
                <Button asChild className="w-full">
                  <Link to="/help">Open Help Center</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
