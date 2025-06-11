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
}
