import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { apiFetch } from "../api.js";

interface AnalyticsResponse {
  period: string;
  totals: { hits: number; bytesServed: number; uniqueIps: number };
  topPaths: Array<{ path: string; count: number }>;
  topReferrers: Array<{ referrer: string; count: number }>;
  hourly: Array<{ hour: string; hits: number }>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function bar(count: number, max: number, width = 20): string {
  const filled = Math.round((count / max) * width);
  return chalk.cyan("█".repeat(filled)) + chalk.dim("░".repeat(width - filled));
}

export const analyticsCommand = new Command("analytics")
  .description("View traffic analytics for a site")
  .requiredOption("-s, --site <id>", "Site ID")
  .option("-p, --period <period>", "Time period: 24h | 7d | 30d", "24h")
  .option("--json", "Output raw JSON")
  .action(async (opts: { site: string; period: string; json?: boolean }) => {
    const siteId = parseInt(opts.site, 10);
    if (Number.isNaN(siteId)) {
      console.error(chalk.red("--site must be a numeric site ID"));
      process.exit(1);
    }

    if (!["24h", "7d", "30d"].includes(opts.period)) {
      console.error(chalk.red("--period must be one of: 24h, 7d, 30d"));
      process.exit(1);
    }

    const spinner = ora("Fetching analytics").start();
    let data: AnalyticsResponse;
    try {
      data = await apiFetch<AnalyticsResponse>(
        `/sites/${siteId}/analytics?period=${opts.period}`,
      );
      spinner.stop();
    } catch (err: any) {
      spinner.fail(chalk.red(err.message));
      process.exit(1);
    }

    if (opts.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    const { totals, topPaths, topReferrers } = data;

    console.log();
    console.log(
      chalk.bold(`  Analytics — Site ${siteId}`) +
        chalk.dim(` (${opts.period})`),
    );
    console.log(chalk.dim("  " + "─".repeat(50)));
    console.log(`  ${chalk.dim("Hits:")}         ${chalk.white(totals.hits.toLocaleString())}`);
    console.log(`  ${chalk.dim("Unique IPs:")}   ${chalk.white(totals.uniqueIps.toLocaleString())}`);
    console.log(`  ${chalk.dim("Bandwidth:")}    ${chalk.white(formatBytes(totals.bytesServed))}`);
    console.log();

    if (topPaths.length > 0) {
      console.log(chalk.bold("  Top Pages"));
      const maxPath = topPaths[0]?.count ?? 1;
      for (const p of topPaths.slice(0, 8)) {
        const label = (p.path || "/").slice(0, 35).padEnd(36);
        console.log(
          `  ${chalk.dim(label)} ${bar(p.count, maxPath)} ${chalk.white(p.count.toLocaleString())}`,
        );
      }
      console.log();
    }

    if (topReferrers.length > 0) {
      console.log(chalk.bold("  Top Referrers"));
      const maxRef = topReferrers[0]?.count ?? 1;
      for (const r of topReferrers.slice(0, 6)) {
        const label = (r.referrer || "(direct)").slice(0, 35).padEnd(36);
        console.log(
          `  ${chalk.dim(label)} ${bar(r.count, maxRef)} ${chalk.white(r.count.toLocaleString())}`,
        );
      }
      console.log();
    }

    if (topPaths.length === 0 && topReferrers.length === 0) {
      console.log(chalk.dim("  No traffic data for this period yet."));
      console.log();
    }
  });
