output "vpc_connector_id" {
  value = var.create_vpc_connector ? google_vpc_access_connector.this[0].id : null
}
