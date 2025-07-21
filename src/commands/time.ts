import chalk from "chalk"
import Configstore from "configstore"
import { logTempoTime } from "../api"
import { JiraConfig } from "../types"

const config = new Configstore("jira-github-cli")

export async function timeCommand(
  issueKey: string,
  duration: string,
  options: { description?: string; date?: string },
): Promise<void> {
  if (!config.has("jira")) {
    console.log(
      chalk.red('❌ Please run "jgh setup" first to configure your settings.'),
    )
    return
  }

  const jiraConfig: JiraConfig = config.get("jira")

  if (!config.has("tempoToken")) {
    console.log(
      chalk.red(
        "❌ No Tempo token found. Please add your Tempo OAuth token to configuration.",
      ),
    )
    return
  }

  const tempoToken = config.get("tempoToken")

  try {
    console.log(chalk.yellow(`⌛ Logging ${duration} to ${issueKey}...`))

    const worklogId = await logTempoTime({
      tempoToken,
      accountId: jiraConfig.accountId!,
      issueKey,
      duration,
      description: options.description || `Work on ${issueKey}`,
      date: options.date,
    })

    console.log(
      chalk.green(`✅ Time logged successfully! Worklog ID: ${worklogId}`),
    )
    console.log(chalk.cyan(`🕒 Logged ${duration} on ${issueKey}`))
  } catch (error) {
    console.error(chalk.red("❌ Error logging time:"), (error as Error).message)
  }
}
