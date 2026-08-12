variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "create_vpc_connector" {
  description = "Off by default — docs/08-INFRA-DEPLOYMENT.md §3 explicitly avoids VPC/load-balancer cost at this scale (Cloud SQL Auth Proxy handles DB connectivity without one). Flip on only if a future need for private networking (e.g. Memorystore in v1.1) arises."
  type        = bool
  default     = false
}

variable "vpc_connector_cidr" {
  type    = string
  default = "10.8.0.0/28"
}
