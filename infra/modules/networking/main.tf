# Deliberately minimal — see docs/08-INFRA-DEPLOYMENT.md §3: Cloud Run gets public HTTPS
# ingress by default, and Cloud SQL connects via the Auth Proxy/connector, so no VPC or load
# balancer is provisioned for v1. This module exists so a future need (e.g. Memorystore in
# v1.1, docs/01-ARCHITECTURE.md §2.3) can add private networking without restructuring.

resource "google_vpc_access_connector" "this" {
  count         = var.create_vpc_connector ? 1 : 0
  name          = "taskapp-connector"
  project       = var.project_id
  region        = var.region
  ip_cidr_range = var.vpc_connector_cidr
  network       = "default"
}
