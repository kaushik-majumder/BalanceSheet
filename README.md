# BalanceSheet

A receipt scanner that turns a photo of a receipt into structured, categorized
spending data you can search, chart, and share with your family. Built as a
React Native (Expo) app for Android and iOS, with Firebase for auth + cloud
sync and a Cloudflare Workers AI fallback so receipt parsing keeps working
even when the primary AI provider's free tier is exhausted.

## What it does

- **Scan a receipt with your phone camera** → on-device ML Kit OCR pulls
  the raw text → Gemini 2.5 Flash (or a Cloudflare Workers AI fallback)
  parses it into a structured receipt with store name, date, line items,
  per-item categories, subtotal, tax, and total.
- **Dashboards & reports**: month-over-month spending, category
  breakdowns, recurring-purchase detection, top-stores list, PDF
  export with a branded layout.
- **Multi-user, multi-device**: every user has their own private data
  by default. Invite a family member by email — Firebase sends them a
  magic-link they can tap to install the app and accept. Once they
  accept, all receipts sync across both devices in real time.
- **Offline-first**: receipts live in a local SQLite database first;
  cloud sync is a shadow-write on top, so the app feels instant and
  works without a network.

## Quick start (development)

```bash
git clone https://github.com/kaushik-majumder/BalanceSheet.git
cd BalanceSheet
npm install --legacy-peer-deps
npx expo prebuild --platform android   # or ios
npx expo start
```

You'll also need:

- `google-services.json` for Android Firebase (download from
  the Firebase console, place at repo root).
- `GoogleService-Info.plist` for iOS Firebase (same).
- `GEMINI_API_KEY` env var, OR a deployed Cloudflare Workers AI
  parser (see [`scripts/PARSE_WORKER_README.md`](scripts/PARSE_WORKER_README.md)).

## Architecture in 30 seconds

```
                     ┌────────────────────────────────────┐
                     │  React Native (Expo) app           │
                     │                                    │
                     │  ┌─────────────────────────────┐   │
                     │  │ ML Kit on-device OCR        │   │
                     │  │     ↓                       │   │
                     │  │ regex parser (lib/parser)   │   │
                     │  │     ↓ refined by            │   │
                     │  │ AI parse (Gemini → Worker)  │   │
                     │  └─────────────────────────────┘   │
                     │              ↓                     │
                     │  ┌─────────────────────────────┐   │
                     │  │ local SQLite (source of     │   │
                     │  │  truth for reads, offline)  │   │
                     │  └─────────────────────────────┘   │
                     │              ↕ shadow-write +      │
                     │                onSnapshot listener │
                     │  ┌─────────────────────────────┐   │
                     │  │ Firestore (cloud durability,│   │
                     │  │  multi-device sync, family) │   │
                     │  └─────────────────────────────┘   │
                     └────────────────────────────────────┘
```

**Why local-first**: the dashboard renders thousands of receipts
fast because every read is a SQLite query, not a network round-trip.
The cloud is durability + the data plane for family sharing — never
on the hot path of a render.

**Why a regex parser AND an AI parser**: the regex output is what
the user sees instantly while the AI request is in flight (1–4
seconds). When the AI returns, it replaces the regex result in-
place. If the AI fails (rate limit, network, parse error), the
regex result is what's already on screen — graceful degradation.

## Receipt parsing in detail

The interesting bit. Receipts are filthy data — multi-column OCR,
implicit discounts, "3 For $4" deal qualifiers that look like prices,
embedded tax flags. The pipeline:

1. **OCR** (`react-native-text-recognition`) — on-device, no network.
2. **Regex parser** ([`lib/parser.ts`](lib/parser.ts)) — handles
   inline `Name $1.23` formats AND two-column "all names then all
   prices" layouts via `extractPairedItems`. Detects subtotal /
   tax / total via keyword + amount heuristics. Folds discount
   lines (`-$2.98`, `TPD/SKU`, parenthesized accounting style) into
   the parent item.
