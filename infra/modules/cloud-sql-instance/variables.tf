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

variable "enable_public_ip" {
  description = "Assigns a public IPv4 address to the instance. Off by default (docs/08-INFRA-DEPLOYMENT.md §3 — Cloud Run connects via the Cloud SQL Auth Proxy/connector, no public IP needed). Note: a public IP alone doesn't open access — nothing can reach it until an authorized network (CIDR) is added via `authorized_networks`, deliberately left empty here."
  type        = bool
  default     = false
}

variable "authorized_networks" {
  description = "CIDR ranges allowed to reach the public IP, e.g. [{ name = \"office\", cidr = \"203.0.113.4/32\" }]. Only relevant when enable_public_ip = true. Empty by default — a public IP with no authorized network still rejects every connection."
  type = list(object({
    name = string
    cidr = string
  }))
  default = []
}
