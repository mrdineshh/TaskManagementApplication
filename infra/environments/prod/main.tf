# prod — live environment. min_instances=1 to avoid cold-start latency for real users
# (docs/08-INFRA-DEPLOYMENT.md §2); everything else stays structurally identical to
# staging, differing only in sizing (docs/09-TERRAFORM-IAC.md §2).

resource "google_service_account" "api_runtime" {
  project      = var.project_id
  account_id   = "taskapp-api-runtime"
  display_name = "Task Management API runtime (Cloud Run)"
}

resource "google_kms_key_ring" "taskapp" {
  project  = var.project_id
  name     = "taskapp"
  location = var.region
}

resource "google_kms_crypto_key" "integration_settings" {
  name     = "integration-settings"
  key_ring = google_kms_key_ring.taskapp.id

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_kms_crypto_key_iam_member" "api_runtime_decrypt" {
  crypto_key_id = google_kms_crypto_key.integration_settings.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_service_account.api_runtime.email}"
}

module "jwt_access_secret" {
  source                         = "../../modules/secret"
  project_id                     = var.project_id
  secret_id                      = "taskapp-jwt-access-secret"
  accessor_service_account_email = google_service_account.api_runtime.email
}

module "jwt_refresh_secret" {
  source                         = "../../modules/secret"
  project_id                     = var.project_id
  secret_id                      = "taskapp-jwt-refresh-secret"
  accessor_service_account_email = google_service_account.api_runtime.email
}

module "google_oauth_client_secret" {
  source                         = "../../modules/secret"
  project_id                     = var.project_id
  secret_id                      = "taskapp-google-oauth-client-secret"
  secret_value                   = var.google_oauth_client_secret
  accessor_service_account_email = google_service_account.api_runtime.email
}

module "db" {
  source              = "../../modules/cloud-sql-instance"
  project_id          = var.project_id
  region              = var.region
  instance_name       = "taskapp-prod"
  tier                = "db-custom-2-7680"
  availability_type   = var.enable_ha ? "REGIONAL" : "ZONAL"
  backup_enabled      = true
  deletion_protection = true
}

resource "google_secret_manager_secret_iam_member" "db_connection_accessor" {
  project   = var.project_id
  secret_id = module.db.connection_string_secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api_runtime.email}"
}

module "attachments_bucket" {
  source                  = "../../modules/storage-bucket"
  project_id              = var.project_id
  location                = var.region
  name                    = "${var.project_id}-attachments"
  cold_storage_after_days = 90
}

module "api" {
  source                            = "../../modules/cloud-run-service"
  project_id                        = var.project_id
  region                            = var.region
  service_name                      = "taskapp-api"
  image                             = var.api_image
  service_account_email             = google_service_account.api_runtime.email
  min_instances                     = 1 # avoid cold-start latency for real users
  max_instances                     = 10
  allow_unauthenticated             = true
  cloudsql_instance_connection_name = module.db.connection_name

  env_vars = {
    NODE_ENV             = "production"
    PORT                 = "3000"
    ALLOWED_EMAIL_DOMAIN = "econz.net"
    AUTH_PROVIDERS       = "google"
    FIREBASE_PROJECT_ID  = var.firebase_project_id
    ATTACHMENTS_BUCKET   = module.attachments_bucket.bucket_name
    DEV_KMS_KEY_ID       = google_kms_crypto_key.integration_settings.id
  }

  secret_env_vars = {
    DATABASE_URL               = { secret_id = module.db.connection_string_secret_id }
    JWT_ACCESS_SECRET          = { secret_id = module.jwt_access_secret.secret_id }
    JWT_REFRESH_SECRET         = { secret_id = module.jwt_refresh_secret.secret_id }
    GOOGLE_OAUTH_CLIENT_SECRET = { secret_id = module.google_oauth_client_secret.secret_id }
  }
}

resource "google_storage_bucket" "web" {
  name          = "${var.project_id}-web"
  project       = var.project_id
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }
}

resource "google_storage_bucket_iam_member" "web_public_read" {
  bucket = google_storage_bucket.web.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
