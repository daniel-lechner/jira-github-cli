import chalk from "chalk"
import Configstore from "configstore"
import {
  compareSyncStatus,
  getJiraIssueTimeTracking,
  getTempoWorklogsForIssue,
  getUserAccountId,
  listGitHubIssues,
  listJiraIssues,
} from "../api"
import { JiraConfig } from "../types"

const config = new Configstore("jira-github-cli")

function formatTimeFromSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0 && minutes > 0) {
    return `${hours}h${minutes}min`
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

export async function listCommand(filterMine: boolean = false): Promise<void> {
  if (!config.has("jira")) {
    console.log(
      chalk.red('❌ Please run "jgh setup" first to configure your settings.'),
    )
    return
  }

  const jiraConfig: JiraConfig = config.get("jira")
  const tempoToken = config.get("tempoToken")

  try {
    console.log(chalk.cyan("⌛ Fetching issues from Jira and GitHub..."))

    const [jiraIssues, githubIssues] = await Promise.all([
      listJiraIssues(
        jiraConfig.url,
        jiraConfig.email,
        jiraConfig.token,
        jiraConfig.project,
      ),
      listGitHubIssues(),
    ])

    const syncStatuses = compareSyncStatus(jiraIssues, githubIssues)

    let currentUserAccountId: string | undefined
    try {
      currentUserAccountId =
        jiraConfig.accountId ||
        (await getUserAccountId(
          jiraConfig.url,
          jiraConfig.email,
          jiraConfig.token,
        ))
    } catch (error) {
      currentUserAccountId = undefined
    }

    const jiraDisplayName = config.get("jiraDisplayName") || "me"

    let filteredStatuses = syncStatuses
    if (filterMine) {
      filteredStatuses = syncStatuses.filter((s) => {
        const jiraAssignedToMe =
          s.jiraIssue?.assignee === jiraDisplayName ||
          s.jiraIssue?.assignee
            ?.toLowerCase()
            .includes(jiraDisplayName.toLowerCase())
        const githubAssignedToMe =
          s.githubIssue?.assignee === "me" ||
          (s.githubIssue?.assignee && s.githubIssue?.assignee !== "")
        return jiraAssignedToMe || githubAssignedToMe
      })
    }

    if (filteredStatuses.length === 0) {
      if (filterMine) {
        console.log(chalk.yellow("No issues assigned to you found."))
      } else {
        console.log(chalk.yellow("No open issues found."))
      }
      return
    }

    const headerText = filterMine ? "📋 My Issues:" : "📋 Open Issues Status:"
    console.log(chalk.cyan(`\n${headerText}\n`))

    for (const item of filteredStatuses) {
      let icon: string
      let color: any
      let statusText: string

      switch (item.status) {
        case "synced":
          icon = "🔄"
          color = chalk.green
          statusText = "synced to both"
          break
        case "github-only":
          icon = "💻"
          color = chalk.white
          statusText = "GitHub only"
          break
        case "jira-only":
          icon = "🗂️"
          color = chalk.yellowBright
          statusText = "Jira only"
          break
      }

      const labels = item.labels.length > 0 ? ` +${item.labels.join(" +")}` : ""
      const truncatedTitle =
        item.title.length > 50
          ? item.title.substring(0, 47) + "..."
          : item.title

      let assigneeInfo = ""
      if (!filterMine) {
        const jiraAssignee = item.jiraIssue?.assignee
        const githubAssignee = item.githubIssue?.assignee

        if (jiraAssignee || githubAssignee) {
          const isJiraAssignedToMe =
            jiraAssignee === jiraDisplayName ||
            (jiraAssignee &&
              jiraAssignee
                .toLowerCase()
                .includes(jiraDisplayName.toLowerCase()))
          const isGithubAssignedToMe =
            githubAssignee === "me" || (githubAssignee && githubAssignee !== "")

          if (isJiraAssignedToMe || isGithubAssignedToMe) {
            assigneeInfo = " " + chalk.cyan("👤@me")
          } else if (jiraAssignee) {
            assigneeInfo = " " + chalk.cyan(`👤@${jiraAssignee.split(" ")[0]}`)
          } else if (githubAssignee) {
            assigneeInfo = " " + chalk.cyan(`👤@${githubAssignee}`)
          }
        }
      } else {
        assigneeInfo = " " + chalk.cyan("👤@me")
      }

      let timeInfo = ""
      if (tempoToken && item.jiraIssue) {
        try {
          const [timeTracking, tempoWorklogs] = await Promise.all([
            getJiraIssueTimeTracking(
              jiraConfig.url,
              jiraConfig.email,
              jiraConfig.token,
              item.jiraKey,
            ),
            getTempoWorklogsForIssue(tempoToken, item.jiraKey),
          ])

          const estimateSeconds = parseJiraTimeToSeconds(
            timeTracking.originalEstimate || "",
          )
          const loggedSeconds = tempoWorklogs.reduce(
            (total, log) => total + log.timeSpentSeconds,
            0,
          )

          if (estimateSeconds > 0 || loggedSeconds > 0) {
            const loggedTime =
              loggedSeconds > 0 ? formatTimeFromSeconds(loggedSeconds) : "0min"
            const estimatedTime =
              estimateSeconds > 0
                ? formatTimeFromSeconds(estimateSeconds)
                : "0min"

            let trendIcon = "🆗"
            let percentage = ""

            if (loggedSeconds === 0 && estimateSeconds > 0) {
              trendIcon = "⏱️"
              percentage = ""
            } else if (estimateSeconds > 0 && loggedSeconds > 0) {
              const diff =
                ((loggedSeconds - estimateSeconds) / estimateSeconds) * 100
              if (diff > 5) {
                trendIcon = "📈"
                percentage = ` +${Math.round(diff)}%`
              } else if (diff < -5) {
                trendIcon = "📉"
                percentage = ` ${Math.round(diff)}%`
              } else {
                percentage = " 0%"
              }
            }

            timeInfo =
              " — " +
              chalk.yellow(`${loggedTime}/${estimatedTime}`) +
              ` ${trendIcon}${percentage}`
          }
        } catch (error) {}
      }

      console.log(
        `${color(icon)} ${color(item.jiraKey)} ${chalk.gray(
          truncatedTitle,
        )}${labels}${assigneeInfo}${timeInfo}`,
      )
    }

    if (filterMine) {
      const syncedCount = filteredStatuses.filter(
        (s) => s.status === "synced",
      ).length
      const jiraOnlyCount = filteredStatuses.filter(
        (s) => s.status === "jira-only",
      ).length
      const githubOnlyCount = filteredStatuses.filter(
        (s) => s.status === "github-only",
      ).length

      console.log(
        chalk.gray(
          `\n📊 My Issues: ${filteredStatuses.length} total (${syncedCount} synced, ${jiraOnlyCount} Jira-only, ${githubOnlyCount} GitHub-only)`,
        ),
      )
    } else {
      const syncedCount = syncStatuses.filter(
        (s) => s.status === "synced",
      ).length
      const jiraOnlyCount = syncStatuses.filter(
        (s) => s.status === "jira-only",
      ).length
      const githubOnlyCount = syncStatuses.filter(
        (s) => s.status === "github-only",
      ).length
      const jiraDisplayName = config.get("jiraDisplayName") || "me"
      const assignedToMeCount = syncStatuses.filter((s) => {
        const jiraAssignedToMe =
          s.jiraIssue?.assignee === jiraDisplayName ||
          (s.jiraIssue?.assignee &&
            s.jiraIssue?.assignee
              .toLowerCase()
              .includes(jiraDisplayName.toLowerCase()))
        const githubAssignedToMe =
          s.githubIssue?.assignee === "me" ||
          (s.githubIssue?.assignee && s.githubIssue?.assignee !== "")
        return jiraAssignedToMe || githubAssignedToMe
      }).length

      console.log(
        chalk.gray(
          `\n📊 Summary: ${syncedCount} synced, ${jiraOnlyCount} Jira-only, ${githubOnlyCount} GitHub-only, ${assignedToMeCount} assigned to me`,
        ),
      )
    }
  } catch (error) {
    console.error(
      chalk.red("❌ Error fetching issues:"),
      (error as Error).message,
    )
  }
}
