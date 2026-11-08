"use client";

import { Description, Input, Label, TextArea, TextField } from "@heroui/react";

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  description?: string;
  isRequired?: boolean;
  name?: string;
  autoComplete?: string;
  className?: string;
  isDisabled?: boolean;
};

export function Field({ label, value, onChange, type = "text", placeholder, description, isRequired, name, autoComplete, className, isDisabled }: FieldProps) {
  return (
    <TextField className={className ?? "w-full"} value={value} onChange={onChange} type={type} isRequired={isRequired} name={name} isDisabled={isDisabled}>
      <Label>{label}</Label>
      <Input placeholder={placeholder} autoComplete={autoComplete} />
      {description ? <Description>{description}</Description> : null}
    </TextField>
  );
}

export function AreaField({ label, value, onChange, placeholder, description, rows = 4, className }: Omit<FieldProps, "type"> & { rows?: number }) {
  return (
    <TextField className={className ?? "w-full"} value={value} onChange={onChange}>
      <Label>{label}</Label>
      <TextArea placeholder={placeholder} rows={rows} />
      {description ? <Description>{description}</Description> : null}
    </TextField>
  );
}
