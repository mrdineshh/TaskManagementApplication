# Remote state — one GCS bucket per environment (docs/09-TERRAFORM-IAC.md §3), matching the
# project-per-environment isolation principle. This bucket is bootstrapped manually (or via
# infra/README.md's bootstrap script) before this config can run, since Terraform needs
# somewhere to store state before it can manage its own backend.
terraform {
  backend "gcs" {
    bucket = "econz-taskapp-dev-tfstate"
    prefix = "terraform/state"
  }
}
