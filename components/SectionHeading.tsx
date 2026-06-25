import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center" | "right";
  className?: string;
  children?: ReactNode;
}

const alignStyles = {
  left: "text-left items-start",
  center: "text-center items-center mx-auto",
  right: "text-right items-end ml-auto",
};

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className,
  children,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex max-w-4xl flex-col gap-4",
        alignStyles[align],
        className,
      )}
    >
      {eyebrow ? (
        <span className="type-label inline-flex items-center gap-3 text-[#D9A441]">
          <span className="h-px w-10 bg-[#D9A441]/40" />
          {eyebrow}
          <span className="h-px w-10 bg-[#D9A441]/40" />
        </span>
      ) : null}
      <h2 className="type-display-md text-[#2A120C]">{title}</h2>
      {subtitle ? (
        <p className="type-body-lg max-w-[56ch] text-[#4A2418]/75">{subtitle}</p>
      ) : null}
      {children}
    </div>
  );
}