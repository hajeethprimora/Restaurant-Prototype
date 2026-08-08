# Phase 1 Prototype — Analysis & Optimization Plan

**Scope:** Phase 1 only (Core Ordering & Kitchen Flow). Phase 2/3 items ignored per request.
**Compared against:** PRD v1.0, HLD v1.0, TRD v1.0, LLD v1.0 (2026-08-02/03)
**Prototype reviewed:** current `develop` branch — `index.html`, `login.html`, `kitchen.html`, `server.html`, `Admin_page/index.html`, `scripts/{app.js,store.js,data.js,kitchen.js,server.js}`, `Admin_page/scripts/admin.js`

---

## 1. What's actually been built

This is **not** a slice of the target architecture (Next.js + Spring Boot + Postgres + SSE) — it's a **fully client-side static prototype**:

- No backend, no database, no network calls of any kind.
- `scripts/store.js` is a single `FlameDineStore` singleton that persists all state to **`localStorage`** and fans out change events via **`BroadcastChannel`** + the `storage` event, so multiple browser tabs (Customer / Kitchen / Server / Admin) stay in sync on one machine.
- Four static HTML entry points: `index.html` (customer), `login.html` (role picker), `kitchen.html`, `server.html`, `Admin_page/index.html`.

**This is a reasonable and pragmatic way to prototype the Phase 1 flow** — it correctly proves out the core idea (shared state → live-updating role-specific boards) without needing the real backend yet. The `Store` class's write APIs (`placeOrder`, `updateOrderItemStatus`, `settleSession`, `correctPaymentMethod`, etc.) map closely to the LLD's service layer method names and even reproduce the state-machine transition table, the tax-breakdown-per-component billing math, the discount-before-tax order, and the void/replace payment-correction pattern. That part is genuinely well done and matches the spec's intent.

The problem is that **the Kitchen/Server/Admin dashboards are wired correctly to this shared store, but the Customer app is not** — it runs on a separate, disconnected data path. That one gap undermines the entire demo, because the customer-facing flow is the entry point of the whole system.

---

## 2. Critical bugs (breaks the core demo)

### 2.1 Customer app uses a different, disconnected menu (`scripts/app.js` + `scripts/data.js`)
`app.js` renders from the global `menuItems`/`categories` arrays defined in `data.js` — a leftover duplicate seed, not `FlameDineStore.getMenuItems()`. Consequence:
- Admin's menu CRUD, availability toggle, price edits, and station reassignment (`ADM-01`–`ADM-03`) **never appear on the customer menu**. You can mark an item sold out in Admin and it still shows as orderable to the guest.
- `data.js` items don't even carry a `station` field, so if this path were ever reconnected, kitchen routing would silently break for anything ordered through it (`ROUTE-01`).

**Fix:** delete `data.js`, have `app.js` read `window.FlameDineStore.getMenuItems()` / `getCategories()` and subscribe to `MENU_UPDATED` events to re-render.

### 2.2 Customer app fakes its own order-status progression (`scripts/app.js:599-627`)
`renderTracker()` starts a `setInterval` that advances **every item's status by one step every 3 seconds**, mutating `currentOrder.items` directly in memory — completely independent of what Kitchen/Server actually do in the store. At the same time, `app.js` *also* subscribes to real `FlameDineStore` events and overwrites `currentOrder` from live data on every store change (`app.js:779-793`).

Consequence: whichever fires last wins. In practice the fake timer usually races ahead of real kitchen actions, so a demo where you deliberately leave an item unclaimed in Kitchen will still show it marching to "Served" on the customer's phone by itself. This is the single most damaging bug for a live Phase-1 demo (`CUST-07`, `RT-01` are effectively fake).

**Fix:** delete the simulated interval entirely. The tracker should be a pure render of store state, re-rendered only on `FlameDineStore.subscribe()` events (already present) plus a cheap safety-net `setInterval` that just re-reads the store (no mutation) — mirroring the real design's "poll + SSE-refetch" pattern (LLD §3.4/3.5, RT-03).

### 2.3 Everything is hardcoded to Table 5 (`scripts/app.js`, multiple lines: 401, 709, 730, 758, 780, 798)
There is no QR-token parsing anywhere in `index.html`/`app.js` (`CUST-01`). The customer app always calls `getOpenSessionForTable(5)` / `placeOrder({ tableNumber: 5, ... })` no matter how it was opened. `store.js` already generates a distinct `token` per table (`tbl_token_0N_xxxx`), so the data model supports multi-table — the customer page just never reads it.

**Fix:** read `?t=<qrToken>` (or a path segment) from the URL, resolve it against `FlameDineStore.getTables()` to get the table number, and thread that through every store call instead of the literal `5`. Falls back to a "table not found" state for an invalid/missing token.

