import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { apiFetch } from "../api.js";

/** The whole analytics API: page views per page per UTC day. */
interface AnalyticsResponse {
  days: Array<{ day: string; path: string; views: number }>;
}

function bar(count: number, max: number, width = 20): string {
  const filled = Math.round((count / max) * width);
  return chalk.cyan("█".repeat(filled)) + chalk.dim("░".repeat(width - filled));
}

export const analyticsCommand = new Command("analytics")
  .description("View page-view counts for a site")
  .requiredOption("-s, --site <id>", "Site ID")
  .option("-p, --period <period>", "Time period: 24h | 7d | 30d | 90d", "7d")
  .option("--json", "Output raw JSON")
  .action(async (opts: { site: string; period: string; json?: boolean }) => {
    const siteId = parseInt(opts.site, 10);
    if (Number.isNaN(siteId)) {
      console.error(chalk.red("--site must be a numeric site ID"));
      process.exit(1);
    }

    if (!["24h", "7d", "30d", "90d"].includes(opts.period)) {
      console.error(chalk.red("--period must be one of: 24h, 7d, 30d, 90d"));
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

    const rows = data.days;
    const total = rows.reduce((a, r) => a + r.views, 0);

    const byDay = new Map<string, number>();
    const byPath = new Map<string, number>();
    for (const r of rows) {
      byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.views);
      byPath.set(r.path, (byPath.get(r.path) ?? 0) + r.views);
    }
    const dayTotals = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

    // ASCII sparkline of views per day
    function sparkline(values: number[]): string {
      const BLOCKS = " ▁▂▃▄▅▆▇█";
      const max = Math.max(...values, 1);
      return values.map(v => BLOCKS[Math.round((v / max) * 8)] ?? " ").join("");
    }

    console.log();
    console.log(
      chalk.bold(`  Page views — Site ${siteId}`) +
        chalk.dim(` (${opts.period})`),
    );
    console.log(chalk.dim("  " + "─".repeat(50)));
    console.log(`  ${chalk.dim("Views:")}        ${chalk.white(total.toLocaleString())}`);
    console.log(`  ${chalk.dim("Pages:")}        ${chalk.white(byPath.size.toLocaleString())}`);
    if (dayTotals.length > 1) {
      console.log(`  ${chalk.dim("Per day:")}      ${chalk.cyan(sparkline(dayTotals.map(([, v]) => v)))}`);
    }
    console.log();

    if (rows.length === 0) {
      console.log(chalk.dim("  No page views for this period yet."));
      console.log();
      return;
    }

    console.log(chalk.bold("  Views per page per day"));
    const maxViews = Math.max(...rows.map(r => r.views), 1);
    for (const r of rows.slice(-40)) {
      const label = `${r.day}  ${(r.path || "/").slice(0, 28)}`.padEnd(40);
      console.log(`  ${chalk.dim(label)} ${bar(r.views, maxViews)} ${chalk.white(r.views.toLocaleString())}`);
    }
    console.log();
  });
