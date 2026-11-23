# OMI on Azure

Use one Linux VM as the authoritative Fastify process, with its SQLite database and WAL on an attached Azure managed data disk formatted as a local filesystem. The systemd template requires the mount at `/srv/omi-data` and refuses startup when the mount is absent. Keep the build and certificates separate from that directory. Azure temporary disks are unsuitable for this state, and SQLite WAL requires shared memory on one host. [Managed data disks](https://learn.microsoft.com/en-us/azure/virtual-machines/linux/disks-format-mount-data-disks-linux) · [SQLite WAL requirements](https://sqlite.org/wal.html)

## Configuration

- Build using the patched Node release in `.nvmrc`. Stage immutable releases under `/opt/omi` and point `/opt/omi/current` to the selected release.
- Set `/etc/omi/server.env` to mode 0600. Configure production mode, HTTPS `APP_ORIGIN`, loopback bind, `TRUST_LOCAL_PROXY=true`, and `DATABASE_PATH=/srv/omi-data/omi.sqlite`. Use an unprivileged service account and keep `EXPERIMENTAL_ELO=false`. Store provider keys in a protected secret store or root-readable environment file.
- Configure an Azure NSG that exposes HTTPS, with administrative SSH restricted to approved sources. Use the direct TLS NGINX renderer in `infra/azure/render-nginx.mjs` with an absolute compiled web root and absolute certificate paths. The public listener on TCP 443 rejects unknown SNI, overwrites client forwarding headers, and proxies the existing API allowlist and WebSocket upgrades to loopback. Validate syntax on the target host before installing the two systemd units. Certificate issuance, renewal, and DNS are operator prerequisites.
- Before migration, create and verify a backup using the existing SQLite backup CLI. Restore to a separate database and test recovery. On rollout, use one writer, preserve the managed disk, validate migration and production configuration with `deploy:check`, then probe `/api/health` and verify one authenticated WSS reconnect. HTTP health is a liveness check. Production preflight and the authenticated smoke check cover readiness.
- Bound persistent journal retention and ensure log rotation for host services. Monitor CPU credits, RSS, disk and WAL size, restart count, provider errors, connection saturation, and backup age. Copy encrypted verified backups off the VM and test restoration.
- Use Azure Cost Management alerts at 50%, 80%, and 100% of the resource-group budget. Azure budget alerts notify operators and do not stop spend. [Azure budgets](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets)

## Cost and scaling boundary

Quote one small burstable Linux VM for 730 hours, managed OS and data disks, a public IP, backup storage, network egress, and monitoring in the intended Azure region. Include TURN if enabled. The LKR 3,000 target has not been confirmed. For planning, even a compute-only rate of USD 0.0104/hour would be USD 7.59/month before disks, egress, tax, and exchange fees. This is an illustrative rate, not a quote. [Azure Linux VM pricing](https://azure.microsoft.com/en-us/pricing/details/virtual-machines/linux/) · [Azure calculator](https://azure.microsoft.com/en-us/pricing/calculator/)

Before adding instances, move authoritative data to a transactional shared store, fence room ownership with renewable leases, coordinate the matchmaking queue, route connections to the active room owner, and use cross-instance events. Persist terminal results and rating writes with idempotency keys in the same transaction. Affinity alone cannot recover ownership or serialize commands. Validate failover and sequential state recovery under load before enabling multiple authoritative instances.

The checked-in configuration is a local deployment template. No Azure resources were provisioned and no public release was performed.

## V2.3 release checks

Verify a backup before applying the additive match-detail and moderation migration. Keep one process writing the mounted SQLite database. In the release environment, check `MODERATOR_IDS` against the intended administrator account UUIDs and keep experimental Elo off. `ALLOW_GUESTS=true` in production requires the explicit `PRODUCTION_CASUAL_GUESTS=true` setting. Guests have no voice or chat. Signed-in private room communication is off unless `PRODUCTION_PRIVATE_COMMUNICATIONS=true`; keep it off until the audience and guardian policy is accepted. Ranked communication remains off. Exercise admin authorization, match recovery and authenticated WSS in staging before making the endpoint public.

## V2.4 readiness and retail estimate

Apply migration 0005 after a verified backup. The existing managed data disk now also holds unstarted lobby snapshots, invitation expiry and account safety state. Keep the data mount and single-writer rule on restarts and rollbacks. Probe `http://127.0.0.1:3000/ready` on the host after starting the service. An unavailable SQLite probe returns HTTP 503. Public `/api/health` remains a liveness check. Keep the readiness probe on loopback and verify authenticated WSS separately. Monitor probe failures, journal warning events `account_maintenance_failed` and `room_maintenance_failed`, disk availability, WAL size and backup age.

The Microsoft retail API returned USD 0.0112/hour for Central India Linux Standard_B1s and USD 2.64/month per E4 LRS Standard SSD managed disk when checked for V2.4. At 730 hours, a VM and two example E4 disks total USD 13.46/month before disk transactions, public IP, egress, monitoring, backups, tax and currency conversion. The LKR 3,000 budget would require an exchange rate of about LKR 223/USD or lower for that subtotal alone. VM availability, disk sizing, subscription discounts and public network latency still require Azure validation. [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)
