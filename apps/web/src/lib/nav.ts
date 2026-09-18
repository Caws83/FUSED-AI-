import type { NavItem } from "@fused-ai/ui";

export const NAV_ITEMS: readonly Omit<NavItem, "active">[] = [
  { href: "/community", label: "Community" },
  { href: "/launch", label: "Launch" },
  { href: "/rewards", label: "Rewards" },
  { href: "/explore", label: "Explore" },
];

export function navFor(pathname: string): NavItem[] {
  return NAV_ITEMS.map((item) => ({ ...item, active: pathname === item.href }));
}
