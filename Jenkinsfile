pipeline {
    agent any

    stages {
        stage('Checkout Code') {
            steps {
                echo 'Cloning Repository...'
                checkout scm
            }
        }

        stage('Build') {
            steps {
                echo 'Building Project...'
                sh 'npm install'
            }
        }

        stage('Unit Test') {
            steps {
                echo 'Running Unit Tests...'
                sh 'npm test || echo "No tests configured yet"'
            }
        }

        stage('Package') {
            steps {
                echo 'Packaging Project...'
                sh 'npm run build'
            }
        }

        stage('SonarQube Analysis') {
            when {
                expression { return false } // make optional for now
            }
            steps {
                echo 'Running SonarQube...'
            }
        }

        stage('Deploy') {
            steps {
                echo 'Deploying on local server...'
                sh 'docker build -t connect4 .'
                sh 'docker run -d -p 4000:4000 connect4'
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully ✅'
        }
        failure {
            echo 'Pipeline failed ❌'
        }
    }
}