3. **AI parser** ([`lib/geminiParseReceipt.ts`](lib/geminiParseReceipt.ts)):
   structured JSON output via Gemini 2.5 Flash with
   `thinkingConfig: { thinkingBudget: 0 }` (the model's chain-of-
   thought tokens would otherwise burn through the output budget
   before any JSON is emitted on long receipts). Prompted with
   examples spanning Skechers BOGO, Costco TPD markdown, and
   grocery-style receipts with embedded discounts + multi-buy
   qualifiers.
4. **Worker fallback** ([`scripts/parse-receipt-worker.ts`](scripts/parse-receipt-worker.ts)):
   when Gemini is rate-limited or absent, the same prompt runs
   on a Cloudflare Workers AI deployment (Llama 3.3 70B). Free
   tier of Workers AI covers ~250 receipts/day.
5. **Sanity check** ([`lib/itemsTotalCheck.ts`](lib/itemsTotalCheck.ts)):
   before save, compares line items sum vs printed subtotal. A
   mismatch beyond $0.50 surfaces an alert with a hint ("Item X
   matches the difference — may be double-counted").

## Multi-user & family sharing

Built in three phases, all live:

- **Phase 1 — per-user data isolation**: every SQLite row carries a
  `user_id`. Sign out + sign in by a different user on the same
  device → that user sees an empty receipt list, not yours.
- **Phase 2 — cloud shadow-write**: receipts mirror to Firestore at
  `households/{hid}/receipts/{rid}`. Local SQLite stays primary;
  the cloud copy is durable backup + the substrate for sharing.
- **Phase 3 — household sharing**: invite a family member by email →
  Firebase sends them a magic-link → they install the app +
  sign in → they accept the invite → they join your `memberUids`
  → an `onSnapshot` listener on the receipts collection means every
  scan on either device shows up on both within a couple of seconds.

Setup details in
[`scripts/PHASE2_FIRESTORE_RULES.md`](scripts/PHASE2_FIRESTORE_RULES.md)
(Firestore rules, free tier) and
[`scripts/PHASE3_EMAIL_INVITE_SETUP.md`](scripts/PHASE3_EMAIL_INVITE_SETUP.md)
(magic-link email flow, also free).

## Build & ship

### OTA updates (JS/asset-only changes)

```bash
npx eas-cli update --branch preview --environment preview \
  --message "your change description"
```

Reaches installed devices on the next two cold-starts. No app store
involved — works because the runtime version (`appVersion` policy) is
identical across builds.

### Android APK (native deps changed, e.g. adding a Firebase module)

Pushes to `main` automatically trigger a GitHub Actions build
([`.github/workflows/android-build.yml`](.github/workflows/android-build.yml)).
Pulls credentials from EAS via the repo's `EXPO_TOKEN` secret, runs
`eas build --local` inside the workflow runner. Final APK appears
under the run's **Artifacts** section, ~16 min after push.

For a manual build run from any branch:

```bash
gh workflow run android-build.yml --ref <branch> -f profile=preview
```

iOS builds aren't yet wired into CI — see the deferred work in
`docs/`.

## Tests

```bash
npm test           # full suite, 360+ tests
npm test -- --watch
```

Jest config in [`jest.config.js`](jest.config.js); tests cover the
parser, AI prompt handlers (mocked HTTP), reports, categorizer, auth
errors, secure storage, and the items-sum sanity check.

## Repo layout

```
app/              expo-router screens
components/       shared UI primitives (Card, TagChip, AnimatedBar, …)
lib/              business logic — parser, AI clients, database, auth,
                  cloudSync (Firestore shadow-write + listener), inviteLink
constants/        theme, category list + icons
types/            shared TS types (Receipt, LineItem, etc.)
scripts/          deploy guides, the Cloudflare worker source, docs
firebase-hosting/ static files (assetlinks.json) for invite-link verification
plugins/          Expo prebuild config plugins
__tests__/        Jest tests
.github/workflows/android-build.yml   CI: APK builds on push to main
```

## License

Personal project — no license declared. Not for redistribution.
