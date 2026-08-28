# DevDrop — Master Build Prompt for Google Antigravity

*Paste this entire document as your first message to Antigravity, in a workspace pointed at the DevDrop repository (or an empty one, if this is a fresh project). It is the complete specification — read all of it before taking any action.*

## 1. How You Should Work From This Document
- Do not start writing code after reading this. Your first move is to inspect the repository (if one exists) and produce the analysis described in **Section 19 — Required First Response**.
- Ask about decisions that are genuinely ambiguous or consequential, using the format in **Section 18 — Question Policy**. Do not ask about anything this document already answers.
- Once your questions are answered, implement the project **incrementally**, following the phases in **Section 16**. Never attempt the whole application in one pass.
- Treat everything below as binding unless told otherwise in a follow-up message.

## 2. Non-Negotiable Rules
These override convenience, speed, or "obvious" shortcuts:
1. **PWA only.** No Electron, no native desktop build. The browser is the runtime.
2. **No fake features, anywhere.** Every status, number, or state shown to the user (speed, ETA, connection type, connection quality, throughput, integrity verification, WebRTC/ICE state) must come from a real, measured value. If something can't be measured or isn't built yet, say so in the UI — never simulate or fabricate it.
3. **No user-controlled room-expiration timer.** Rooms expire automatically on a system-defined lifecycle. Do not add UI letting the user pick 15 min / 30 min / 1 hour / custom.
4. **No accounts, no permanent storage of file contents, no cloud storage** — not even quietly, as a "nice to have."
5. **Never assume network topology.** Do not infer "same Wi-Fi = local" or "different network = Internet." Always report the actual connection type from real WebRTC/ICE state.
6. **Stay in scope** (Section 17). Do not add AI features, accounts, social features, chat, payments, subscriptions, cloud storage, public hosting, or permanent history, even if one would feel like a natural extension.
7. **Don't touch `README.md`, `LICENSE`, or package metadata** unless explicitly asked.
8. **Build in phases** (Section 16). Don't implement the whole app in one giant step.
9. **Ask before consequential, hard-to-reverse decisions** (Section 18) — but don't re-ask what's already decided here.
10. **The first reply must be analysis, not code** (Section 19).

## 3. Product Overview
- **Name:** DevDrop
- **Tagline:** "Transfer files instantly. No account. No cables."
- **What it is:** A premium, privacy-focused Progressive Web App for transferring files directly between devices — an AirDrop-like experience that is web-first and cross-platform rather than tied to one vendor's ecosystem.
- **Target platforms:** desktop, laptop, Android, iPhone/iPad (where browser capabilities allow), and installed/standalone PWA environments where supported.
- **Core loop:** `CREATE → CONNECT → TRANSFER → DONE`
- **Quality bar:** this is a flagship portfolio piece. It should demonstrate real WebRTC, real-time signaling, peer-to-peer architecture, chunking and backpressure handling, connection-state management, network fallback, transfer integrity, security, privacy engineering, PWA fundamentals, and clean architecture. But **do not add complexity just to look impressive** — the target is a simple product with excellent UX, real technology, a reliable implementation, and clean engineering, not a maximal feature count.

## 4. Core Flow & Room System

### 4.1 Create / Join
A user opens DevDrop and either **creates a room** or **joins a room**. Creating a room generates: a secure, unpredictable session identifier; a human-friendly room code; a QR code; and a shareable join link. Joining is possible by scanning the QR code, entering the room code manually, or opening the shared link directly.

### 4.2 Room Properties & Lifecycle
Each room should track: secure unpredictable identifier, human-friendly room code, QR code, shareable link, creation timestamp, expiration timestamp, connected devices, active transfers, optional password, and optional one-time-use behavior.

