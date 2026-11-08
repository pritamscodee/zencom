"use client";

import { Switch } from "@heroui/react";
import type { ReactNode } from "react";

export function Toggle({ isSelected, onChange, children, isDisabled, size }: { isSelected: boolean; onChange: (v: boolean) => void; children?: ReactNode; isDisabled?: boolean; size?: "sm" | "md" | "lg" }) {
  return (
    <Switch isSelected={isSelected} onChange={onChange} isDisabled={isDisabled} size={size}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        {children}
      </Switch.Content>
    </Switch>
  );
}
