# Creative Society — Gestão

Management system for a wig and beauty business with several shops: POS, per-shop stock, transfers, purchases with landed cost, money in/out, profit reports, roles and permissions, schedules and attendance. The UI is in Portuguese (pt-AO), with prices in Kwanza.

## Running it

```bash
npm install
npm run seed        # creates the owner (from .env), roles, categories and bank account — safe to run again
npm run dev         # http://localhost:3000
```

- **Owner:** "Administrador" tab, with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (email or plain username).
- **Staff:** "Equipa" tab, with username or phone plus a 4–6 digit PIN. The owner creates these in Equipa.

### Demo data (separate database)

```bash
MONGODB_DB=creative_society_demo npm run seed:demo
MONGODB_DB=creative_society_demo npm run dev
```

- The demo adds 2 shops, 15 products, purchases (USD with freight and customs), transfers, about 100 sales over 2 weeks, expenses, 7 staff, shifts and attendance.
- Staff PIN is `1234`. Accounts:

| User | Role |
|---|---|
| ana | Store manager, Talatona |
| joana, luisa | Cashiers, Talatona |
| marta | Store manager, Kilamba |
| esperanca | Cashier, Kilamba |
| rosa | HR, both shops |
| paulo | Warehouse |

- `seed:demo` only runs on an empty database. Never point it at the real one.

### Checks

```bash
npm run typecheck
npm run smoke       # 17 business-rule checks on a throwaway DB (creative_society_test), dropped at the end
npm run build
```

## How it works (for whoever maintains it)

- **Stack:** Next.js 16 App Router, React 19, TypeScript 6, Tailwind 4, Radix, the native MongoDB driver, zod, jose and bcryptjs. No `cacheComponents`: every page is dynamic and depends on the logged-in user.
- **Business rules** live in `lib/domain/*`:
  - Each function receives `(db, actor, input)`, validates with zod and checks permissions (`assertCan`).
  - Server Actions (`app/actions/app.ts`) are thin wrappers.
  - The smoke test calls the domain layer directly.
- **Permissions:**
  - The catalogue is in `lib/permissions.ts`. Effective permissions = role ∪ person's extras − person's removals.
  - Shop scope is per person ("all shops" or a list).
  - Nobody can grant a permission they don't have.
- **Stock:**
  - `applyMovements` (`lib/domain/stock.ts`) is the only way stock changes.
  - It does a conditional `$inc` (it won't sell what isn't there, unless the shop allows it) and writes `movements`.
  - Sales, transfers, receiving a purchase, voids and returns run in Mongo transactions.
- **Cost and profit:**
  - Landed cost = supplier price × exchange rate + share of extra costs (by value or by quantity). See `lib/costing.ts`.
  - Average cost is weighted across all shops.
  - Each sale stores the cost at the moment it was sold.
  - Profit = net sales − cost of goods sold + other income − expenses − stock losses.
  - Buying stock is money going out (cash flow), but it is not a loss in the profit report.
- **Money:**
  - `cashbook` is a single ledger.
  - Each shop has its own "Caixa" account. TPA and transfers go to the shop's bank account.
  - The till close compares expected cash with counted cash and records any difference.
- **POS:**
  - The cart is saved on the device (localStorage).
  - Each checkout has a `clientRequestId` with a unique index, so a double tap or a retry after a network failure never creates two sales.
- **Time:** Africa/Luanda (UTC+1, no daylight saving), in `lib/time.ts`.
- **Live dashboard:** `/api/painel` is polled every 15 s and pauses when the tab is hidden.
- **Photos:** small WebP files (sharp) stored in the `images` collection.

## App (PWA)

- **Installs** on Android, iPhone/iPad and computers.
  - Android and computers: "Instalar a app" button on the login screen, a card on Início, and an option in the account menu.
  - iPhone: the same button opens step-by-step instructions (Partilhar → Adicionar ao ecrã principal).
- **What it includes:**
  - Manifest: `app/manifest.ts`, with icons, maskable icons, shortcuts (Vender, Stock, Horário, Finanças) and screenshots.
  - iOS icon and splash screens.
  - Service worker `public/sw.js`.
  - Offline page `public/offline.html`.
- **Service worker:**
  - It only caches static files (`/_next/static`, icons).
  - Pages and data are never cached, which is safe on shared devices.
  - With no internet, opening a page shows the "Sem ligação" page, which comes back on its own when the connection returns.
  - It only registers in production. To test it in dev, run `localStorage.setItem("cs:sw-dev","1")` in the browser console.
- **No internet:**
  - With `experimental.useOffline` (Next 16) the app shows an orange bar.
  - Actions (sales included) wait and are sent once the connection returns.
  - The checkout window stays open until the sale is confirmed.
  - Sales are never duplicated, thanks to the `clientRequestId`.
- **New versions:**
  - Pages always come from the network, so a deploy shows up straight away.
  - Only when `public/sw.js` changes (bump `VERSION`) does the "Há uma versão nova" notice appear with an "Atualizar" button.
- **Regenerating icons/splash screens:** `npm run pwa:assets`.
- **Screenshots:** they live in `public/screenshots` and use demo data. Replace them with real screens if you like.
- **Requires HTTPS** in production (Vercel already provides it).
- **Push notifications are not enabled.** They would need VAPID keys and choosing which events to notify.

## For the client to confirm / to do

- [ ] **Invoices:** receipts are internal slips ("Não serve de fatura"). Legal invoices in Angola require AGT-certified software. Confirm with the accountant whether the slip is enough or whether it must connect to certified software.
- [ ] **VAT:** off by default. In Definições you can show "IVA incluído" on the receipt. The accountant should confirm the rate and whether it applies.
- [ ] Company details for the receipt (NIF, address, phone) in Definições.
- [ ] Real data: shops, products and prices, opening stock (via Compras or the product's "Stock inicial"), opening balances of accounts.
- [ ] Photos are stored in Mongo. If the catalogue grows a lot, move them to R2 (same approach as Nuvens).
- [ ] Hosting: Vercel + Atlas. Set the same `.env` variables in the hosting environment.

## Later phases (not built)

- Offline POS (sales saved on the device and synced later).
- Barcode scanning with the phone camera. USB barcode scanners already work in the POS search.
- Payroll / salary processing, leave requests, and staff clocking in themselves.
