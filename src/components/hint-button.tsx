import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function HintButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          aria-label={label}
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="z-50 max-w-xs p-3 text-sm font-normal leading-5"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
