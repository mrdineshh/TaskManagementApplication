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

variable "firebase_project_id" {
  description = "GCP project ID hosting the Firebase project used for Google Sign-In (docs/10-OPEN-DECISIONS.md §M4). Not secret — it's the JWT audience the API checks ID tokens against."
  type        = string
  default     = ""
}
