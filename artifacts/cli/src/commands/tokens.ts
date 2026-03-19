import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { apiFetch } from "../api.js";

interface ApiToken {
  id: number;
  name: string;
  tokenPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export const tokensCommand = new Command("tokens")
  .description("Manage API tokens");

tokensCommand
  .command("list")
  .description("List your active API tokens")
  .action(async () => {
    const spinner = ora("Fetching tokens").start();
    try {
      const tokens = await apiFetch<ApiToken[]>("/tokens");
      spinner.stop();

      if (tokens.length === 0) {
        console.log(chalk.dim("No active tokens."));
        return;
      }

      console.log();
      console.log(
        chalk.bold(`  ${"ID".padEnd(6)} ${"Name".padEnd(24)} ${"Prefix".padEnd(16)} ${"Last Used".padEnd(22)} Expires`),
      );
      console.log(chalk.dim("  " + "─".repeat(90)));

      for (const t of tokens) {
        const lastUsed = t.lastUsedAt
          ? new Date(t.lastUsedAt).toLocaleDateString()
          : chalk.dim("never");
        const expires = t.expiresAt
          ? new Date(t.expiresAt).toLocaleDateString()
          : chalk.dim("never");

        console.log(
          `  ${String(t.id).padEnd(6)} ` +
            `${t.name.slice(0, 23).padEnd(24)} ` +
            `${chalk.dim(t.tokenPrefix + "…").padEnd(16)} ` +
            `${lastUsed.toString().padEnd(22)} ` +
            `${expires}`,
        );
      }
      console.log();
    } catch (err: any) {
      spinner.fail(chalk.red(err.message));
      process.exit(1);
    }
  });

tokensCommand
  .command("revoke <id>")
  .description("Revoke an API token by ID")
  .action(async (id: string) => {
    const spinner = ora(`Revoking token ${id}`).start();
    try {
      await apiFetch(`/tokens/${id}`, { method: "DELETE" });
      spinner.succeed(chalk.green(`Token ${id} revoked`));
    } catch (err: any) {
      spinner.fail(chalk.red(err.message));
      process.exit(1);
    }
  });
