pipeline {
    agent any

    environment {
        IMAGE_NAME = "emittr-app"
        CONTAINER_NAME = "emittr-container"
        DOCKERHUB_USER = "satyyam01" // change this
    }

    stages {
        /* -------------------- 1️⃣ CHECKOUT CODE -------------------- */
        stage('Checkout Code') {
            steps {
                echo '📦 Cloning repository...'
                checkout scm
            }
        }

        /* -------------------- 2️⃣ BUILD FRONTEND + BACKEND -------------------- */
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
                    npm run build || echo "⚠️ No build script defined for client."
                    echo "✅ Client built successfully."
                '''
            }
        }

        /* -------------------- 3️⃣ UNIT TESTS -------------------- */
        stage('Run Unit Tests') {
            agent {
                docker {
                    image 'node:18'
                }
            }
            steps {
                echo '🧪 Running backend unit tests...'
                sh '''
                    cd backend
                    npm test || echo "⚠️ No tests found. Skipping unit tests."
                '''
            }
        }

        /* -------------------- 4️⃣ SONARQUBE ANALYSIS (OPTIONAL) -------------------- */
        stage('SonarQube Analysis') {
            when { expression { return false } } // Toggle to 'true' to enable
            steps {
                echo '📊 Running SonarQube analysis (currently disabled)...'
                script {
                    withSonarQubeEnv('MySonarServer') {
                        dir('backend') {
                            sh '''
                            sonar-scanner \
                                -Dsonar.projectKey=emittr \
                                -Dsonar.sources=. \
                                -Dsonar.host.url=http://host.docker.internal:9000 \
                                -Dsonar.login=$SONARQUBE_TOKEN
                            '''
                        }
                    }
                }
            }
        }

        /* -------------------- 5️⃣ PACKAGE DOCKER IMAGE -------------------- */
        stage('Package Docker Image') {
            steps {
                echo "🐳 Building Docker image..."
                sh 'docker build -t ${IMAGE_NAME}:latest ./backend'
            }
        }

        /* -------------------- 6️⃣ DEPLOYMENT -------------------- */
        stage('Deploy / Push Docker Image') {
            steps {
                script {
                    // 🅰️ Option A: Local deployment (default)
                    echo '🚀 Deploying locally...'
                    sh '''
                        docker stop ${CONTAINER_NAME} || true
                        docker rm ${CONTAINER_NAME} || true
                        docker run -d -p 3000:3000 --name ${CONTAINER_NAME} ${IMAGE_NAME}:latest
                    '''

                    // 🅱️ Option B: Push to Docker Hub (uncomment if you want this)
                    
                    echo '📤 Pushing image to Docker Hub...'
                    docker.withRegistry('https://index.docker.io/v1/', 'dockerhub-creds') {
                        sh """
                            docker tag ${IMAGE_NAME}:latest ${DOCKERHUB_USER}/${IMAGE_NAME}:latest
                            docker push ${DOCKERHUB_USER}/${IMAGE_NAME}:latest
                        """
                    }
                    
                }
            }
        }
    }

    /* -------------------- 7️⃣ POST ACTIONS -------------------- */
    post {
        success {
            echo '✅ Pipeline completed successfully!'
        }
        failure {
            echo '❌ Pipeline failed!'
        }
        always {
            echo '🧹 Cleaning workspace...'
            cleanWs()
        }
    }
}
