variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "service_name" {
  type = string
}

variable "image" {
  description = "Full Artifact Registry image path, including tag/digest. Promoted (not rebuilt) across environments per docs/08-INFRA-DEPLOYMENT.md §4."
  type        = string
}

variable "service_account_email" {
  type = string
}

variable "min_instances" {
  description = "0 in dev/staging (scale-to-zero), 1 in prod to avoid cold starts (docs/08-INFRA-DEPLOYMENT.md §2)."
  type        = number
  default     = 0
}

variable "max_instances" {
  type    = number
  default = 5
}

variable "env_vars" {
  description = "Plain (non-secret) environment variables."
  type        = map(string)
  default     = {}
}

variable "secret_env_vars" {
  description = "Env var name -> { secret_id, version } for bootstrap-only secrets injected from Secret Manager (docs/01-ARCHITECTURE.md §2.9a — DB creds, JWT signing key, OAuth client secret only)."
  type = map(object({
    secret_id = string
    version   = optional(string, "latest")
  }))
  default = {}
}

variable "allow_unauthenticated" {
  description = "True for the public API/web entrypoint; the API itself still enforces auth via JWT (docs/03-RBAC-AUTH.md), Cloud Run ingress is just network-level."
  type        = bool
  default     = true
}

variable "cloudsql_instance_connection_name" {
  description = "Set to attach a Cloud SQL Auth Proxy sidecar connection; empty to skip."
  type        = string
  default     = ""
}
