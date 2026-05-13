# Phase 2 — Firestore + Storage setup

Server-side configuration you (the owner of the Firebase project) need to apply
on **https://console.firebase.google.com/project/balancesheet-android**. Phase 2
of the app code is already shipped; without these console-side steps the cloud
shadow-write silently no-ops (the app keeps working in local-only mode).

## 1. Enable Firestore + Storage

Both are one-time setup:

- **Firestore Database** → Create database → **Production mode** → pick a region
  (e.g. `nam5 (us-central)`). The region is **permanent for the project**.
- **Storage** → Get started → same region as Firestore.

## 2. Firestore security rules

**Build → Firestore Database → Rules** tab. Paste:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // A user can read/write only their own profile doc.
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // A household doc is readable + writable by anyone whose uid is in the
    // doc's memberUids array. We rely on the app to keep memberUids in sync
    // with the members/{uid} subcollection (the app already does this).
    match /households/{hid} {
      function isMember() {
        return request.auth != null
          && request.auth.uid in resource.data.memberUids;
      }
      function isCreating() {
        // Allow the initial create call from ensureHouseholdForUser when the
        // current user puts themselves in memberUids. After creation the
        // isMember rule above takes over.
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

Click **Publish**.

## 3. Storage security rules

**Build → Storage → Rules** tab. Paste:

```
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    // Receipt photos live under households/{hid}/photos/{rid}.jpg.
    // Only members of the owning household can read or write them. We look
    // up the household doc from Firestore to check membership (same model
    // as the Firestore rules above).
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

## 4. Verifying it works

Once the rules are published AND you install the next APK build (which has
`@react-native-firebase/firestore` + `@react-native-firebase/storage` linked):

1. Sign in. Open Firestore console.
2. `users/{your-uid}` should exist with a `householdId` field.
3. `households/{that-hid}` should exist with `memberUids: [your-uid]`.
4. Scan a receipt. Within a few seconds:
   - `households/{hid}/receipts/{receiptId}` should appear with the full payload.
   - `households/{hid}/photos/{receiptId}.jpg` should appear in Storage.
5. Existing local receipts get backfilled in the background on the first
   sign-in after the upgrade — check the receipts subcollection populates
   over a few seconds.

If something doesn't appear, the most common causes are:

- Rules not published → all writes get permission-denied. Check the
  Firestore **Rules → Activity** log.
- Region mismatch between Firestore and Storage → photos fail. Both must
  match.
- The APK on the device pre-dates the Phase 2 native deps → cloudSync
  silently no-ops. Install the latest GitHub Actions APK.

## 5. What gets stored where

```
Firestore:
  users/{uid}                       { householdId, email, displayName, ... }
  households/{hid}                  { ownerUid, memberUids, memberCount, ... }
  households/{hid}/members/{uid}    { role, joinedAt }
  households/{hid}/receipts/{rid}   { full receipt payload + photoUrl }

Cloud Storage:
  households/{hid}/photos/{rid}.jpg one image per receipt
```
