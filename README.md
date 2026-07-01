# Homverax — Complete Audit Fixes
## All 30 files · Drop-in replacements

Copy each file into your project at the matching path shown below.
No other files need to change.

---

## PLACEMENT GUIDE

### src/services/  (7 files)
| File | What changed |
|---|---|
| platformSettings.ts | + homepageStats, testimonials, uploadLimits, whatsApp.contacts[], subscriptionPlans & boostOptions all admin-editable |
| escrow.ts | initiateEscrow reads live platformFeePercent — no hardcoded 1.5% |
| wallet.ts | requestPayout enforces minimumPayoutAmount from settings |
| auth.ts | + getUserById, updateUserBankDetails, updateUserNotifPrefs, updateUserPrivacyPrefs, updateUserSubscription, getAllUsers |
| listings.ts | + getAllListingsAdmin, getReportedListings |
| platformStats.ts | NEW — homepage live stat queries (no db in HomeClient) |
| subscriptions.ts | NEW — subscriptionPayments collection abstracted |

### src/hooks/  (1 file)
| File | What changed |
|---|---|
| usePageContent.ts | Uses pageContent service — no direct Firestore |

### src/app/  (2 files)
| File | What changed |
|---|---|
| HomeClient.tsx | Stats + testimonials loaded from admin settings (admin override or live count) |
| layout.tsx | + MaintenanceGate wrapping children + WhatsAppChat widget |

### src/app/admin/  (5 files)
| File | What changed |
|---|---|
| settings/AdminSettingsClient.tsx | + Homepage Stats editor, Testimonials editor, Upload Limits, WhatsApp Contacts, Subscription pricing, Boost pricing |
| revenue/AdminRevenueClient.tsx | Reads live platformFeePercent — no hardcoded 0.015 |
| users/page.tsx | getAllUsers + updateUserRole from services/auth |
| listings/page.tsx | getAllListingsAdmin + updateListing + deleteListing from services/listings |
| reports/page.tsx | getReportedListings + updateListing from services/listings |
| subscriptions/AdminSubscriptionsClient.tsx | Uses services/subscriptions + services/auth |

### src/app/agents/[id]/  (1 file)
| File | What changed |
|---|---|
| AgentProfileClient.tsx | getUserById from services/auth — no direct Firestore |

### src/app/api/payments/subscription/  (1 file)
| File | What changed |
|---|---|
| route.ts | updateUserSubscription from services/auth |

### src/app/dashboard/  (5 files)
| File | What changed |
|---|---|
| bookings/page.tsx | getMyBookings + updateBookingStatus from services/bookings |
| settings/page.tsx | updateUserBankDetails, updateUserNotifPrefs, updateUserPrivacyPrefs from services/auth |
| referral/page.tsx | Server-side gate — redirects to /dashboard if enableReferralProgram is off |
| inspection/page.tsx | Server-side gate — redirects to /dashboard if enableInspectionBooking is off |
| inspection/InspectionsPageClient.tsx | Renamed client component (referenced by new page.tsx) |

### src/app/blog/  (1 file)
| File | What changed |
|---|---|
| page.tsx | Server-side gate — redirects to / if enableBlogSection is off |

### src/components/features/  (1 file)
| File | What changed |
|---|---|
| WhatsAppChat.tsx | Reads enableLiveChat flag + whatsApp.contacts[] for multi-contact picker |

### src/components/layout/  (2 files)
| File | What changed |
|---|---|
| Navbar.tsx | Blog link gated by enableBlogSection |
| Footer.tsx | Blog link + WhatsApp link gated by feature flags |

### src/components/shared/  (1 file — NEW folder)
| File | What changed |
|---|---|
| MaintenanceGate.tsx | NEW — wraps app, shows maintenance page when maintenanceMode = true |

### functions/  (2 files)
| File | What changed |
|---|---|
| autoReleaseEscrow.ts | Reads platformFeePercent from Firestore at runtime |
| autoResolveDisputes.ts | Reads platformFeePercent + disputeAutoResolveHours at runtime |

---

## FEATURE FLAGS WIRED

| Flag | Enforced where |
|---|---|
| maintenanceMode | MaintenanceGate (layout.tsx) — all non-admins see maintenance page |
| enableBlogSection | Navbar, Footer, blog/page.tsx |
| enableReferralProgram | dashboard/referral/page.tsx |
| enableInspectionBooking | dashboard/inspection/page.tsx |
| enableLiveChat | WhatsAppChat, Footer |
| WhatsApp multi-contact | Widget shows picker when admin adds extra contacts in settings |

---

## ADMIN SETTINGS NEW SECTIONS

Go to /admin/settings to configure:
- Homepage Stats — per card: toggle live count vs fixed override value (e.g. "7+")
- Testimonials — add / edit / hide / delete homepage testimonials
- Upload Limits — max images per listing + max MB per image
- WhatsApp Contacts — add Sales, Support, Complaints etc. for widget picker
- Subscription Pricing — edit plan names, prices, max listings
- Boost Pricing — edit featured/top/urgent prices and descriptions
