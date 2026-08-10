# Task attachments + report exports (docs/01-ARCHITECTURE.md §2.4 — [Fixed]). Pay-per-use,
# no idle cost. One bucket per environment, per docs/08-INFRA-DEPLOYMENT.md §2.

resource "google_storage_bucket" "this" {
  name     = var.name
  project  = var.project_id
  location = var.location

  uniform_bucket_level_access = var.uniform_bucket_level_access
  force_destroy               = false

  dynamic "lifecycle_rule" {
    for_each = var.cold_storage_after_days > 0 ? [1] : []
    content {
      condition {
        age = var.cold_storage_after_days
      }
      action {
        type          = "SetStorageClass"
        storage_class = "COLDLINE"
      }
    }
  }
}
