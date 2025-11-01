🧭 Overview
🎯 Objective

Automate the full development-to-deployment cycle for the Emittr project, including:

Code fetch from GitHub on push/merge.

Building Docker images for both frontend and backend.

Running unit/integration tests.

Pushing images to Docker Hub.

Automatically deploying containers to the target environment (local server, VPS, or cloud).

🧱 Core Stack
Component	Purpose
Jenkins	Automates build, test, and deployment pipelines.
Docker	Containerizes services for consistency across environments.
Docker Compose	Orchestrates multi-container setup (frontend, backend, PostgreSQL, Kafka).
Docker Hub	Stores and distributes built images.
GitHub Webhooks	Triggers Jenkins builds on code pushes.
(Optional) Nginx	Reverse proxy for frontend/backend services in production.
🧩 CI/CD Architecture
                ┌───────────────┐
                │   Developer   │
                └──────┬────────┘
                       │ git push
                       ▼
                ┌───────────────┐
                │    GitHub     │
                └──────┬────────┘
                       │ Webhook Trigger
                       ▼
                ┌───────────────┐
                │   Jenkins     │
                ├───────────────┤
                │ Build + Test  │
                │ Docker Build  │
                │ Push to Hub   │
                └──────┬────────┘
                       │ Deploy Script
                       ▼
                ┌───────────────┐
                │  Production   │
                │   Server/VPS  │
                └───────────────┘

🔧 Prerequisites

Before configuring Jenkins and deployment, ensure you have:

✅ Docker and Docker Compose installed

✅ Jenkins (LTS) installed and running

✅ GitHub repository connected

✅ Docker Hub account with repository access

✅ (Optional) VPS or cloud VM with ports open (5173 for frontend, 4000 for backend)

🧱 Folder Structure for CI/CD

You can maintain the following structure:

Emittr/
├── backend/
│   ├── Dockerfile
│   └── ...
├── client/
│   ├── Dockerfile
│   └── ...
├── docker-compose.yml
├── Jenkinsfile
└── docs/
    └── CI-CD_SETUP.md

🐋 Step 1: Docker Setup (Backend + Frontend)
Backend Dockerfile (backend/Dockerfile)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 4000
CMD ["npm", "start"]

Frontend Dockerfile (client/Dockerfile)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "preview"]

⚙️ Step 2: Docker Compose for Multi-Service Setup
version: "3.8"

services:
  backend:
    build: ./backend
    ports:
      - "4000:4000"
    depends_on:
      - db
      - kafka
    environment:
      POSTGRES_URL: postgres://postgres:postgres@db:5432/connect4
      KAFKA_BROKER: kafka:9092

  client:
    build: ./client
    ports:
      - "5173:5173"
    environment:
      VITE_BACKEND: http://localhost:4000

  db:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: connect4
    volumes:
      - db_data:/var/lib/postgresql/data

  kafka:
    image: docker.redpanda.com/vectorized/redpanda:v23.1.8
    command:
      - redpanda start --overprovisioned --smp 1 --memory 512M --reserve-memory 0M --node-id 0 --check=false
    ports:
      - "9092:9092"

volumes:
  db_data:

🧰 Step 3: Jenkins Setup
1️⃣ Run Jenkins in Docker
docker run -d --name jenkins \
  --restart=on-failure \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins/jenkins:lts-jdk17


Access Jenkins at http://localhost:8080
.

2️⃣ Install Required Plugins

In Manage Jenkins → Plugins, install:

Docker Pipeline

Git

GitHub Integration

Blue Ocean

Pipeline Utility Steps

3️⃣ Connect Jenkins to GitHub

Create a new GitHub Personal Access Token (with repo + workflow permissions).

In Jenkins → Manage Credentials, add it under:

Kind: Secret Text

ID: github-token

Create a webhook in your GitHub repo:

URL: http://<YOUR_JENKINS_SERVER>:8080/github-webhook/

Events: “Just the push event”

🧮 Step 4: Jenkinsfile (Declarative Pipeline)

Create a Jenkinsfile in the project root:

pipeline {
    agent any

    environment {
        DOCKER_HUB_USER = 'your_dockerhub_username'
        DOCKER_HUB_PASS = credentials('dockerhub-password')
        BACKEND_IMAGE = 'your_dockerhub_username/emittr-backend'
        FRONTEND_IMAGE = 'your_dockerhub_username/emittr-frontend'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', credentialsId: 'github-token', url: 'https://github.com/yourusername/Emittr.git'
            }
        }

        stage('Build Backend Image') {
            steps {
                script {
                    sh 'docker build -t $BACKEND_IMAGE:latest ./backend'
                }
            }
        }

        stage('Build Frontend Image') {
            steps {
                script {
                    sh 'docker build -t $FRONTEND_IMAGE:latest ./client'
                }
            }
        }

        stage('Push Images to Docker Hub') {
            steps {
                script {
                    sh '''
                    echo $DOCKER_HUB_PASS | docker login -u $DOCKER_HUB_USER --password-stdin
                    docker push $BACKEND_IMAGE:latest
                    docker push $FRONTEND_IMAGE:latest
                    '''
                }
            }
        }

        stage('Deploy Containers') {
            steps {
                sshagent (credentials: ['server-ssh-key']) {
                    sh '''
                    ssh -o StrictHostKeyChecking=no user@your_server_ip '
                        docker pull $BACKEND_IMAGE:latest &&
                        docker pull $FRONTEND_IMAGE:latest &&
                        cd /home/user/Emittr &&
                        docker-compose down &&
                        docker-compose up -d
                    '
                    '''
                }
            }
        }
    }

    post {
        success {
            echo '✅ Deployment Successful!'
        }
        failure {
            echo '❌ Build or Deployment Failed!'
        }
    }
}

🔐 Step 5: Managing Secrets

Use Jenkins credentials store:

Type	ID	Used For
Secret Text	github-token	GitHub access
Username + Password	dockerhub-password	Docker Hub login
SSH Key	server-ssh-key	Remote server deploy access
🚀 Step 6: Automated Deployment Flow

Developer pushes new code to GitHub.

GitHub webhook triggers Jenkins pipeline.

Jenkins:

Clones the repo

Builds Docker images for frontend & backend

Pushes images to Docker Hub

SSHs into the production server

Pulls latest images and redeploys services via Docker Compose

Users see the updated app live within minutes.

🧠 Optional Enhancements
Enhancement	Description
Testing Stage	Add unit/integration tests before Docker build.
Staging Environment	Deploy to a staging VM before production.
Slack Notifications	Send pipeline updates to a Slack channel.
Grafana + Prometheus	Monitor app and container performance.
Kubernetes Migration	Replace Compose with Helm charts for scaling.
🧩 Troubleshooting Tips
Issue	Possible Fix
Jenkins can’t access Docker	Mount Docker socket -v /var/run/docker.sock:/var/run/docker.sock.
Webhook not triggering	Verify Jenkins webhook URL and GitHub permissions.
Docker Hub push fails	Check credentials ID and Docker Hub rate limits.
SSH deploy fails	Ensure server public key is added to ~/.ssh/authorized_keys.