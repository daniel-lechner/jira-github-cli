#!/usr/bin/env node

import chalk from "chalk"
import { Command } from "commander"
import Configstore from "configstore"
import inquirer from "inquirer"
import { createGitHubIssue, createJiraIssue } from "./api"
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

    // Store configuration
    config.set("jira", {
      url: answers.jiraUrl,
      email: answers.jiraEmail,
      token: answers.jiraToken,
      project: answers.jiraProject,
      issueType: answers.jiraIssueType,
    })

    console.log(chalk.green("✓ Configuration saved successfully!"))
    console.log(
      chalk.yellow(
        "Note: Make sure you have GitHub CLI (gh) installed and authenticated.",
      ),
    )
  })

program
  .command("create")
  .argument("<title>", "Issue title")
  .option("-d, --description <desc>", "Issue description")
  .option("-t, --type <type>", "Issue type (Task, Bug, Story, Epic)")
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

    try {
      console.log(chalk.blue("Creating Jira issue..."))

      const jiraIssue = await createJiraIssue({
        url: jiraConfig.url,
        email: jiraConfig.email,
        token: jiraConfig.token,
        project: jiraConfig.project,
        title: title,
        description: options.description || "",
        issueType: options.type || jiraConfig.issueType,
      })

      console.log(chalk.green(`✓ Jira issue created: ${jiraIssue.key}`))

      console.log(chalk.blue("Creating GitHub issue..."))
      const githubTitle = `${title} ${jiraIssue.key}`

      await createGitHubIssue({
        title: githubTitle,
        description:
          options.description ||
          `Linked to Jira issue: ${jiraConfig.url}/browse/${jiraIssue.key}`,
      })

      console.log(
        chalk.green(`✓ GitHub issue created with title: "${githubTitle}"`),
      )
      console.log(
        chalk.cyan(`🔗 Jira issue: ${jiraConfig.url}/browse/${jiraIssue.key}`),
      )
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
  })

program.parse()
