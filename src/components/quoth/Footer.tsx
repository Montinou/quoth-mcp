"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

interface FooterLink {
  href: string;
  label: string;
}

interface FooterProps {
  className?: string;
  links?: FooterLink[];
}

const defaultLinks: FooterLink[] = [
  { href: "/manifesto", label: "Manifesto" },
  { href: "/protocol", label: "Protocol" },
  { href: "/guide", label: "Guide" },
  { href: "/pricing", label: "Pricing" },
];

export function Footer({ className, links = defaultLinks }: FooterProps) {
  return (
    <footer
      className={cn(
        "border-t border-white/5 py-12 px-6 bg-obsidian",
        className
      )}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <Logo />

          <div className="flex gap-8 text-sm text-gray-500">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-violet-ghost transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Social links hidden until real accounts exist - E-E-A-T compliance */}
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 text-center">
          <p className="text-gray-600 text-sm font-mono">
            &copy; 2025 Quoth Labs. &quot;Wisdom over Guesswork.&quot;
          </p>
        </div>
      </div>
    </footer>
  );
}
