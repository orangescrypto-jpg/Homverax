"use client";

/**
 * components/features/WhatsAppChat.tsx
 *
 * WhatsApp floating widget — fully admin-controlled:
 *   • Admin can toggle ON/OFF via features.enableLiveChat
 *   • Admin can set the primary number + support message in General Settings
 *   • Admin can add extra contacts (e.g. Sales, Support, Complaints)
 *     via whatsApp.contacts[] — each has a name, number, and optional label
 *   • Widget shows a single button if only one contact; a contact picker if multiple
 */

import { useEffect, useState } from "react";
import { MessageCircle, X, ChevronDown, Phone } from "lucide-react";
import { getPlatformConfig } from "@/services/platformSettings";
import { cn } from "@/lib/utils";

interface WhatsAppContact {
  name: string;
  number: string;   // e.g. 2348012345678 (no +)
  label?: string;   // e.g. "Sales", "Support"
  message?: string; // optional custom pre-fill
}

interface WhatsAppState {
  enabled: boolean;
  number: string;
  supportMessage: string;
  contacts: WhatsAppContact[];
}

interface WhatsAppChatProps {
  defaultMessage?: string;
}

export default function WhatsAppChat({ defaultMessage }: WhatsAppChatProps) {
  const [wa, setWa] = useState<WhatsAppState | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    getPlatformConfig().then((cfg) => {
      // ✅ Gated by features.enableLiveChat AND whatsApp.enabled
      if (!cfg.features.enableLiveChat) return;
      if (!cfg.whatsApp?.enabled || !cfg.whatsApp?.number) return;

      setWa({
        enabled: true,
        number: cfg.whatsApp.number,
        supportMessage: defaultMessage ?? cfg.whatsApp.supportMessage,
        // Extra contacts from admin settings — falls back to empty array
        contacts: cfg.whatsApp.contacts ?? [],
      });
    });

    const timer = setTimeout(() => setShowTooltip(true), 5000);
    return () => clearTimeout(timer);
  }, [defaultMessage]);

  if (!wa) return null;

  // Build the full contact list — primary + extras
  const allContacts: WhatsAppContact[] = [
    { name: "Support", number: wa.number, label: "General Support", message: wa.supportMessage },
    ...wa.contacts,
  ];

  const hasMultiple = allContacts.length > 1;

  const openChat = (contact: WhatsAppContact) => {
    const msg = contact.message ?? wa.supportMessage;
    const url = `https://wa.me/${contact.number}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setShowPicker(false);
    setShowTooltip(false);
  };

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2">

      {/* Tooltip bubble */}
      {showTooltip && !dismissed && !showPicker && (
        <div className="relative bg-card border border-border rounded-2xl shadow-lg p-3.5 max-w-[210px] animate-in slide-in-from-right-4">
          <button
            onClick={() => setDismissed(true)}
            className="absolute -top-2 -right-2 w-5 h-5 bg-muted rounded-full flex items-center justify-center shadow"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
          <p className="text-xs font-semibold text-foreground">Need help?</p>
          <p className="text-xs text-muted-foreground mt-0.5">Chat with us on WhatsApp</p>
        </div>
      )}

      {/* Contact picker — shown when admin has configured multiple contacts */}
      {showPicker && hasMultiple && (
        <div className="bg-card border border-border rounded-2xl shadow-xl p-3 w-56 animate-in slide-in-from-bottom-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">
            Choose a contact
          </p>
          <div className="space-y-1">
            {allContacts.map((contact, i) => (
              <button
                key={i}
                onClick={() => openChat(contact)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#25D366]/10 transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-[#25D366]/15 flex items-center justify-center shrink-0 group-hover:bg-[#25D366]/25 transition-colors">
                  <Phone className="w-3.5 h-3.5 text-[#25D366]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
                  {contact.label && (
                    <p className="text-[11px] text-muted-foreground truncate">{contact.label}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main WhatsApp button */}
      <button
        onClick={() => {
          setShowTooltip(false);
          if (hasMultiple) {
            setShowPicker((p) => !p);
          } else {
            openChat(allContacts[0]);
          }
        }}
        className={cn(
          "w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95",
          "bg-[#25D366] text-white relative"
        )}
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle className="w-7 h-7 fill-white" />
        {/* Multi-contact indicator */}
        {hasMultiple && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow border border-[#25D366]/20">
            <ChevronDown className={cn("w-3 h-3 text-[#25D366] transition-transform", showPicker && "rotate-180")} />
          </span>
        )}
      </button>
    </div>
  );
}
