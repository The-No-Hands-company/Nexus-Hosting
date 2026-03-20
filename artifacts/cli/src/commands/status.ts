import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { apiFetch } from "../api.js";
import { getConfig } from "../config.js";

interface HealthStatus {
  status: "healthy" | "degraded" | "error";
  uptime: number;
  version: string;
  environment: string;
  services: { database: { status: string; latencyMs: number } };
}

interface FederationMeta {
  protocol: string;
  name: string;
  domain: string;
  region: string;
  publicKey: string | null;
  nodeCount: number;
  activeSites: number;
}

interface CapacitySummary {
  totalNodes: number;
  activeNodes: number;
  totalStorageGb: number;
  usedStorageGb: number;
  totalBandwidthGb: number;
  totalSites: number;
  uptimePercent: number;
}

function uptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function statusIcon(status: string): string {
  switch (status) {
    case "healthy":
    case "ok":
    case "active":
      return chalk.green("●");
    case "degraded":
    case "inactive":
      return chalk.yellow("●");
    default:
      return chalk.red("●");
  }
}

export const statusCommand = new Command("status")
  .description("Show node health and federation network status")
  .option("--json", "Output raw JSON")
  .action(async (opts: { json?: boolean }) => {
    const cfg = getConfig();
    const nodeUrl = cfg.nodeUrl || "http://localhost:8080";

    const spinner = ora(`Checking node at ${chalk.bold(nodeUrl)}`).start();

    let health: HealthStatus | null = null;
    let meta: FederationMeta | null = null;
    let capacity: CapacitySummary | null = null;
    let error: string | null = null;

    try {
      [health, meta, capacity] = await Promise.all([
        apiFetch<HealthStatus>("/health", { auth: false }),
        apiFetch<FederationMeta>("/federation/meta", { auth: false }),
        apiFetch<CapacitySummary>("/capacity/summary", { auth: false }),
      ]);
      spinner.stop();
    } catch (err: any) {
      spinner.fail(chalk.red(`Could not reach node: ${err.message}`));
      error = err.message;
    }

    if (opts.json) {
      console.log(JSON.stringify({ health, meta, capacity, error }, null, 2));
      return;
    }

    if (!health) {
      console.log(chalk.red("\n  Node is unreachable."));
      process.exit(1);
    }

    console.log();
    console.log(
      `  ${statusIcon(health.status)} Node ${chalk.bold(meta?.name ?? "Unknown")}` +
        chalk.dim(` — ${meta?.domain ?? nodeUrl}`),
    );
    console.log();

    // Health
    console.log(chalk.bold("  Health"));
    console.log(`  ${chalk.dim("Status:")}      ${health.status === "healthy" ? chalk.green("healthy") : chalk.yellow(health.status)}`);
    console.log(`  ${chalk.dim("Uptime:")}      ${uptime(health.uptime)}`);
    console.log(`  ${chalk.dim("Version:")}     ${health.version}`);
    console.log(`  ${chalk.dim("Database:")}    ${statusIcon(health.services.database.status)} ${health.services.database.latencyMs}ms`);
    console.log();

    // Federation
    if (meta) {
      console.log(chalk.bold("  Federation"));
      console.log(`  ${chalk.dim("Protocol:")}    ${meta.protocol}`);
      console.log(`  ${chalk.dim("Region:")}      ${meta.region}`);
      console.log(`  ${chalk.dim("Peers:")}       ${meta.nodeCount}`);
      console.log(`  ${chalk.dim("Active Sites:")} ${meta.activeSites}`);
      console.log();
    }

    // Capacity
    if (capacity) {
      const storageUsedPct = capacity.totalStorageGb > 0
        ? ((capacity.usedStorageGb / capacity.totalStorageGb) * 100).toFixed(1)
        : "0.0";

      console.log(chalk.bold("  Network Capacity"));
      console.log(`  ${chalk.dim("Nodes:")}       ${capacity.activeNodes} active / ${capacity.totalNodes} total`);
      console.log(`  ${chalk.dim("Sites:")}       ${capacity.totalSites}`);
      console.log(`  ${chalk.dim("Storage:")}     ${capacity.usedStorageGb.toFixed(1)} GB used / ${capacity.totalStorageGb.toFixed(1)} GB total (${storageUsedPct}%)`);
      console.log(`  ${chalk.dim("Uptime:")}      ${capacity.uptimePercent.toFixed(1)}%`);
      console.log();
    }

    // Show authenticated user's sites if logged in
    if (cfg.token) {
      try {
        const sites = await apiFetch<{ data: Array<{ id: number; name: string; domain: string; status: string; storageUsedMb: number }> }>(
          "/sites?limit=5"
        );
        if (sites.data?.length) {
          console.log(chalk.bold("  Your Sites"));
          for (const s of sites.data) {
            const icon = s.status === "active" ? chalk.green("●") : chalk.dim("○");
            console.log(`  ${icon} ${chalk.white(s.domain.padEnd(35))} ${chalk.dim(`${s.storageUsedMb.toFixed(1)} MB`)}`);

            try {
              const deps = await apiFetch<{ data: Array<{ version: number; environment: string; deployedAt: string; fileCount: number }> }>(
                `/sites/${s.id}/deployments?limit=1`
              );
              const d = deps.data?.[0];
              if (d) {
                const envLabel = d.environment && d.environment !== "production" ? chalk.yellow(` [${d.environment}]`) : "";
                console.log(`    ${chalk.dim(`v${d.version}${envLabel} · ${d.fileCount} files · ${new Date(d.deployedAt).toLocaleDateString()}`)}`);
              }
            } catch { /* skip */ }
          }
          console.log();
        }
      } catch { /* skip if not authenticated */ }
    }
  });
