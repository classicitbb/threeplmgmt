import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ProductOption = {
  id: string;
  sku: string;
  name: string;
  barcode?: string;
};

type Props = {
  value: string;
  onChange: (id: string) => void;
  options: ProductOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
};

export function ProductSearch({ value, onChange, options, placeholder = "Search product by code or name…", disabled, error }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value);

  const filtered = query.length === 0
    ? options.slice(0, 8)
    : options
        .filter((o) => {
          const q = query.toLowerCase();
          return (
            o.sku.toLowerCase().includes(q) ||
            o.name.toLowerCase().includes(q) ||
            (o.barcode && o.barcode.toLowerCase().includes(q))
          );
        })
        .slice(0, 8);

  // Bluetooth scanner support: if the query exactly matches a product barcode, auto-select
  useEffect(() => {
    if (!query) return;
    const match = options.find((o) => o.barcode && o.barcode === query);
    if (match) {
      onChange(match.id);
      setQuery("");
      setOpen(false);
    }
  }, [query, options, onChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            error && "border-destructive",
          )}
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selected ? `${selected.sku} · ${selected.name}` : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            ref={inputRef}
            placeholder="Type SKU, name, or scan barcode…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No products matched. Check the SKU or name.</CommandEmpty>
            <CommandGroup>
              {filtered.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.id}
                  onSelect={() => {
                    onChange(product.id);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === product.id ? "opacity-100" : "opacity-0")} />
                  <span className="font-mono text-xs text-muted-foreground mr-2">{product.sku}</span>
                  <span className="truncate">{product.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
