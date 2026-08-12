output "connection_name" {
  value = google_sql_database_instance.this.connection_name
}

output "instance_name" {
  value = google_sql_database_instance.this.name
}

output "connection_string_secret_id" {
  value = google_secret_manager_secret.db_connection_string.secret_id
}
