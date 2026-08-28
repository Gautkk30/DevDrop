# DevDrop 🚀
### Ephemeral, Peer-to-Peer File Transfer System

DevDrop is a secure, ephemeral, high-speed peer-to-peer file transfer web application built with **WebRTC DataChannels**, **Web Crypto SHA-256 integrity verification**, and a **Node.js/WebSocket signaling server**.

Files stream directly between browser endpoints without ever touching a server disk or database.

---

## ✨ Features

- **Pure Peer-to-Peer**: High-speed binary chunk streaming directly between devices over WebRTC DataChannels.
- **Zero Cloud Storage**: File payloads never touch server disks or cloud storage.
- **SHA-256 Integrity Verification**: Computed on both sides using the Web Crypto API to ensure byte-level integrity.
- **Real Telemetry**: Live throughput measurement with Exponential Moving Average (EMA) smoothing, real-time RTT latency, and backpressure buffer monitoring.
- **Tactile, Minimal Visual System**: Warm Cream (`#FBF9F5`) canvas, Clean White functional surfaces, and Deep Charcoal typography.
- **Pairing**: Connect instantly via 6-character room codes (`7KX9-PQ`), QR code camera scanning, or direct URLs.
- **Security**: DTLS-SRTP end-to-end encryption, optional room password protection, one-time room lifecycle, and executable file detection.
- **Developer Diagnostics**: Inspect WebRTC connection paths (`direct-local`, `direct-internet`, `relayed`), ICE candidate types, and run pre-transfer speed estimation.
- **Command Palette**: Press `⌘K` or `Ctrl+K` for keyboard navigation.

---

## 🛠️ Architecture

```
                      +-----------------------------+
                      |   Node.js / Express / WS    |
                      |   Signaling Server (:3001)  |
                      +--------------+--------------+
                                     |
              1. Room & SDP Signaling (WebSockets / PING-PONG)
                                     |
             +-----------------------+-----------------------+
             |                                               |
             v                                               v
+------------------------+                       +------------------------+
|   Client A (Sender)    |<=====================>|  Client B (Receiver)   |
|  React 18 + Vite       |  2. Direct WebRTC P2P |  React 18 + Vite       |
|  Tailwind CSS          |     Binary Chunks     |  Tailwind CSS          |
|  (:5173)               |     (32 KB / DTLS)    |  (:5173)               |
+------------------------+                       +------------------------+
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or pnpm

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Gautkk30/DevDrop.git
   cd DevDrop
   ```

2. **Install dependencies**:
   ```bash
   # Root / Server
   cd server && npm install
   cd ../client && npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   PORT=3001
   WS_PORT=3001
   CLIENT_ORIGIN=http://localhost:5173
   ROOM_TTL_MINUTES=30
   RATE_LIMIT_MAX_ROOMS_PER_HOUR=50
   ```

4. **Start Development Servers**:
   ```bash
   # In terminal 1 (Signaling Server)
   cd server && npm run dev

   # In terminal 2 (Vite Client)
   cd client && npm run dev
   ```

5. **Open in Browser**:
   Navigate to `http://localhost:5173`.

---

## 📜 License

MIT License.
