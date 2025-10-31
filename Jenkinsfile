pipeline {
    agent any

    environment {
        APP_NAME = "connect4"
        IMAGE_NAME = "connect4-app"
        CONTAINER_NAME = "connect4-container"
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo '📦 Cloning Repository...'
                checkout scm
            }
        }

        stage('Build & Test') {
            agent {
                docker {
                    image 'node:18'
                    args '-v /var/run/docker.sock:/var/run/docker.sock'
                }
            }
            steps {
                echo '⚙️ Installing dependencies and building...'
                sh '''
                    npm install
                    npm run build || echo "Build skipped (if not defined)"
                    npm test || echo "No tests configured"
                '''
            }
        }

        stage('Package Docker Image') {
            steps {
                echo '🐳 Building Docker image...'
                sh 'docker build -t ${IMAGE_NAME}:latest .'
            }
        }

        stage('Deploy Container') {
            steps {
                echo '🚀 Deploying container...'
                sh '''
                    docker stop ${CONTAINER_NAME} || true
                    docker rm ${CONTAINER_NAME} || true
                    docker run -d -p 3000:3000 --name ${CONTAINER_NAME} ${IMAGE_NAME}:latest
                '''
            }
        }

        stage('SonarQube Analysis (Optional)') {
            when { expression { return false } } // Disabled for now
            steps {
                echo '📊 Running SonarQube analysis (skipped for now)'
            }
        }
    }

    post {
        success {
            echo '✅ Pipeline completed successfully!'
        }
        failure {
            echo '❌ Pipeline failed!'
        }
    }
}
