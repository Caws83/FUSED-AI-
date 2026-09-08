export type NavItem = {
  href: string;
  label: string;
  active?: boolean;
};

export function Navigation({
  items,
  open = false,
}: {
  items: readonly NavItem[];
  open?: boolean;
}) {
  return (
    <nav className="fused-nav-links" data-open={open ? "true" : "false"} aria-label="Primary">
      {items.map((item) => (
        <a key={item.href} href={item.href} data-active={item.active ? "true" : "false"}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}
