# Downstream features to preserve

The downstream fork must retain its optional Caddy Host Network Mode support.

## Protected behavior

- `CADDY_NETWORK_MODE=bridge` remains the backward-compatible default.
- Host mode runs only Caddy with host networking; the web application and its
  database stay on the Compose bridge network.
- Host mode applies L4 listener changes through the Caddy Admin API and does
  not require the L4 port-manager or Docker socket proxy.
- Do not expose the Caddy Admin API on an untrusted host interface.
- Preserve the associated Compose override, tests, configuration examples,
  and documentation.

This file describes downstream requirements. It is not permission to bypass
tests or modify the protected paths listed in `.upstream/policy.yml`.
