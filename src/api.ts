import axios from "axios"
import { exec } from "child_process"
import { promisify } from "util"
import {
  GitHubIssuePayload,
  JiraIssuePayload,
  JiraIssueResponse,
} from "./types"

const execAsync = promisify(exec)

export async function createJiraIssue(
  payload: JiraIssuePayload,
): Promise<JiraIssueResponse> {
  const auth = Buffer.from(`${payload.email}:${payload.token}`).toString(
    "base64",
  )

  const requestPayload = {
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
    // Check if gh CLI is available
    await execAsync("gh --version")

    // Create the issue using GitHub CLI
    const command = `gh issue create --title "${payload.title}" --body "${payload.description}"`
    const { stdout } = await execAsync(command)

    return stdout.trim()
  } catch (error: any) {
    if (error.message.includes("gh: command not found")) {
      throw new Error(
        "GitHub CLI (gh) is not installed. Please install it from https://cli.github.com/",
      )
    }
    throw new Error(`Failed to create GitHub issue: ${error.message}`)
  }
}
