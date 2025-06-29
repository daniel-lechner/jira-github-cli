#!/usr/bin/env node

import { Command } from "commander"
import { configCommand } from "./commands/config"
import { createCommand } from "./commands/create"
import { listCommand } from "./commands/list"
import { reconfigureCommand } from "./commands/reconfigure"
import { setupCommand } from "./commands/setup"
import { updateCommand } from "./commands/update"

const program = new Command()

program
  .name("jgh")
  .description("CLI to create linked Jira and GitHub issues")
  .version("1.0.0")

program
  .command("setup")
  .description("Configure Jira and GitHub settings")
  .action(setupCommand)

program
  .command("reconfigure")
  .description("Update missing or outdated configuration settings")
  .action(reconfigureCommand)

program
  .command("create")
  .argument(
    "<title>",
    "Issue title (supports @me, +labels, (status), !priority)",
  )
  .option("-d, --description <desc>", "Issue description")
  .option("-t, --type <type>", "Issue type (Task, Bug, Story, Epic)")
  .option("--assign-me", "Assign issue to yourself")
  .option("--labels <labels>", "Comma-separated list of GitHub labels")
  .option("--status <status>", "Jira status to transition to")
  .description("Create a linked Jira and GitHub issue")
  .action(createCommand)

program
  .command("update")
  .argument("<issueKey>", "Jira issue key (e.g., PRJ-123)")
  .argument(
    "<updates>",
    "Updates: (status) !priority +addlabel -removelabel @me @unassign",
  )
  .description("Update an existing issue status, labels, or assignment")
  .action(updateCommand)

program
  .command("list")
  .argument(
    "[filter]",
    "Optional filter: 'mine' to show only issues assigned to you",
  )
  .description("List all open issues and their sync status")
  .action(async (filter?: string) => {
    const showMine = filter === "mine"
    await listCommand(showMine)
  })

program
  .command("config")
  .description("View current configuration")
  .action(configCommand)

program.parse()
