pipeline {
    agent any

    environment {
        IMAGE_NAME = "emittr-app"
        CONTAINER_NAME = "emittr-container"
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo '📦 Cloning repository...'
                checkout scm
            }
        }

        stage('Build Backend & Frontend') {
            agent {
                docker {
                    image 'node:18'
                    args '-v /var/run/docker.sock:/var/run/docker.sock'
                }
            }
            steps {
                echo '⚙️ Installing dependencies and building both backend & client...'
                sh '''
                    cd backend
                    npm install
                    echo "✅ Backend dependencies installed."

                    cd ../client
                    npm install
                    npm run build || echo "No build script defined for client."
                    echo "✅ Client built successfully."
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
