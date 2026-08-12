terraform {
  backend "gcs" {
    bucket = "econz-taskapp-prod-tfstate"
    prefix = "terraform/state"
  }
}