### 2.4 No item customization/options (`CUST-05`)
Menu items in `store.js` have no `options`/modifiers array at all — only free-text `note`. Spec calls for **structured** options (e.g. spice level, add-ons) in addition to notes. Not a bug exactly, but a real gap vs. the Phase 1 requirement.

### 2.5 Zero auth/route gating (`CHF's role model, SRV/ADM access`)
`login.html`'s `quickLogin()` just writes a `flame_dine_user` object to `localStorage` and redirects — but `kitchen.html`, `server.html`, and `Admin_page/index.html` never read it. Anyone can open any dashboard directly by URL with no session check and no role enforcement. For a prototype this is low-priority, but since three distinct logins are a named Phase 1 deliverable, it's worth at least a client-side guard (redirect to `login.html` if `flame_dine_user` is missing or role mismatched) so the three-roles story is demonstrable, not just cosmetic.

### 2.6 Dead UI: "Add Table" (`Admin_page/scripts/admin.js:509`, `Admin_page/index.html:275`)
The button opens the `addTable` modal template (`admin.js:179`) but there is no `executeAddTable` handler and no `Store.addTable()` method — submitting does nothing. Same pattern likely worth auditing across all modals (see §4).

### 2.7 Hard-delete instead of soft-delete for menu items (`store.js:592-597`)
`deleteMenuItem` splices the item out of the array entirely. If that item has ever been ordered, any historical `OrderItem` referencing it (by `menuItemId`) will fail to resolve its name/price on re-render (Admin's transaction history, table detail drawers). Spec explicitly calls for **soft delete** (`is_available = false`) to preserve order history (TRD §5.4.2 note). Low risk today since nothing currently looks up historical order items by `menuItemId`, but it's a latent data-integrity bug.

### 2.8 No table enable/disable, no "N tables active" limits (`ADM-04`)
`store.js` tables only support `regenerateTableQR`. There's no create/edit/delete/enable/disable — despite the Admin Tables page implying "Add Table" exists (see 2.6).

---

## 3. Phase 1 requirement-by-requirement status

| ID | Requirement | Status | Notes |
|---|---|---|---|
| CUST-01 | QR scan opens/joins session | ❌ | Hardcoded to Table 5; no token parsing |
| CUST-02 | Menu browsing by category | ⚠️ | Works, but off the disconnected `data.js` menu |
| CUST-03 | Menu search | ✅ | Works (client-side filter) |
| CUST-04 | Item detail view | ✅ | Item sheet works |
| CUST-05 | Quantity/options/notes | ⚠️ | Qty + note ✅, structured options ❌ |
| CUST-06 | Cart & multi-round order | ✅ (backend logic) | `store.placeOrder` correctly reuses session/order and bumps `round_no`; **not reachable** from customer UI since it's on the wrong data path |
| CUST-07 | Live status tracking | ❌ | Faked by local timer, not real kitchen/server state |
| CUST-08 | Cancel before preparing | ❌ | No cancel action anywhere in customer UI (store supports `cancelled` transition, UI doesn't expose it) |
| CHF-01 | Shared station filter | ✅ | `kitchen.js` correctly filters via `getKitchenQueue` |
| CHF-02 | Live updates | ✅ | `subscribe()` re-renders on store events |
| CHF-03 | Claim (single-claimant) | ✅ | `claimOrderItem` guards `status === 'placed'` |
| CHF-04 | Prepare → Ready | ✅ | State machine enforced in `updateOrderItemStatus` |
| CHF-05 | Consistent action model | ✅ | Same `updateOrderItemStatus` used by Kitchen, Server, Admin override |
| SRV-01/02/03/04 | Server dashboard | ✅ | Tables floor, ready feed, table drawer, pick-up/serve all wired |
| ADM-01 | Menu CRUD | ⚠️ | Works in Admin; **not reflected to customer** (§2.1); hard-delete not soft-delete |
| ADM-02 | Station reassignment | ✅ | `reassignItemStation`, forward-only (only affects `MenuItem`, not placed `OrderItem.station`) ✅ correct per `ROUTE-02` |
| ADM-03 | Station management | ✅ | Add/delete stations wired |
| ADM-04 | Table & QR management | ⚠️ | Regenerate QR ✅; create/enable/disable ❌ (dead button) |
| ADM-05 | Staff role assignment | ✅ | `assignStaffRole` wired |
| BIL-01 | Open sessions overview | ✅ | `renderBillingFloor` |
| BIL-02 | Bill generation (itemized, multi-round) | ✅ | Correct subtotal/discount/tax math |
| BIL-03 | Settle & close, incl. UNPAID override | ✅ | Matches spec's forced-cancel-remaining-items behavior |
| BIL-04 | Availability toggle | ⚠️ | Works in Admin; not visible to customer (same root cause as ADM-01) |
| ROUTE-01/02/03/04 | Routing & lifecycle | ✅ (via store) | State machine matches LLD exactly |
| RT-01/02/03 | Real-time expectations | ⚠️ | Kitchen/Server: genuinely real-time via BroadcastChannel (fine for a prototype). Customer: fake (§2.2) |
| Three logins | Admin/Server/Kitchen | ⚠️ | Pages exist; no actual auth/route guard (§2.5) |

**Bottom line:** the staff-side triangle (Kitchen ↔ Server ↔ Admin, via the shared store) is the strongest part of the prototype and closely tracks the LLD's data model and state machine. The customer-facing app is the weakest link and currently undercuts the whole "scan → order → track → kitchen → serve" story you'd want to demo end-to-end.

---

## 4. Reframing: this is a blueprint, not a product

Given this prototype's purpose — a visual/functional reference to be onboarded into `softnix_fe_next` (real Next.js + Spring Boot build) later, not a system to keep extending — the bar is: **each screen demonstrates its own feature set on its own.** It does not need deep, airtight cross-screen integration to prove the idea. Concretely:

- The Customer app already shows a full order→cart→place→track flow, end to end, on its own. That it doesn't pull live from Admin's menu edits, or that the tracker's progress is simulated rather than driven by a real kitchen action in that same moment, doesn't matter for a blueprint walkthrough — the *screen* still shows every state (placed/preparing/ready/served) and every interaction a reviewer needs to see.
- The Kitchen, Server, and Admin dashboards already demonstrate their own claim/prepare/ready, pickup/serve, and menu/station/billing flows convincingly within their own screens (they happen to also be cross-wired via the shared store, which is a bonus, not a requirement).
- Not-yet-present elements (structured item options, table enable/disable, real auth) just need to be **visibly present as UI** where the real spec calls for them — a static/inert control that shows "this exists in the design" is sufficient; it doesn't need a working handler behind it.

So there's **no required logic-fix bucket** — the earlier "must-fix logic" items (menu sync, real QR resolution, killing the simulated tracker) are downgraded to optional. Skip them unless you want them. One exception worth a cheap look: a button that visibly does nothing when clicked (e.g. "Add Table" → modal → submit → silence) reads worse in a walkthrough than either making it work minimally or removing it — see the dead-button note in §2.6. Fixing that one is a few lines; not required, just cheap enough to be worth it.

### Must-fix (UI — "must be perfect")

This is the part worth investing real time in, since it's explicitly the bar you set. Recommended pass, screen by screen:

1. **Customer (`index.html`)** — this is the screen a stakeholder will scrutinize hardest since it's guest-facing. Check: consistent spacing/type scale across landing → menu → item sheet → cart → tracker → success; smooth transitions between pages (currently instant `display` toggles — consider a fade/slide); loading and empty states (empty cart, no search results) look intentional, not like a fallback; image fallback chain (local → Unsplash → emoji) never flashes broken-image icons.
2. **Kitchen (`kitchen.html`)** — card layout, status colors, and claim/prepare/ready button states should read at a glance from a few feet away (this is meant to run on a tablet in a kitchen). Check contrast, touch-target size, and that the station tabs have a clear active state.
3. **Server (`server.html`)** — table floor grid + ready feed + drawer should feel like one coherent app, not three bolted-together views. Check the drawer's open/close animation and that ready items visually stand out (this is the "notice it instantly" screen).
4. **Admin (`Admin_page/index.html`)** — the biggest surface area (menu, stations, tables, staff, billing). Check for visual consistency between its "page" sections — this file grew the most (36K) and is the most likely to have inconsistent card/table/modal styling between sections added at different times.
5. **Cross-screen** — one shared design language (color tokens, border-radius, shadow depth, font weights) across all four HTML files. Right now each was clearly built somewhat independently (`Admin_page/style/` is separate from `style/main.css`) — worth a pass to make sure they don't visibly diverge.

### Suggested order of work

1. UI polish pass, screen by screen as listed above — this is the only required work.
2. (Optional, cheap) Fix or remove the one dead button noted in §2.6, since a visibly broken control looks worse in a walkthrough than no control at all.
3. One pass clicking through all four screens solo (not wired together) to confirm each one, by itself, visibly shows every Phase 1 state/interaction it's supposed to represent — a presentation rehearsal, not a QA suite.

---

## 5. Beyond the prototype

The LLD's real Spring Boot `restaurant-module` + Next.js frontend + Postgres + Redis + SSE build is separate, later work — this blueprint's job is to make that build easy to scope and get sign-off on, not to become it. No action needed here now; flagging only so scope stays clear.
