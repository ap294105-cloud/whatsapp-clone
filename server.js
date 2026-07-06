require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const fs = require("fs");
const twilio = require("twilio");

// Security dependencies
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");

const app = reportExpressSetup();
const server = http.createServer(app);

// Layer 11: CORS constraints for Socket.io connections
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Setup directories for persistent data
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const STATUSES_FILE = path.join(DATA_DIR, "statuses.json");
const CALLS_FILE = path.join(DATA_DIR, "calls.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const GROUPS_FILE = path.join(DATA_DIR, "groups.json");
const KEYS_FILE = path.join(DATA_DIR, "keys.json");

// Bot Profiles Data
const BOTS = [
  { id: "bot-alice", name: "Alice 💻 (Dev Friend)", avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Alice", phone: "+1 (555) 349-2041", bio: "Main branch contains bugs. Proceed with caution. 🚀", status: "online", isBot: true },
  { id: "bot-bob", name: "Bob 💼 (Project Lead)", avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Bob", phone: "+1 (555) 892-4410", bio: "In meetings all day. Email if urgent.", status: "offline", isBot: true },
  { id: "bot-charlie", name: "Charlie Grandma ❤️", avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Charlie", phone: "+1 (555) 438-1992", bio: "Baking cookies today! 👵🍪", status: "online", isBot: true },
  { id: "bot-david", name: "Coach David 🏋️‍♂️", avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=David", phone: "+1 (555) 723-5591", bio: "Eat, sleep, lift, repeat. 💪 No excuses!", status: "online", isBot: true },
  { id: "bot-eva", name: "Eva ✈️ (Travel Vlog)", avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Eva", phone: "+1 (555) 234-9008", bio: "Currently exploring Tokyo! 🇯🇵🗼", status: "online", isBot: true }
];

function reportExpressSetup() {
  const serverApp = reportExpressSetupCore();
  
  // Layer 8: Disable Express fingerprinting header
  serverApp.disable("x-powered-by");
  
  // Layer 1 & 2 & 9: Secure headers with Helmet + Custom Content Security Policy
  serverApp.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://api.dicebear.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "https://api.dicebear.com", "https://images.unsplash.com", "https://www.gstatic.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          connectSrc: ["'self'", "ws:", "wss:", "http://localhost:3000", "http://127.0.0.1:3000", "https://www.gstatic.com", "https://identitytoolkit.googleapis.com"],
          frameSrc: ["'self'", "https://*.firebaseapp.com"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
    })
  );

  // Layer 3: CORS Restriction
  serverApp.use(cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Reset-Token"]
  }));

  // Layer 7: Parameter Pollution Protection
  serverApp.use(hpp());

  // Layer 10: Limit POST payload body size to prevent memory DoS
  serverApp.use(express.json({ limit: "100kb" }));
  serverApp.use(express.urlencoded({ extended: true, limit: "100kb" }));

  // Layer 4 & 5: REST API General Rate Limiter (Max 100 requests per 15 minutes per IP)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many requests from this IP, please try again after 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false
  });
  serverApp.use("/api/", apiLimiter);

  // Layer 20: Prevent directory listing / traversal
  serverApp.use((req, res, next) => {
    if (req.path.endsWith("/") && req.path !== "/") {
      return res.status(403).json({ error: "Access denied. Directory listing disabled." });
    }
    next();
  }, express.static(path.join(__dirname, "public")));

  return serverApp;
}

function reportExpressSetupCore() {
  return express();
}

// Input XSS Sanitizer Helper (Layer 6 & 16)
function sanitizeHTMLInput(str) {
  if (typeof str !== "string") return "";
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Helper to read database JSON files
function readJSON(file, defaultData = []) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
  }
  return defaultData;
}

