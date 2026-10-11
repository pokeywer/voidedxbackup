# VoidedX

VoidedX is a static website with Vercel serverless API routes. Deploy the repository root with the project's existing Firebase and Vercel configuration.

The Vault Protection switch uses Prometheus Medium in LuaU mode with a Roblox compatibility profile. The profile skips the VM and tamper-detection passes that are not a safe fit for Roblox Luau APIs. It retains the other Medium transformations. The original vault source stays readable in `code`; the generated copy is stored separately and served by the existing raw, verify, and payload routes. Existing vaults remain off until the owner enables the switch and saves. The browser compresses the generated copy before storing it, while the API decompresses it for execution.

Prometheus describes its LuaU support as basic and unfinished, so this profile may still not support every Luau-specific syntax or Roblox script pattern. Keep a backup and try the output in a private test place before using it broadly.