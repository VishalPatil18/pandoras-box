import { useId, type InputHTMLAttributes } from "react";
import { cn } from "cn";
import { Icon } from "@/components/icons";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  help?: string;
  error?: string | null;
  hideLabel?: boolean;
};

// Label above, help below, error last; screen readers hear help and error with the input.
export function Field({ label, help, error, hideLabel, className, id, ...input }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const describedBy = [help && helpId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-2">
      <label htmlFor={inputId} className={cn("text-sm font-bold", hideLabel && "sr-only")}>
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(
          "w-full rounded-card border border-carbon bg-paper px-5 py-4 text-lg placeholder:text-[#6b6b6b]",
          "aria-invalid:border-2 aria-invalid:border-ember",
          className,
        )}
        {...input}
      />
      {help && (
        <p id={helpId} className="text-sm text-ink-soft">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-center gap-2 text-sm font-bold">
          <Icon name="triangle-alert" className="text-ember" />
          {error}
        </p>
      )}
    </div>
  );
}
