# Cloud Scheduler + Cloud Tasks pattern (docs/01-ARCHITECTURE.md §2.3) — replaces a
# Redis-backed job queue for SLA checks, recurring task generation, and report aggregate
# refreshes, per the cost-conscious "no Memorystore until v1.1 justifies it" decision.

resource "google_cloud_scheduler_job" "this" {
  name      = var.name
  project   = var.project_id
  region    = var.region
  schedule  = var.schedule
  time_zone = "Etc/UTC"

  http_target {
    uri         = var.target_uri
    http_method = var.http_method

    dynamic "oidc_token" {
      for_each = [1]
      content {
        service_account_email = var.service_account_email
      }
    }

    body = var.body != null ? base64encode(var.body) : null

    headers = {
      "Content-Type" = "application/json"
    }
  }

  retry_config {
    retry_count = 3
  }
}
