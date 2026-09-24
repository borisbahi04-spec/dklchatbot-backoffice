"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

function FieldShell({
  label,
  error,
  hint,
  required,
  children,
}: FieldWrapperProps & { children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label && (
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
      )}
      {children}
      {hint && !error && (
        <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}

const baseInputClasses =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-500 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-900";

type InputProps = InputHTMLAttributes<HTMLInputElement> & FieldWrapperProps;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, required, className, ...props }, ref) => (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      <input
        ref={ref}
        className={clsx(baseInputClasses, error && "border-red-500", className)}
        {...props}
      />
    </FieldShell>
  )
);
Input.displayName = "Input";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldWrapperProps;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, required, className, ...props }, ref) => (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      <textarea
        ref={ref}
        className={clsx(baseInputClasses, "min-h-[80px] resize-y", error && "border-red-500", className)}
        {...props}
      />
    </FieldShell>
  )
);
Textarea.displayName = "Textarea";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> &
  FieldWrapperProps & { placeholder?: string };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, required, className, placeholder, children, ...props }, ref) => (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      <select
        ref={ref}
        className={clsx(baseInputClasses, error && "border-red-500", className)}
        {...props}
      >
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {children}
      </select>
    </FieldShell>
  )
);
Select.displayName = "Select";

export function Checkbox({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-slate-600"
        {...props}
      />
      {label}
    </label>
  );
}
