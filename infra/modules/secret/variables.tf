variable "project_id" {
  type = string
}

variable "secret_id" {
  type = string
}

variable "secret_value" {
  description = "Supplied at apply-time via -var or CI secret store — never written to a committed file (docs/09-TERRAFORM-IAC.md §4). Null skips creating a version, letting a human populate it out-of-band via `gcloud secrets versions add`."
  type        = string
  default     = null
  sensitive   = true
}

variable "accessor_service_account_email" {
  description = "Service account granted secretAccessor — typically the Cloud Run runtime SA."
  type        = string
}
