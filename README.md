# VoidedX

VoidedX is a static website with Vercel serverless API routes. Deploy the repository root with the project's existing Firebase and Vercel configuration.

The Vault Protection switch uses the Prometheus Medium preset in LuaU mode. The original vault source stays readable in `code`; the generated copy is stored separately and served by the existing raw, verify, and payload routes. Existing vaults remain off until the owner enables the switch and saves. The browser compresses the generated copy before storing it, while the API decompresses it for execution.

Based on Prometheus by Elias Oelschner, https://github.com/prometheus-lua/Prometheus

See `LICENSE-PROMETHEUS.txt` for the engine's license.
