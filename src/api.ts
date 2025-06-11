import axios from "axios"
import { exec } from "child_process"
import { promisify } from "util"
import {
  GitHubIssuePayload,
  JiraIssuePayload,
  JiraIssueResponse,
  ParsedTitle,
} from "./types"

const execAsync = promisify(exec)

export function parseTitle(title: string): ParsedTitle {
  let cleanTitle = title
  let assignMe = false
  const labels: string[] = []
  let status: string | undefined

  const assignRegex = /@me/g
  if (assignRegex.test(cleanTitle)) {
    assignMe = true
    cleanTitle = cleanTitle.replace(assignRegex, "").trim()
  }

  const labelRegex = /#(\w+)/g
  let labelMatch
  while ((labelMatch = labelRegex.exec(cleanTitle)) !== null) {
    labels.push(labelMatch[1])
  }
  cleanTitle = cleanTitle.replace(labelRegex, "").trim()

  const statusRegex = /\(([^)]+)\)/
  const statusMatch = cleanTitle.match(statusRegex)
  if (statusMatch) {
    status = statusMatch[1]
    cleanTitle = cleanTitle.replace(statusRegex, "").trim()
  }

  return { cleanTitle, assignMe, labels, status }
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
