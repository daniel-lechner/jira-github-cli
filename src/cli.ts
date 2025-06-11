#!/usr/bin/env node

import chalk from "chalk"
import { Command } from "commander"
import Configstore from "configstore"
import inquirer from "inquirer"
import {
  createGitHubIssue,
  createJiraIssue,
  getUserAccountId,
  parseTitle,
  transitionJiraIssue,
} from "./api"
import { CreateIssueOptions, JiraConfig } from "./types"

const config = new Configstore("jira-github-cli")
const program = new Command()

program
  .name("jgh")
  .description("CLI to create linked Jira and GitHub issues")
  .version("1.0.0")

program
  .command("setup")
  .description("Configure Jira and GitHub settings")
  .action(async () => {
    console.log(chalk.blue("Setting up Jira and GitHub configuration..."))

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "jiraUrl",
        message:
          "Enter your Jira URL (e.g., https://your-domain.atlassian.net):",
        validate: (input: string) =>
          input.includes("atlassian.net") || "Please enter a valid Jira URL",
      },
      {
        type: "input",
        name: "jiraEmail",
        message: "Enter your Jira email:",
        validate: (input: string) =>
          input.includes("@") || "Please enter a valid email",
      },
      {
        type: "password",
        name: "jiraToken",
        message: "Enter your Jira API token:",
        mask: "*",
      },
      {
        type: "input",
        name: "jiraProject",
        message: "Enter your Jira project key (e.g., PRJ):",
        validate: (input: string) =>
          input.length > 0 || "Project key is required",
      },
      {
        type: "list",
        name: "jiraIssueType",
        message: "Select default issue type:",
        choices: ["Task", "Bug", "Story", "Epic"],
      },
    ])

    try {
      console.log(chalk.yellow("⌛ Getting your account ID..."))
      const accountId = await getUserAccountId(
        answers.jiraUrl,
        answers.jiraEmail,
        answers.jiraToken,
      )

      config.set("jira", {
        url: answers.jiraUrl,
        email: answers.jiraEmail,
        token: answers.jiraToken,
        project: answers.jiraProject,
        issueType: answers.jiraIssueType,
        accountId: accountId,
      })

      console.log(chalk.green("✓ Configuration saved successfully!"))
      console.log(
        chalk.yellow(
          "Note: Make sure you have GitHub CLI (gh) installed and authenticated.",
        ),
      )
    } catch (error) {
      console.error(
        chalk.red("❌ Error during setup:"),
        (error as Error).message,
      )
      console.log(
        chalk.yellow(
          "Configuration saved without account ID. You can run setup again to retry.",
        ),
      )
    }
  })

program
  .command("create")
  .argument("<title>", "Issue title (supports @me, #labels, (status))")
  .option("-d, --description <desc>", "Issue description")
  .option("-t, --type <type>", "Issue type (Task, Bug, Story, Epic)")
  .option("--assign-me", "Assign issue to yourself")
  .option("--labels <labels>", "Comma-separated list of GitHub labels")
  .option("--status <status>", "Jira status to transition to")
  .description("Create a linked Jira and GitHub issue")
  .action(async (title: string, options: CreateIssueOptions) => {
    if (!config.has("jira")) {
      console.log(
        chalk.red(
          '❌ Please run "jgh setup" first to configure your settings.',
        ),
      )
      return
    }

    const jiraConfig: JiraConfig = config.get("jira")
    const parsed = parseTitle(title)

    const assignMe = options.assignMe || parsed.assignMe
    const labels = options.labels
      ? options.labels.split(",").map((l) => l.trim())
      : parsed.labels
    const status = options.status || parsed.status
    const finalTitle = parsed.cleanTitle

    try {
      console.log(chalk.yellow("⌛ Creating Jira issue..."))

      const jiraIssue = await createJiraIssue({
        url: jiraConfig.url,
        email: jiraConfig.email,
        token: jiraConfig.token,
        project: jiraConfig.project,
        title: finalTitle,
        description: options.description || "",
        issueType: options.type || jiraConfig.issueType,
        assignee: assignMe ? jiraConfig.accountId : undefined,
      })

      console.log(chalk.blue(`🆗 Jira issue created: ${jiraIssue.key}`))

      if (status) {
        console.log(chalk.yellow(`⌛ Transitioning to "${status}"...`))
        try {
          await transitionJiraIssue(
            jiraConfig.url,
            jiraConfig.email,
            jiraConfig.token,
            jiraIssue.key,
            status,
          )
          console.log(chalk.blue(`🆗 Issue transitioned to "${status}"`))
        } catch (error) {
          console.log(chalk.yellow(`⚠️ Warning: ${(error as Error).message}`))
        }
      }

      const githubTitle = `${finalTitle} ${jiraIssue.key}`
      console.log(chalk.yellow("⌛ Creating GitHub issue..."))

      let githubDescription =
        options.description ||
        `Linked to Jira issue: ${jiraConfig.url}/browse/${jiraIssue.key}`

      if (labels.length > 0) {
        githubDescription += `\n\nLabels: ${labels
          .map((l) => `#${l}`)
          .join(" ")}`
      }

      const githubIssueUrl = await createGitHubIssue({
        title: githubTitle,
        description: githubDescription,
        assignMe: assignMe,
        labels: labels,
      })

      console.log(
        chalk.blue(`🆗 GitHub issue created with title: "${githubTitle}"`),
      )
      console.log(
        chalk.green(
          `🔗 JIRA issue:     ${jiraConfig.url}/browse/${jiraIssue.key}`,
        ),
      )
      console.log(chalk.green(`🔗 GITHUB issue:   ${githubIssueUrl}`))

      if (labels.length > 0) {
        console.log(chalk.blue(`🏷️  Applied labels: ${labels.join(", ")}`))
      }
      if (assignMe) {
        console.log(chalk.blue(`👤 Assigned to you`))
      }
    } catch (error) {
      console.error(
        chalk.red("❌ Error creating issues:"),
        (error as Error).message,
      )
    }
  })

program
  .command("config")
  .description("View current configuration")
  .action(() => {
    if (!config.has("jira")) {
      console.log(
        chalk.yellow('No configuration found. Run "jgh setup" first.'),
      )
      return
    }

    const jiraConfig: JiraConfig = config.get("jira")
    console.log(chalk.blue("Current configuration:"))
    console.log(`Jira URL: ${jiraConfig.url}`)
    console.log(`Jira Email: ${jiraConfig.email}`)
    console.log(`Jira Project: ${jiraConfig.project}`)
    console.log(`Default Issue Type: ${jiraConfig.issueType}`)
    console.log(`API Token: ${"*".repeat(jiraConfig.token.length)}`)
    console.log(`Account ID: ${jiraConfig.accountId || "Not set"}`)
  })

program.parse()
