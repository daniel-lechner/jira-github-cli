import axios from "axios"
import { exec } from "child_process"
import { promisify } from "util"
import {
  GitHubIssue,
  GitHubIssuePayload,
  JiraIssue,
  JiraIssuePayload,
  JiraIssueResponse,
  ParsedCommand,
  ParsedTitle,
  SyncStatus,
} from "./types"

const execAsync = promisify(exec)

export function parseCommand(input: string): ParsedCommand {
  let cleanInput = input
  const result: ParsedCommand = {
    cleanTitle: input,
    assignMe: false,
    unassign: false,
    addLabels: [],
    removeLabels: [],
  }

  const assignRegex = /@me/g
  if (assignRegex.test(cleanInput)) {
    result.assignMe = true
    cleanInput = cleanInput.replace(assignRegex, "").trim()
  }

  const unassignRegex = /@unassign/g
  if (unassignRegex.test(cleanInput)) {
    result.unassign = true
    cleanInput = cleanInput.replace(unassignRegex, "").trim()
  }

  const addLabelRegex = /\+(\w+)/g
  let addLabelMatch
  while ((addLabelMatch = addLabelRegex.exec(cleanInput)) !== null) {
    result.addLabels.push(addLabelMatch[1])
  }
  cleanInput = cleanInput.replace(/\+\w+/g, "").trim()

  const removeLabelRegex = /-(\w+)/g
  let removeLabelMatch
  while ((removeLabelMatch = removeLabelRegex.exec(cleanInput)) !== null) {
    result.removeLabels.push(removeLabelMatch[1])
  }
  cleanInput = cleanInput.replace(/-\w+/g, "").trim()

  const statusRegex = /\(([^)]+)\)/
  const statusMatch = cleanInput.match(statusRegex)
  if (statusMatch) {
    result.status = statusMatch[1]
    cleanInput = cleanInput.replace(statusRegex, "").trim()
  }

  const priorityRegex = /!(asap|high|medium|low)/i
  const priorityMatch = cleanInput.match(priorityRegex)
  if (priorityMatch) {
    const priorityValue = priorityMatch[1].toLowerCase()
    switch (priorityValue) {
      case "asap":
        result.priority = "Express"
        break
      case "high":
        result.priority = "High"
        break
      case "medium":
        result.priority = "Medium"
        break
      case "low":
        result.priority = "Low"
        break
    }
    cleanInput = cleanInput.replace(priorityRegex, "").trim()
  }

  result.cleanTitle = cleanInput
  return result
}

export function parseTitle(title: string): ParsedTitle {
  const parsed = parseCommand(title)
  return {
    cleanTitle: parsed.cleanTitle,
    assignMe: parsed.assignMe,
    labels: parsed.addLabels,
    status: parsed.status,
    priority: parsed.priority,
  }
}

