import chalk from "chalk"
import Configstore from "configstore"
import inquirer from "inquirer"
import { getUserAccountId } from "../api"

const config = new Configstore("jira-github-cli")

export async function reconfigureCommand(): Promise<void> {
  if (!config.has("jira")) {
    console.log(
      chalk.red(
        '❌ No existing configuration found. Please run "jgh setup" first.',
      ),
    )
    return
  }

  const jiraConfig = config.get("jira")
  const jiraDisplayName = config.get("jiraDisplayName")

  console.log(chalk.blue("Reconfiguring missing or outdated settings..."))
  console.log(chalk.gray("Leave blank to keep current values\n"))

  const questions = []

  if (!jiraConfig.url || !jiraConfig.url.includes("atlassian.net")) {
    questions.push({
      type: "input",
      name: "jiraUrl",
      message: `Jira URL (current: ${jiraConfig.url || "Not set"}):`,
      validate: (input: string) =>
        !input ||
        input.includes("atlassian.net") ||
        "Please enter a valid Jira URL",
    })
  }

  if (!jiraConfig.email || !jiraConfig.email.includes("@")) {
    questions.push({
      type: "input",
      name: "jiraEmail",
      message: `Jira email (current: ${jiraConfig.email || "Not set"}):`,
      validate: (input: string) =>
        !input || input.includes("@") || "Please enter a valid email",
    })
  }

  if (!jiraConfig.token) {
    questions.push({
      type: "password",
      name: "jiraToken",
      message: "Jira API token (current: Not set):",
      mask: "*",
    })
  }

  if (!jiraConfig.project) {
    questions.push({
      type: "input",
      name: "jiraProject",
      message: `Jira project key (current: ${
        jiraConfig.project || "Not set"
      }):`,
      validate: (input: string) =>
        !input || input.length > 0 || "Project key is required",
    })
  }

  if (!jiraConfig.issueType) {
    questions.push({
      type: "list",
      name: "jiraIssueType",
      message: `Default issue type (current: ${
        jiraConfig.issueType || "Not set"
      }):`,
      choices: ["Task", "Bug", "Story", "Epic"],
    })
  }

  if (!jiraDisplayName) {
    questions.push({
      type: "input",
      name: "jiraDisplayName",
      message: "Jira display name (for filtering your issues):",
      validate: (input: string) =>
        !input || input.length > 0 || "Display name is required",
    })
  }

  questions.push({
    type: "confirm",
    name: "refreshAccountId",
    message: `Refresh account ID? (current: ${
      jiraConfig.accountId || "Not set"
    })`,
    default: !jiraConfig.accountId,
  })

  if (
    questions.length === 1 &&
    questions[0].name === "refreshAccountId" &&
    jiraConfig.accountId
  ) {
    console.log(chalk.green("✓ All required configuration is already set!"))

    const { refreshAccountId } = await inquirer.prompt(questions)

    if (!refreshAccountId) {
      console.log(chalk.yellow("No changes made."))
      return
    }
  }

  const answers = await inquirer.prompt(questions)

  const updatedConfig = {
    url: answers.jiraUrl || jiraConfig.url,
    email: answers.jiraEmail || jiraConfig.email,
    token: answers.jiraToken || jiraConfig.token,
    project: answers.jiraProject || jiraConfig.project,
    issueType: answers.jiraIssueType || jiraConfig.issueType,
    accountId: jiraConfig.accountId,
  }

  const updatedDisplayName = answers.jiraDisplayName || jiraDisplayName

  if (answers.refreshAccountId || !jiraConfig.accountId) {
    try {
      console.log(chalk.yellow("⌛ Getting your account ID..."))
      const accountId = await getUserAccountId(
        updatedConfig.url,
        updatedConfig.email,
        updatedConfig.token,
      )
      updatedConfig.accountId = accountId
      console.log(chalk.green("✓ Account ID updated!"))
    } catch (error) {
      console.error(
        chalk.red("❌ Error getting account ID:"),
        (error as Error).message,
      )
      console.log(
        chalk.yellow("Configuration saved without account ID update."),
      )
    }
  }

  config.set("jira", updatedConfig)

  if (updatedDisplayName) {
    config.set("jiraDisplayName", updatedDisplayName)
  }

  console.log(chalk.green("✓ Configuration updated successfully!"))

  const changedFields = []
  if (answers.jiraUrl) changedFields.push("Jira URL")
  if (answers.jiraEmail) changedFields.push("Jira Email")
  if (answers.jiraToken) changedFields.push("API Token")
  if (answers.jiraProject) changedFields.push("Project")
  if (answers.jiraIssueType) changedFields.push("Issue Type")
  if (answers.jiraDisplayName) changedFields.push("Display Name")
  if (answers.refreshAccountId) changedFields.push("Account ID")

  if (changedFields.length > 0) {
    console.log(chalk.blue(`Updated: ${changedFields.join(", ")}`))
  }
}
