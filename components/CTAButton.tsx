import type { ComponentProps, ReactNode, ButtonHTMLAttributes } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type LinkHref = ComponentProps<typeof Link>["href"];

type CTAButtonVariant = "primary" | "secondary" | "ghost";
type CTAButtonSize = "sm" | "md" | "lg";

interface CTAButtonBaseProps {
  variant?: CTAButtonVariant;
  size?: CTAButtonSize;
  className?: string;
  children: ReactNode;
}

interface CTAButtonAsLink extends CTAButtonBaseProps {
  href: LinkHref;
  onClick?: never;
  type?: never;
  disabled?: boolean;
}

interface CTAButtonAsButton
  extends CTAButtonBaseProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> {
  href?: never;
}

type CTAButtonProps = CTAButtonAsLink | CTAButtonAsButton;

const variantStyles: Record<CTAButtonVariant, string> = {
  primary:
    "bg-[#D9A441] text-[#2A120C] hover:bg-[#c99538] shadow-[0_4px_14px_rgba(217,164,65,0.25)]",
  secondary:
    "border border-[#4A2418]/30 bg-transparent text-[#4A2418] hover:border-[#4A2418] hover:bg-[#4A2418]/[0.04]",
  ghost:
    "bg-transparent text-[#4A2418] hover:text-[#2A120C] underline-offset-4 hover:underline",
};

const sizeStyles: Record<CTAButtonSize, string> = {
  sm: "h-11 px-6 text-sm",
  md: "h-14 px-8 text-base",
  lg: "h-16 px-10 text-lg",
};

export function CTAButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: CTAButtonProps) {
  const styles = cn(
    "btn-3d inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9A441] disabled:pointer-events-none disabled:opacity-50",
    variantStyles[variant],
    variant !== "ghost" ? sizeStyles[size] : "h-auto px-0 py-1",
    className,
  );

  if ("href" in props && props.href) {
    const { href, disabled } = props;
    if (disabled) {
      return (
        <span aria-disabled="true" className={cn(styles, "opacity-50")}>
          {children}
        </span>
      );
    }
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }

  const { type = "button", disabled, ...buttonProps } = props;

  return (
    <button
      type={type}
      disabled={disabled}
      className={styles}
      {...buttonProps}
    >
      {children}
    </button>
  );
}