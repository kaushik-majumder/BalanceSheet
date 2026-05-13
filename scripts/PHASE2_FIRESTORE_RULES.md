# Phase 2 — Firestore setup (and optional Storage)

Server-side configuration on **https://console.firebase.google.com/project/balancesheet-android**.
Phase 2 of the app code is already shipped; without these console-side steps
the cloud shadow-write silently no-ops (the app keeps working in local-only
mode).

> **Recommended path: Firestore only.**
> Firestore stays on the free Spark plan — receipts, line items, and the
> household model all sync. Photos remain device-local. If you ever decide
> you want photos visible across family members' devices, follow the
> "Optional: enable Storage" section at the bottom — no code changes needed.

---

## 1. Enable Firestore

**Build → Firestore Database** → **Create database**:

- Mode: **Production mode** (we'll apply real rules in the next step).
- Location: pick the one closest to you (e.g. `nam5 (us-central)` in North
  America). **The region is permanent for the project — choose carefully.**

No upgrade prompt should appear — Firestore is on the free Spark tier.

## 2. Publish Firestore security rules

**Build → Firestore Database → Rules** tab. Replace the placeholder rules with:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // A user can read/write only their own profile doc.
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // A household doc is readable + writable by anyone whose uid is in the
    // doc's memberUids array. The app keeps memberUids in sync with the
    // members/{uid} subcollection on every membership change.
    match /households/{hid} {
      function isMember() {
        return request.auth != null
          && request.auth.uid in resource.data.memberUids;
      }
      function isCreating() {
        // Allow the initial create call from ensureHouseholdForUser when
        // the current user puts themselves in memberUids. After creation
        // the isMember rule above takes over.
        return request.auth != null
          && request.auth.uid in request.resource.data.memberUids;
      }

      allow read: if isMember();
      allow create: if isCreating();
      allow update, delete: if isMember();

      // Members subcollection — only existing household members can manage.
      match /members/{memberUid} {
        allow read, write:
          if request.auth != null
          && request.auth.uid in get(/databases/$(database)/documents/households/$(hid)).data.memberUids;
      }

      // Receipts subcollection — same household-membership gate.
      match /receipts/{rid} {
        allow read, write:
          if request.auth != null
          && request.auth.uid in get(/databases/$(database)/documents/households/$(hid)).data.memberUids;
      }
    }
  }
}
```

Click **Publish**. From now on every Firestore read or write is checked
against the rules; a request from outside the household is rejected
server-side.

## 3. Verifying it works

Once the rules are published AND you install the next APK build (the one
that includes `@react-native-firebase/firestore`):

1. Sign in to the app.
2. Open Firestore console → Data tab.
3. Within a few seconds of the first launch:
   - `users/{your-uid}` should appear with a `householdId` field.
   - `households/{that-hid}` should appear with `memberUids: [your-uid]`.
4. Scan a receipt OR force-close + reopen. Existing local receipts get
   backfilled in the background on the first sign-in after the upgrade —
   `households/{hid}/receipts/` should populate over a few seconds.
5. Future scans appear in Firestore within a second or two of saving locally.

If something doesn't appear, the most common causes are:

- **Rules not published** → all writes get `permission-denied`. Check the
  Firestore **Rules → Activity** tab for denied operations.
- **The APK on the device pre-dates the Phase 2 native deps** → `cloudSync`
  silently no-ops. Install the latest GitHub Actions APK from main.
- **No internet at the moment of save** → Firestore queues the write and
  flushes when the connection returns. Normal behaviour.

---

## What's stored where (Firestore-only path)

```
Firestore:
  users/{uid}                       { householdId, email, displayName, ... }
  households/{hid}                  { ownerUid, memberUids, memberCount, ... }
  households/{hid}/members/{uid}    { role, joinedAt }
  households/{hid}/receipts/{rid}   full receipt payload
                                    photoUrl = null (until Storage is enabled)

Local device only:
  imageUri                          the captured photo, still on this phone
```

Receipts saved on one device sync to Firestore so any future device this
user signs into will pick them up via Phase 3's listener. Photos are the
only thing that stays local.

---

## Optional: enable Storage (photo sync across family)

Skip this until you're ready to start sharing receipts with a family member
and want them to see the photos too. No code change is needed when you
enable it later — `loadStorage()` will start returning a real native module
and photo uploads activate automatically on the next save.

**One-time cost note:** Cloud Storage requires the **Blaze (pay-as-you-go)**
plan as of late 2024, even for usage below the free tier (5 GB stored / 1 GB
per day downloaded). You add a credit card; actual charge stays $0 unless
you exceed those limits. Set a $1 billing alert and you'll notice
immediately if anything ever crosses.

### Steps when you're ready

1. **Upgrade to Blaze**: top of Firebase console → "Upgrade" button → add card.
2. **Build → Storage → Get started** → same region as Firestore.
3. **Build → Storage → Rules** tab. Paste:

   ```
   rules_version = '2';

   service firebase.storage {
     match /b/{bucket}/o {

       // Receipt photos live under households/{hid}/photos/{rid}.jpg.
       // Only members of the owning household can read or write them. We
       // look up the household doc in Firestore to check membership.
       match /households/{hid}/photos/{photo} {
         allow read, write:
           if request.auth != null
           && request.auth.uid in firestore.get(
             /databases/(default)/documents/households/$(hid)
           ).data.memberUids;
       }
     }
   }
   ```

   Click **Publish**.

4. Set a billing alert: top-right gear → **Usage and billing → Details &
   settings → Budgets & alerts → Create budget**. Set monthly budget to
   $1 with an alert at 100%. You'll get an email if usage ever pushes past.

Future receipt saves upload their photo automatically; existing receipts
without `photoUrl` get uploaded on the next save / edit on that receipt.

---

## What gets stored where (full path, after Storage is enabled)

```
Firestore:
  users/{uid}                       { householdId, email, displayName, ... }
  households/{hid}                  { ownerUid, memberUids, memberCount, ... }
  households/{hid}/members/{uid}    { role, joinedAt }
  households/{hid}/receipts/{rid}   full receipt payload + photoUrl

Cloud Storage:
  households/{hid}/photos/{rid}.jpg one image per receipt
```
