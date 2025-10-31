# 🎮 Emittr - Real-Time Connect 4 Multiplayer Game

A real-time, multiplayer Connect 4 (4-in-a-Row) game built with React, Node.js, Socket.IO, PostgreSQL, and Kafka for analytics. This project is fully containerized with Docker for easy setup and deployment. Players can join a lobby, get matched with an opponent, or play against an AI bot if no one joins in time. Game data is persisted in PostgreSQL, and analytics events are streamed via Kafka.

> **Note:** Replace the image URL above with a screenshot or GIF of your game!

## 🚀 Features

- **Real-Time Multiplayer**: Seamless gameplay with instant move updates using Socket.IO.
- **Automatic Matchmaking**: Players are automatically paired upon joining the lobby.
- **AI Bot Opponent**: If an opponent doesn't join within 10 seconds, an AI bot steps in to play.
- **Persistent Leaderboard**: A global leaderboard tracks wins, stored in PostgreSQL.
- **Game State Notifications**: Clear "Win," "Loss," or "Draw" modals announce the game's outcome.
- **Reconnection Support**: Players can rejoin an ongoing game if their connection drops (30-second timeout).
- **Analytics Integration**: Game events (starts, moves, ends) are produced to a Kafka topic for real-time analytics.
- **Dockerized**: Includes `docker-compose.yml` for a one-command setup of frontend, backend, PostgreSQL, and Kafka services.

## 🧱 Tech Stack

| Layer          | Technology                                                                 |
|----------------|---------------------------------------------------------------------------|
| **Frontend**   | React (with Vite), Socket.IO Client                                       |
| **Backend**    | Node.js, Express, Socket.IO, KafkaJS                                      |
| **Database**   | PostgreSQL                                                                |
| **Message Queue** | Kafka (Redpanda)                                                       |
| **Deployment** | Docker & Docker Compose                                                   |

## 📂 Project Structure

```
Emittr/
├── backend/
│   ├── index.js              # Main Express + Socket.IO server logic, game management, bot AI
│   ├── analytics.js          # Kafka consumer for processing analytics events
│   ├── package.json          # Backend dependencies (Express, Socket.IO, pg, Kafkajs, etc.)
│   └── package-lock.json
│
├── client/
│   ├── src/
│   │   ├── App.jsx           # Main React component handling game UI and state
│   │   ├── App.css           # Component-specific styles
│   │   ├── index.css         # Global styles
│   │   ├── main.jsx          # React app entry point
│   │   └── assets/           # Static assets (e.g., React logo)
│   ├── public/
│   │   └── vite.svg          # Vite logo
│   ├── index.html            # HTML template
│   ├── package.json          # Frontend dependencies (React, Socket.IO Client, Vite)
│   ├── package-lock.json
│   ├── vite.config.js        # Vite configuration
│   ├── eslint.config.js      # ESLint configuration
│   └── README.md             # Client-specific README
│
├── docker-compose.yml        # Defines multi-container setup (backend, frontend, postgres, redpanda)
├── TODO.md                   # Project task list
└── README.md                 # This file
```

## ⚙️ Getting Started

You can run this project using Docker (recommended) or manually on your local machine.

### Prerequisites

- Node.js (v18 or newer)
- `npm` or `yarn`
- Docker and Docker Compose (for containerized setup)

### 🐳 Method 1: Docker Setup (Recommended)

This is the simplest way to get the full application running with all dependencies.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/Emittr.git
   cd Emittr
   ```

2. **Build and start the containers:**
   From the root directory, run:
   ```bash
   docker-compose up --build
   ```
   This command builds the Docker images and starts the services: backend (port 4000), frontend (port 5173), PostgreSQL (port 5432), and Redpanda Kafka (port 9092).

3. **Access the application:**
   - **Frontend:** Open your browser to http://localhost:5173
   - **Backend API:** Available at http://localhost:4000 (e.g., `/leaderboard`, `/health`)

4. **To stop the application:**
   Press `Ctrl + C` in the terminal, then run:
   ```bash
   docker-compose down
   ```

### 🖥️ Method 2: Manual Local Setup

If you prefer to run the services directly on your machine (requires local PostgreSQL and Kafka setup).

1. **Clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/Emittr.git
   cd Emittr
   ```

2. **Set up PostgreSQL:**
   - Install and start PostgreSQL locally.
   - Create a database named `connect4`.
   - Set environment variables or update connection string in `backend/index.js` (default: `postgresql://postgres:postgres@localhost:5432/connect4`).

3. **Set up Kafka (Redpanda):**
   - Install and start Redpanda or Kafka locally on port 9092.
   - Update `KAFKA_BROKER` in `backend/index.js` if needed.

4. **Set up the Backend:**
   ```bash
   cd backend
   npm install
   npm start
   ```
   The backend server will run on http://localhost:4000.

5. **Set up the Frontend:**
   Open a new terminal window.
   ```bash
   cd client
   npm install
   ```
   Create a `.env` file in the `client` directory:
   ```
   VITE_BACKEND=http://localhost:4000
   ```
   Then run:
   ```bash
   npm run dev
   ```
   The frontend will be available at http://localhost:5173.

## 🎯 How to Play

1. Open the game in your browser (http://localhost:5173).
2. Enter a username and click **"Join"**.
3. You'll see "Waiting for opponent..." with a 10-second countdown.
4. If another player joins, the game starts. Otherwise, the AI bot joins automatically.
5. Take turns dropping discs into one of the seven columns.
6. The first to get four discs in a row (horizontally, vertically, or diagonally) wins!
7. A modal announces the result, and the leaderboard updates.

## 🏆 API Endpoints

The backend exposes REST endpoints for leaderboard and health checks.

| Method | Endpoint       | Description                                  |
|--------|----------------|----------------------------------------------|
| `GET`  | `/leaderboard` | Returns the leaderboard as a JSON array.     |
| `GET`  | `/health`      | Health check endpoint.                       |

**Example `/leaderboard` Response:**
```json
[
  { "username": "Player1", "wins": 10 },
  { "username": "BOT", "wins": 5 }
]
```

## 📊 Analytics

Game events are streamed to a Kafka topic (`connect4-events`) for real-time analytics:
- `game_start`: When a game begins (includes players, bot flag).
- `move_made`: Each move (by player or bot).
- `game_end`: Game conclusion (result, winner, duration).

Run `npm run analytics` in the backend directory to consume and log events. This can be extended for dashboards or data warehousing.

## 🧠 Future Enhancements

- **Advanced AI**: Upgrade bot with Minimax or neural network-based strategies.
- **Game Lobbies**: Custom rooms and private matches.
- **Move History**: Replay and analysis of past games.
- **Authentication**: User accounts with secure login.
- **Scalability**: Microservices architecture, Redis caching, or Kubernetes deployment.
- **Real-Time Dashboards**: Analytics UI using Kafka streams.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/your-feature-name`).
3. Commit changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature/your-feature-name`).
5. Open a Pull Request.

## 🪪 License

This project is licensed under the MIT License. See the LICENSE file for details.

---

Developed by Satyam.
