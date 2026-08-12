variable "project_id" {
  type = string
}

variable "location" {
  type = string
}

variable "name" {
  type = string
}

variable "uniform_bucket_level_access" {
  type    = bool
  default = true
}

variable "cold_storage_after_days" {
  description = "Lifecycle rule: move objects (e.g. old report exports) to a cheaper storage class after N days. 0 disables it (docs/08-INFRA-DEPLOYMENT.md §2)."
  type        = number
  default     = 90
}
