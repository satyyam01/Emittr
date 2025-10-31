import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_BACKEND || "http://localhost:4000";
const socket = io(SOCKET_URL);

function Cell({ value }) {
  const style = {
    width: 60,
    height: 60,
    borderRadius: "50%",
    background: value
      ? value === "A"
        ? "#ff4b4b"
        : "#4b8bff"
      : "rgba(255,255,255,0.85)",
    display: "inline-block",
    margin: 6,
    boxShadow: "inset 0 0 8px rgba(0,0,0,0.3)",
    transition: "background 0.3s ease",
  };
  return <div style={style}></div>;
}

function Board({ board, onDrop }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        {Array.from({ length: 7 }).map((_, c) => (
          <button
            key={c}
            onClick={() => onDrop(c)}
            style={{
              width: 60,
              height: 32,
              margin: 4,
              borderRadius: 8,
              background: "#222",
              color: "white",
              cursor: "pointer",
              border: "none",
              fontWeight: "bold",
            }}
          >
            ↓
          </button>
        ))}
      </div>
      <div
        style={{
          background: "linear-gradient(145deg, #005f4b, #009e78)",
          padding: 12,
          borderRadius: 16,
          boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
        }}
      >
        {board.map((row, r) => (
          <div key={r} style={{ display: "flex", justifyContent: "center" }}>
            {row.map((cell, c) => (
              <Cell key={c} value={cell} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState("");
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("");
  const [board, setBoard] = useState(
    Array.from({ length: 6 }, () => Array(7).fill(null))
  );
  const [gameId, setGameId] = useState(null);
  const [side, setSide] = useState(null);
  const [turn, setTurn] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [countdown, setCountdown] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  useEffect(() => {
    socket.on("connect", () => setConnected(true));

    socket.on("waiting", () => {
      setStatus("Waiting for opponent...");
      setCountdown(10);
    });

    socket.on("game_start", ({ gameId, side, opponent, board: b }) => {
      setGameId(gameId);
      setSide(side);
      setOpponent(opponent);
      setBoard(b);
      setStatus(`Game started vs ${opponent}`);
      setTurn("A");
      setCountdown(0);
    });

    socket.on("board_update", ({ board: b }) => {
      setBoard(b);
      setTurn((prev) => (prev === "A" ? "B" : "A"));
    });

    socket.on("game_end", ({ result, winner }) => {
      let msg;
      if (result === "draw") msg = "🤝 The game ended in a draw!";
      else msg = `🏆 Winner: ${winner}`;
      setStatus(msg);
      setModalMessage(msg);
      setShowModal(true);
      fetchLeaderboard();
    });

    socket.on("rejoined", ({ board: b, side, turn }) => {
      setBoard(b);
      setSide(side);
      setTurn(turn);
      setStatus("Rejoined ongoing game");
    });

    socket.on("error_msg", (msg) => setStatus("Error: " + msg));
    fetchLeaderboard();
    return () => socket.off();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((t) => t - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  function join() {
    if (!username) return alert("Enter username");
    socket.emit("join", { username });
    setStatus("Joining...");
  }

  function drop(col) {
    if (!gameId) return alert("No active game");
    socket.emit("make_move", { gameId, col });
  }

  async function fetchLeaderboard() {
    try {
      const res = await fetch(`${SOCKET_URL}/leaderboard`);
      const json = await res.json();
      setLeaderboard(json);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        color: "white",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.1)",
          backdropFilter: "blur(10px)",
          padding: 30,
          borderRadius: 16,
          boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
          textAlign: "center",
          maxWidth: 450,
          width: "90%",
        }}
      >
        <h2 style={{ marginBottom: 16 }}>🎯 Connect 4</h2>

        <div style={{ marginBottom: 14 }}>
          <input
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.4)",
              width: "65%",
              marginRight: 8,
              background: "rgba(255,255,255,0.2)",
              color: "white",
              outline: "none",
            }}
          />
          <button
            onClick={join}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "#00c896",
              color: "white",
              border: "none",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Join
          </button>
        </div>

        <p style={{ marginBottom: 10, color: "#ddd" }}>{status}</p>
        {countdown > 0 && (
          <p style={{ color: "#ff6b6b" }}>
            ⏳ Bot joins in {countdown} seconds...
          </p>
        )}

        <Board board={board} onDrop={drop} />

        <div style={{ marginTop: 24 }}>
          <h3>🏅 Leaderboard</h3>
          <button
            onClick={fetchLeaderboard}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              background: "#4d94ff",
              color: "white",
              border: "none",
              cursor: "pointer",
              marginBottom: 8,
            }}
          >
            Refresh
          </button>
          <ol
            style={{
              textAlign: "left",
              margin: "0 auto",
              maxWidth: 220,
              background: "rgba(255,255,255,0.1)",
              padding: 10,
              borderRadius: 8,
            }}
          >
            {leaderboard.map((l) => (
              <li key={l.username}>
                {l.username} — {l.wins}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #009e78, #00c896)",
              padding: 28,
              borderRadius: 16,
              textAlign: "center",
              color: "white",
              boxShadow: "0 6px 16px rgba(0,0,0,0.5)",
            }}
          >
            <h2>{modalMessage}</h2>
            <button
              onClick={() => setShowModal(false)}
              style={{
                marginTop: 16,
                background: "#222",
                color: "white",
                border: "none",
                padding: "10px 18px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
