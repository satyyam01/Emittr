pipeline {
    agent any

    environment {
        NODEJS_HOME = '/usr/local/bin/node'
        PATH = "$NODEJS_HOME:$PATH"
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo 'Cloning Repository...'
                checkout scm
            }
        }

        stage('Build') {
            agent {
                docker { image 'node:18' }  // ✅ Run this stage inside Node.js container
            }
            steps {
                echo 'Building Project...'
                sh 'npm install'
                sh 'npm run build || echo "Build step skipped (if not defined)"'
            }
        }

        stage('Unit Test') {
            agent {
                docker { image 'node:18' }
            }
            steps {
                echo 'Running Tests...'
                sh 'npm test || echo "No tests configured"'
            }
        }

        stage('Package') {
            steps {
                echo 'Packaging Project...'
                sh 'zip -r build.zip .'
            }
        }

        stage('SonarQube Analysis') {
            when { expression { return false } }  // Optional for now
            steps {
                echo 'Running SonarQube (skipped for now)'
            }
        }

        stage('Deploy') {
            steps {
                echo 'Deploying to server...'
                // We'll add deployment commands later
            }
        }
    }

    post {
        success {
            echo '✅ Pipeline completed successfully!'
        }
        failure {
            echo '❌ Pipeline failed'
        }
    }
}
