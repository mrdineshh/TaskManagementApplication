# dev — active development, freely resettable data (docs/08-INFRA-DEPLOYMENT.md §1).
# Scale-to-zero everywhere possible; smallest viable Cloud SQL tier; no HA replica.

resource "google_service_account" "api_runtime" {
  project      = var.project_id
  account_id   = "taskapp-api-runtime"
  display_name = "Task Management API runtime (Cloud Run)"
}

# --- KMS: envelope-encryption key for Admin-UI-configured secrets (docs/01-ARCHITECTURE.md §2.9a) ---
# The DB stores ciphertext; only the API's own service account can decrypt. This is the one
# resource type not in a dedicated module (the doc's module list doesn't call one out) since
# it's a single key ring/key pair, reused as-is across environments.
resource "google_kms_key_ring" "taskapp" {
  project  = var.project_id
  name     = "taskapp"
  location = var.region
}

resource "google_kms_crypto_key" "integration_settings" {
  name     = "integration-settings"
  key_ring = google_kms_key_ring.taskapp.id

  lifecycle {
    prevent_destroy = true # destroying this key makes every encrypted integration setting unrecoverable
  }
}

resource "google_kms_crypto_key_iam_member" "api_runtime_decrypt" {
  crypto_key_id = google_kms_crypto_key.integration_settings.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_service_account.api_runtime.email}"
}

# --- Bootstrap secrets (docs/01-ARCHITECTURE.md §2.9a — the narrow deployment-only set) ---
# JWT signing secrets are arbitrary random strings, not a human-chosen value — nothing to wait
# on, so generate them the same way random_password.db_password already does, rather than
# leaving them null. A null secret_value means the Secret Manager container has zero versions,
# which made the Cloud Run deploy itself fail outright ("Secret .../versions/latest was not
# found") since a secretKeyRef needs an actual version to reference, not just a container.
resource "random_password" "jwt_access_secret" {
  length  = 64
  special = false
}

resource "random_password" "jwt_refresh_secret" {
  length  = 64
  special = false
}

module "jwt_access_secret" {
  source                         = "../../modules/secret"
  project_id                     = var.project_id
  secret_id                      = "taskapp-jwt-access-secret"
  secret_value                   = random_password.jwt_access_secret.result
  create_version                 = true # literal, not inferred — see modules/secret/variables.tf
  accessor_service_account_email = google_service_account.api_runtime.email
}

module "jwt_refresh_secret" {
  source                         = "../../modules/secret"
  project_id                     = var.project_id
  secret_id                      = "taskapp-jwt-refresh-secret"
  secret_value                   = random_password.jwt_refresh_secret.result
  create_version                 = true # literal, not inferred — see modules/secret/variables.tf
  accessor_service_account_email = google_service_account.api_runtime.email
}

module "google_oauth_client_secret" {
  source                         = "../../modules/secret"
  project_id                     = var.project_id
  secret_id                      = "taskapp-google-oauth-client-secret"
  secret_value                   = var.google_oauth_client_secret
  accessor_service_account_email = google_service_account.api_runtime.email
}

# --- Data layer ---
module "db" {
  source              = "../../modules/cloud-sql-instance"
  project_id          = var.project_id
  region              = var.region
  instance_name       = "taskapp-dev"
  tier                = "db-f1-micro"
  availability_type   = "ZONAL"
  backup_enabled      = false # dev data is freely resettable — skip backup cost
  deletion_protection = false
  enable_public_ip    = true # no authorized_networks passed below, so nothing can actually
  # reach it yet — add entries here once you know which IP(s) need to connect, e.g.:
  # authorized_networks = [{ name = "office", cidr = "203.0.113.4/32" }]
}

resource "google_secret_manager_secret_iam_member" "db_connection_accessor" {
  project   = var.project_id
  secret_id = module.db.connection_string_secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api_runtime.email}"
}

# --- File storage (attachments, exports) ---
module "attachments_bucket" {
  source                  = "../../modules/storage-bucket"
  project_id              = var.project_id
  location                = var.region
  name                    = "${var.project_id}-attachments"
  cold_storage_after_days = 90
}

# --- Artifact Registry (docs/08-INFRA-DEPLOYMENT.md §2/§4) ---
# Empty until CI pushes an image — costs ~$0 until then. Without this, Cloud Run deploy fails
# outright at apply time (not just at request time) since it validates the image is pullable:
# hit this live pointing api_image at a repo that didn't exist yet ("Permission
# artifactregistry.repositories.downloadArtifacts denied ... or it may not exist").
resource "google_artifact_registry_repository" "taskapp" {
  project       = var.project_id
  location      = var.region
  repository_id = "taskapp"
  format        = "DOCKER"
  description   = "Docker images for the Task Management API, published by CI."
}

resource "google_artifact_registry_repository_iam_member" "api_runtime_reader" {
  project    = var.project_id
  location   = google_artifact_registry_repository.taskapp.location
  repository = google_artifact_registry_repository.taskapp.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.api_runtime.email}"
}

# --- API (Cloud Run) ---
module "api" {
  source                            = "../../modules/cloud-run-service"
  project_id                        = var.project_id
  region                            = var.region
  service_name                      = "taskapp-api"
  image                             = var.api_image
  service_account_email             = google_service_account.api_runtime.email
  min_instances                     = 0 # scale-to-zero in dev (docs/08-INFRA-DEPLOYMENT.md §2)
  max_instances                     = 3
  allow_unauthenticated             = true # the API enforces its own JWT auth; this is network-level only
  cloudsql_instance_connection_name = module.db.connection_name

  env_vars = {
    NODE_ENV = "development"
    # PORT is deliberately not set here — Cloud Run reserves and injects it itself (defaults
    # to 8080), rejecting the deploy outright if a container tries to set it explicitly ("The
    # following reserved env names were provided: PORT", hit live). apps/api/src/main.ts
    # already reads process.env.PORT with a 3000 fallback only for local dev, so this needs
    # no code change — Cloud Run's own value just flows straight through.
    ALLOWED_EMAIL_DOMAIN = "econz.net"
    AUTH_PROVIDERS       = "google" # "dev" mock provider is local-only, never deployed
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

# --- Web (static SPA — Cloud Storage, per docs/08-INFRA-DEPLOYMENT.md §5 Default) ---
# NOTE: this provisions the storage bucket only. Fronting it with Cloud CDN + a custom domain
# requires an HTTPS Load Balancer (backend bucket + URL map + forwarding rule) — deliberately
# not added yet since docs/08-INFRA-DEPLOYMENT.md §7 confirms launch on default GCP URLs with
# no custom domain, and the bucket's own public URL is sufficient until that's needed.
resource "google_storage_bucket" "web" {
  name          = "${var.project_id}-web"
  project       = var.project_id
  location      = var.region
  force_destroy = true # dev only — safe to recreate the static build

  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html" # SPA client-side routing fallback
  }
}

resource "google_storage_bucket_iam_member" "web_public_read" {
  bucket = google_storage_bucket.web.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
