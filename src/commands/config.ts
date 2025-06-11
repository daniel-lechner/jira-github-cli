import chalk from "chalk"
import Configstore from "configstore"
import { JiraConfig } from "../types"

const config = new Configstore("jira-github-cli")

export function configCommand(): void {
  if (!config.has("jira")) {
    console.log(chalk.yellow('No configuration found. Run "jgh setup" first.'))
    return
  }

  const jiraConfig: JiraConfig = config.get("jira")
  const jiraDisplayName = config.get("jiraDisplayName")
  console.log(chalk.blue("Current configuration:"))
  console.log(`Jira URL: ${jiraConfig.url}`)
  console.log(`Jira Email: ${jiraConfig.email}`)
  console.log(`Jira Project: ${jiraConfig.project}`)
  console.log(`Default Issue Type: ${jiraConfig.issueType}`)
  console.log(`API Token: ${"*".repeat(jiraConfig.token.length)}`)
  console.log(`Account ID: ${jiraConfig.accountId || "Not set"}`)
  console.log(`Jira Display Name: ${jiraDisplayName || "Not set"}`)
}
