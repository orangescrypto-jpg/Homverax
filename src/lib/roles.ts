import type { UserRole } from "@/types";

/**
 * Single source of truth for all role definitions.
 * Update here → updates everywhere: select-role, sidebar, profile, labels.
 */
export const ROLE_CONFIG: Record<UserRole, {
  label: string;
  shortLabel: string;
  description: string;
  iconName: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  tenant: {
    label: "Buyer / Tenant",
    shortLabel: "Buyer",
    description: "Looking to rent, buy a property, or hire a service provider.",
    iconName: "User",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  agent: {
    label: "Agent / Broker",
    shortLabel: "Agent",
    description: "Professional real estate agent listing and managing properties for clients.",
    iconName: "Building2",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  landlord: {
    label: "Landlord / Property Owner",
    shortLabel: "Landlord",
    description: "Own properties to rent out or sell directly.",
    iconName: "Home",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  seller: {
    label: "Seller",
    shortLabel: "Seller",
    description: "Sell products like furniture, building materials, solar equipment, groceries, and household items.",
    iconName: "Store",
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
  },
  service_provider: {
    label: "Artisan / Service Provider",
    shortLabel: "Artisan",
    description: "Offer hands-on services — repairs, installation, cleaning, home services, and more.",
    iconName: "Wrench",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  moderator: {
    label: "Moderator",
    shortLabel: "Mod",
    description: "Review listings, handle disputes, and moderate platform content.",
    iconName: "ShieldAlert",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
  },
  admin: {
    label: "Admin",
    shortLabel: "Admin",
    description: "Full platform administrator with access to all tools.",
    iconName: "ShieldCheck",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
};

/** Roles users can self-select (admin & moderator assigned by admin only). Landlord kept for existing users but no longer offered at signup. */
export const SELECTABLE_ROLES: UserRole[] = [
  "tenant",
  "agent",
  "seller",
  "service_provider",
];

/** Roles that can create listings */
export const LISTER_ROLES: UserRole[] = [
  "agent",
  "landlord",
  "seller",
  "service_provider",
];

/** Roles with admin-panel access */
export const ADMIN_ROLES: UserRole[] = ["admin", "moderator"];

/** Moderator can do everything EXCEPT: delete users, change roles, financial overrides */
export const MODERATOR_PERMISSIONS = [
  "review_listings",
  "remove_listings",
  "review_verifications",
  "handle_disputes",
  "view_escrows",
  "send_warnings",
  "ban_users",
] as const;

export type ModeratorPermission = typeof MODERATOR_PERMISSIONS[number];

export function getRoleLabel(role: UserRole): string {
  return ROLE_CONFIG[role]?.label ?? role;
}

export function getRoleShortLabel(role: UserRole): string {
  return ROLE_CONFIG[role]?.shortLabel ?? role;
}

export function isLister(role: UserRole): boolean {
  return LISTER_ROLES.includes(role);
}

export function isAdminOrModerator(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

export function isModerator(role: UserRole): boolean {
  return role === "moderator";
}
