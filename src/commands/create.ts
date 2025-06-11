import chalk from "chalk"
import Configstore from "configstore"
import {
  createGitHubIssue,
  createJiraIssue,
  parseTitle,
  transitionJiraIssue,
} from "../api"
import { CreateIssueOptions, JiraConfig } from "../types"

const config = new Configstore("jira-github-cli")

export async function createCommand(
  title: string,
  options: CreateIssueOptions,
): Promise<void> {
  if (!config.has("jira")) {
    console.log(
      chalk.red('❌ Please run "jgh setup" first to configure your settings.'),
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
      priority: parsed.priority,
    })

    console.log(chalk.cyan(`🆗 Jira issue created: ${jiraIssue.key}`))

    if (parsed.priority) {
      console.log(chalk.cyan(`🚨 Priority set to: ${parsed.priority}`))
    }

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
        console.log(chalk.cyan(`🆗 Issue transitioned to "${status}"`))
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
      githubDescription += `\n\nLabels: ${labels.map((l) => `+${l}`).join(" ")}`
    }

    if (parsed.priority) {
      githubDescription += `\n\nPriority: ${parsed.priority}`
      if (parsed.priority === "Express" || parsed.priority === "High") {
        labels.push("priority-high")
      } else if (parsed.priority === "Medium") {
        labels.push("priority-medium")
      } else if (parsed.priority === "Low") {
        labels.push("priority-low")
      }
    }

    const githubIssueUrl = await createGitHubIssue({
      title: githubTitle,
      description: githubDescription,
      assignMe: assignMe,
      labels: labels,
    })

    console.log(
      chalk.cyan(`🆗 GitHub issue created with title: "${githubTitle}"`),
    )
    console.log(
      chalk.green(
        `🔗 JIRA issue:     ${jiraConfig.url}/browse/${jiraIssue.key}`,
      ),
    )
    console.log(chalk.green(`🔗 GITHUB issue:   ${githubIssueUrl}`))

    if (labels.length > 0) {
      console.log(chalk.cyan(`🏷️  Applied labels: ${labels.join(", ")}`))
    }
    if (assignMe) {
      console.log(chalk.cyan(`👤 Assigned to you`))
    }
  } catch (error) {
    console.error(
      chalk.red("❌ Error creating issues:"),
      (error as Error).message,
    )
  }
}
