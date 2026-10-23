# VoidedX

VoidedX is a static website with Vercel serverless API routes. Deploy the repository root with the project's existing Firebase and Vercel configuration.

## Admin setup

The admin page at `/admin.html` uses the `/api/admin-auth` route. Configure these Vercel environment variables before deployment:

- `FIREBASE_SERVICE_ACCOUNT`: the Firebase service-account JSON used by the server-side API routes.
- `ADMIN_USERNAME`: the admin sign-in name.
- `ADMIN_PASSWORD`: a private password of at least 12 bytes.
- `ADMIN_SESSION_SECRET`: a separate random secret of at least 32 bytes. Changing it signs out existing admin sessions.

Admin sessions use signed, HTTP-only, same-site cookies and expire after eight hours. Sign-in is limited to five failed attempts per network address in a 15-minute window. The client-side Firebase security rules are not part of this archive; review the rules configured in Firebase separately, especially for direct vault and key-manager writes.

## Loader and key protection

Each successful `/api/verify` call issues a cryptographically random, one-use delivery ticket. It expires after 90 seconds. `/api/payload` consumes the ticket once and rechecks the vault, key, player binding, ban, and IP-lock state before returning the execution script. This flow is used by public loaders, URL-key loaders, and the in-game key popup. Keyed verification requires a player ID and is limited to 30 attempts per vault and network address in a 15-minute window. Newly generated keys use 16 cryptographically random characters; existing keys continue to work.

Generated bootstrap loaders use an `_bsdata0` envelope containing a per-response masked byte string. The mask changes whenever the bootstrap is fetched; the separate one-use delivery ticket changes whenever it runs. These are obfuscation layers, not encryption. A script must reach the client to run, so a player or executor can still capture or inspect delivered code at runtime. Keep secrets and private API credentials out of client scripts; obfuscation and a loader are not DRM.

## Vault protection and obfuscation

Vault Protection offers Auto, Low, Medium, and High obfuscation strengths in Luau mode. Auto selects High up to 10,000 UTF-8 bytes and Medium above that; owners can override the selection. Every strength splits string literals using native concatenation, while High also uses Prometheus's stronger numeric representation pass. A mild watermark check is enabled by default. VM protection is disabled in the Luau profile because it can corrupt Roblox API strings.

The optional **More string splitting** setting splits ordinary string literals into shorter two- or three-character chunks, while leaving literals longer than 4 KiB intact to keep large scripts manageable. It uses native Luau concatenation. The Luau profile skips Prometheus VM, string-encryption, and constant-array passes because they can corrupt Roblox API strings or break scripts. Vaults saved with the earlier experimental profile should be opened and saved again to regenerate their execution copy. Prometheus describes its Luau support as basic and unfinished; keep a backup and try generated code in a private test place before using it broadly.

Readable source is gzip-base64 compressed in Firestore when the browser supports compression; older plain-text and gzip-base64 records remain supported. The obfuscated execution copy is also gzip-base64 encoded in storage and decompressed by the API for delivery. Browser obfuscation accepts source up to 2 MiB and generated output up to 8 MiB, while each vault document is kept below an estimated 870 KiB. The combined source and execution copy can therefore hit the document limit before either individual byte limit. Large scripts can take several minutes to process or time out. Re-saving unchanged source with the same strength and protection settings reuses the last generated copy in that browser session.

Based on Prometheus by Elias Oelschner, https://github.com/prometheus-lua/Prometheus
