output "connection_name" {
  value = google_sql_database_instance.this.connection_name
}

output "instance_name" {
  value = google_sql_database_instance.this.name
}

output "connection_string_secret_id" {
  value = google_secret_manager_secret.db_connection_string.secret_id
}

output "public_ip_address" {
  description = "Null unless enable_public_ip = true."
  value       = try(google_sql_database_instance.this.public_ip_address, null)
}
