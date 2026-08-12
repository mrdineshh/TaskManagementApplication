output "api_url" {
  value = module.api.url
}

output "web_bucket_url" {
  value = google_storage_bucket.web.url
}

output "db_connection_name" {
  value = module.db.connection_name
}
