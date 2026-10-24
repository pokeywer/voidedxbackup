# VoidedX

VoidedX is a static website with Vercel serverless API routes. Deploy the repository root with the project's existing Firebase and Vercel configuration.

## Admin setup

The admin page at `/admin.html` uses the `/api/admin-auth` route. Configure these Vercel environment variables before deployment:

- `FIREBASE_SERVICE_ACCOUNT`: the Firebase service-account JSON used by the server-side API routes.
- `ADMIN_USERNAME`: the admin sign-in name.
- `ADMIN_PASSWORD`: a private password of at least 12 bytes.
- `ADMIN_SESSION_SECRET`: a separate random secret of at least 32 bytes. Changing it signs out existing admin sessions.

Admin sessions use signed, HTTP-only, same-site cookies and expire after eight hours. Sign-in is limited to five failed attempts per network address in a 15-minute window. The client-side Firebase security rules are not part of this archive; review the rules configured in Firebase separately, especially for direct vault and key-manager writes.

The authenticated Admin dashboard includes a private vault source manager. It lists vault metadata, loads readable source only when a vault is selected, and can update its title, source, obfuscation settings, and execution copy. Admin edits are protected by the same-origin check and session cookie, and update only the chosen vault's script fields while preserving owner keys and execution counts. Saving there changes the live vault used by that vault's loader.

## Loader and key protection

The website issues a signed loader token that refreshes in the browser every 40 seconds and expires after 45 seconds. The raw loader endpoint checks its signature, expiry, vault ID, key binding, and per-vault loader version before returning a bootstrap. Owners can increment that version to revoke every copied loader token immediately. Each successful `/api/verify` call also issues a cryptographically random, one-use delivery ticket; it expires after the vault's configured 20, 30, 45, or 60 seconds (45 by default) and `/api/payload` consumes it once while rechecking the vault, key, player binding, ban, IP-lock state, and pause status. Keyed verification limits can be set to 5, 10, 20, 30, or 50 checks per network in 15 minutes (30 by default); the counter includes successful checks. Owners can pause a vault to block new loader downloads, verification, public-key claims, and payload delivery. Pausing does not stop a script that has already been downloaded and is running. Newly generated keys use 16 cryptographically random characters; existing keys continue to work. Older loadstrings without the signed token must be recopied from the website after deploying this change.

Generated bootstrap loaders use an `_bsdata0` envelope containing a per-response masked byte string. The mask changes whenever the bootstrap is fetched; the signed loader token refreshes every 40 seconds and copied versions expire after 45 seconds; the separate one-use delivery ticket changes whenever it runs. `LOADER_TOKEN_SECRET` may be set to a random secret of at least 32 bytes; if unset, signing uses `ADMIN_SESSION_SECRET`, then `FIREBASE_SERVICE_ACCOUNT`. The token is client-visible and the public token endpoint can issue a fresh one, so expiry limits stale copies but does not stop a determined user from requesting another loader or capturing the script at runtime. These are access-control and obfuscation layers, not encryption or DRM. Keep secrets and private API credentials out of client scripts.

## Vault protection and obfuscation

Vault Protection offers Auto, Low, Medium, and High obfuscation strengths in Luau mode. Auto selects High up to 10,000 UTF-8 bytes and Medium above that; owners can override the selection. Every strength splits string literals using native concatenation, while High also uses Prometheus's stronger numeric representation pass. A mild watermark check is enabled by default. Optional experimental VM protection runs Prometheus's `Vmify` pass by itself, so string splitting, watermark checks, and strength-specific passes are paused while VM mode is selected. This avoids known interactions between the VM and the other Luau passes. Unsupported syntax or VM compile errors stop the save before Firestore is updated; turn VM mode off to use the regular Luau profile.

The optional **More string splitting** setting splits ordinary string literals into shorter two- or three-character chunks, while leaving literals longer than 4 KiB intact to keep large scripts manageable. It uses native Luau concatenation. The regular Luau profile skips Prometheus VM, string-encryption, and constant-array passes because they can corrupt Roblox API strings or break scripts. Vaults saved with an earlier obfuscation profile should be opened and saved again to regenerate their execution copy. Prometheus describes its Luau support as basic and unfinished; keep a backup and try generated code in a private test place before using it broadly.

Source up to 128 KiB is stored as readable text in Firestore for owner audits; larger source is gzip-base64 compressed to preserve Firestore document space. Compression is not encryption. Older plain-text and gzip-base64 records remain supported, and loading a vault decodes compressed source into the editor. The obfuscated execution copy is gzip-base64 encoded in storage and decompressed by the API for delivery. Browser obfuscation accepts source up to 2 MiB and generated output up to 8 MiB, while each vault document is kept below an estimated 870 KiB. The combined source and execution copy can therefore hit the document limit before either individual byte limit. Large scripts can take several minutes to process or time out. Re-saving unchanged source with the same strength and protection settings reuses the last generated copy in that browser session.

Based on Prometheus by Elias Oelschner, https://github.com/prometheus-lua/Prometheus
