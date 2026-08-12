variable "project_id" {
  type    = string
  default = "econz-task-management-app"
}

variable "region" {
  type    = string
  default = "us-central1" # lowest-cost GCP region — no real-user latency to optimize for in dev
}

variable "api_image" {
  description = "Artifact Registry image for the API, set by CI (docs/08-INFRA-DEPLOYMENT.md §4). Placeholder until the first Cloud Build run publishes one."
  type        = string
  default     = "gcr.io/cloudrun/hello" # placeholder — replaced by the CI pipeline's build
}

variable "google_oauth_client_secret" {
  description = "Bootstrap secret — supplied via -var or CI secret store, never committed (docs/09-TERRAFORM-IAC.md §4). Null leaves the Secret Manager entry empty for manual population."
  type        = string
  default     = null
  sensitive   = true
}
