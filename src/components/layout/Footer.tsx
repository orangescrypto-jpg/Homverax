"use client";

/**
 * components/layout/Footer.tsx
 *
 * FIX: Blog link gated behind enableBlogSection feature flag.
 * WhatsApp number shown in contact section when enableLiveChat is on.
 * Social links loaded from platformSettings as before.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Facebook, Instagram, Linkedin, Mail, MapPin, MessageCircle, Twitter, Youtube } from "lucide-react";
import {
  getPlatformConfig,
  DEFAULT_SOCIAL,
  type SocialLinks,
} from "@/services/platformSettings";

interface FooterConfig {
  social: SocialLinks;
  showBlog: boolean;
  showWhatsApp: boolean;
  whatsAppNumber: string;
  whatsAppMessage: string;
}

export default function Footer() {
  const year = new Date().getFullYear();
  const [cfg, setCfg] = useState<FooterConfig>({
    social: DEFAULT_SOCIAL,
    showBlog: true,
    showWhatsApp: false,
    whatsAppNumber: "",
    whatsAppMessage: "",
  });

  useEffect(() => {
    getPlatformConfig().then((config) => {
      setCfg({
        social: config.social ?? DEFAULT_SOCIAL,
        // ✅ FIX: Blog link gated by enableBlogSection
        showBlog: config.features.enableBlogSection !== false,
        // ✅ WhatsApp in footer gated by enableLiveChat + number present
        showWhatsApp: config.features.enableLiveChat === true && !!config.whatsApp?.number,
        whatsAppNumber: config.whatsApp?.number ?? "",
        whatsAppMessage: config.whatsApp?.supportMessage ?? "Hello, I need help with HomveraX",
      });
    }).catch(() => { /* keep defaults */ });
  }, []);

  const socialIcons: { key: keyof SocialLinks; Icon: React.ElementType; label: string }[] = [
    { key: "facebookUrl",  Icon: Facebook,  label: "Facebook" },
    { key: "twitterUrl",   Icon: Twitter,   label: "Twitter / X" },
    { key: "instagramUrl", Icon: Instagram, label: "Instagram" },
    { key: "linkedInUrl",  Icon: Linkedin,  label: "LinkedIn" },
    { key: "youtubeUrl",   Icon: Youtube,   label: "YouTube" },
  ];

  const activeSocials = socialIcons.filter(({ key }) => !!(cfg.social[key] as string));

  const whatsappUrl = cfg.showWhatsApp
    ? `https://wa.me/${cfg.whatsAppNumber}?text=${encodeURIComponent(cfg.whatsAppMessage)}`
    : "";

  return (
    <footer className="bg-foreground text-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <Building2 className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="text-xl font-serif font-semibold text-background">
                Homvera<span className="text-accent font-bold">X</span>
              </span>
            </div>
            <p className="text-sm text-background/70 leading-relaxed mb-6">
              Nigeria's most trusted real estate and services marketplace. Find your perfect home,
              hire verified professionals, and transact securely with escrow.
            </p>

            {activeSocials.length > 0 && (
              <div className="flex gap-3">
                {activeSocials.map(({ key, Icon, label }) => (
                  <a key={key} href={cfg.social[key] as string} target="_blank" rel="noopener noreferrer"
                    aria-label={label}
                    className="w-9 h-9 rounded-full bg-background/10 hover:bg-accent hover:text-accent-foreground flex items-center justify-center transition-colors">
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Marketplace */}
          <div>
            <h4 className="font-semibold text-background mb-4 text-sm uppercase tracking-wider">Marketplace</h4>
            <ul className="space-y-3">
              {[
                { label: "Browse Listings",       href: "/listings" },
                { label: "Housing",               href: "/listings?category=housing" },
                { label: "Land",                  href: "/listings?category=land" },
                { label: "Short Stays",           href: "/listings?category=shortlets" },
                { label: "Furniture & Home",      href: "/listings?category=furniture_home" },
                { label: "Building Materials",    href: "/listings?category=building_materials" },
                { label: "Artisans & Repairs",    href: "/listings?category=artisans_repair" },
                { label: "Solar & Power",         href: "/listings?category=solar_power" },
                { label: "Home Services",         href: "/listings?category=home_service" },
                { label: "Food & Grocery",        href: "/listings?category=food_grocery" },
                { label: "Post a Listing",        href: "/dashboard/listings/new" },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-background/70 hover:text-accent transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="font-semibold text-background mb-4 text-sm uppercase tracking-wider">Account</h4>
            <ul className="space-y-3">
              {[
                { label: "Dashboard",        href: "/dashboard" },
                { label: "My Listings",      href: "/dashboard/listings" },
                { label: "Saved Properties", href: "/dashboard/saved" },
                { label: "Escrow",           href: "/dashboard/escrow" },
                { label: "Subscription",     href: "/dashboard/subscription" },
                { label: "Verification",     href: "/dashboard/verification" },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-background/70 hover:text-accent transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company + Contact */}
          <div>
            <h4 className="font-semibold text-background mb-4 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-3 mb-6">
              {[
                { label: "About Us",         href: "/about" },
                // ✅ FIX: Blog link only shown when enableBlogSection is on
                ...(cfg.showBlog ? [{ label: "Blog", href: "/blog" }] : []),
                { label: "Contact",          href: "/contact" },
                { label: "Terms of Service", href: "/terms" },
                { label: "Privacy Policy",   href: "/privacy" },
                { label: "Escrow Agreement", href: "/escrow-agreement" },
                { label: "Cookie Policy",    href: "/cookies" },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-background/70 hover:text-accent transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="space-y-2 text-sm text-background/60">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>Lagos & Abuja, Nigeria</span>
              </div>
              {cfg.social.contactEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 shrink-0" />
                  <a href={`mailto:${cfg.social.contactEmail}`} className="hover:text-accent transition-colors">
                    {cfg.social.contactEmail}
                  </a>
                </div>
              )}
              {/* ✅ WhatsApp contact in footer — only when enableLiveChat is on */}
              {cfg.showWhatsApp && (
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 shrink-0 text-[#25D366]" />
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                    className="hover:text-[#25D366] transition-colors">
                    Chat on WhatsApp
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-background/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-background/50">© {year} HomveraX. All rights reserved.</p>
          <p className="text-sm text-background/50">Escrow protected · BVN verified agents · Trusted marketplace</p>
        </div>
      </div>
    </footer>
  );
}
