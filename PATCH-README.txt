VOIDEDX PROMETHEUS LUAU OBFUSCATION IMPROVEMENTS

This integrates the Prometheus engine into VoidedX's existing Vault Protection panel. It does not include the separate Prometheus website interface.

Upload files into the matching repository paths and replace files when GitHub asks. Keep all five files in prometheus-engine/assets/ together.

The strength selector offers Auto, Low, Medium, and High in LuaU mode. Auto uses Medium up to 10,000 UTF-8 bytes and Low above; users can choose a strength manually. High selects Prometheus's Strong preset, while the LuaU compatibility profile continues to skip Vmify, AntiTamper, EncryptStrings, and ConstantArray. The browser can obfuscate source files up to 700 KiB, caches the last successful result for repeat saves, and checks the estimated Firestore document size before saving. Unkeyed raw loaders fetch the code body directly rather than embedding it in the bootstrap. The existing /api/raw, /api/verify, and /api/payload routes deliver the generated copy. No API endpoints are added.

Prometheus documents LuaU support as basic and unfinished; some Luau-specific syntax or Roblox script patterns may still be unsupported. Keep a backup and try the output in a private test place before broad use. A saved vault document is capped at an estimated 870 KiB to leave headroom under Firestore's document-size limit.
