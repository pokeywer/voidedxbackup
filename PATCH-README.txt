VOIDEDX PROMETHEUS MEDIUM PATCH

This integrates the Prometheus engine into VoidedX's existing Vault Protection panel. It does not include the separate Prometheus website interface.

Upload files into the matching repository paths and replace files when GitHub asks. Keep all five files in prometheus-engine/assets/ together.

The switch is fixed to Medium and LuaU. When enabled, saving a vault runs the provided Prometheus engine in the browser and stores its compressed output separately from the original source. Existing /api/raw, /api/verify, and /api/payload routes deliver the transformed copy. This patch adds no API endpoints. Do not replace the entire api folder; only copy the listed API files.

The supplied Prometheus license requires the public UI credit and license notice included here. Do not remove the attribution or LICENSE-PROMETHEUS.txt while using this engine.
