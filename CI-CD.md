# ⚙️ CI/CD Setup Guide — *Emittr: Real-Time Multiplayer Connect 4 Game*

This guide details the **Continuous Integration and Continuous Deployment (CI/CD)** pipeline for Emittr — ensuring automated builds, testing, and deployment using **Jenkins**, **Docker**, and **Docker Hub**.  
It’s written for developers who want to replicate or extend the existing setup in their own environments.

---

## 🧭 Overview

### 🎯 Objective

Automate the full development-to-deployment lifecycle for Emittr, including:

1. Fetching code from GitHub upon push or merge.
2. Building Docker images for frontend and backend.
3. Running tests and validation.
4. Pushing built images to Docker Hub.
5. Automatically deploying containers to a production server or cloud instance.

---

## 🧱 Core Stack

| Component | Purpose |
|------------|----------|
| **Jenkins** | Automates build, test, and deployment pipelines. |
| **Docker** | Containerizes app services for consistent environments. |
| **Docker Compose** | Orchestrates multi-container setup (frontend, backend, PostgreSQL, Kafka). |
| **Docker Hub** | Stores and distributes built Docker images. |
| **GitHub Webhooks** | Automatically triggers Jenkins builds on new pushes. |
| **(Optional) Nginx** | Acts as a reverse proxy for production. |

---

## 🧩 CI/CD Architecture

pgsql
Copy code
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
yaml
Copy code

---

## 🔧 Prerequisites

Before setting up, ensure you have:

- ✅ Docker and Docker Compose installed  
- ✅ Jenkins (LTS) running (locally or on a server)  
- ✅ GitHub repository connected  
- ✅ Docker Hub account for storing images  
- ✅ (Optional) VPS or cloud instance with open ports (`5173` for frontend, `4000` for backend)

---

## 📂 Folder Structure

Emittr/
├── backend/
│ ├── Dockerfile
│ └── ...
├── client/
│ ├── Dockerfile
│ └── ...
├── docker-compose.yml
├── Jenkinsfile
└── docs/
└── CI-CD_SETUP.md

yaml
Copy code

---

## 🐋 Step 1: Docker Setup

### Backend (`backend/Dockerfile`)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 4000
CMD ["npm", "start"]
Frontend (client/Dockerfile)
dockerfile
Copy code
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "preview"]
⚙️ Step 2: Docker Compose Setup
yaml
Copy code
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
Run Jenkins in Docker
bash
Copy code
docker run -d --name jenkins \
  --restart=on-failure \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins/jenkins:lts-jdk17
Access Jenkins at http://localhost:8080

Install Required Plugins
Go to Manage Jenkins → Plugins and install:

Docker Pipeline

Git

GitHub Integration

Blue Ocean

Pipeline Utility Steps

Connect Jenkins to GitHub
Create a GitHub Personal Access Token with repo + workflow permissions.

Add it in Jenkins → Manage Credentials:

Kind: Secret Text

ID: github-token

Create a GitHub Webhook:

URL: http://<JENKINS_SERVER>:8080/github-webhook/

Event: “Push event”

🧮 Step 4: Jenkinsfile Pipeline
Create a Jenkinsfile in the root:

groovy
Copy code
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
Type	ID	Purpose
Secret Text	github-token	GitHub access
Username + Password	dockerhub-password	Docker Hub authentication
SSH Key	server-ssh-key	Server deployment access

🚀 Step 6: Deployment Flow
Developer pushes code to GitHub.

GitHub webhook triggers Jenkins.

Jenkins:

Clones repo

Builds frontend & backend images

Pushes them to Docker Hub

SSHs into the production server

Pulls new images & redeploys via Docker Compose

The updated app is live within minutes.

🧠 Optional Enhancements
Enhancement	Description
Test Stage	Add automated test stage before Docker build.
Staging Environment	Deploy builds to a staging VM first.
Slack Notifications	Send build/deploy updates to a Slack channel.
Grafana + Prometheus	Monitor service performance and health.
Kubernetes	Migrate from Compose to Helm-based K8s setup for scalability.

🧩 Troubleshooting
Issue	Fix
Jenkins can’t access Docker	Mount Docker socket: -v /var/run/docker.sock:/var/run/docker.sock
Webhook not triggering	Recheck webhook URL and GitHub token.
Docker Hub push fails	Validate Docker credentials or rate limits.
SSH deploy fails	Ensure key is in server’s ~/.ssh/authorized_keys.

🏁 Summary
This pipeline delivers:

✅ Continuous Integration — Build, test, validate
✅ Continuous Delivery — Push stable images to registry
✅ Continuous Deployment — Live redeploy on every push

Emittr’s CI/CD ensures reliable updates, consistent environments, and faster development cycles.

📚 Related Docs
Main Project README

Observability & Monitoring Setup (Coming Soon)

Maintained by: Satyam
License: MIT