import chalk from "chalk"
import Configstore from "configstore"
import { setJiraEstimate } from "../api"
import { JiraConfig } from "../types"

const config = new Configstore("jira-github-cli")

export async function estimateCommand(
  issueKey: string,
  duration: string,
): Promise<void> {
  if (!config.has("jira")) {
    console.log(
      chalk.red('❌ Please run "jgh setup" first to configure your settings.'),
    )
    return
  }

  const jiraConfig: JiraConfig = config.get("jira")

  try {
    console.log(
      chalk.yellow(`⌛ Setting estimate of ${duration} for ${issueKey}...`),
    )

    await setJiraEstimate({
      url: jiraConfig.url,
      email: jiraConfig.email,
      token: jiraConfig.token,
      issueKey,
      duration,
    })

    console.log(chalk.green(`✅ Estimate set successfully!`))
    console.log(chalk.cyan(`📊 Estimated ${duration} for ${issueKey}`))
  } catch (error) {
    console.error(
      chalk.red("❌ Error setting estimate:"),
      (error as Error).message,
    )
  }
}