// Layer 18: Atomic Database file writing (write to temp file, then rename atomically)
function writeJSON(file, data) {
  const tempPath = `${file}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tempPath, file);
  } catch (err) {
    console.error(`Error atomically writing ${file}:`, err);
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
  }
}

// Bot Responses Logic
const BOT_RESPONSE_ENGINE = {
  "bot-alice": {
    greetings: ["Hey! What's coding today? 💻", "Hi! Hope your compilers aren't throwing warnings.", "Hello! Just finished updating my node dependencies 💀"],
    keywords: [
      { keys: ["leak", "bug", "error", "crash", "compile", "run", "broken"], replies: ["Ugh! Did you try console.logging every line? 😅 Or check stackoverflow?", "Check if there is a circular dependency. That always leaks memory in JS.", "It works on my machine! 🤷‍♀️ Let's do a git pull and verify."] },
      { keys: ["work", "project", "app", "website", "code"], replies: ["Building a WhatsApp clone? That's awesome! Check out the Web Audio API.", "JavaScript is fun until you try to compare `[] === ![]` which is somehow true... 😂"] }
    ],
    default: ["Let's grab coffee soon! ☕ I need to step away from this terminal.", "Git commit -m 'Fixed formatting (broken whole app)'. Classic! 😭"]
  },
  "bot-bob": {
    greetings: ["Good day. Hope we are making progress on our sprints.", "Hello. Please share your status update for the daily standup."],
    keywords: [
      { keys: ["update", "status", "ready", "finish", "done", "slide", "presentation"], replies: ["Excellent work. Please upload the deck to the shared workspace for feedback.", "Great. Send me the link so I can review before the sync call with stakeholders."] }
    ],
    default: ["Let's schedule a alignment sync tomorrow at 10 AM. 📅", "Please make sure all changes are documented in the project wiki. 💼"]
  },
  "bot-charlie": {
    greetings: ["Hello my dear! How are you doing? ❤️👵", "Hi sweetie! Hope you are taking proper care of yourself."],
    keywords: [
      { keys: ["eat", "food", "dinner", "lunch", "hungry", "cookie", "cook"], replies: ["You must eat healthy meals! I am making delicious pot roast today. 🍲", "I will bake some fresh chocolate chip cookies and send them over to you!"] }
    ],
    default: ["Remember to take small breaks and rest your eyes, dear. 👀👵", "I'm trying to learn how to send these emoji symbols. Hope I got it right! 😊"]
  },
  "bot-david": {
    greetings: ["Let's get it! Ready to crush today's goals? 💪", "Rise and shine! The weights are waiting. No excuses!"],
    keywords: [
      { keys: ["workout", "gym", "squat", "lift", "lazy", "tired", "run"], replies: ["Tired? That is just mental weakness. Get up, put your shoes on, and push! 🏆", "Consistency beats talent every single time. 45 minutes of heavy sweat today. Let's go!"] }
    ],
    default: ["Excuses don't burn calories. Sweat does! 🏋️‍♂️💪", "Your only limit is you. Break through that mental barrier!"]
  },
  "bot-eva": {
    greetings: ["Kon'nichiwa! 🇯🇵 Spot me in the streets of Shibuya!", "Hey wanderer! Where is our next flight heading? ✈️🗺️"],
    keywords: [
      { keys: ["where", "location", "hotel", "tokyo", "japan", "coordinate"], replies: ["Currently filming near Senso-ji Temple. The architecture is breathtaking! 🏮", "Check the shared location I sent earlier. It's the best local ramen shop!"] }
    ],
    default: ["Travel is the only thing you buy that makes you richer. ✈️🗺️", "Next stop: Kyoto! The bamboo forest awaits. 🎋"]
  }
};

function generateBotResponse(botId, messageText) {
  const engine = BOT_RESPONSE_ENGINE[botId] || BOT_RESPONSE_ENGINE["bot-alice"];
  const textClean = messageText.toLowerCase().trim();
  for (const group of engine.keywords) {
    if (group.keys.some(k => textClean.includes(k))) {
      return group.replies[Math.floor(Math.random() * group.replies.length)];
    }
  }
  const greetingsList = ["hi", "hello", "hey", "morning", "yo"];
  if (greetingsList.some(g => textClean.startsWith(g) || textClean === g)) {
    return engine.greetings[Math.floor(Math.random() * engine.greetings.length)];
  }
  return engine.default[Math.floor(Math.random() * engine.default.length)];
}

// API Endpoint to Reset DB with admin key verification (Layer 22)
app.post("/api/reset", (req, res) => {
  const token = req.headers["x-admin-reset-token"] || req.query.token;
  const secureToken = process.env.ADMIN_RESET_TOKEN || "AppSecretAdminResetKey2026";
  if (!token || token !== secureToken) {
    return res.status(403).json({ success: false, error: "Access Denied. Invalid admin token." });
  }

  writeJSON(MESSAGES_FILE, []);
  writeJSON(STATUSES_FILE, []);
  writeJSON(CALLS_FILE, []);
  writeJSON(USERS_FILE, []);
  writeJSON(GROUPS_FILE, []);
  writeJSON(KEYS_FILE, {});
  res.json({ success: true, message: "Server database reset." });
});

// API Endpoint to get user profile by phone
app.get("/api/profile", (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ success: false, error: "Phone number required" });
  
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.phone === phone);
  if (user) {
    res.json({ success: true, exists: true, profile: user });
  } else {
    res.json({ success: true, exists: false });
  }
});

// API Endpoint to create/update user profile (Sanitized - Layer 6 & 23)
app.post("/api/profile", (req, res) => {
  let { phone, name, avatar, bio, userId } = req.body;
  if (!phone || !name) return res.status(400).json({ success: false, error: "Phone and Name are required" });
  
  phone = sanitizeHTMLInput(phone);
  name = sanitizeHTMLInput(name);
  avatar = sanitizeHTMLInput(avatar);
  bio = sanitizeHTMLInput(bio);
  userId = sanitizeHTMLInput(userId);
  
  const users = readJSON(USERS_FILE);
  const existingIdx = users.findIndex(u => u.phone === phone);
  
  const profile = { phone, name, avatar, bio, userId };
  
  if (existingIdx >= 0) {
    users[existingIdx] = profile;
  } else {
    users.push(profile);
  }
  
  writeJSON(USERS_FILE, users);
  res.json({ success: true, profile });
});

// API Endpoint to get Firebase Configuration
app.get("/api/firebase-config", (req, res) => {
  const config = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  };
  if (config.apiKey) {
    res.json({ success: true, config });
  } else {
    res.json({ success: false, error: "Firebase configuration is not defined." });
  }
});

// API Endpoint to Generate and Send OTP via Twilio
app.post("/api/send-otp", async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ success: false, error: "Phone number is required." });
  }

  // Generate 6-digit random code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  activeOTPs[phoneNumber] = {
    code: code,
    expiry: Date.now() + 5 * 60 * 1000 // 5 minutes validity
  };

  if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
    try {
      await twilioClient.messages.create({
        body: `Your WhatsApp Web Clone verification code is: ${code}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
      console.log(`[SMS Success] OTP code sent successfully to ${phoneNumber}`);
      res.json({ success: true });
    } catch (err) {
      console.error(`[SMS Error] Failed to dispatch SMS via Twilio to ${phoneNumber}:`, err);
      res.status(500).json({ success: false, error: "Failed to dispatch verification SMS via Twilio." });
    }
  } else {
    // Print to terminal for local simulation in case Twilio is not yet configured
    console.warn(`\n----------------------------------------\n[DEMO CODE NOTICE] Twilio not configured!\nOTP verification code generated for ${phoneNumber}: ${code}\n----------------------------------------\n`);
    res.status(500).json({ success: false, error: "Twilio credentials are not configured on the server. Code was printed to server terminal." });
  }
});

