# VoidedX

VoidedX is a static website with Vercel serverless API routes. Deploy the repository root with the project's existing Firebase and Vercel configuration.

The Vault Protection switch uses a customized Prometheus Medium configuration in LuaU mode. To avoid corrupting Roblox service names and other string literals, the Luau profile skips `Vmify`, `AntiTamper`, `EncryptStrings`, and `ConstantArray`, retaining `NumbersToExpressions` and `WrapInFunction`. The original vault source stays readable in `code`; the generated copy is stored separately and served by the existing raw, verify, and payload routes. Existing vaults remain off until the owner enables the switch and saves. The browser compresses the generated copy before storing it, while the API decompresses it for execution.

Prometheus describes its LuaU support as basic and unfinished, so this profile may still not support every Luau-specific syntax or Roblox script pattern. Keep a backup and try the output in a private test place before using it broadly.