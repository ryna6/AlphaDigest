"use client";
import Link, { type LinkProps } from "next/link";
import { forwardRef } from "react";
import { beginRouteNavigation } from "@/components/shell/route-loading-provider";
type Props = LinkProps & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>;
export const AppLink = forwardRef<HTMLAnchorElement, Props>(function AppLink({ href, onClick, ...props }, ref) {
  return <Link ref={ref} href={href} prefetch={false} onClick={(event)=>{ onClick?.(event); if(!event.defaultPrevented && typeof href === "string") beginRouteNavigation(href); }} {...props} />;
});
