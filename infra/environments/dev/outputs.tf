output "api_url" {
  value = module.api.url
}

output "web_url" {
  value = module.web.url
}

output "db_connection_name" {
  value = module.db.connection_name
}

output "db_public_ip_address" {
  value = module.db.public_ip_address
}
