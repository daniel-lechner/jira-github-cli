export interface JiraConfig {
  url: string
  email: string
  token: string
  project: string
  issueType: string
}

export interface CreateIssueOptions {
  description?: string
  type?: string
}

export interface JiraIssuePayload {
  url: string
  email: string
  token: string
  project: string
  title: string
  description: string
  issueType: string
}

export interface JiraIssueResponse {
  key: string
  id: string
  url: string
}

export interface GitHubIssuePayload {
  title: string
  description: string
}
