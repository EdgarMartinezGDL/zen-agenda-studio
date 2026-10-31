<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- All backend data goes through src/lib/microfix/api.ts (MicroFix Cloud, VITE_API_URL); no mock data or direct fetch in screens — single source of truth.
- Session via AuthProvider/useAuth in src/lib/microfix/auth.tsx, hydrated after mount — avoids SSR localStorage access.
- Device push uses src/lib/microfix/push.ts and a dedicated public/sw.js with no app-shell caching; keep it separate from offline service workers to prevent stale previews.

- Super-admin UI uses AdminShell and the adminApi contract separately from AppShell; backend authorization remains enforced by MicroFix Cloud so organization-free sessions never use business branding or device push.
- Demo management lives in the AdminShell-protected /admin/demos route and uses adminApi exclusively; QR polling stays scoped to its dialog, and conversion credentials remain transient form state to avoid browser persistence.

- Professional plan and documents use organizationApi/knowledgeApi, and paused conversations use pausedApi within AppShell; query keys are organization-scoped so plan gating and refreshes share one source of truth.

- Billing notices use notificationsApi in the professional bell and adminApi inside AdminShell for /admin/avisos; keep their queries separate because the sessions have different scopes.
- Super-admin payments use adminBillingApi inside AdminShell at /admin/pagos with admin-scoped queries; MicroFix Cloud owns Stripe operations and validation so no payment logic or private credentials are duplicated in the frontend.

- Professional scheduling conversions and calendar arithmetic use src/lib/zona-horaria.ts with explicit location/clinic zones, so device timezone never changes captured instants or displayed dates.
