export interface JiraConfig {
  url: string
  email: string
  token: string
  project: string
  issueType: string
  accountId?: string
}

export interface CreateIssueOptions {
  description?: string
  type?: string
  assignMe?: boolean
  labels?: string
  status?: string
}

export interface JiraIssuePayload {
  url: string
  email: string
  token: string
  project: string
  title: string
  description: string
  issueType: string
  assignee?: string
  priority?: string
}

export interface JiraIssueResponse {
  key: string
  id: string
  url: string
}

export interface GitHubIssuePayload {
  title: string
  description: string
  assignMe?: boolean
  labels?: string[]
}

export interface ParsedTitle {
  cleanTitle: string
  assignMe: boolean
  labels: string[]
  status?: string
  priority?: string
}

export interface ParsedCommand {
  cleanTitle: string
  assignMe: boolean
  unassign: boolean
  addLabels: string[]
  removeLabels: string[]
  status?: string
  priority?: string
}

export interface JiraIssue {
  key: string
  summary: string
  status: string
  assignee?: string
  labels: string[]
  url: string
}

export interface GitHubIssue {
  number: number
  title: string
  state: string
  assignee?: string
  labels: string[]
  url: string
  jiraKey?: string
}

export interface SyncStatus {
  jiraKey: string
  title: string
  labels: string[]
  status: "synced" | "jira-only" | "github-only"
  jiraIssue?: JiraIssue
  githubIssue?: GitHubIssue
}
