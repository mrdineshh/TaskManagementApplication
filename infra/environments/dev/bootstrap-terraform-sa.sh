#!/usr/bin/env bash
# One-time bootstrap: creates a least-privilege service account for Terraform to plan/apply
# the dev environment, plus the GCS state bucket (infra/README.md §1). Run this yourself
# from a machine with gcloud authenticated as a project owner/editor — this script is not
# run by Terraform or any agent, it's the human-authority step docs/08-INFRA-DEPLOYMENT.md
# §9 and infra/README.md §0 call out as required before Terraform can do anything.
#
# Usage: PROJECT_ID=econz-task-management-app REGION=us-central1 ./bootstrap-terraform-sa.sh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID, e.g. econz-task-management-app}"
REGION="${REGION:-us-central1}"
SA_NAME="terraform-dev"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
KEY_FILE="./terraform-dev-key.json"

gcloud config set project "$PROJECT_ID"

echo "Enabling required APIs..."
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com \
  iam.googleapis.com \
  sqladmin.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  cloudkms.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com \
  cloudscheduler.googleapis.com

echo "Creating service account $SA_EMAIL..."
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="Terraform (dev environment)" \
  --project="$PROJECT_ID" || echo "  (already exists, continuing)"

echo "Granting least-privilege roles (not Owner/Editor)..."
for ROLE in \
  roles/iam.serviceAccountAdmin \
  roles/iam.serviceAccountUser \
  roles/cloudkms.admin \
  roles/secretmanager.admin \
  roles/cloudsql.admin \
  roles/storage.admin \
  roles/run.admin \
  roles/serviceusage.serviceUsageAdmin \
  roles/resourcemanager.projectIamAdmin
do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --condition=None \
    --quiet
done

echo "Creating key file at $KEY_FILE — treat this as a live credential..."
gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="$SA_EMAIL"

echo "Bootstrapping Terraform state bucket..."
gsutil mb -l "$REGION" "gs://${PROJECT_ID}-tfstate" || echo "  (already exists, continuing)"
gsutil versioning set on "gs://${PROJECT_ID}-tfstate"

echo
echo "Done. Paste the contents of $KEY_FILE into the chat when ready, then:"
echo "  gcloud iam service-accounts keys list --iam-account=$SA_EMAIL   # note the key id"
echo "  gcloud iam service-accounts keys delete <KEY_ID> --iam-account=$SA_EMAIL   # once we're done this session"
