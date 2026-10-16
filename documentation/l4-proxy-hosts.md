# L4 proxy hosts

An L4 host forwards TCP or UDP traffic that is not HTTP (SSH, mail, DNS over TLS, WireGuard, databases) from a port of its own to services on your network. It can route by TLS server name (SNI) or HTTP Host, terminate TLS, speak the PROXY protocol, balance load over several upstreams with health checks, and apply [geo blocking](geo-blocking.md).

## The list

**Traffic → L4 hosts** lists every L4 host you may see (a custom role limited to tags sees the hosts with one of its tags). Each row shows:

- **Name**, and for a host that routes by TLS SNI or HTTP Host, the first server name it matches and how many more.
- **Listen**: the protocol and the listen address.
- **Upstream**: the first upstream and how many more (hover to see them all).
- **Tags**, when any host has tags ([host tags](host-tags.md)).
- **Status**: *Active*, *Disabled*, or *Port not published* in Bridge Mode when the host is saved but Caddy cannot receive its traffic yet (see [Ports](#ports-and-network-mode)).

Search matches names, listen addresses, upstreams, server names and tags, ignoring case. The protocol filter (TCP or UDP) and the status filter (enabled or disabled) narrow the list; each option shows how many hosts it would list with the search and the other filter. By default, the list is sorted newest first. **Profile → Interface → Default list order** can change the account's initial ordering; an explicit sort in the URL wins. The Name, Listen, Upstream and Status headings sort by that column (on a phone, use the Sort menu). It shows 25 hosts per page, and the page is part of the address, so back, reload and shared links keep it.

Select a host's name (or **Open** in its row menu) to open [its page](#a-hosts-page). The row menu also has **Edit** (the page at Routing), **Duplicate** and **Delete**; the switch in the row enables or disables the host. **New L4 host** opens the editor for a new host at `/l4-proxy-hosts/new`.

Select hosts with the checkboxes to enable, disable or delete several at once (deleting asks for a confirmation). Each host goes through the same checks as a change to it alone: your role's tags, the [change approval](../ee/docs/change-approvals.md) policies (a protected host gets a change request instead) and the audit log, which records one event per host. Caddy is applied once for the whole batch.

Links that open the list with something prepared: `/l4-proxy-hosts?search=<text>`, with `&protocol=tcp` or `udp`, and `&status=enabled` or `disabled`.

## A host's page

`/l4-proxy-hosts/<id>` has one header (name, status, listen address and protocol, server names, tags, **Duplicate** and **Enable**/**Disable**) and one row of tabs, laid out like a [proxy host's page](proxy-host-editor.md):

- **Overview**: the settings of each tab in plain words, with an **Edit** link to that tab, and the upstreams. A port the host needs that is not published yet is named at the top (see [Ports](#ports)).
- **Routing**: protocol and listen address, upstreams (one host:port per row; a pasted list fills several rows), the matcher (none, TLS SNI or HTTP Host with the names to match, or a PROXY protocol header), TLS termination (TCP only) and the PROXY protocol in and out. A new host's name and tags are here too.
- **Load balancing**: the policy, how long to keep trying another upstream, and active and passive health checks.
- **Security**: geo blocking.
- **Advanced**: name and tags, DNS resolvers and upstream DNS pinning.
- **History**: the host's recent changes with what they changed (needs `audit_log:read`).

The tabs switch in place and are linkable (`#routing`, `#security` …, or a card such as `#upstreams`). A change in any tab counts on the tab and in a bar at the bottom, which appears once something changed: **Save** applies everything, **Discard** drops it, and Ctrl/Cmd+S saves too. Unsaved changes survive switching tabs; leaving the page with unsaved changes asks first. A problem to fix shows on its field and on its tab before anything is sent. A host a [change approval](../ee/docs/change-approvals.md) policy protects says so above the tabs, and saving sends a change request instead. Without `l4_proxy_hosts:write` the page has Overview and History only.

**Duplicate** opens the editor for a new host filled from the host (`/l4-proxy-hosts/new?from=<id>`): hosts on the same port need different matchers, so change the listen address or the matcher before creating it.

## Ports and network mode

Bridge Mode is the default. Each L4 host listens on a port of the Caddy container, and Docker publishes the needed ports when it creates the container. When a port is missing, the page offers **Publish ports now**; the L4 port manager recreates Caddy, which interrupts traffic for a few seconds. Ports 80, 443 and 2019 are reserved for Caddy.

For Host Mode, replace the existing Stack definition with the standalone `docker-compose.host.yml` file and set `CADDY_HOST_GATEWAY_IP` to the host address used by Docker's `host-gateway` mapping. Keep the existing Compose project/Portainer Stack name so named volumes retain their names. With Docker Compose, run `docker compose -f docker-compose.host.yml up -d`; in Portainer, use a Git-based Stack pointing to this file. The Caddy container uses the host network; Web and the database remain on the Compose network. The Docker socket proxy and L4 port manager are not part of this Stack. Caddy's unauthenticated Admin API binds only to the specified host gateway address on port 2019. Keep that address private and use the host firewall to allow access only from the Web container; do not expose port 2019 on public interfaces. On restart, Caddy starts from its base Caddyfile and Web reapplies the database-backed configuration after Caddy becomes healthy; traffic may be interrupted during that startup. The dashboard shows the active network mode and does not ask to publish ports.

Host networking is supported on Linux Docker Engine. Docker Desktop uses a VM network and does not provide the same host binding behavior. Check that the host ports are unused. Caddy runs as a non-root user: ports below the host's `net.ipv4.ip_unprivileged_port_start` may fail to bind without host configuration. Host network containers do not use Compose service DNS. Set Proxy Host upstreams to addresses reachable from the host network; the `web` service is reached via its published port for Forward Auth. Caddy applies listener changes through its Admin API; existing connection behavior during a configuration update depends on Caddy and the affected protocol, so this mode does not promise zero downtime. The provided Host Stack targets the main SQLite stack; review custom PostgreSQL replica and HA upstreams separately before combining those files.

## Settings worth knowing

- **Geo blocking** at L4 sees the client's direct address: there is no `X-Forwarded-For` to read, so behind another proxy it sees that proxy. Blocked connections are closed. **Merge** adds the host's rules to the default rules of [Geo blocking](geo-blocking.md); **Override** uses only the host's.
- **Upstream DNS pinning** ([upstream-dns-pinning.md](upstream-dns-pinning.md)) resolves upstream hostnames to addresses when the configuration is applied. *As in Host defaults* follows the default on **Proxy hosts → Host defaults**.

## Permissions and API

The list and a host's page need `l4_proxy_hosts:read`; the editor (`/l4-proxy-hosts/new` and the tabs of a host's page), deleting, and applying Bridge Mode port changes need `l4_proxy_hosts:write` ([custom roles](../ee/docs/custom-roles.md)).

The REST API has the same hosts at `/api/v1/l4-proxy-hosts` (see `/api/v1/openapi.json`).
