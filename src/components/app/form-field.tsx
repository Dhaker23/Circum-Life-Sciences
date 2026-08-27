"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * FormField — reusable label + control + description + error wrapper.
 *
 * Renders a semantic Label (with red asterisk if `required`), the caller-
 * supplied control(s) via `children`, an optional muted description, and an
 * optional error message (red, text-xs) with a subtle fade-in animation.
 *
 * Pure presentational — does not manage any state. The caller decides when an
 * `error` should be shown (typically on blur / submit attempt).
 *
 * RTL-aware: uses logical Tailwind properties; relies on the page's `dir`
 * attribute for text alignment.
 */
export interface FormFieldProps {
  /** Visible label text. */
  label: string;
  /** Renders a red asterisk next to the label. */
  required?: boolean;
  /** Optional error string. When non-null + non-empty, renders below the control in red. */
  error?: string | null;
  /** Optional helper text shown below the control (muted). Hidden when an error is shown. */
  description?: string;
  /** Optional id of the inner control — passed to the Label's `htmlFor` for accessibility. */
  htmlFor?: string;
  /** Optional extra className applied to the outer wrapper. */
  className?: string;
  /** The form control(s) to render. */
  children: React.ReactNode;
}

export function FormField({
  label,
  required = false,
  error = null,
  description,
  htmlFor,
  className,
  children,
}: FormFieldProps) {
  const showError = Boolean(error && error.trim().length > 0);
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        <span>{label}</span>
        {required ? (
          <span aria-hidden="true" className="text-destructive ms-0.5">
            *
          </span>
        ) : null}
        {required ? (
          <span className="sr-only"> (required)</span>
        ) : null}
      </Label>
      {children}
      {showError ? (
        <p
          role="alert"
          className="text-xs font-medium text-destructive animate-in fade-in-0 slide-in-from-top-0.5 duration-150"
        >
          {error}
        </p>
      ) : description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export default FormField;
