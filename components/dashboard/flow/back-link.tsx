import Link from "next/link";

export function FlowBackLink({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="border border-borderStrong px-3 py-1 text-xs text-textSecondary transition-colors hover:border-accentBlue/50 hover:text-textPrimary"
    >
      {label}
    </Link>
  );
}
