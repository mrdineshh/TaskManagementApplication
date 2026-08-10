terraform {
  backend "gcs" {
    bucket = "econz-taskapp-staging-tfstate"
    prefix = "terraform/state"
  }
}
