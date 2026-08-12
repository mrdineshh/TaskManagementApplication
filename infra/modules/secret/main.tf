# Bootstrap-only secrets in Secret Manager (docs/01-ARCHITECTURE.md §2.9a) — the narrow set
# the app needs before it can even read its own DB-stored config: DB creds, JWT signing key,
# Firebase/Google OAuth client secret. Everything else (SMTP, integration credentials) is
# Admin-UI-configurable and lives encrypted in the database instead — see the `secret` module
# is deliberately NOT used for those.

resource "google_secret_manager_secret" "this" {
  secret_id = var.secret_id
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "this" {
  count       = var.secret_value != null ? 1 : 0
  secret      = google_secret_manager_secret.this.id
  secret_data = var.secret_value
}

resource "google_secret_manager_secret_iam_member" "accessor" {
  secret_id = google_secret_manager_secret.this.secret_id
  project   = var.project_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.accessor_service_account_email}"
}
