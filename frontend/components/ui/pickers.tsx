"use client";

import { Label, ListBox, Select } from "@heroui/react";


export type Option = { id: string; label: string };

/** Thin wrapper over HeroUI v3 Select for single-value pickers. */
export function Picker({
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  className = "w-full",
  hideLabel,
  isDisabled,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  hideLabel?: boolean;
  isDisabled?: boolean;
}) {
  return (
    <Select
      className={className}
      placeholder={placeholder}
      value={value}
      onChange={(v) => onChange(v == null ? null : String(v))}
      aria-label={label}
      isDisabled={isDisabled}
    >
      <Label className={hideLabel ? "sr-only" : undefined}>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** Segmented filter (lighter than tabs for list filters). */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; count?: number }[] }) {
  return (
    <div className="zc-scroll inline-flex max-w-full overflow-x-auto rounded-lg bg-default p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 transition-colors ${
            value === o.id ? "bg-surface font-medium text-foreground shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          {o.label}
          {o.count !== undefined && o.count > 0 ? <span className="text-xs text-muted">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