export async function getUserAccountId(
  url: string,
  email: string,
  token: string,
): Promise<string> {
  const auth = Buffer.from(`${email}:${token}`).toString("base64")

  try {
    const response = await axios.get(
      `${url}/rest/api/3/user/search?query=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      },
    )

    if (response.data.length > 0) {
      return response.data[0].accountId
    } else {
      throw new Error("User not found")
    }
  } catch (error: any) {
    throw new Error(
      `Failed to get user account ID: ${
        error.response?.data?.errorMessages?.[0] || error.message
      }`,
    )
  }
}

export async function transitionJiraIssue(
  url: string,
  email: string,
  token: string,
  issueKey: string,
  status: string,
): Promise<void> {
  const auth = Buffer.from(`${email}:${token}`).toString("base64")

  try {
    const transitionsResponse = await axios.get(
      `${url}/rest/api/3/issue/${issueKey}/transitions`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      },
    )

    const transitions = transitionsResponse.data.transitions
    const transition = transitions.find(
      (t: any) => t.name.toLowerCase() === status.toLowerCase(),
    )

    if (!transition) {
      throw new Error(
        `Transition "${status}" not found. Available transitions: ${transitions
          .map((t: any) => t.name)
          .join(", ")}`,
      )
    }

    await axios.post(
      `${url}/rest/api/3/issue/${issueKey}/transitions`,
      {
        transition: {
          id: transition.id,
        },
      },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      },
    )
  } catch (error: any) {
    throw new Error(
      `Failed to transition issue: ${
        error.response?.data?.errorMessages?.[0] || error.message
      }`,
    )
  }
}

export async function createJiraIssue(
  payload: JiraIssuePayload,
): Promise<JiraIssueResponse> {
  const auth = Buffer.from(`${payload.email}:${payload.token}`).toString(
    "base64",
  )

  const requestPayload: any = {
    fields: {
      project: { key: payload.project },
      summary: payload.title,
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: payload.description || payload.title,
              },
            ],
          },
        ],
      },
      issuetype: { name: payload.issueType },
    },
  }

  if (payload.assignee) {
    requestPayload.fields.assignee = { accountId: payload.assignee }
  }

  if (payload.priority) {
    requestPayload.fields.priority = { name: payload.priority }
  }

  try {
    const response = await axios.post(
      `${payload.url}/rest/api/3/issue`,
      requestPayload,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      },
    )

    return {
      key: response.data.key,
      id: response.data.id,
      url: `${payload.url}/browse/${response.data.key}`,
    }
  } catch (error: any) {
    throw new Error(
      `Failed to create Jira issue: ${
        error.response?.data?.errorMessages?.[0] || error.message
      }`,
    )
  }
}

export async function createGitHubIssue(
  payload: GitHubIssuePayload,
): Promise<string> {
  try {
    await execAsync("gh --version")

    let command = `gh issue create --title "${payload.title}" --body "${payload.description}"`

    if (payload.assignMe) {
      command += " --assignee @me"
    }

    if (payload.labels && payload.labels.length > 0) {
      command += ` --label "${payload.labels.join(",")}"`
    }

    const { stdout } = await execAsync(command)
    const issueUrl = stdout.trim()
    return issueUrl
  } catch (error: any) {
    if (error.message.includes("gh: command not found")) {
      throw new Error(
        "GitHub CLI (gh) is not installed. Please install it from https://cli.github.com/",
      )
    }
    throw new Error(`Failed to create GitHub issue: ${error.message}`)
  }
}

export async function listJiraIssues(
  url: string,
  email: string,
  token: string,
  project: string,
): Promise<JiraIssue[]> {
  const auth = Buffer.from(`${email}:${token}`).toString("base64")

  try {
    const response = await axios.get(
      `${url}/rest/api/3/search?jql=project=${project} AND resolution=Unresolved&fields=key,summary,status,assignee,labels&maxResults=1000`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      },
    )

    return response.data.issues.map((issue: any) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      assignee: issue.fields.assignee?.displayName,
      labels: issue.fields.labels?.map((label: any) => label.name) || [],
      url: `${url}/browse/${issue.key}`,
    }))
  } catch (error: any) {
    throw new Error(
      `Failed to fetch Jira issues: ${
        error.response?.data?.errorMessages?.[0] || error.message
      }`,
    )
  }
}

export async function listGitHubIssues(): Promise<GitHubIssue[]> {
  try {
    await execAsync("gh --version")

    const { stdout } = await execAsync(
      "gh issue list --state open --json number,title,state,assignees,labels,url --limit 1000",
    )

    const issues = JSON.parse(stdout)

    return issues.map((issue: any) => {
      const jiraKeyMatch = issue.title.match(/([A-Z]+-\d+)/)

      return {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        assignee: issue.assignees?.[0]?.login,
        labels: issue.labels?.map((label: any) => label.name) || [],
        url: issue.url,
        jiraKey: jiraKeyMatch ? jiraKeyMatch[1] : undefined,
      }
    })
  } catch (error: any) {
    if (error.message.includes("gh: command not found")) {
      throw new Error(
        "GitHub CLI (gh) is not installed. Please install it from https://cli.github.com/",
      )
    }
    throw new Error(`Failed to fetch GitHub issues: ${error.message}`)
  }
}

export function compareSyncStatus(
  jiraIssues: JiraIssue[],
  githubIssues: GitHubIssue[],
): SyncStatus[] {
  const statusMap = new Map<string, SyncStatus>()

  jiraIssues.forEach((jiraIssue) => {
    statusMap.set(jiraIssue.key, {
      jiraKey: jiraIssue.key,
      title: jiraIssue.summary,
      labels: jiraIssue.labels,
      status: "jira-only",
      jiraIssue,
    })
  })

  githubIssues.forEach((githubIssue) => {
    if (githubIssue.jiraKey) {
      const existing = statusMap.get(githubIssue.jiraKey)
      if (existing) {
        existing.status = "synced"
        existing.githubIssue = githubIssue
      } else {
        statusMap.set(githubIssue.jiraKey, {
          jiraKey: githubIssue.jiraKey,
          title: githubIssue.title,
          labels: githubIssue.labels,
          status: "github-only",
          githubIssue,
        })
      }
    }
  })

  return Array.from(statusMap.values()).sort((a, b) =>
    a.jiraKey.localeCompare(b.jiraKey),
  )
}

export { execAsync }