// API Endpoint to Verify OTP Code
app.post("/api/verify-otp", (req, res) => {
  const { phoneNumber, code } = req.body;
  if (!phoneNumber || !code) {
    return res.status(400).json({ success: false, error: "Phone number and verification code are required." });
  }

  const record = activeOTPs[phoneNumber];
  if (!record) {
    return res.status(400).json({ success: false, error: "No OTP request found for this phone number." });
  }

  if (Date.now() > record.expiry) {
    delete activeOTPs[phoneNumber];
    return res.status(400).json({ success: false, error: "Verification code has expired." });
  }

  if (record.code === code) {
    delete activeOTPs[phoneNumber];
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: "Incorrect verification code." });
  }
});

// Socket.io Real-Time Event Loop
let connectedClients = {}; // socket.id -> { username, avatar, bio, userId, sharePresence, privacy }
let userKeys = readJSON(KEYS_FILE, {});

function broadcastRosterUpdate() {
  const roster = Object.values(connectedClients).map(c => {
    const privacy = c.privacy || { lastSeen: "everyone", profilePhoto: "everyone", about: "everyone", readReceipts: true, disappearing: "off" };
    
    // Determine status (online / offline status share)
    const status = (privacy.lastSeen === "nobody" || c.sharePresence === false) ? "" : "online";
    
    // Determine avatar visibility
    const avatar = privacy.profilePhoto === "nobody" ? "https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder" : c.avatar;
    
    // Determine bio visibility
    const bio = privacy.about === "nobody" ? "Hey! I am using WhatsApp." : c.bio;

    return {
      userId: c.userId,
      username: c.username,
      avatar: avatar,
      bio: bio,
      status: status
    };
  });

  io.emit("roster-update", {
    onlineUsers: roster,
    bots: BOTS
  });
}

