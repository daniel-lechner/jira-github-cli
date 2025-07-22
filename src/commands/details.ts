import chalk from "chalk"
import Configstore from "configstore"
import {
  getJiraIssueTimeTracking,
  getTempoWorklogsForIssue,
  listGitHubIssues,
  listJiraIssues,
} from "../api"
import { JiraConfig } from "../types"

const config = new Configstore("jira-github-cli")

function formatTimeFromSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}min`
  } else if (hours > 0) {
    return `${hours}h`
  } else {
    return `${minutes}min`
  }
}

function parseJiraTimeToSeconds(jiraTime: string): number {
  if (!jiraTime) return 0

  let totalSeconds = 0
  const hourMatch = jiraTime.match(/(\d+)h/)
  const minuteMatch = jiraTime.match(/(\d+)m/)

  if (hourMatch) {
    totalSeconds += parseInt(hourMatch[1]) * 3600
  }
  if (minuteMatch) {
    totalSeconds += parseInt(minuteMatch[1]) * 60
  }

  return totalSeconds
}

export async function detailsCommand(issueKey: string): Promise<void> {
  if (!config.has("jira")) {
    console.log(
      chalk.red('❌ Please run "jgh setup" first to configure your settings.'),
    )
    return
  }

  const jiraConfig: JiraConfig = config.get("jira")
  const tempoToken = config.get("tempoToken")

  try {
    console.log(chalk.cyan(`⌛ Fetching details for ${issueKey}...`))

    const [jiraIssues, githubIssues] = await Promise.all([
      listJiraIssues(
        jiraConfig.url,
        jiraConfig.email,
        jiraConfig.token,
        jiraConfig.project,
      ),
      listGitHubIssues(),
    ])

    const jiraIssue = jiraIssues.find((issue) => issue.key === issueKey)
    const githubIssue = githubIssues.find((issue) => issue.jiraKey === issueKey)

    if (!jiraIssue) {
      console.log(chalk.red(`❌ Jira issue ${issueKey} not found`))
      return
    }

    console.log(chalk.cyan(`\n📋 Issue Details: ${issueKey}\n`))

    console.log(chalk.cyan("Title: ") + chalk.white(jiraIssue.summary))
    console.log(chalk.cyan("Status: ") + chalk.white(jiraIssue.status))
    console.log(
      chalk.cyan("Assignee: ") +
        chalk.white(jiraIssue.assignee || "Unassigned"),
    )

    if (jiraIssue.labels.length > 0) {
      console.log(
        chalk.cyan("Labels: ") + chalk.white(jiraIssue.labels.join(", ")),
      )
    }

    console.log(chalk.cyan("Jira URL: ") + chalk.gray(jiraIssue.url))

    if (githubIssue) {
      console.log(chalk.green(`\n🔗 Linked GitHub Issue:`))
      console.log(
        chalk.green("   Number: ") + chalk.white(`#${githubIssue.number}`),
      )
      console.log(chalk.green("   State: ") + chalk.white(githubIssue.state))
      console.log(chalk.green("   URL: ") + chalk.gray(githubIssue.url))

      if (githubIssue.labels.length > 0) {
        console.log(
          chalk.green("  GitHub Labels: ") +
            chalk.white(githubIssue.labels.join(", ")),
        )
      }
    } else {
      console.log(chalk.yellow(`\n⚠️  No linked GitHub issue found`))
    }

    if (tempoToken) {
      try {
        const [timeTracking, tempoWorklogs] = await Promise.all([
          getJiraIssueTimeTracking(
            jiraConfig.url,
            jiraConfig.email,
            jiraConfig.token,
            issueKey,
          ),
          getTempoWorklogsForIssue(tempoToken, issueKey),
        ])

        console.log(chalk.magenta(`\n⏱️  Time Tracking:`))

        const estimateSeconds = parseJiraTimeToSeconds(
          timeTracking.originalEstimate || "",
        )
        const loggedSeconds = tempoWorklogs.reduce(
          (total, log) => total + log.timeSpentSeconds,
          0,
        )

        if (estimateSeconds > 0) {
          console.log(
            chalk.magenta("    Original Estimate: ") +
              chalk.white(formatTimeFromSeconds(estimateSeconds)),
          )
        } else {
          console.log(
            chalk.magenta("    Original Estimate: ") + chalk.gray("Not set"),
          )
        }

        if (loggedSeconds > 0) {
          console.log(
            chalk.magenta("    Time Logged: ") +
              chalk.white(formatTimeFromSeconds(loggedSeconds)),
          )
        } else {
          console.log(chalk.magenta("    Time Logged: ") + chalk.gray("None"))
        }

        if (estimateSeconds > 0 && loggedSeconds > 0) {
          const diff =
            ((loggedSeconds - estimateSeconds) / estimateSeconds) * 100
          const remaining = estimateSeconds - loggedSeconds

          let trendIcon = "🆗"
          let statusText = "On track"

          if (diff > 5) {
            trendIcon = "📈"
            statusText = `Over estimate by ${Math.round(diff)}%`
          } else if (diff < -5) {
            trendIcon = "📉"
            statusText = `Under estimate by ${Math.abs(Math.round(diff))}%`
          }

          console.log(
            chalk.magenta("  Status: ") +
              chalk.white(`${trendIcon} ${statusText}`),
          )

          if (remaining > 0) {
            console.log(
              chalk.magenta("  Remaining: ") +
                chalk.white(formatTimeFromSeconds(remaining)),
            )
          } else {
            console.log(
              chalk.magenta("  Over by: ") +
                chalk.red(formatTimeFromSeconds(Math.abs(remaining))),
            )
          }
        }

        if (tempoWorklogs.length > 0) {
          console.log(
            chalk.yellow(`\n📊 Work Logs (${tempoWorklogs.length} entries):`),
          )
          tempoWorklogs.slice(0, 5).forEach((log, index) => {
            console.log(
              chalk.yellow("  " + (index + 1) + ". ") +
                chalk.white(formatTimeFromSeconds(log.timeSpentSeconds)),
            )
          })

          if (tempoWorklogs.length > 5) {
            console.log(
              chalk.gray(`  ... and ${tempoWorklogs.length - 5} more entries`),
            )
          }
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Could not fetch time tracking data`))
      }
    } else {
      console.log(
        chalk.gray(
          `\n⚠️  Tempo token not configured - time tracking unavailable`,
        ),
      )
    }
  } catch (error) {
    console.error(
      chalk.red("❌ Error fetching issue details:"),
      (error as Error).message,
    )
  }
}
