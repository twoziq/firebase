#!/bin/bash

# 프로젝트 ID 설정 (필요시 수정)
PROJECT_ID="project-e53d9ddc-6b87-4393-b10"
SERVICE_NAME="twoziq-api"
REGION="asia-northeast3" # 서울 리전

echo "Deploying to Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"

# Cloud Run 배포 명령어
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --project $PROJECT_ID

echo "Deployment finished."
