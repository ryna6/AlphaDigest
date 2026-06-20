import Link from "next/link";

export function FlowBackLink({ href }: { href: string }) {
  return (
    <div className="mb-4">
      <Link
        href={href}
        className="inline-flex border border-borderStrong px-3 py-1.5 text-xs text-textSecondary transition-colors hover:border-accentBlue/50 hover:text-textPrimary"
      >
        ← Back
      </Link>
    </div>
  );
}
