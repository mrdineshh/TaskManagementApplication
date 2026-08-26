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

variable "web_image" {
  description = "Artifact Registry image serving the built static SPA (e.g. nginx + the Vite build output), set by CI. Placeholder until the first Cloud Build run publishes one — see docs/08-INFRA-DEPLOYMENT.md §5 on why this is Cloud Run rather than a public Cloud Storage bucket."
  type        = string
  default     = "gcr.io/cloudrun/hello"
}

variable "google_oauth_client_secret" {
  description = "Bootstrap secret — supplied via -var or CI secret store, never committed (docs/09-TERRAFORM-IAC.md §4). Null leaves the Secret Manager entry empty for manual population."
  type        = string
  default     = null
  sensitive   = true
}

variable "firebase_project_id" {
  description = "GCP project ID hosting the Firebase project used for Google Sign-In (docs/10-OPEN-DECISIONS.md §M4). Not secret — it's the JWT audience the API checks ID tokens against."
  type        = string
  default     = "task-management-applicat-5e5d6"
}