// IP Connection mapping to prevent Socket connection flooding (Layer 12)
const ipConnections = {};

io.use((socket, next) => {
  const ip = socket.handshake.address;
  ipConnections[ip] = (ipConnections[ip] || 0) + 1;
  
  if (ipConnections[ip] > 15) {
    console.warn(`[Security Alert] Socket limit reached for IP: ${ip}`);
    ipConnections[ip]--;
    return next(new Error("Connection rate limit exceeded (Max 15 concurrent tabs)."));
  }
  
  socket.on("disconnect", () => {
    if (ipConnections[ip] > 0) {
      ipConnections[ip]--;
    }
  });
  
  next();
});

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Layer 15: Socket Message Rate Limiter state per socket
  let messageCount = 0;
  let resetTime = Date.now() + 1000;
  
  // Layer 17: Typing Event Flood Prevention
  let lastTypingTime = 0;

  // User join (with Layer 13 connection limit & Layer 16 Sanitization)
  socket.on("user-join", ({ username, avatar, bio, userId, privacy }) => {
    if (!userId || typeof userId !== "string" || userId.length > 50) return;
    if (!username || typeof username !== "string" || username.length > 50) return;
    
    // Layer 13: Cap active user sockets (Max 3 concurrent tabs per user)
    const existingSockets = Object.values(connectedClients).filter(c => c.userId === userId);
    if (existingSockets.length >= 3) {
      const oldestSocket = existingSockets[0];
      const oldestSocketObj = io.sockets.sockets.get(oldestSocket.socketId);
      if (oldestSocketObj) {
        oldestSocketObj.emit("forced-logout", { message: "Too many concurrent connections. Logged out." });
        oldestSocketObj.disconnect(true);
      }
    }

    // Layer 16: Sanitize join info
    const cleanUsername = sanitizeHTMLInput(username);
    const cleanBio = sanitizeHTMLInput(bio || "Hey there! I am using WhatsApp.");
    const cleanAvatar = sanitizeHTMLInput(avatar || "");

    connectedClients[socket.id] = { 
      username: cleanUsername, 
      avatar: cleanAvatar, 
      bio: cleanBio, 
      userId, 
      sharePresence: privacy ? privacy.lastSeen !== "nobody" : true, 
      privacy: privacy || { lastSeen: "everyone", profilePhoto: "everyone", about: "everyone", readReceipts: true, disappearing: "off" },
      socketId: socket.id 
    };
    
    // Broadcast roster sync
    broadcastRosterUpdate();

    // Send history messages
    const allMsgs = readJSON(MESSAGES_FILE);
    const groups = readJSON(GROUPS_FILE);
    
    const myGroups = groups.filter(g => g.members.includes(userId));
    const myGroupIds = myGroups.map(g => g.id);

    const userMsgs = allMsgs.filter(m => 
      (m.chatId === userId || m.sender === userId || myGroupIds.includes(m.chatId)) &&
      (!m.deletedBy || !m.deletedBy.includes(userId))
    );
    socket.emit("history-messages", userMsgs);

    // Send group list history
    socket.emit("history-groups", myGroups);
    
    // Filter expired statuses (older than 24h) on login
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
    const activeStatuses = readJSON(STATUSES_FILE).filter(s => s.timestamp > cutoffTime);
    socket.emit("history-statuses", activeStatuses);
    socket.emit("history-calls", readJSON(CALLS_FILE));

    // Send all existing users' public keys
    socket.emit("public-key-sync", userKeys);
  });

  // Share user's public crypto key
  socket.on("share-public-key", ({ userId, publicKey }) => {
    userKeys[userId] = publicKey;
    writeJSON(KEYS_FILE, userKeys);
    socket.broadcast.emit("public-key-update", { userId, publicKey });
  });

  // Toggle online status presence visibility
  socket.on("presence-privacy-toggle", ({ enabled }) => {
    if (connectedClients[socket.id]) {
      connectedClients[socket.id].sharePresence = enabled;
      broadcastRosterUpdate();
    }
  });

  // Handle privacy settings update
  socket.on("privacy-update", (privacyObj) => {
    if (connectedClients[socket.id]) {
      connectedClients[socket.id].privacy = privacyObj;
      connectedClients[socket.id].sharePresence = privacyObj.lastSeen !== "nobody";
      
      // Save privacy config to server's registered user database
      const userId = connectedClients[socket.id].userId;
      const users = readJSON(USERS_FILE);
      const userIdx = users.findIndex(u => u.userId === userId);
      if (userIdx >= 0) {
        users[userIdx].privacy = privacyObj;
        writeJSON(USERS_FILE, users);
      }
      
      broadcastRosterUpdate();
    }
  });

  // Client messages message (Direct vs Group routing) (Harden - Layer 14, 15, 16, 21, 27)
  socket.on("send-message", (msg) => {
    // Layer 15: Socket Message Rate Limiting
    const now = Date.now();
    if (now > resetTime) {
      messageCount = 0;
      resetTime = now + 1000;
    }
    messageCount++;
    if (messageCount > 5) {
      return socket.emit("error", { message: "Rate limit exceeded (Max 5 messages/sec). Please slow down." });
    }

    // Layer 14: Socket Event Payload Schema Validation
    if (!msg || typeof msg !== "object") {
      return socket.emit("error", { message: "Invalid payload format." });
    }
    if (!msg.id || typeof msg.id !== "string" || msg.id.length > 50) return;
    if (!msg.chatId || typeof msg.chatId !== "string" || msg.chatId.length > 50) return;
    if (!msg.sender || typeof msg.sender !== "string" || msg.sender.length > 50) return;
    if (!msg.type || !["text", "image", "doc", "location", "voice", "deleted"].includes(msg.type)) return;

    // Validate size if doc or image (Max 15MB upload)
    if (msg.size && (typeof msg.size !== "number" || msg.size > 15 * 1024 * 1024)) {
      return socket.emit("error", { message: "File exceeds maximum upload size (15MB)." });
    }

    // Layer 21: Directory Traversal Prevention
    if (msg.fileName && typeof msg.fileName === "string") {
      msg.fileName = path.basename(msg.fileName).replace(/\.\./g, "");
    }

    // Layer 16: Event Sanitization (Prevent stored HTML injection)
    if (msg.isUnencrypted && msg.text && typeof msg.text === "string") {
      msg.text = sanitizeHTMLInput(msg.text);
    }

    // Layer 27: Enforce Server E2EE Protocol for human-to-human direct chats
    const isHumanRecipient = !BOTS.some(b => b.id === msg.chatId) && !msg.chatId.startsWith("group-");
    if (isHumanRecipient && msg.isUnencrypted !== false) {
      const keysRegistry = readJSON(KEYS_FILE, {});
      const hasSenderKey = keysRegistry[msg.sender];
      const hasRecipientKey = keysRegistry[msg.chatId];
      if (hasSenderKey && hasRecipientKey) {
        return socket.emit("error", { message: "Security error: End-to-end encryption is required for this chat." });
      }
    }

    const allMsgs = readJSON(MESSAGES_FILE);
    msg.timestamp = Date.now();
    allMsgs.push(msg);
    writeJSON(MESSAGES_FILE, allMsgs);

    const recipientId = msg.chatId;

    const groups = readJSON(GROUPS_FILE);
    const targetGroup = groups.find(g => g.id === recipientId);

    if (targetGroup) {
      targetGroup.members.forEach(memberId => {
        if (memberId !== msg.sender) {
          const clientSocket = Object.values(connectedClients).find(c => c.userId === memberId);
          if (clientSocket) {
            io.to(clientSocket.socketId).emit("receive-message", msg);
          }
        }
      });
    } else {
      const recipientSocket = Object.values(connectedClients).find(c => c.userId === recipientId);
      if (recipientSocket) {
        io.to(recipientSocket.socketId).emit("receive-message", msg);
        socket.emit("message-delivery-feedback", { id: msg.id, status: "read" });
      } else {
        const isBot = BOTS.some(b => b.id === recipientId);
        if (isBot) {
          setTimeout(() => {
            socket.emit("bot-typing-status", { botId: recipientId, typing: true });
            setTimeout(() => {
              const botReplyText = generateBotResponse(recipientId, msg.text || "");
              const botMsg = {
                id: "msg-bot-" + Date.now(),
                chatId: msg.sender,
                sender: recipientId,
                text: botReplyText,
                timestamp: Date.now(),
                type: "text",
                status: "read",
                isUnencrypted: true
              };

              const updatedMsgs = readJSON(MESSAGES_FILE);
              updatedMsgs.push(botMsg);
              writeJSON(MESSAGES_FILE, updatedMsgs);

              socket.emit("bot-typing-status", { botId: recipientId, typing: false });
              socket.emit("receive-message", botMsg);
            }, 2000);
          }, 1200);
        }
      }
    }
  });

  // Pin message action
  socket.on("pin-message", ({ chatId, msgId, text }) => {
    io.emit("message-pinned-broadcast", { chatId, msgId, text });
  });

  socket.on("unpin-message", ({ chatId }) => {
    io.emit("message-unpinned-broadcast", { chatId });
  });

  // Delete message action
  socket.on("delete-message", ({ msgId, userId, target }) => {
    const allMsgs = readJSON(MESSAGES_FILE);
    const msgIdx = allMsgs.findIndex(m => m.id === msgId);
    if (msgIdx === -1) return;

    const msg = allMsgs[msgIdx];

    if (target === "everyone") {
      // Check 1-hour deletion limit constraint
      const ageMs = Date.now() - msg.timestamp;
      if (ageMs > 3600000) {
        socket.emit("delete-failed", { error: "Messages older than 1 hour cannot be deleted for everyone." });
        return;
      }

      msg.text = "🚫 This message was deleted";
      msg.type = "deleted";
      msg.isDeletedForEveryone = true;
      writeJSON(MESSAGES_FILE, allMsgs);

      // Broadcast to everyone
      io.emit("message-deleted-broadcast", { msgId, target: "everyone" });
    } else {
      // Delete for Me
      if (!msg.deletedBy) msg.deletedBy = [];
      if (!msg.deletedBy.includes(userId)) {
        msg.deletedBy.push(userId);
      }
      writeJSON(MESSAGES_FILE, allMsgs);
      socket.emit("message-deleted-broadcast", { msgId, target: "me" });
    }
  });

  // Create Group Chat channel (Layer 14 & 16)
  socket.on("create-group", ({ groupName, members }) => {
    if (!groupName || typeof groupName !== "string" || groupName.length > 50) return;
    if (!Array.isArray(members) || members.length === 0 || members.length > 100) return;

    const cleanGroupName = sanitizeHTMLInput(groupName);
    const cleanMembers = members.map(m => sanitizeHTMLInput(m));

    const groups = readJSON(GROUPS_FILE);
    const newGroup = {
      id: "group-" + Date.now(),
      name: cleanGroupName,
      members: cleanMembers,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanGroupName)}`,
      status: `${cleanMembers.length} participants`,
      isGroup: true
    };
    groups.push(newGroup);
    writeJSON(GROUPS_FILE, groups);

    cleanMembers.forEach(memberId => {
      const client = Object.values(connectedClients).find(c => c.userId === memberId);
      if (client) {
        io.to(client.socketId).emit("group-created", newGroup);
      }
    });
  });

  // User Keyboard typing presence broadcasts (Layer 17: flood check)
  socket.on("typing-state", ({ recipientId, typing }) => {
    const now = Date.now();
    if (now - lastTypingTime < 100) return; // 100ms debounce rate limit
    lastTypingTime = now;

    const sender = connectedClients[socket.id];
    if (!sender) return;

    if (sender.sharePresence === false) return;

    const groups = readJSON(GROUPS_FILE);
    const targetGroup = groups.find(g => g.id === recipientId);

    if (targetGroup) {
      targetGroup.members.forEach(memberId => {
        if (memberId !== sender.userId) {
          const client = Object.values(connectedClients).find(c => c.userId === memberId);
          if (client) {
            io.to(client.socketId).emit("peer-typing-state", {
              chatId: recipientId,
              peerName: sender.username,
              typing: typing
            });
          }
        }
      });
    } else {
      const recipient = Object.values(connectedClients).find(c => c.userId === recipientId);
      if (recipient) {
        io.to(recipient.socketId).emit("peer-typing-state", {
          chatId: sender.userId,
          peerName: sender.username,
          typing: typing
        });
      }
    }
  });

  // P2P WebRTC Signalling Channels
  socket.on("call-dial", ({ recipientId, callType }) => {
    const caller = connectedClients[socket.id];
    if (!caller) return;

    const recipient = Object.values(connectedClients).find(c => c.userId === recipientId);
    if (recipient) {
      io.to(recipient.socketId).emit("call-incoming-alert", {
        callerId: caller.userId,
        callerName: caller.username,
        callerAvatar: caller.avatar,
        callType: callType
      });
    } else {
      const isBot = BOTS.some(b => b.id === recipientId);
      if (isBot) {
        socket.emit("call-connection-established");
      } else {
        socket.emit("call-user-offline");
      }
    }
  });

  socket.on("call-hangup", ({ recipientId }) => {
    const recipient = Object.values(connectedClients).find(c => c.userId === recipientId);
    if (recipient) {
      io.to(recipient.socketId).emit("call-hangup-alert");
    }
  });

  socket.on("call-accept", ({ callerId }) => {
    const caller = Object.values(connectedClients).find(c => c.userId === callerId);
    if (caller) {
      io.to(caller.socketId).emit("call-connection-established");
    }
  });

  // WebRTC SDP Signalling Handlers
  socket.on("webrtc-offer", ({ offer, recipientId }) => {
    const sender = connectedClients[socket.id];
    if (!sender) return;
    const recipient = Object.values(connectedClients).find(c => c.userId === recipientId);
    if (recipient) {
      io.to(recipient.socketId).emit("webrtc-offer", { offer, callerId: sender.userId });
    }
  });

  socket.on("webrtc-answer", ({ answer, callerId }) => {
    const sender = connectedClients[socket.id];
    if (!sender) return;
    const caller = Object.values(connectedClients).find(c => c.userId === callerId);
    if (caller) {
      io.to(caller.socketId).emit("webrtc-answer", { answer, recipientId: sender.userId });
    }
  });

  socket.on("webrtc-ice-candidate", ({ candidate, recipientId }) => {
    const sender = connectedClients[socket.id];
    if (!sender) return;
    const recipient = Object.values(connectedClients).find(c => c.userId === recipientId);
    if (recipient) {
      io.to(recipient.socketId).emit("webrtc-ice-candidate", { candidate, senderId: sender.userId });
    }
  });

  socket.on("call-log-record", (callRecord) => {
    const allCalls = readJSON(CALLS_FILE);
    allCalls.push(callRecord);
    writeJSON(CALLS_FILE, allCalls);
    io.emit("call-log-broadcast", allCalls);
  });

  socket.on("post-status", (statusObj) => {
    if (!statusObj || typeof statusObj !== "object") return;
    if (statusObj.type !== "text" && statusObj.type !== "image") return;
    
    // Validate size if status is a base64 image (Layer 14)
    if (statusObj.type === "image" && statusObj.image && statusObj.image.length > 10 * 1024 * 1024) {
      return socket.emit("error", { message: "Status image size limit exceeded (Max 10MB)." });
    }

    // Layer 16: Sanitize text caption/content
    if (statusObj.text && typeof statusObj.text === "string") {
      statusObj.text = sanitizeHTMLInput(statusObj.text);
    }
    if (statusObj.background && typeof statusObj.background === "string") {
      statusObj.background = sanitizeHTMLInput(statusObj.background);
    }

    let allStatuses = readJSON(STATUSES_FILE);
    statusObj.timestamp = Date.now();
    allStatuses.push(statusObj);
    
    // Auto-expiry: filter statuses older than 24 hours
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
    allStatuses = allStatuses.filter(s => s.timestamp > cutoffTime);
    
    writeJSON(STATUSES_FILE, allStatuses);
    io.emit("status-broadcast", allStatuses);
  });

  socket.on("disconnect", () => {
    if (connectedClients[socket.id]) {
      const closingUser = connectedClients[socket.id];
      console.log(`${closingUser.username} logged out.`);
      delete connectedClients[socket.id];
      broadcastRosterUpdate();
    }
  });
});

// API Endpoint to send Twilio invitation message to unregistered contacts
app.post("/api/invite-contact", async (req, res) => {
  let { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ success: false, error: "Phone number is required." });
  }

  phoneNumber = sanitizeHTMLInput(phoneNumber);
  const inviteMsg = `Join my secure chat room on the WhatsApp Clone! Visit: http://localhost:3000`;

  if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
    try {
      await twilioClient.messages.create({
        body: inviteMsg,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
      console.log(`[SMS Invite Success] Invitation sent successfully to ${phoneNumber}`);
      res.json({ success: true, method: "twilio" });
    } catch (err) {
      console.error(`[SMS Invite Error] Failed to send Twilio invitation:`, err);
      res.status(500).json({ success: false, error: "Failed to dispatch Twilio invitation." });
    }
  } else {
    // Local simulation fallback
    console.warn(`\n----------------------------------------\n[DEMO CODE NOTICE] Twilio not configured!\nContact Invitation simulation for ${phoneNumber}:\n"${inviteMsg}"\n----------------------------------------\n`);
    res.json({ success: true, method: "simulation", message: "Twilio not configured. Invitation printed to server console." });
  }
});

server.listen(PORT, () => {
  console.log(`WhatsApp Clone Server listening on http://localhost:${PORT}`);
});
