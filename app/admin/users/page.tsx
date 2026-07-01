"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2, ChevronDown, Loader2, Search,
  Shield, ShieldAlert, ShieldCheck, User, X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// ✅ FIX: Use service layer — removed direct Firestore (db, collection, getDocs, etc.)
import { getAllUsers, updateUserRole } from "@/services/auth";
import { ROLE_CONFIG } from "@/lib/roles";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { HomveraxUser, UserRole } from "@/types";

const ASSIGNABLE_ROLES: UserRole[] = [
  "tenant", "agent", "landlord", "service_provider", "moderator", "admin",
];

const ROLE_ICONS: Record<string, React.ElementType> = {
  admin: ShieldCheck,
  moderator: ShieldAlert,
};

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<HomveraxUser[]>([]);
  const [filtered, setFiltered] = useState<HomveraxUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [changingRole, setChangingRole] = useState<string | null>(null);

  useEffect(() => {
    // ✅ FIX: getAllUsers() from service layer instead of inline getDocs
    getAllUsers(200)
      .then((list) => { setUsers(list); setFiltered(list); })
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFiltered(users);
      return;
    }
    const q = searchQuery.toLowerCase();
    setFiltered(
      users.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.role?.toLowerCase().includes(q)
      )
    );
  }, [searchQuery, users]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (userId === currentUser?.id && newRole !== "admin") {
      toast.error("You cannot remove your own admin role");
      return;
    }
    setChangingRole(userId);
    try {
      // ✅ FIX: updateUserRole() from service layer
      await updateUserRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast.success(`Role updated to ${ROLE_CONFIG[newRole].label}`);
    } catch {
      toast.error("Failed to update role");
    } finally {
      setChangingRole(null);
    }
  };

  const roleCounts = ASSIGNABLE_ROLES.reduce((acc, role) => {
    acc[role] = users.filter((u) => u.role === role).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {users.length} total users · Assign roles including Moderator
        </p>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {ASSIGNABLE_ROLES.map((role) => {
          const cfg = ROLE_CONFIG[role];
          return (
            <div key={role} className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-lg font-serif font-bold text-foreground">{roleCounts[role] ?? 0}</p>
              <p className={cn("text-xs font-semibold mt-0.5", cfg.color)}>{cfg.shortLabel}</p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5 mb-5">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Search by name, email or role…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-muted-foreground text-sm">No users found</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((u) => {
              const cfg = ROLE_CONFIG[u.role] ?? ROLE_CONFIG.tenant;
              const RoleIcon = ROLE_ICONS[u.role] ?? null;
              const isSelf = u.id === currentUser?.id;

              return (
                <div key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors">
                  {/* Avatar */}
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarImage src={u.avatarUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                      {u.name?.charAt(0) ?? "U"}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                      {u.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                      {isSelf && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>

                  {/* Role badge */}
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    {RoleIcon && <RoleIcon className={cn("w-3.5 h-3.5", cfg.color)} />}
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded", cfg.bgColor, cfg.color)}>
                      {cfg.shortLabel}
                    </span>
                  </div>

                  {/* Role dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8 text-xs shrink-0"
                        disabled={changingRole === u.id}
                      >
                        {changingRole === u.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>Change Role <ChevronDown className="w-3 h-3" /></>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Assign role to {u.name?.split(" ")[0]}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {ASSIGNABLE_ROLES.map((role) => {
                        const rcfg = ROLE_CONFIG[role];
                        const isCurrent = u.role === role;
                        return (
                          <DropdownMenuItem
                            key={role}
                            disabled={isCurrent}
                            onClick={() => handleRoleChange(u.id, role)}
                            className={cn(
                              "gap-2",
                              isCurrent && "opacity-50 cursor-default",
                              role === "admin" && "text-red-600 focus:text-red-600",
                              role === "moderator" && "text-indigo-600 focus:text-indigo-600"
                            )}
                          >
                            <span className={cn("w-2 h-2 rounded-full", rcfg.bgColor.replace("bg-", "bg-").replace("50", "400"))} />
                            {rcfg.label}
                            {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
