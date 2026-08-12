variable "project_id" {
  type    = string
  default = "econz-taskapp-prod"
}

variable "region" {
  type    = string
  default = "asia-south1"
}

variable "api_image" {
  description = "Same image digest promoted from staging, not rebuilt (docs/08-INFRA-DEPLOYMENT.md §4)."
  type        = string
}

variable "google_oauth_client_secret" {
  type      = string
  default   = null
  sensitive = true
}

variable "enable_ha" {
  description = "Adds a Cloud SQL HA replica (~2x cost) — off by default per docs/08-INFRA-DEPLOYMENT.md §6, flip on only once uptime requirements justify it."
  type        = bool
  default     = false
}
