variable "project_id" {
  type = string
}

variable "secret_id" {
  type = string
}

variable "secret_value" {
  description = "Supplied at apply-time via -var or CI secret store — never written to a committed file (docs/09-TERRAFORM-IAC.md §4)."
  type        = string
  default     = null
  sensitive   = true
}

variable "create_version" {
  description = "Whether to create an initial secret version now. Defaults to `secret_value != null`, which works for plain input variables (e.g. a value from -var, known at plan time even when null) but NOT when secret_value comes from another resource's computed attribute (e.g. random_password.result) — pass this explicitly as a literal `true`/`false` in that case, since Terraform can't evaluate `count` from a value that's unknown until apply."
  type        = bool
  default     = null
}

locals {
  create_version = var.create_version != null ? var.create_version : var.secret_value != null
}

variable "accessor_service_account_email" {
  description = "Service account granted secretAccessor — typically the Cloud Run runtime SA."
  type        = string
}
