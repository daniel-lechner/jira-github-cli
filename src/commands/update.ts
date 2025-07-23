import axios from "axios"
import chalk from "chalk"
import Configstore from "configstore"
import {
  compareSyncStatus,
  execAsync,
  listGitHubIssues,
  listJiraIssues,
  parseCommand,
  transitionJiraIssue,
} from "../api"
import { JiraConfig } from "../types"

const config = new Configstore("jira-github-cli")

async function getRepoInfo(): Promise<{ owner: string; name: string } | null> {
  try {
    const { stdout } = await execAsync("gh repo view --json owner,name")
    const repo = JSON.parse(stdout)
    return { owner: repo.owner.login, name: repo.name }
  } catch (error) {
    return null
  }
}

async function createGitHubLabel(
  name: string,
  color: string,
  description: string,
): Promise<boolean> {
  try {
    const repoInfo = await getRepoInfo()
    if (!repoInfo) return false

    await execAsync(
      `gh api repos/${repoInfo.owner}/${repoInfo.name}/labels -f name="${name}" -f color="${color}" -f description="${description}"`,
    )
    return true
  } catch (error: any) {
    if (error.message.includes("already_exists")) {
      return true
    }
    return false
  }
}

async function removeOldPriorityLabels(issueNumber: number): Promise<void> {
  const priorityLabels = ["high-priority", "medium-priority", "low-priority"]

  for (const label of priorityLabels) {
    try {
      await execAsync(`gh issue edit ${issueNumber} --remove-label "${label}"`)
    } catch (error) {
      // Ignore errors if label doesn't exist
    }
  }
}

async function updateJiraIssue(
  jiraConfig: JiraConfig,
  issueKey: string,
  options: any,
): Promise<void> {
  const auth = Buffer.from(`${jiraConfig.email}:${jiraConfig.token}`).toString(
    "base64",
  )

  if (options.status) {
    await transitionJiraIssue(
      jiraConfig.url,
      jiraConfig.email,
      jiraConfig.token,
      issueKey,
      options.status,
    )
    console.log(
      chalk.cyan(
        `🆗 Jira issue ${issueKey} transitioned to "${options.status}"`,
      ),
    )
  }

  if (options.priority) {
    try {
      await axios.put(
        `${jiraConfig.url}/rest/api/3/issue/${issueKey}`,
        {
          fields: {
            priority: { name: options.priority },
          },
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
        },
      )
      console.log(
        chalk.cyan(
          `🚨 Jira issue ${issueKey} priority set to: ${options.priority}`,
        ),
      )
    } catch (error: any) {
      console.log(
        chalk.yellow(`⚠️ Warning updating Jira priority: ${error.message}`),
      )
    }
  }

  if (options.addLabels.length > 0 || options.removeLabels.length > 0) {
    try {
      const issueResponse = await axios.get(
        `${jiraConfig.url}/rest/api/3/issue/${issueKey}?fields=labels`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
        },
      )

      const currentLabels = issueResponse.data.fields.labels || []
      const currentLabelNames = currentLabels.map((label: any) => label.name)

      let updatedLabels = [...currentLabelNames]

      options.addLabels.forEach((label: string) => {
        if (!updatedLabels.includes(label)) {
          updatedLabels.push(label)
        }
      })

      options.removeLabels.forEach((label: string) => {
        updatedLabels = updatedLabels.filter((l) => l !== label)
      })

      const labelObjects = updatedLabels.map((name) => ({ name }))

      await axios.put(
        `${jiraConfig.url}/rest/api/3/issue/${issueKey}`,
        {
          fields: {
            labels: labelObjects,
          },
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
        },
      )

      if (options.addLabels.length > 0) {
        console.log(
          chalk.cyan(
            `🏷️  Added labels to Jira: ${options.addLabels.join(", ")}`,
          ),
        )
      }
      if (options.removeLabels.length > 0) {
        console.log(
          chalk.cyan(
            `🗑️  Removed labels from Jira: ${options.removeLabels.join(", ")}`,
          ),
        )
      }
    } catch (error: any) {
      // console.log(
      //   chalk.yellow(`⚠️ Warning updating Jira labels: ${error.message}`),
      // )
    }
  }

  if (options.assignMe || options.unassign) {
    try {
      const assigneeValue = options.unassign
        ? null
        : { accountId: jiraConfig.accountId }

      await axios.put(
        `${jiraConfig.url}/rest/api/3/issue/${issueKey}`,
        {
          fields: {
            assignee: assigneeValue,
          },
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
        },
      )

      if (options.assignMe) {
        console.log(chalk.cyan(`👤 Assigned Jira issue ${issueKey} to you`))
      } else {
        console.log(chalk.cyan(`👤 Unassigned Jira issue ${issueKey}`))
      }
    } catch (error: any) {
      console.log(
        chalk.yellow(`⚠️ Warning updating Jira assignee: ${error.message}`),
      )
    }
  }
}