Rooms are **temporary and must always expire automatically** (see Rule #3 in Section 2 — there must be no user-facing timer picker). Expired/stale rooms and their metadata must be cleaned up.

### 4.3 One-Time Rooms
Support a room mode that **automatically closes once its intended transfer/session completes** — this is behavior tied to session completion, not a user-facing countdown. Implement it if the architecture supports it cleanly.

### 4.4 Password-Protected Rooms
Let the room creator choose **Open** or **Password protected** at creation time. Never expose the password beyond what's operationally necessary to validate it (don't log it, don't return it in unrelated responses).

### 4.5 Shareable Links & QR
Links look like `devdrop.app/join/ROOM` for illustration only — **the real domain must be configurable via environment variable, never hardcoded.** Opening a room link should drop the visitor straight into the join flow. The room-created screen should look roughly like:
```
YOUR ROOM IS READY

7KX9-PQ

[QR CODE]

Scan with another device

[Copy code]   [Share link]

Room expires in: 14:32
```
The QR must encode whatever's needed to join directly. Always provide manual code entry as a fallback, including for devices/browsers that can't scan.

### 4.6 QR Scanning
On capable mobile browsers, provide camera-based scanning. Explicitly handle: camera permission denied, camera unavailable, invalid QR, wrong/nonexistent room, expired room, and browsers without camera-access support — with manual code entry always available as a fallback.

## 5. Connectivity Architecture (read carefully — this is a core differentiator)

### 5.1 The Governing Principle
**Do not assume "same Wi-Fi = local transfer" or "different network = Internet transfer."** DevDrop must determine the *actual* connection path from real networking/WebRTC state and report that — never a guess. The UI should say "Direct connection" or "Relayed connection" based on what ICE/WebRTC actually negotiated, never "Wi-Fi transfer" just because both devices happen to show as being on Wi-Fi.

### 5.2 Connection Preference Hierarchy
1. Direct/local WebRTC connection where possible
2. Direct WebRTC connection over the Internet where possible
3. TURN-relayed WebRTC connection when a direct peer connection can't be established

### 5.3 Nearby-Device Scenarios to Support
- **Home Wi-Fi:** laptop + phone on the same network
- **Phone hotspot:** phone + laptop
- **Laptop hotspot:** laptop + phone + tablet

When a direct WebRTC path is achievable, use it — the goal is to avoid unnecessarily routing file contents through a cloud relay when devices are nearby. **Do not build this around native LAN scanning or assume unrestricted local-network discovery from the browser** — rely on the room/QR/code pairing mechanism plus WebRTC negotiation instead.

### 5.4 Remote (Cross-Network) Transfers
DevDrop must also work for devices on completely different networks (e.g., a laptop in Kerala and a phone in Delhi). Attempt direct WebRTC first; fall back to TURN relay when direct connectivity isn't possible. The user-facing experience should stay just as simple either way — the connection-type indicator is what changes, not the flow.

## 6. File Transfer Engine

### 6.1 Ground Rules
This must be a **real implementation** — no mock progress, no simulated speed, no faked completion. Use WebRTC DataChannels for peer-to-peer transfer wherever practical. All statistics shown to the user (speed, average speed, ETA) must be calculated from actual bytes transferred, updating dynamically as the transfer proceeds — never a fixed promised time. For example, "2 GB at 48 MB/s ≈ 42 seconds" is a *live estimate from real throughput*, not a canned number.

### 6.2 Required Capabilities
The transfer engine must correctly handle: small files, large files, and multiple files at once; file queues; chunking of large files and DataChannel backpressure; live progress, current speed, average speed, and ETA; cancellation, failed transfers, connection interruption, and reconnection; **resuming interrupted transfers** from the appropriate byte offset where possible (6.3); multiple simultaneous destinations where the architecture reasonably allows (Section 8.1); and **integrity verification** (6.4).

### 6.3 Interrupted Transfers & Resume
This is a production-grade requirement, not a nice-to-have. On connection loss mid-transfer, show something like:
```
CONNECTION LOST

Transfer paused at:
7.2 GB / 8 GB

[Resume]
```
Resume from the correct offset when technically possible; when resume genuinely isn't possible, fail gracefully and explain why, rather than silently restarting or hanging.

### 6.4 Transfer Verification
After a transfer completes, verify integrity using an appropriate hashing/checksum mechanism where practical, e.g.:
```
TRANSFER COMPLETE

project.zip
2.00 GB

Integrity verified ✓
```
**Never claim "verified" unless verification actually ran.**

## 7. Connection Quality, Connection Test & Developer Diagnostics

### 7.1 Live Connection Display
Show real connection state plainly during a transfer, e.g. `CONNECTED · ● Direct connection · 48.6 MB/s` or `CONNECTED · ● Relayed connection · 8.4 MB/s`.

### 7.2 User-Facing Quality Rating
Provide a simple rating — **Excellent / Good / Fair / Poor / Disconnected** — based on real measured signal (throughput, RTT, packet loss where available), never an arbitrary or cosmetic value.

### 7.3 Pre-Transfer Connection Test
Where practical, let the user run a quick test before sending something large:
```
Connection: Direct
Latency: 12 ms
Measured throughput: 48 MB/s
Estimated 2 GB transfer: ~45 seconds
```
Label this clearly as an **estimate** — never imply it's a guarantee.

### 7.4 Developer Mode / Diagnostics Panel
Provide an advanced, opt-in diagnostics area (it doesn't need to clutter the main UI) that surfaces, wherever genuinely measurable: connection type and WebRTC/ICE connection state (including ICE candidate type where available); RTT/latency where available; current and average throughput; packet loss where reliably measurable; DataChannel state and buffered amount; transfer chunk size, transfer state, and reconnection state; and encryption/secure-transport status where meaningful.

**If a metric can't be reliably obtained in-browser, omit it rather than faking it.** This panel exists to make the underlying architecture transparent and to aid debugging — treat it as a technical showcase, not decoration.

## 8. Multi-Device & File Handling

### 8.1 Multiple Devices in a Room
A room may contain several connected devices, e.g.:
```
ROOM 7KX9-PQ

● Gautham's Laptop
● Gautham's Phone
● Tablet
● Work PC
```
The sender picks a destination device. Support one-to-one transfers between any pair of connected devices, and one-to-many where the architecture reasonably permits — favor **correctness over premature optimization**, but avoid unnecessarily duplicating a huge transfer's data path if an efficient design can reasonably avoid it.

### 8.2 Send to Everyone
Offer a convenient "send to all eligible connected devices" option, e.g.:
```
5 DEVICES CONNECTED

presentation.pdf

☑ Phone   ☑ Laptop   ☑ Tablet   ☑ PC   ☑ Mac

[SEND TO 5 DEVICES]
```
Handle simultaneous multi-destination transfers safely, and keep each destination's progress/status transparent to the sender.

### 8.3 Folder Transfer
Support folder selection/transfer where the browser genuinely allows it. **Detect capability rather than assuming parity across browsers** — fall back gracefully to multiple-file selection where folder APIs aren't available, and clearly explain the limitation rather than silently degrading. Preserve folder structure wherever folder transfer is supported.

### 8.4 File Previews
Support previews for common, practical formats: images, video, PDFs, plain text, common code/text files, and audio where the browser supports it. Don't try to cover every format — fall back to a clean, generic file representation for anything unsupported.

### 8.5 File Safety Warnings
For incoming files that could be executable or otherwise risky, show a clear warning before accepting, e.g.:
```
INCOMING FILE

setup.exe
182 MB

This file can run programs on your device.

[Reject]   [Accept anyway]
```
Never claim DevDrop can guarantee file safety, and never auto-execute anything.

### 8.6 Session Transfer History
Show session-level history only, e.g.:
```
THIS SESSION

↑ project.zip     2.1 GB   42 sec
↓ IMG_8292.jpg    5.2 MB   1.2 sec
```
This is metadata about what happened in this session — **not** a permanent, cloud-based history. Keep session metadata and file contents explicitly distinct in the implementation.

## 9. PWA Requirements
DevDrop **must** be a Progressive Web App. Support, wherever the platform permits: a Web App Manifest, a service worker, installability, standalone display mode, an app icon, splash/startup behavior, an offline app shell, a responsive layout, install prompts where appropriate, and notifications where supported.

**Critical distinction to build correctly:** "the app shell is available offline" is not the same as "a file transfer can happen without a network." The UI must never conflate the two — opening DevDrop offline is fine, but transferring a file requires an actual connection to the peer.

No Electron, no native desktop build for the MVP — the browser is the primary runtime, and the implementation must respect normal browser security/permission boundaries rather than assume native OS networking APIs are available.

## 10. UI/UX & Design Direction

### 10.1 Feel
Premium, minimal, modern, technical, fast, trustworthy, privacy-focused. Use modern developer-tool quality as an aesthetic reference point — **Linear, Arc, Raycast, AirDrop, and Apple's system interfaces** — for craft and clarity only, never for copying branding or layouts.

**Avoid:** generic SaaS templates, excessive gradients or glassmorphism, excessive neon, fake "futuristic HUD" styling, overly complex dashboards, excessive decorative graphics, unnecessary animation, and generic AI-generated-looking aesthetics. Clarity beats decoration every time.

### 10.2 Responsive, Mobile-First Experience
Mobile is a first-class citizen, not a shrunk-down desktop layout. A representative real-world flow the UI must support smoothly:
```
Laptop: Create Room
Phone:  Scan QR
Phone:  Join
Laptop: Send file
Phone:  Receive
```
The whole experience needs to work well on desktop, laptop, tablet, and mobile.

### 10.3 Landing Page
A polished landing page with the core message:
```
TRANSFER FILES INSTANTLY.
NO ACCOUNT.
NO CABLES.
NO PERMANENT CLOUD STORAGE.
```
Primary CTA: **Start Transferring**. Secondary CTA: **How It Works**. Minimal, premium visual style — explain the product simply.

### 10.4 Animation & Micro-interactions
Use purposeful, subtle, fast micro-interactions for: room creation, a device joining, connection establishment, drag-and-drop, file selection, transfer progress, transfer completion, QR display, copying the room code, and error recovery. **Respect `prefers-reduced-motion`.**

### 10.5 Accessibility
Aim for WCAG 2.1 AA in practice: semantic HTML, full keyboard navigation, visible focus states, screen-reader labels, accessible progress indicators, accessible QR-flow instructions, accessible error messaging, sufficient contrast, reduced-motion support, and properly labeled buttons/forms.

### 10.6 Notifications
Where supported, send useful, sparing notifications — e.g., "File transfer complete — project.zip" or "Your phone disconnected." Respect the browser's permission model, never spam, and make sure the app functions fully when notifications are unavailable or denied.

## 11. Security & Privacy

### 11.1 Security
Treat this as a real production system: HTTPS in production and WSS for realtime; secure, unpredictable room identifiers and proper room authorization; session expiration, input validation, and rate limiting; filename sanitization and file-size validation; WebSocket abuse prevention and resource-exhaustion protection; sensible CORS configuration and secure headers; safe error handling that doesn't leak internals; and reliable cleanup of expired rooms plus protection against unauthorized room access. Don't make unrealistic security claims anywhere in the UI or docs.

### 11.2 Privacy
Core principle: **no account, no permanent file storage.** File contents must never be permanently stored by the backend. Temporary room/session metadata may exist only as long as operationally necessary. The implementation (and ideally the product copy) should make explicit what exists temporarily, what gets deleted and when, and what is never stored at all. Never add cloud storage quietly.

## 12. Technical Architecture

### 12.1 Preferred Stack
Frontend: **React + TypeScript**. Build tooling: **Vite**. PWA: Web App Manifest + service worker (or equivalent appropriate tooling). Backend: **Node.js + Express**. Realtime/signaling: **WebSocket**. Peer-to-peer: **WebRTC DataChannel**. Database: **PostgreSQL, only where genuinely necessary**. Styling: a maintainable CSS architecture or lightweight styling solution. Choose supporting libraries carefully and avoid unnecessary dependencies.

### 12.2 Explicitly Excluded
Electron, microservices, Kubernetes, GraphQL (unless clearly justified), heavy AI frameworks, unnecessary state-management libraries, and excessive abstraction. Keep the architecture understandable by a single engineer reading the repo.

### 12.3 Backend Responsibilities
Room creation/joining/lifecycle, device/session registration, WebSocket signaling, WebRTC coordination, room authorization, password validation, expiration, cleanup, rate limiting, health checks, and logging. **The backend must never permanently store file contents.**

### 12.4 WebRTC Implementation Concerns
Implement this properly, not superficially: signaling, SDP offer/answer, ICE candidates, STUN, TURN, DataChannel setup, connection states, ICE states, reconnection handling, failure handling, DataChannel buffering/backpressure, and chunking. **Never assume a direct connection is always achievable.**

### 12.5 Data Model (if PostgreSQL is used)
Keep persistence minimal. Plausible entities: `Room`, `Device`, `Session`, `Transfer`, `TransferItem`. Be explicit about what's ephemeral vs. persisted, use expiration timestamps and cleanup jobs, and **never store file contents in the database.**

### 12.6 API Surface
Clean REST endpoints for room/session management, plus WebSocket events covering at least: room created, device joined, device left, signaling messages, transfer offer, transfer acceptance, transfer cancellation, transfer completion, connection failure, and room expiration. Use consistent schemas and validation throughout.

### 12.7 Environment Variables
Never hardcode secrets or domains. At minimum, externalize: database URL, backend URL, client URL, STUN configuration, TURN configuration and credentials, session secrets, and other production settings. Provide a safe, complete `.env.example`. Never commit real credentials.

## 13. Error Handling Philosophy
Handle at least: invalid room, expired room, incorrect password, room unavailable, connection failure, WebRTC failure, network interruption, file too large, unsupported file, permission denied, camera unavailable, QR failure, transfer failure, server unavailable, and browser incompatibility.

For every meaningful error, the UI must: **(1)** explain what happened, **(2)** explain what the user can do about it, and **(3)** offer a path to recovery wherever one exists.

## 14. Project Structure & File Discipline
Keep frontend, backend, and shared concerns cleanly separated, and favor reusable components. Keep networking logic separate from UI logic, file-transfer logic separate from signaling logic, and connection management separate from room UI. Avoid overengineering — this should stay easy to navigate.

**Before modifying the repository:** inspect what already exists. Don't overwrite working code, delete files, or touch unrelated files without a clear reason tied to the current phase. Don't change configuration merely for convenience.

**Do not modify `README.md`, `LICENSE`, or package metadata unless explicitly asked to.** Only touch files required for the current implementation step.

## 15. Testing Expectations
Cover, at minimum: room creation and joining (including via QR and with a password), multiple devices in a room, file transfer (single, multiple, large, and via folders where supported), cancellation, connection interruption and resume, room expiration, WebRTC failure and TURN fallback, transfer integrity, responsive UI, PWA installation, the offline app shell, error states, and security controls.

**The project is not "done" just because it compiles.** Working, verified functionality is the bar.

## 16. Development Process — Work in Phases
Work incrementally. Suggested phases (refine the sequence if your own analysis suggests a better one, but flag any material change as a question):

1. Inspect the repository and understand what already exists.
2. Confirm architecture and resolve open questions.
3. Create the project foundation.
4. Implement room lifecycle.
5. Implement core UI.
6. Implement QR/code joining.
7. Implement WebSocket signaling.
8. Implement WebRTC connections.
9. Implement file transfer.
10. Implement transfer queues, progress, speed, and ETA.
11. Implement reconnection and resume.
12. Implement multiple devices.
13. Implement folder transfer and previews.
14. Implement verification and diagnostics.
15. Implement PWA functionality.
16. Implement notifications and advanced UX.
17. Security hardening.
18. Testing.
19. Final UI/UX polish.

**Do not attempt to implement the entire application in one giant step.**

## 17. Scope Boundaries — Do Not Add Without Explicit Request
The requested feature set is already extensive. Do **not** add: AI features, user accounts, social/networking features, chat, payments or subscriptions, cloud storage, public file hosting, permanent transfer history, unrequested third-party integrations, a native desktop application, Electron, or a user-selectable self-destruct timer — **unless explicitly requested later.**

## 18. Question Policy
Before implementing: read this whole document, inspect the repository, determine what already exists, identify dependencies, and propose an architecture. Then identify anything that genuinely needs a decision and ask — **but only when it matters.**

**Don't ask** things like "what color should the button be" when the design direction already answers it, or "should I use React" when the stack is already specified.

**Do ask** when a choice affects: architecture, cost, security, privacy, product behavior, major UX, scope, browser compatibility, or data flow.

Use this format when asking:
```
QUESTION
[the question]

WHY IT MATTERS
[the concrete consequence of getting this wrong]

RECOMMENDATION
[the suggested default, and why]

OPTIONS
A. ...
B. ...
```
Worked example:
> "Should DevDrop support server-relayed file transfer if WebRTC fails entirely?
>
> **Why it matters:** It affects server bandwidth and the reliability of transfers.
>
> **Recommendation:** No for the initial implementation. Use TURN as the WebRTC relay and clearly report when a relay is in use.
>
> **Options:** A. WebRTC + TURN only. B. WebRTC + TURN + server file-transfer fallback."

Wait for an answer on anything that materially changes architecture, privacy, or scope before proceeding on that part.

## 19. Required First Response
Do **not** start implementing after reading this document. The first reply must contain, in order:

1. Your understanding of DevDrop and its purpose.
2. Your interpretation of the complete feature set.
3. Your proposed technical architecture.
4. Your proposed repository structure.
5. Your proposed implementation phases (confirming or refining Section 16).
6. Important technical risks or browser limitations you foresee.
7. Important assumptions you're making.
8. Any questions that genuinely require a decision, formatted per Section 18.

Then wait for a response before proceeding. Once the important questions are answered, proceed phase by phase per Section 16. **Prioritize correctness and maintainability over speed of code generation** throughout.
