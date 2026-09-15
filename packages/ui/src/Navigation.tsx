import type { ElementType, ReactNode } from "react";

export type NavItem = {
  href: string;
  label: string;
  active?: boolean;
};

export function Navigation({
  items,
  open = false,
  link: Link = "a",
}: {
  items: readonly NavItem[];
  open?: boolean;
  link?: ElementType<{ href: string; children?: ReactNode; "data-active"?: string }>;
}) {
  return (
    <nav className="fused-nav-links" data-open={open ? "true" : "false"} aria-label="Primary">
      {items.map((item) => (
        <Link key={item.href} href={item.href} data-active={item.active ? "true" : "false"}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
