"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

export function SiteNavigation() {
  const pathname = usePathname();
  const disclosure = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);

  function closeMenu() {
    if (disclosure.current) disclosure.current.open = false;
  }

  const links = [
    { href: "/", label: "Home" },
    { href: "/explore", label: "Explore" },
    { href: "/account", label: "Account" },
  ].map(({ href, label }) => (
    <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={closeMenu}>
      {label}
    </Link>
  ));

  return (
    <nav aria-label="Main navigation">
      <div className="desktop-links">{links}</div>
      <details
        key={pathname}
        className="mobile-menu"
        ref={disclosure}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) closeMenu();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && disclosure.current?.open) {
            closeMenu();
            trigger.current?.focus();
          }
        }}
      >
        <summary ref={trigger}><span aria-hidden="true" className="menu-icon" />Menu</summary>
        <div className="mobile-links">{links}</div>
      </details>
    </nav>
  );
}
