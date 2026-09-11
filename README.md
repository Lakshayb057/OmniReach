# 🚀 OmniReach Global — Enterprise Broadcast & Automation Center

OmniReach is an all-in-one omnichannel communications platform combining **WhatsApp (Meta Cloud API & Baileys Web Socket)** and **Email (AWS SES, Resend, Multi-SMTP)** with automated drip Journeys, Live Chat Inbox, and a comprehensive WhatsApp Anti-Ban Protection Suite.

---

## 🌟 Key Architecture & Capabilities

1. **Dual WhatsApp Infrastructure**:
   - **Meta WhatsApp Cloud API (WABA)**: Official Graph API v21.0 integration with template approval synchronization and message analytics.
   - **WhatsApp Baileys Multi-Device Protocol**: Unofficial direct WhatsApp Web socket connection supporting freeform messaging, dynamic QR code & pairing code linking, and zero per-conversation Meta fees.

2. **🛡️ 8-Layer Anti-Ban Protection Suite (Baileys)**:
   - Genuine Windows 11 Chrome browser fingerprint emulation (`Browsers.windows('Chrome')`).
   - Pre-flight WhatsApp number existence check (`onWhatsApp`) to prevent probe bans.
   - Human presence & typing simulation (`available` $\to$ `composing` $\to$ typing delay $\to$ `paused`).
   - Spintax syntax support (`{Hello|Hi|Hey}`) and invisible polymorphic zero-width SHA-256 anti-hash variations.
   - Velocity pacing (4s–10s random jitter) and batch cooldown pauses.
   - Daily send safety caps (Warm-up, Balanced, High-Throughput presets).
   - Automated `STOP` / `UNSUBSCRIBE` keyword detector with contact suppression to prevent user reports.
   - Auto read-receipt acknowledgment for natural bi-directional engagement.

3. **Visual Journey Builder**:
   - Interactive drip campaign automations with trigger filters, delays, WhatsApp prompts/actions, email nodes, and condition branches.
   - Dynamic variable substitution and customer response routing.

4. **WhatsApp Multi-Agent Live Chat Inbox**:
   - Real-time inbound/outbound chat streaming over Socket.IO.
   - Bypasses Meta 24-hour template lockout when communicating over Baileys gateways.

5. **Multi-Tenant Gateway Vault**:
   - Company-partitioned routing, quality ratings, and diagnostic test messengers.

---

## ☁️ Single-Service Deployment on Render

OmniReach is designed to run as a **Single Web Service** on Render, serving both the React SPA frontend and the Node.js / Socket.IO backend on the same port, alongside managed PostgreSQL.

### Option 1: Automatic Blueprint (One-Click)
1. Push this repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com/), click **New +** $\to$ **Blueprint**.
3. Connect your repository: `Lakshayb057/OmniReach`.
4. Render will read `render.yaml` and automatically provision:
   - A **Node Web Service** (Frontend + Backend + Baileys + Socket.IO).
   - A **PostgreSQL Database** (`BroadcastEngine`).
5. Click **Apply**. The application will build and deploy automatically!

---

### Option 2: Manual Web Service Setup on Render

1. **Create PostgreSQL Database on Render**:
   - In Render, click **New +** $\to$ **PostgreSQL**.
   - Name: `omnireach-postgres`
   - Database: `BroadcastEngine`
   - User: `omnireach_user`
   - Copy the **Internal Database URL** (e.g. `postgresql://omnireach_user:password@dpg-xxx:5432/BroadcastEngine`).

2. **Create Web Service on Render**:
   - In Render, click **New +** $\to$ **Web Service**.
   - Connect your repository: `Lakshayb057/OmniReach`.
   - **Runtime**: `Node`
   - **Region**: Same region as your database.
   - **Build Command**:
     ```bash
     npm install && npm run build
     ```
   - **Start Command**:
     ```bash
     npm start
     ```

3. **Configure Environment Variables in Render**:
   | Key | Value / Description |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` (Render default) |
   | `DATABASE_URL` | *Paste your Render Internal Database URL* |
   | `JWT_SECRET` | *Any random 32+ character secure string* |
   | `SUPERADMIN_EMAIL` | `SuplerLucky@gmail.com` |
   | `SUPERADMIN_PASSWORD` | `Lakshay@123` |

4. **Deploy**:
   - Click **Create Web Service**.
   - Render will build the Vite frontend, start the Express backend, automatically initialize database tables & schemas, seed the Superadmin, and serve the application!

---

## 🔑 Default Superadmin Login

When the database is initialized, the following Superadmin account is automatically seeded:

- **Email**: `SuplerLucky@gmail.com`
- **Password**: `Lakshay@123`

*(You can change these in `/superadmin` or via environment variables before initial boot).*

---

## 🛠️ Local Development

1. **Clone & Install**:
   ```bash
   git clone https://github.com/Lakshayb057/OmniReach.git
   cd OmniReach
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your local PostgreSQL credentials
   ```

3. **Start Development Servers**:
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:5000`

---

## 📜 License
Proprietary enterprise broadcasting software. All rights reserved.
