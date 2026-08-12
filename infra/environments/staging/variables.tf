variable "project_id" {
  type    = string
  default = "econz-taskapp-staging"
}

variable "region" {
  type    = string
  default = "asia-south1"
}

variable "api_image" {
  description = "Same image digest promoted from dev, not rebuilt (docs/08-INFRA-DEPLOYMENT.md §4)."
  type        = string
}

variable "google_oauth_client_secret" {
  type      = string
  default   = null
  sensitive = true
}
