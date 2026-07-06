# WhatsApp Clone: E2EE Web Client & Native Android App

A fully featured, highly secure WhatsApp Web Clone built with a Node.js Express/Socket.io backend, featuring End-to-End Encryption (E2EE), robust network connection resilience, Twilio SMS verification fallbacks, and a native Android WebView wrapper.

---

## 🚀 Key Features

### 1. 🔒 End-to-End Encryption (E2EE)
- **Zero-Knowledge Architecture**: Messages are encrypted on the client side using browser Web Crypto APIs (`SubtleCrypto`) before transmission. Private keys are never shared with the server.
- **XOR Private Key Storage**: Client-side private keys are encrypted in `localStorage` using a base64 XOR cipher.
- **Key Auto-Rotation**: Dynamic cryptographic key regeneration and auto-rotation occurs every 30 days.
- **Decryption Resilience**: Implements an automatic decryption retry loop with fallback keys, alongside a UI "Resync Keys" trigger.

### 2. 🛡️ 35 Layers of Security Hardening
- **HTTP Server Protections**: Custom Content Security Policy (CSP), Helmet secure headers, HPP parameter pollution validation, CORS origin lock, and directory traversal filters.
- **Rate Limiters**: REST endpoint limiters (100 calls/15 mins) and Socket.io handshake throttles per IP.
- **Socket Safety**: Socket connection limiters (max 3 concurrent tabs per user ID), socket event payload schema checks, and message rate-limiting (max 5/sec).
- **Client Side Hardening**: DOM XSS sanitization, frame-busting protection, inline code execution blocker (`eval`), and clipboard copy-event cleaners.
- **Database Integrity**: Atomic file system writes using temporary files and synchronous rename calls to prevent database corruption.

### 3. 📱 Native Android App (WebView Wrapper)
- **Offline Assets**: Bundles the entire client interface inside the APK's native Android assets folder (`file:///android_asset/public/index.html`).
- **Dynamic Port Handlers**: Automatically routes API calls to the local emulator loopback `http://10.0.2.2:3000` when running locally, or fallback to server endpoints.
- **Cleartext Permitted**: Tailored network configurations enabling cleartext HTTP traffic for local development.

### 4. 📞 Full-Featured Messaging Experience
- **Granular Privacy Controls**: Configure Last Seen, Profile Photo visibility, About info, Read Receipts, and Disappearing Messages (24h/7d/90d).
- **Status Composer**: Create text status updates with gradient presets or upload image status updates with captions (auto-expiring in 24 hours).
- **Multimedia & Calls**: Voice notes recording, file attachment handlers, location shares, WebRTC-powered voice & video calls, and call minimizing window states.
- **Twilio SMS Integrations**: Seamless phone number lookups, auto-adding contacts by phone, and Twilio SMS invitation templates.

---

## 🛠️ Getting Started (Local Server)

### 1. Installation
Clone the repository and install the Node.js backend dependencies:
```bash
git clone https://github.com/ap294105-cloud/whatsapp-clone.git
cd whatsapp-clone
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory and configure your credentials:
```env
PORT=3000
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number
```
*Note: If Twilio is not configured, the system automatically falls back to local terminal code simulation.*

### 3. Running the Server
Start the backend server:
```bash
npm start
```
The client interface will be available at [http://localhost:3000](http://localhost:3000).

---

## 📦 Building the Android APK

The project contains a pre-configured Gradle project in the `android-app` folder.

1. Ensure **JDK 17 or JDK 21** is installed and `$JAVA_HOME` is set.
2. Ensure your `$ANDROID_HOME` points to your Android SDK folder.
3. Open a terminal in the `android-app` directory and compile the package:
```powershell
cd android-app
.\gradlew.bat assembleDebug
```
The compiled Android package will be available at:
`android-app/app/build/outputs/apk/debug/app-debug.apk`

---

## 📜 License
This project is open-source and available under the MIT License.
