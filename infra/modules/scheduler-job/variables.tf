variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "name" {
  type = string
}

variable "schedule" {
  description = "Standard cron expression, e.g. \"*/15 * * * *\" for the report-aggregate refresh (docs/05-FEATURES.md §3.6)."
  type        = string
}

variable "target_uri" {
  description = "HTTPS endpoint on the Cloud Run API this job calls (e.g. an internal /internal/jobs/* route)."
  type        = string
}

variable "http_method" {
  type    = string
  default = "POST"
}

variable "service_account_email" {
  description = "Invokes the target Cloud Run service with an OIDC token — same service account pattern used for other authenticated internal calls."
  type        = string
}

variable "body" {
  type    = string
  default = null
}
