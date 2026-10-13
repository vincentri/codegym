// The trigger follows the WAI-ARIA combobox pattern (button + popup list), as in shadcn's combobox.
// oxlint-disable jsx-a11y/prefer-tag-over-role
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useCategories, useSaveCategory } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { categoryFormSchemaWithNames } from "@/schemas";
import { ColorDot } from "./CategoryBadge";

/**
 * Multi-select for categories. With `allowCreate`, typing a new name offers "Create …",
 * validated by the same Zod rules as the Categories page.
 */
export function CategoryPicker({
  value,
  onChange,
  allowCreate = false,
  placeholder = "Choose categories",
  className,
  id,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  allowCreate?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const { data: categories = [] } = useCategories();
  const save = useSaveCategory();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listId = useId();

  const selected = categories.filter((c) => value.includes(c.id));
  const toggle = (cid: string) =>
    onChange(value.includes(cid) ? value.filter((v) => v !== cid) : [...value, cid]);

  const trimmed = search.trim();
  const exists = categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());

  const create = async () => {
    const form = { id: null, name: trimmed, color: "slate" as const, description: "" };
    const parsed = categoryFormSchemaWithNames(categories).safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid category name");
      return;
    }
    const created = await save.mutateAsync(parsed.data);
    onChange([...value, created.id]);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          className={cn("h-auto min-h-9 w-full justify-between font-normal", className)}
        >
          <span className="flex flex-wrap gap-1">
            {selected.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
            {selected.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs"
              >
                <ColorDot color={c.color} />
                {c.name}
              </span>
            ))}
          </span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent id={listId} className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search categories…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            <CommandGroup>
              {categories.map((c) => (
                <CommandItem key={c.id} value={c.name} onSelect={() => toggle(c.id)}>
                  <ColorDot color={c.color} />
                  <span className="flex-1">{c.name}</span>
                  <CheckIcon
                    className={cn("size-4", value.includes(c.id) ? "opacity-100" : "opacity-0")}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            {allowCreate && trimmed.length > 0 && !exists && (
              <CommandGroup>
                <CommandItem value={`create ${trimmed}`} onSelect={() => void create()}>
                  <PlusIcon /> Create “{trimmed}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