async function updateGitHubIssue(
  issueNumber: number,
  options: any,
): Promise<void> {
  try {
    let labelsToAdd = [...options.addLabels]
    let priorityLabel = ""

    if (options.priority) {
      console.log(chalk.gray("Removing old priority labels..."))
      await removeOldPriorityLabels(issueNumber)

      if (options.priority === "Express" || options.priority === "High") {
        priorityLabel = "high-priority"
        await createGitHubLabel(
          "high-priority",
          "d73a4a",
          "High priority issue",
        )
      } else if (options.priority === "Medium") {
        priorityLabel = "medium-priority"
        await createGitHubLabel(
          "medium-priority",
          "fbca04",
          "Medium priority issue",
        )
      } else if (options.priority === "Low") {
        priorityLabel = "low-priority"
        await createGitHubLabel("low-priority", "0e8a16", "Low priority issue")
      }

      if (priorityLabel) {
        labelsToAdd.push(priorityLabel)
      }
    }

    for (const label of options.addLabels) {
      await createGitHubLabel(label, "d73a4a", "Auto-created label")
    }

    if (labelsToAdd.length > 0) {
      for (const label of labelsToAdd) {
        try {
          await execAsync(`gh issue edit ${issueNumber} --add-label "${label}"`)
          console.log(chalk.cyan(`🏷️  Added label to GitHub: ${label}`))
        } catch (error: any) {
          console.log(
            chalk.yellow(
              `⚠️ Warning adding label "${label}": ${error.message}`,
            ),
          )
        }
      }
    }

    if (options.removeLabels.length > 0) {
      for (const label of options.removeLabels) {
        try {
          await execAsync(
            `gh issue edit ${issueNumber} --remove-label "${label}"`,
          )
          console.log(chalk.cyan(`🗑️  Removed label from GitHub: ${label}`))
        } catch (error: any) {
          console.log(
            chalk.yellow(
              `⚠️ Warning removing label "${label}": ${error.message}`,
            ),
          )
        }
      }
    }

    if (options.assignMe) {
      try {
        await execAsync(`gh issue edit ${issueNumber} --add-assignee @me`)
        console.log(
          chalk.cyan(`👤 Assigned GitHub issue #${issueNumber} to you`),
        )
      } catch (error: any) {
        console.log(
          chalk.yellow(`⚠️ Warning assigning issue: ${error.message}`),
        )
      }
    }

    if (options.unassign) {
      try {
        await execAsync(`gh issue edit ${issueNumber} --remove-assignee @me`)
        console.log(chalk.cyan(`👤 Unassigned GitHub issue #${issueNumber}`))
      } catch (error: any) {
        console.log(
          chalk.yellow(`⚠️ Warning unassigning issue: ${error.message}`),
        )
      }
    }

    if (
      options.status &&
      (options.status.toLowerCase() === "closed" ||
        options.status.toLowerCase() === "rejected" ||
        options.status.toLowerCase() === "done" ||
        options.status.toLowerCase() === "completed" ||
        options.status.toLowerCase() === "resolved" ||
        options.status.toLowerCase() === "finished")
    ) {
      try {
        await execAsync(`gh issue close ${issueNumber}`)
        console.log(chalk.cyan(`🔒 Closed GitHub issue #${issueNumber}`))
      } catch (error: any) {
        console.log(chalk.yellow(`⚠️ Warning closing issue: ${error.message}`))
      }
    }
  } catch (error: any) {
    console.log(
      chalk.yellow(`⚠️ Warning updating GitHub issue: ${error.message}`),
    )
  }
}

export async function updateCommand(
  issueKey: string,
  updateString: string,
): Promise<void> {
  if (!config.has("jira")) {
    console.log(
      chalk.red('❌ Please run "jgh setup" first to configure your settings.'),
    )
    return
  }

  const jiraConfig: JiraConfig = config.get("jira")
  const options = parseCommand(updateString)

  if (
    !options.status &&
    !options.priority &&
    options.addLabels.length === 0 &&
    options.removeLabels.length === 0 &&
    !options.assignMe &&
    !options.unassign
  ) {
    console.log(
      chalk.yellow(
        "No updates specified. Use (status), !priority, +label, -label, @me, or @unassign",
      ),
    )
    return
  }

  try {
    console.log(chalk.yellow(`⌛ Updating issue ${issueKey}...`))

    const normalizedIssueKey = issueKey.toUpperCase()

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
    const syncedIssue = syncStatuses.find(
      (s) => s.jiraKey === normalizedIssueKey && s.status === "synced",
    )

    await updateJiraIssue(jiraConfig, normalizedIssueKey, options)

    if (syncedIssue?.githubIssue) {
      await updateGitHubIssue(syncedIssue.githubIssue.number, options)
    } else {
      console.log(
        chalk.yellow(
          `⚠️ No synced GitHub issue found for ${normalizedIssueKey}`,
        ),
      )
    }

    console.log(
      chalk.green(`✅ Issue ${normalizedIssueKey} updated successfully!`),
    )
  } catch (error) {
    console.error(
      chalk.red("❌ Error updating issue:"),
      (error as Error).message,
    )
  }
}
