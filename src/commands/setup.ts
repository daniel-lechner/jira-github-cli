import chalk from "chalk"
import Configstore from "configstore"
import inquirer from "inquirer"
import { getUserAccountId } from "../api"

const config = new Configstore("jira-github-cli")

export async function setupCommand(): Promise<void> {
  console.log(chalk.blue("Setting up Jira and GitHub configuration..."))

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "jiraUrl",
      message: "Enter your Jira URL (e.g., https://your-domain.atlassian.net):",
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
    {
      type: "input",
      name: "jiraDisplayName",
      message: "Enter your Jira display name (e.g., Daniel Lechner):",
      validate: (input: string) =>
        input.length > 0 ||
        "Display name is required for filtering your issues",
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

    config.set("jiraDisplayName", answers.jiraDisplayName)

    console.log(chalk.green("✓ Configuration saved successfully!"))
    console.log(
      chalk.yellow(
        "Note: Make sure you have GitHub CLI (gh) installed and authenticated.",
      ),
    )
  } catch (error) {
    console.error(chalk.red("❌ Error during setup:"), (error as Error).message)
    console.log(
      chalk.yellow(
        "Configuration saved without account ID. You can run setup again to retry.",
      ),
    )
  }
}
