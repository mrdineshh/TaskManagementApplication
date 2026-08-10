variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "instance_name" {
  type = string
}

variable "tier" {
  description = "Smallest viable tier to start (docs/01-ARCHITECTURE.md §2.2), e.g. db-f1-micro / db-custom-1-3840. Scale vertically only when metrics justify it."
  type        = string
  default     = "db-f1-micro"
}

variable "database_name" {
  type    = string
  default = "taskapp"
}

variable "database_user" {
  type    = string
  default = "taskapp"
}

variable "availability_type" {
  description = "ZONAL (cheaper, no HA replica) or REGIONAL (HA, ~2x cost — only if uptime requirements justify it per docs/08-INFRA-DEPLOYMENT.md §6)."
  type        = string
  default     = "ZONAL"
}

variable "backup_enabled" {
  type    = bool
  default = true
}

variable "deletion_protection" {
  type    = bool
  default = true
}
