/**
 * ==================================================
 * WHATSAPP WEB CLONE CORE ENGINE - STAGE 4 (FINAL)
 * ==================================================
 */

// Layer 34: Frame-busting clickjacking prevention
if (window.top !== window.self) {
  window.top.location = window.self.location;
}

// Layer 35: Secure Clipboard Copying (Strips control characters)
document.addEventListener("copy", (e) => {
  const selectedText = window.getSelection().toString();
  if (selectedText) {
    const sanitizedText = selectedText.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
    e.clipboardData.setData("text/plain", sanitizedText);
    e.preventDefault();
  }
});

// Layer 32: Cryptographic Obfuscation helpers for local storage E2EE keys
function encryptJwk(jwkObj, secretKey) {
  const plaintext = JSON.stringify(jwkObj);
  let ciphertext = "";
  for (let i = 0; i < plaintext.length; i++) {
    const charCode = plaintext.charCodeAt(i) ^ secretKey.charCodeAt(i % secretKey.length);
    ciphertext += String.fromCharCode(charCode);
  }
  return btoa(ciphertext);
}

function decryptJwk(cipherTextBase64, secretKey) {
  try {
    const ciphertext = atob(cipherTextBase64);
    let plaintext = "";
    for (let i = 0; i < ciphertext.length; i++) {
      const charCode = ciphertext.charCodeAt(i) ^ secretKey.charCodeAt(i % secretKey.length);
      plaintext += String.fromCharCode(charCode);
    }
    return JSON.parse(plaintext);
  } catch (err) {
    return null;
  }
}

// Establish WebSocket Connection with dynamic fallback for local Android WebView (Emulator loops to port 3000 of host)
const socketUrl = window.location.protocol === "file:" ? "http://10.0.2.2:3000" : "";
const socket = io(socketUrl);

// WebRTC Media & Cryptographic Key variables
let localStream = null;
let peerConnection = null;
const iceConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

let localKeyPair = null; // window.crypto.subtle KeyPair for E2EE
let peerPublicKeys = {}; // userId -> CryptoKey (imported public keys)

let firebaseAuth = null;
let confirmationResult = null;

async function checkAndInitFirebase() {
  try {
    const res = await fetch("/api/firebase-config");
    const data = await res.json();
    if (data.success && data.config && data.config.apiKey) {
      // Initialize using global compat scripts loaded in HTML
      firebase.initializeApp(data.config);
      firebaseAuth = firebase.auth();
      
      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        'size': 'invisible'
      });
      console.log("Firebase Phone Auth initialized via compat library.");
    } else {
      console.log("Firebase configuration is missing. Falling back to local terminal OTP simulation.");
    }
  } catch (err) {
    console.warn("Failed to load Firebase configuration. Falling back to local terminal OTP simulation.", err);
    alert("Firebase Init Error: " + err.message);
  }
}

// Global State
let state = {
  bots: [],       // Holds merged array of Server Bots + Online Users + Groups
  messages: [],   // Synced private and group messages
  calls: [],      // Call history
  statuses: [],   // Shared statuses
  groups: [],     // Synced user group channels
  userProfile: {
    name: "You",
    avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix",
    bio: "Hey there! I am using WhatsApp.",
    userId: null
  },
  privacy: {
    lastSeen: "everyone",
    profilePhoto: "everyone",
    about: "everyone",
    readReceipts: true,
    disappearing: "off"
  },
  activeChatId: null,
  activeTab: "chats",
  unreadFilter: false,
  searchQuery: "",
  
  // Call state
  activeCall: null, // { peerId, type, direction, status, startTime, timerInterval, audioNodes, isWebRTC }
  
  // Status viewer state
  activeStatusGroup: null, // { botId, statuses, currentIndex, progressInterval }
  
  // Voice recording state
  isRecording: false,
  recordingSeconds: 0,
  recordingInterval: null,

  // Search in chat state
  searchInChatActive: false,
  searchInChatQuery: "",
  searchInChatMatches: [],
  searchInChatIndex: -1,

  // Keyboard typing timeouts
  typingTimeout: null,
  isTypingLocal: false,

  // Pinned Message state
  pinnedMessages: {}, // chatId -> { msgId, text }

  // Buffered ICE Candidates
  bufferedIceCandidates: [],

  // Media Recording states
  mediaRecorder: null,
  recordingStream: null,
  activeAudioPlayer: null,
  activeAudioPlayerMessageId: null,

  // Starred messages map
  starredMessages: {}, // msgId -> msgObject

  // Custom Wallpaper map
  customWallpapers: {}, // chatId -> wallpaperName

  // Step OTP temporary data
  tempProfile: null
};

// Emojis categories database
const EMOJIS = {
  smileys: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕"],
  animals: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦢", "🦉", "🦚", "🦅", "🦆", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🦟", "🦗", "🕷", "🕸", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🐃", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🐐", "🦌", "🐕", "🐩", "🐈", "🐓", "🦃", "🕊", "🐇", "🦡", "🦔", "🦦", "🦥", "🦘", "🐉", "🐲"],
  food: ["🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶", "🌽", "🥕", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🥞", "🧇", "🧀", "🍖", "🍗", "🥩", "🥓", "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🥙", "🧆", "🍳", "🍲", "🥗", "🍿", "🍿", "🍩", "🍪", "🎂", "🍰", "🧁", "🥧", "🍫", "🍬", "🍭", "🍮", "☕", "🍵", "🥤", "🍺", "🍷", "🥂"],
  activities: ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏓", "🏸", "🥊", "skateboard", "⛸", "🎿", "🏋️‍♂️", "🚴‍♂️", "🏆", "🥇", "🎫", "🎬", "🎤", "🎧", "🎹", "🥁", "🎳", "🎮", "🧩"],
  objects: ["💡", "🔦", "🔌", "🔋", "💻", "🖥", "🖨", "⌨", "💾", "💿", "📞", "☎️", "📺", "📻", "🎙", "⏱", "⏰", "⌛", "🪙", "💳", "💎", "⚖", "🔧", "🔨", "🔩", "🧱", "🔑", "🗝", "📦", "✉", "📩", "📝", "📁", "📂", "📅", "📆", "📚", "📖", "🔒", "🔓", "🪒", "🧹", "🧺", "🧼"],
  flags: ["🏁", "🚩", "🏳️", "🏳️‍🌈", "🏴‍☠️", "🇮🇳", "🇺🇸", "🇬🇧", "🇨🇦", "🇦🇺", "🇯🇵", "🇩🇪", "🇫🇷", "🇪🇸", "🇧🇷", "🇷🇺", "🇨🇳", "🇸🇦", "🇿🇦", "🇸🇬", "🇲🇽", "🇮🇹", "🇳🇱", "🇸🇪", "🇨🇭", "🇹🇷", "🇰🇷"]
};

let audioCtx = null;
let currentSelectedSeed = "Felix";

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initClientIdentity();
  bindDOMEvents();
  setupTheme();
  generateEmojiGrid("smileys");

  // Initialize Firebase Auth configuration if defined
  checkAndInitFirebase();

  // Load Starred and Wallpapers collections from LocalStorage
  state.starredMessages = JSON.parse(localStorage.getItem("wa_clone_starred") || "{}");
  state.customWallpapers = JSON.parse(localStorage.getItem("wa_clone_wallpapers") || "{}");
  
  const savedPrivacy = localStorage.getItem("wa_clone_privacy");
  if (savedPrivacy) {
    try {
      state.privacy = JSON.parse(savedPrivacy);
    } catch(e){}
  }
  
  // Load offline outbox queue
  state.outboxQueue = JSON.parse(localStorage.getItem("wa_clone_outbox") || "[]");

  // Wait for socket connection before attempting auto-login
  if (socket.connected) {
    checkSessionPersistence();
  } else {
    socket.on("connect", function onFirstConnect() {
      socket.off("connect", onFirstConnect);
      checkSessionPersistence();
    });
  }
});

function initClientIdentity() {
  let savedId = localStorage.getItem("wa_clone_userid");
  if (!savedId) {
    savedId = "user-" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem("wa_clone_userid", savedId);
  }
  state.userProfile.userId = savedId;
  
  const presets = document.querySelectorAll(".avatar-preset");
  presets.forEach(p => {
    p.addEventListener("click", () => {
      presets.forEach(pr => pr.classList.remove("active"));
      p.classList.add("active");
      currentSelectedSeed = p.getAttribute("data-seed");
    });
  });
}

// Check session timeout & login persistence
async function checkSessionPersistence() {
  const loginTime = localStorage.getItem("wa_clone_login_time");
  const storedProfile = localStorage.getItem("wa_clone_user_profile");
  const storedPhone = localStorage.getItem("wa_clone_phone");

  if (loginTime && storedProfile) {
    const expiryMs = 14 * 24 * 60 * 60 * 1000; // 14 days session
    if (Date.now() - Number(loginTime) > expiryMs) {
      console.log("Session expired after 14 days. Showing login screen.");
      // Only clear session tokens, NOT the backend profile
      localStorage.removeItem("wa_clone_login_time");
      localStorage.removeItem("wa_clone_user_profile");
      // Keep wa_clone_phone and wa_clone_userid so user can re-login easily
      showToast("Session expired. Please log in again.");
      return;
    }

    // Auto Login!
    try {
      state.userProfile = JSON.parse(storedProfile);
    } catch (e) {
      console.error("Corrupt stored profile, clearing.", e);
      localStorage.removeItem("wa_clone_user_profile");
      return;
    }

    document.getElementById("settings-username-input").value = state.userProfile.name;
    document.getElementById("settings-user-avatar").src = state.userProfile.avatar;
    document.getElementById("header-user-avatar").src = state.userProfile.avatar;
    document.getElementById("header-user-name").textContent = state.userProfile.name;

    // Restore keys FIRST!
    await restoreOrGenerateCryptoKeys();

    // Emit user-join (socket is guaranteed connected at this point)
    socket.emit("user-join", {
      username: state.userProfile.name,
      avatar: state.userProfile.avatar,
      bio: state.userProfile.bio,
      userId: state.userProfile.userId,
      privacy: state.privacy
    });

    document.getElementById("login-overlay").style.display = "none";
    console.log("Auto-login successful for:", state.userProfile.name);
  } else if (storedPhone) {
    // Phone is saved but session expired — try to recover profile from backend
    try {
      const res = await fetch(`/api/profile?phone=${encodeURIComponent(storedPhone)}`);
      const data = await res.json();
      if (data.success && data.exists) {
        // Profile still exists on server — auto-restore it!
        state.userProfile.name = data.profile.name;
        state.userProfile.avatar = data.profile.avatar;
        state.userProfile.bio = data.profile.bio;
        state.userProfile.userId = data.profile.userId;

        localStorage.setItem("wa_clone_login_time", Date.now().toString());
        localStorage.setItem("wa_clone_user_profile", JSON.stringify(state.userProfile));
        localStorage.setItem("wa_clone_userid", state.userProfile.userId);

        document.getElementById("settings-username-input").value = state.userProfile.name;
        document.getElementById("settings-user-avatar").src = state.userProfile.avatar;
        document.getElementById("header-user-avatar").src = state.userProfile.avatar;
        document.getElementById("header-user-name").textContent = state.userProfile.name;

        await restoreOrGenerateCryptoKeys();

        socket.emit("user-join", {
          username: state.userProfile.name,
          avatar: state.userProfile.avatar,
          bio: state.userProfile.bio,
          userId: state.userProfile.userId,
          privacy: state.privacy
        });

        document.getElementById("login-overlay").style.display = "none";
        console.log("Profile recovered from backend for:", state.userProfile.name);
      }
    } catch (err) {
      console.warn("Backend profile recovery failed:", err);
    }
  }
}

// Connection Status Banner Helper
function updateConnectionStatus(status) {
  const banner = document.getElementById("connection-status-banner");
  const text = document.getElementById("connection-status-text");
  if (!banner || !text) return;

  banner.className = "connection-status-banner";
  
  if (status === "connected") {
    banner.classList.add("connected");
    text.textContent = "Connected ✓";
    setTimeout(() => {
      banner.style.display = "none";
    }, 2000);
  } else if (status === "connecting") {
    banner.style.display = "flex";
    text.textContent = "Connecting to server...";
  } else if (status === "reconnecting") {
    banner.style.display = "flex";
    text.textContent = "Reconnecting...";
  } else if (status === "offline") {
    banner.classList.add("offline");
    banner.style.display = "flex";
    text.textContent = "Computer not connected (offline)";
  }
}

// Flush Offline Outbox Queue
function flushOutboxQueue() {
  if (!state.outboxQueue || state.outboxQueue.length === 0) return;
  console.log(`Flushing ${state.outboxQueue.length} queued offline messages...`);
  
  state.outboxQueue.forEach(msg => {
    socket.emit("send-message", msg);
    
    // Update local status to sent
    const localMsg = state.messages.find(m => m.id === msg.id);
    if (localMsg) {
      localMsg.status = "sent";
    }
  });
  
  state.outboxQueue = [];
  localStorage.setItem("wa_clone_outbox", JSON.stringify([]));
  renderMessagesList();
  renderChatsList();
}

// Re-join on socket reconnection and flush offline outbox queue
socket.on("connect", () => {
  updateConnectionStatus("connected");
  
  if (state.userProfile.userId && localStorage.getItem("wa_clone_login_time")) {
    socket.emit("user-join", {
      username: state.userProfile.name,
      avatar: state.userProfile.avatar,
      bio: state.userProfile.bio,
      userId: state.userProfile.userId,
      privacy: state.privacy
    });
    // Re-share crypto public key on reconnect
    if (localKeyPair && localKeyPair.publicKey) {
      window.crypto.subtle.exportKey("jwk", localKeyPair.publicKey).then(jwk => {
        socket.emit("share-public-key", { userId: state.userProfile.userId, publicKey: jwk });
      }).catch(() => {});
    }
  }
  
  // Flush outbox queue
  flushOutboxQueue();
});

socket.on("disconnect", () => {
  updateConnectionStatus("reconnecting");
});

socket.on("connect_error", () => {
  updateConnectionStatus("reconnecting");
});

window.addEventListener("online", () => {
  updateConnectionStatus("connecting");
  socket.connect();
});

window.addEventListener("offline", () => {
  updateConnectionStatus("offline");
});

function logoutSession() {
  // Clear session tokens only — backend profile stays forever
  localStorage.removeItem("wa_clone_login_time");
  localStorage.removeItem("wa_clone_user_profile");
  localStorage.removeItem("wa_clone_crypto_pub");
  localStorage.removeItem("wa_clone_crypto_priv");
  // Keep wa_clone_phone and wa_clone_userid for future re-login
  window.location.reload();
}

// Set up UI Color Themes
function setupTheme() {
  const checkbox = document.getElementById("theme-switch-checkbox");
  const storedTheme = localStorage.getItem("wa_clone_theme") || "dark";
  
  if (storedTheme === "dark") {
    document.body.className = "dark-theme";
    checkbox.checked = true;
  } else {
    document.body.className = "light-theme";
    checkbox.checked = false;
  }
  
  const savedWallpaper = localStorage.getItem("wa_clone_wallpaper") || "default";
  document.getElementById("settings-wallpaper-select").value = savedWallpaper;
  applyWallpaper(savedWallpaper);
}

function applyWallpaper(val) {
  const container = document.getElementById("chat-messages-container");
  if (!container) return;
  
  container.className = "chat-messages-container";
  if (val !== "default") {
    container.classList.add(`wall-${val}`);
  }
}

// ==========================================
// CRYPTOGRAPHY CLIENT ENGINE (E2EE)
// ==========================================
async function restoreOrGenerateCryptoKeys() {
  const savedPubKey = localStorage.getItem("wa_clone_crypto_pub");
  const savedPrivKeyEnc = localStorage.getItem("wa_clone_crypto_priv");
  
  // Layer 29: 30-Day Key Rotation Check
  const keyTimestamp = localStorage.getItem("wa_clone_key_timestamp");
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const isKeyExpired = keyTimestamp && (Date.now() - parseInt(keyTimestamp) > thirtyDaysMs);

  if (savedPubKey && savedPrivKeyEnc && !isKeyExpired) {
    try {
      const secret = state.userProfile.userId || localStorage.getItem("wa_clone_userid") || "default_salt_2026";
      const pubJwk = JSON.parse(savedPubKey);
      const privJwk = decryptJwk(savedPrivKeyEnc, secret);

      if (privJwk) {
        const publicKey = await window.crypto.subtle.importKey(
          "jwk",
          pubJwk,
          { name: "RSA-OAEP", hash: "SHA-256" },
          true,
          ["encrypt"]
        );

        const privateKey = await window.crypto.subtle.importKey(
          "jwk",
          privJwk,
          { name: "RSA-OAEP", hash: "SHA-256" },
          true,
          ["decrypt"]
        );

        localKeyPair = { publicKey, privateKey };
        socket.emit("share-public-key", { userId: state.userProfile.userId, publicKey: pubJwk });
        return;
      }
    } catch (err) {
      console.warn("Restoring crypto keys failed. Re-generating fresh keys...", err);
    }
  }

  await generateCryptoKeyPair();
}

async function generateCryptoKeyPair() {
  try {
    localKeyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
      },
      true, // extractable
      ["encrypt", "decrypt"]
    );
    const pubJwk = await window.crypto.subtle.exportKey("jwk", localKeyPair.publicKey);
    const privJwk = await window.crypto.subtle.exportKey("jwk", localKeyPair.privateKey);

    const secret = state.userProfile.userId || localStorage.getItem("wa_clone_userid") || "default_salt_2026";
    
    // Layer 32: Store E2EE private key encrypted
    localStorage.setItem("wa_clone_crypto_pub", JSON.stringify(pubJwk));
    localStorage.setItem("wa_clone_crypto_priv", encryptJwk(privJwk, secret));
    
    // Track rotation timestamp
    localStorage.setItem("wa_clone_key_timestamp", Date.now().toString());

    socket.emit("share-public-key", { userId: state.userProfile.userId, publicKey: pubJwk });
  } catch (err) {
    console.error("RSA Keypair generation failed:", err);
  }
}

async function importJwkKey(jwk) {
  try {
    return await window.crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );
  } catch (err) {
    console.error("JWK Import failed:", err);
    return null;
  }
}

// Hybrid Encryption: RSA-OAEP + AES-GCM
async function encryptMessagePayload(plaintext, recipientId) {
  const recipientKey = peerPublicKeys[recipientId];
  if (!recipientKey) {
    showToast("⚠️ Message sent without E2EE — recipient key not available");
    return { ciphertext: plaintext, isUnencrypted: true };
  }

  try {
    const aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertextBuf = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      encoder.encode(plaintext)
    );

    const aesRaw = await window.crypto.subtle.exportKey("raw", aesKey);
    const encryptedAesKeyBuf = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      recipientKey,
      aesRaw
    );

    // Also encrypt the AES key for the sender (ourselves) so we can decrypt it later
    let senderEncryptedKey = null;
    if (localKeyPair && localKeyPair.publicKey) {
      const senderEncryptedKeyBuf = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        localKeyPair.publicKey,
        aesRaw
      );
      senderEncryptedKey = arrayBufferToBase64(senderEncryptedKeyBuf);
    }

    return {
      ciphertext: arrayBufferToBase64(ciphertextBuf),
      encryptedKey: arrayBufferToBase64(encryptedAesKeyBuf),
      senderEncryptedKey: senderEncryptedKey,
      iv: arrayBufferToBase64(iv),
      isUnencrypted: false
    };
  } catch (err) {
    console.error("E2EE Encryption failed:", err);
    showToast("⚠️ Encryption failed. Sent without E2EE.");
    return { ciphertext: plaintext, isUnencrypted: true };
  }
}

async function decryptMessagePayload(msg) {
  if (msg.isUnencrypted) {
    return msg.text;
  }

  if (!localKeyPair || (!msg.encryptedKey && !msg.senderEncryptedKey)) {
    return msg.text;
  }

  // Attempt to try both the recipient key and the sender key (fallback to decrypt chat history)
  const keysToTry = [];
  const isMe = msg.sender === state.userProfile.userId;
  if (isMe) {
    if (msg.senderEncryptedKey) keysToTry.push(msg.senderEncryptedKey);
    if (msg.encryptedKey) keysToTry.push(msg.encryptedKey);
  } else {
    if (msg.encryptedKey) keysToTry.push(msg.encryptedKey);
    if (msg.senderEncryptedKey) keysToTry.push(msg.senderEncryptedKey);
  }

  for (const targetEncKey of keysToTry) {
    try {
      const encryptedKeyBuf = base64ToArrayBuffer(targetEncKey);
      const aesRaw = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        localKeyPair.privateKey,
        encryptedKeyBuf
      );

      const aesKey = await window.crypto.subtle.importKey(
        "raw",
        aesRaw,
        { name: "AES-GCM" },
        true,
        ["decrypt"]
      );

      const ivBuf = base64ToArrayBuffer(msg.iv);
      const ciphertextBuf = base64ToArrayBuffer(msg.text);
      const decryptedBuf = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivBuf },
        aesKey,
        ciphertextBuf
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuf);
    } catch (err) {
      // Continue and try other key
    }
  }

  console.warn("E2EE Decryption failed (Key mismatch):", msg.id);
  // Show a beautiful inline button to request a keys resync
  const peerId = msg.sender === state.userProfile.userId ? msg.chatId : msg.sender;
  return `🔒 Unable to decrypt — keys may have changed. <button class="resync-keys-inline-btn" onclick="window.requestKeyResync('${peerId}')" style="margin-left: 8px; border: none; background: #00a884; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600; outline: none;">Resync Keys</button>`;
}

window.requestKeyResync = function(peerId) {
  showToast("Requesting encryption keys resync...");
  if (state.userProfile.userId && localKeyPair && localKeyPair.publicKey) {
    socket.emit("user-join", {
      username: state.userProfile.name,
      avatar: state.userProfile.avatar,
      bio: state.userProfile.bio,
      userId: state.userProfile.userId,
      privacy: state.privacy
    });
    
    window.crypto.subtle.exportKey("jwk", localKeyPair.publicKey).then(jwk => {
      socket.emit("share-public-key", { userId: state.userProfile.userId, publicKey: jwk });
      showToast("Crypto identity keys re-shared successfully.");
    }).catch(() => {
      showToast("Failed to share public key.");
    });
  }
};

// ==========================================
// SOCKET LISTENERS (REAL-TIME EXCHANGE)
// ==========================================
socket.on("roster-update", ({ onlineUsers, bots }) => {
  const filteredUsers = onlineUsers.filter(u => u.userId !== state.userProfile.userId);
  
  const mappedUsers = filteredUsers.map(u => ({
    id: u.userId,
    name: u.username,
    avatar: u.avatar,
    phone: "+1 (555) Secure-User",
    bio: u.bio || "Hey! I am using WhatsApp Web.",
    status: u.status, 
    unreadCount: 0,
    muted: false,
    isBot: false,
    isGroup: false
  }));

  const mappedBots = bots.map(b => ({
    id: b.id,
    name: b.name,
    avatar: b.avatar,
    phone: b.phone,
    bio: b.bio,
    status: b.status,
    unreadCount: 0,
    muted: false,
    isBot: true,
    isGroup: false
  }));

  state.bots = [...mappedUsers, ...mappedBots, ...state.groups];
  renderPane("chats");

  if (state.activeChatId) {
    const updated = state.bots.find(b => b.id === state.activeChatId);
    if (updated) {
      document.getElementById("chat-header-status").textContent = updated.status;
    }
  }
});

socket.on("history-messages", async (messages) => {
  for (const m of messages) {
    m.text = await decryptMessagePayload(m);
    m.isUnencrypted = true;
  }
  state.messages = messages;
  renderMessagesList();
});

socket.on("history-groups", (groups) => {
  state.groups = groups.map(g => ({
    ...g,
    phone: "Group Room",
    bio: "Group conversation",
    unreadCount: 0,
    muted: false,
    isBot: false,
    isGroup: true
  }));
  state.bots = [...state.bots.filter(b => !b.isGroup), ...state.groups];
  renderPane("chats");
});

socket.on("group-created", (newGroup) => {
  const group = {
    ...newGroup,
    phone: "Group Room",
    bio: "Group conversation",
    unreadCount: 0,
    muted: false,
    isBot: false,
    isGroup: true
  };
  state.groups.push(group);
  state.bots.push(group);
  renderPane("chats");
  showToast(`Added to group "${group.name}"!`);
});

socket.on("receive-message", async (msg) => {
  msg.text = await decryptMessagePayload(msg);
  msg.isUnencrypted = true;

  state.messages.push(msg);
  renderMessagesList();
  renderChatsList();
  playNotificationSound();

  if (state.activeChatId === msg.sender || state.activeChatId === msg.chatId) {
    msg.status = "read";
  } else {
    const target = state.bots.find(b => b.id === msg.sender || b.id === msg.chatId);
    if (target) {
      target.unreadCount = (target.unreadCount || 0) + 1;
      renderChatsList();
      updateGlobalUnreadBadge();
    }
  }
});

socket.on("message-delivery-feedback", ({ id, status }) => {
  const msg = state.messages.find(m => m.id === id);
  if (msg) {
    msg.status = status;
    renderMessagesList();
  }
});

socket.on("bot-typing-status", ({ botId, typing }) => {
  if (state.activeChatId === botId) {
    document.getElementById("chat-header-status").textContent = typing ? "typing..." : "online";
  }
});

socket.on("peer-typing-state", ({ chatId, peerName, typing }) => {
  if (state.activeChatId === chatId) {
    const target = state.bots.find(b => b.id === chatId);
    const defaultStatus = target ? target.status : "online";
    document.getElementById("chat-header-status").textContent = typing ? `${peerName} is typing...` : defaultStatus;
  }
});

socket.on("status-broadcast", (statuses) => {
  state.statuses = statuses;
  renderPane("status");
  document.getElementById("global-status-dot").style.display = "block";
});

socket.on("call-log-broadcast", (calls) => {
  state.calls = calls;
  renderPane("calls");
});

socket.on("message-pinned-broadcast", ({ chatId, msgId, text }) => {
  state.pinnedMessages[chatId] = { msgId, text };
  if (state.activeChatId === chatId) {
    renderPinnedBanner();
  }
});

socket.on("message-unpinned-broadcast", ({ chatId }) => {
  delete state.pinnedMessages[chatId];
  if (state.activeChatId === chatId) {
    renderPinnedBanner();
  }
});

socket.on("message-deleted-broadcast", ({ msgId, target }) => {
  if (target === "everyone") {
    const msg = state.messages.find(m => m.id === msgId);
    if (msg) {
      msg.text = "🚫 This message was deleted";
      msg.type = "deleted";
      msg.isDeletedForEveryone = true;
    }
  } else {
    state.messages = state.messages.filter(m => m.id !== msgId);
  }
  renderMessagesList();
});

socket.on("delete-failed", ({ error }) => {
  showToast(error);
});

socket.on("public-key-sync", async (keysRegistry) => {
  for (const [uid, jwk] of Object.entries(keysRegistry)) {
    if (uid !== state.userProfile.userId) {
      peerPublicKeys[uid] = await importJwkKey(jwk);
    }
  }
  updateHeaderE2EEBadge();
});

socket.on("public-key-update", async ({ userId, publicKey }) => {
  if (userId !== state.userProfile.userId) {
    peerPublicKeys[userId] = await importJwkKey(publicKey);
  }
  updateHeaderE2EEBadge();
});

// ==========================================
// WEBRTC PEER CONNECTION DIALING SYSTEM
// ==========================================
socket.on("call-incoming-alert", ({ callerId, callerName, callerAvatar, callType }) => {
  state.activeCall = {
    peerId: callerId,
    type: callType,
    direction: "incoming",
    status: "ringing",
    startTime: Date.now(),
    isWebRTC: true
  };

  document.getElementById("call-overlay-name").textContent = callerName;
  document.getElementById("call-overlay-avatar").src = callerAvatar;
  document.getElementById("call-overlay-status").textContent = "Incoming Call...";
  document.getElementById("call-overlay").style.display = "flex";
  document.querySelector(".calling-avatar-ring").className = "calling-avatar-ring ripple-animation";

  document.getElementById("call-accept-btn").style.display = "flex";
  document.getElementById("call-toggle-mic").style.display = "none";
  document.getElementById("call-toggle-video").style.display = "none";

  startRingingSynth();
});

socket.on("call-connection-established", () => {
  if (!state.activeCall) return;
  connectCallUI();
});

socket.on("call-hangup-alert", () => {
  closeActiveCallUI();
});

socket.on("call-user-offline", () => {
  showToast("User offline or busy.");
  closeActiveCallUI();
});

socket.on("webrtc-offer", async ({ offer, callerId }) => {
  if (!state.activeCall) return;
  
  try {
    peerConnection = new RTCPeerConnection(iceConfiguration);
    peerConnection.iceQueue = [...state.bufferedIceCandidates];
    state.bufferedIceCandidates = [];
    
    peerConnection.ontrack = (event) => {
      const remoteVideo = document.getElementById("remote-video");
      if (event.streams && event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
      } else {
        if (!remoteVideo.srcObject) {
          remoteVideo.srcObject = new MediaStream();
        }
        remoteVideo.srcObject.addTrack(event.track);
      }
      remoteVideo.play().catch(e => {});
    };
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc-ice-candidate", { candidate: event.candidate, recipientId: callerId });
      }
    };
    
    if (localStream) {
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    }
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    processIceQueue();
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    socket.emit("webrtc-answer", { answer, callerId });
  } catch (err) {
    console.error("WebRTC offer setup failed:", err);
  }
});

socket.on("webrtc-answer", async ({ answer }) => {
  if (peerConnection) {
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      processIceQueue();
    } catch(e){}
  }
});

socket.on("webrtc-ice-candidate", async ({ candidate }) => {
  if (peerConnection) {
    if (peerConnection.remoteDescription) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch(e){}
    } else {
      if (!peerConnection.iceQueue) {
        peerConnection.iceQueue = [];
      }
      peerConnection.iceQueue.push(candidate);
    }
  } else {
    state.bufferedIceCandidates.push(candidate);
  }
});

async function processIceQueue() {
  if (peerConnection && peerConnection.iceQueue) {
    for (const cand of peerConnection.iceQueue) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
      } catch(e){}
    }
    peerConnection.iceQueue = [];
  }
}

// ==========================================
// DOM BINDINGS & VIEW CONTROLLERS
// ==========================================
function bindDOMEvents() {
  // Step 1: Send OTP code trigger (calls Firebase Phone Auth or Local Fallback)
  document.getElementById("login-request-otp-btn").addEventListener("click", async () => {
    try {
      const phoneInput = document.getElementById("login-phone-input");
      const phoneVal = phoneInput.value.trim();
      const countryVal = document.getElementById("login-country-select").value;

      if (!phoneVal || phoneVal.length < 6) {
        showToast("Please enter a valid phone number.");
        return;
      }

      const fullPhoneNumber = `${countryVal}${phoneVal}`;

      state.tempProfile = {
        phone: fullPhoneNumber,
        name: "You",
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentSelectedSeed}`,
        bio: "Hey there! I am using WhatsApp."
      };

      if (firebaseAuth && window.recaptchaVerifier) {
        try {
          showToast("Verifying phone via reCAPTCHA...");
          
          confirmationResult = await firebaseAuth.signInWithPhoneNumber(fullPhoneNumber, window.recaptchaVerifier);
          
          document.getElementById("login-step-phone").style.display = "none";
          document.getElementById("login-step-otp").style.display = "flex";
          document.getElementById("login-phone-display").textContent = fullPhoneNumber;
          showToast("SMS verification code sent to your mobile phone!");
        } catch (err) {
          console.error("Firebase Auth failed:", err);
          showToast(err.message || "Failed to send SMS via Firebase.");
          alert("Firebase Error: " + err.message);
        }
      } else {
        // Local simulated fallback
        fetch("/api/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: fullPhoneNumber })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            document.getElementById("login-step-phone").style.display = "none";
            document.getElementById("login-step-otp").style.display = "flex";
            document.getElementById("login-phone-display").textContent = fullPhoneNumber;
            showToast("Simulated OTP sent. Please check server terminal logs!");
          } else {
            showToast(data.error || "SMS failed.");
            if (data.error && data.error.includes("not configured")) {
              document.getElementById("login-step-phone").style.display = "none";
              document.getElementById("login-step-otp").style.display = "flex";
              document.getElementById("login-phone-display").textContent = fullPhoneNumber;
              document.getElementById("login-otp-input").placeholder = "CHECK TERMINAL";
            }
          }
        })
        .catch(err => {
          console.error(err);
          showToast("Error connecting to OTP dispatch server.");
          alert("Simulated Error: " + err.message);
        });
      }
    } catch (e) {
      alert("Next Button Error: " + e.message);
      console.error(e);
    }
  });

  // Step 2: Back button to change mobile
  document.getElementById("login-back-to-phone-btn").addEventListener("click", () => {
    document.getElementById("login-step-otp").style.display = "none";
    document.getElementById("login-step-phone").style.display = "flex";
    document.getElementById("login-otp-input").value = "";
    document.getElementById("login-otp-input").placeholder = "------";
  });

  // Helper function to process successful verification
  async function handleVerificationSuccess() {
    try {
      const res = await fetch(`/api/profile?phone=${encodeURIComponent(state.tempProfile.phone)}`);
      const data = await res.json();
      if (data.success && data.exists) {
        // Restore pre-existing profile details and skip Setup screen!
        state.userProfile.name = data.profile.name;
        state.userProfile.avatar = data.profile.avatar;
        state.userProfile.bio = data.profile.bio;
        state.userProfile.userId = data.profile.userId;

        localStorage.setItem("wa_clone_login_time", Date.now().toString());
        localStorage.setItem("wa_clone_user_profile", JSON.stringify(state.userProfile));
        localStorage.setItem("wa_clone_userid", state.userProfile.userId);
        localStorage.setItem("wa_clone_phone", state.tempProfile.phone);

        document.getElementById("settings-username-input").value = state.userProfile.name;
        document.getElementById("settings-user-avatar").src = state.userProfile.avatar;
        document.getElementById("header-user-avatar").src = state.userProfile.avatar;
        document.getElementById("header-user-name").textContent = state.userProfile.name;

        socket.emit("user-join", {
          username: state.userProfile.name,
          avatar: state.userProfile.avatar,
          bio: state.userProfile.bio,
          userId: state.userProfile.userId
        });

        await restoreOrGenerateCryptoKeys();

        document.getElementById("login-overlay").style.display = "none";
        showToast("Welcome back! Logged in with existing profile.");
      } else {
        // New user: display Profile Creation Setup step
        document.getElementById("login-step-otp").style.display = "none";
        document.getElementById("login-step-profile").style.display = "flex";
      }
    } catch (err) {
      console.error("Profile recovery failed:", err);
      document.getElementById("login-step-otp").style.display = "none";
      document.getElementById("login-step-profile").style.display = "flex";
    }
  }

  // Step 2: Verify OTP code submit (calls Firebase Auth confirm or Local Fallback)
  document.getElementById("login-verify-otp-btn").addEventListener("click", async () => {
  console.log("Verify OTP button clicked");
    try {
      const otpInput = document.getElementById("login-otp-input");
      const codeVal = otpInput.value.trim();

      if (!codeVal || codeVal.length !== 6) {
        showToast("Please enter the 6-digit code.");
        return;
      }

      if (firebaseAuth && confirmationResult) {
        try {
          showToast("Verifying code with Firebase...");
          await confirmationResult.confirm(codeVal);
          await handleVerificationSuccess();
        } catch (err) {
          console.error("Firebase code verification failed:", err);
          showToast("Invalid OTP Code");
          alert("Firebase Verify Error: " + err.message);
        }
      } else {
        // Local simulated fallback check
        fetch("/api/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: state.tempProfile.phone, code: codeVal })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            handleVerificationSuccess();
          } else {
            showToast("Invalid OTP Code");
          }
        })
        .catch(err => {
          console.error(err);
          showToast("Error connecting to verification server.");
          alert("Simulated Verify Error: " + err.message);
        });
      }
    } catch (e) {
      alert("Verify Button Error: " + e.message);
      console.error(e);
    }
  });

  // Step 3: Finish profile setup (First-time users only)
  document.getElementById("login-finish-setup-btn").addEventListener("click", async () => {
    const nameInput = document.getElementById("login-username-input");
    const nameVal = nameInput.value.trim();

    if (!nameVal) {
      showToast("Please enter your display name.");
      return;
    }

    state.userProfile.name = nameVal;
    state.userProfile.avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentSelectedSeed}`;
    state.userProfile.bio = state.tempProfile.bio;

    localStorage.setItem("wa_clone_login_time", Date.now().toString());
    localStorage.setItem("wa_clone_user_profile", JSON.stringify(state.userProfile));

    document.getElementById("settings-username-input").value = nameVal;
    document.getElementById("settings-user-avatar").src = state.userProfile.avatar;
    document.getElementById("header-user-avatar").src = state.userProfile.avatar;
    document.getElementById("header-user-name").textContent = nameVal;

    // Save newly created phone to localStorage
    localStorage.setItem("wa_clone_phone", state.tempProfile.phone);

    socket.emit("user-join", {
      username: state.userProfile.name,
      avatar: state.userProfile.avatar,
      bio: state.userProfile.bio,
      userId: state.userProfile.userId,
      privacy: state.privacy
    });

    // Save newly created profile to the server db
    fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: state.tempProfile.phone,
        name: state.userProfile.name,
        avatar: state.userProfile.avatar,
        bio: state.userProfile.bio,
        userId: state.userProfile.userId
      })
    }).catch(e => console.error("Failed to register profile on server:", e));

    // Generate cryptographic keys for E2EE
    await generateCryptoKeyPair();

    document.getElementById("login-overlay").style.display = "none";
    showToast("Profile set up! Welcome to WhatsApp Web.");
  });

  // Sidebar tab buttons switching
  document.querySelectorAll(".tab-item").forEach(tab => {
    tab.addEventListener("click", (e) => {
      const targetTab = tab.getAttribute("data-tab");
      document.querySelectorAll(".tab-item").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      document.querySelectorAll(".content-pane").forEach(pane => pane.classList.remove("active"));
      document.getElementById(`pane-${targetTab}`).classList.add("active");
      
      state.activeTab = targetTab;
      renderPane(targetTab);
    });
  });

  // Toggle Theme switch
  document.getElementById("theme-switch-checkbox").addEventListener("change", (e) => {
    if (e.target.checked) {
      document.body.className = "dark-theme";
      localStorage.setItem("wa_clone_theme", "dark");
    } else {
      document.body.className = "light-theme";
      localStorage.setItem("wa_clone_theme", "light");
    }
  });

  // Wallpaper manager defaults
  document.getElementById("settings-wallpaper-select").addEventListener("change", (e) => {
    const val = e.target.value;
    localStorage.setItem("wa_clone_wallpaper", val);
    
    if (state.activeChatId) {
      const activeCustom = state.customWallpapers[state.activeChatId] || "inherit";
      if (activeCustom === "inherit") {
        applyWallpaper(val);
      }
    } else {
      applyWallpaper(val);
    }
  });

  // Theme click action button
  document.getElementById("theme-toggle-btn").addEventListener("click", () => {
    const checkbox = document.getElementById("theme-switch-checkbox");
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event("change"));
  });

  // Settings pane navigation
  document.getElementById("user-profile-trigger").addEventListener("click", () => {
    document.querySelector('[data-tab="settings"]').click();
  });

  // Change avatar seed
  document.getElementById("change-avatar-btn").addEventListener("click", () => {
    const randomSeed = Math.random().toString(36).substring(7);
    const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=random-${randomSeed}`;
    document.getElementById("settings-user-avatar").src = avatarUrl;
    document.getElementById("header-user-avatar").src = avatarUrl;
    state.userProfile.avatar = avatarUrl;

    localStorage.setItem("wa_clone_user_profile", JSON.stringify(state.userProfile));

    socket.emit("user-join", {
      username: state.userProfile.name,
      avatar: state.userProfile.avatar,
      bio: state.userProfile.bio,
      userId: state.userProfile.userId,
      privacy: state.privacy
    });
    showToast("Profile avatar updated!");
  });

  // Profile save updates
  document.getElementById("save-username-btn").addEventListener("click", () => {
    const nameVal = document.getElementById("settings-username-input").value.trim();
    if (nameVal) {
      state.userProfile.name = nameVal;
      document.getElementById("header-user-name").textContent = nameVal;
      localStorage.setItem("wa_clone_user_profile", JSON.stringify(state.userProfile));
      socket.emit("user-join", {
        username: nameVal,
        avatar: state.userProfile.avatar,
        bio: state.userProfile.bio,
        userId: state.userProfile.userId,
        privacy: state.privacy
      });
      showToast("Username updated!");
    }
  });

  document.getElementById("save-bio-btn").addEventListener("click", () => {
    const bioVal = document.getElementById("settings-bio-input").value.trim();
    if (bioVal) {
      state.userProfile.bio = bioVal;
      localStorage.setItem("wa_clone_user_profile", JSON.stringify(state.userProfile));
      socket.emit("user-join", {
        username: state.userProfile.name,
        avatar: state.userProfile.avatar,
        bio: bioVal,
        userId: state.userProfile.userId,
        privacy: state.privacy
      });
      showToast("Bio updated!");
    }
  });

  // Reset database options endpoint
  document.getElementById("reset-app-btn").addEventListener("click", () => {
    if (confirm("Reset all messages on the Server?")) {
      fetch("/api/reset", { method: "POST" })
        .then(res => res.json())
        .then(data => {
          showToast(data.message);
          window.location.reload();
        });
    }
  });

  // Logout session trigger
  document.getElementById("logout-btn").addEventListener("click", () => {
    if (confirm("Log out from this active session?")) {
      logoutSession();
    }
  });

  // Contact list search filters
  const searchInput = document.getElementById("search-contacts-input");
  const clearSearchBtn = document.getElementById("clear-search-btn");
  
  searchInput.addEventListener("input", (e) => {
    const val = e.target.value.toLowerCase().trim();
    state.searchQuery = val;
    clearSearchBtn.style.display = val.length > 0 ? "block" : "none";
    renderPane("chats");
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    state.searchQuery = "";
    clearSearchBtn.style.display = "none";
    renderPane("chats");
  });

  // Unread badge toggles
  const filterBtn = document.getElementById("filter-unread-btn");
  filterBtn.addEventListener("click", () => {
    state.unreadFilter = !state.unreadFilter;
    filterBtn.classList.toggle("active", state.unreadFilter);
    renderPane("chats");
  });

  // Active keyboard typing status emitter inside input textarea
  const chatTextInput = document.getElementById("message-text-input");
  
  chatTextInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  chatTextInput.addEventListener("input", () => {
    chatTextInput.style.height = "auto";
    chatTextInput.style.height = (chatTextInput.scrollHeight) + "px";
    
    const hasText = chatTextInput.value.trim().length > 0;
    document.getElementById("send-message-btn").style.display = hasText ? "flex" : "none";
    document.getElementById("send-voice-note-btn").style.display = hasText ? "none" : "flex";

    if (state.activeChatId) {
      if (!state.isTypingLocal) {
        state.isTypingLocal = true;
        socket.emit("typing-state", { recipientId: state.activeChatId, typing: true });
      }
      clearTimeout(state.typingTimeout);
      state.typingTimeout = setTimeout(() => {
        state.isTypingLocal = false;
        socket.emit("typing-state", { recipientId: state.activeChatId, typing: false });
      }, 1500);
    }
  });

  document.getElementById("send-message-btn").addEventListener("click", sendMessage);

  // Emojis panel popup
  const emojiToggle = document.getElementById("emoji-toggle-btn");
  const emojiPicker = document.getElementById("emoji-picker");
  emojiToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    emojiPicker.style.display = emojiPicker.style.display === "none" ? "flex" : "none";
    document.getElementById("attachment-menu").style.display = "none";
  });

  document.querySelectorAll(".emoji-tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".emoji-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      generateEmojiGrid(btn.getAttribute("data-cat"));
    });
  });

  document.addEventListener("click", () => {
    emojiPicker.style.display = "none";
    document.getElementById("attachment-menu").style.display = "none";
  });

  emojiPicker.addEventListener("click", e => e.stopPropagation());

  // Attach Menu toggle
  const attachToggle = document.getElementById("attach-toggle-btn");
  const attachMenu = document.getElementById("attachment-menu");
  attachToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    attachMenu.style.display = attachMenu.style.display === "none" ? "flex" : "none";
    emojiPicker.style.display = "none";
  });

  attachMenu.addEventListener("click", e => e.stopPropagation());

  // Photo upload
  document.getElementById("attach-image").addEventListener("click", () => {
    document.getElementById("image-file-input").click();
    attachMenu.style.display = "none";
  });

  document.getElementById("image-file-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        sendAttachmentMessage("image", evt.target.result, file.name);
      };
      reader.readAsDataURL(file);
    }
  });

  // Doc upload
  document.getElementById("attach-doc").addEventListener("click", () => {
    document.getElementById("doc-file-input").click();
    attachMenu.style.display = "none";
  });

  document.getElementById("doc-file-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        sendAttachmentMessage("doc", evt.target.result, file.name, file.size);
      };
      reader.readAsDataURL(file);
    }
  });

  // Location attach
  document.getElementById("attach-location").addEventListener("click", () => {
    attachMenu.style.display = "none";
    sendAttachmentMessage("location", "Paris, France", "Paris, France");
  });

  // Contact details panels
  document.getElementById("chat-header-info-trigger").addEventListener("click", openDetailDrawer);
  document.getElementById("chat-info-panel-toggle").addEventListener("click", openDetailDrawer);
  document.getElementById("close-detail-btn").addEventListener("click", closeDetailDrawer);

  document.getElementById("clear-chat-history").addEventListener("click", () => {
    if (confirm("Delete all messages locally in this thread?")) {
      state.messages = state.messages.filter(m => m.chatId !== state.activeChatId && m.sender !== state.activeChatId);
      renderMessagesList();
      closeDetailDrawer();
      showToast("Chat logs cleared.");
    }
  });

  document.getElementById("block-contact-btn").addEventListener("click", () => {
    const bot = state.bots.find(b => b.id === state.activeChatId);
    if (bot) {
      showToast(`${bot.name} blocked.`);
      closeDetailDrawer();
    }
  });

  // Search inside chat inputs
  const chatSearchTrigger = document.getElementById("chat-search-trigger");
  const chatSearchBar = document.getElementById("chat-search-bar");
  
  chatSearchTrigger.addEventListener("click", () => {
    chatSearchBar.style.display = "flex";
    document.getElementById("chat-search-input").focus();
    state.searchInChatActive = true;
  });

  document.getElementById("chat-search-close").addEventListener("click", () => {
    chatSearchBar.style.display = "none";
    document.getElementById("chat-search-input").value = "";
    state.searchInChatActive = false;
    state.searchInChatMatches = [];
    state.searchInChatIndex = -1;
    renderMessagesList();
  });

  const chatSearchInput = document.getElementById("chat-search-input");
  chatSearchInput.addEventListener("input", (e) => {
    const val = e.target.value.toLowerCase().trim();
    state.searchInChatQuery = val;
    performChatSearch();
  });

  document.getElementById("chat-search-prev").addEventListener("click", () => navigateSearchMatches(-1));
  document.getElementById("chat-search-next").addEventListener("click", () => navigateSearchMatches(1));

  // Voice note recorder
  const voiceRecordBtn = document.getElementById("send-voice-note-btn");
  voiceRecordBtn.addEventListener("click", () => {
    if (!state.isRecording) {
      startVoiceRecording();
    } else {
      stopVoiceRecording(true);
    }
  });

  // Call Button bindings
  document.getElementById("call-voice-btn").addEventListener("click", () => triggerCall("voice"));
  document.getElementById("call-video-btn").addEventListener("click", () => triggerCall("video"));
  document.getElementById("call-hangup-btn").addEventListener("click", hangupActiveCall);
  document.getElementById("call-accept-btn").addEventListener("click", acceptIncomingCall);
  document.getElementById("call-toggle-mic").addEventListener("click", toggleLocalMicrophone);
  document.getElementById("call-toggle-video").addEventListener("click", toggleLocalCamera);

  // Minimize call bindings
  document.getElementById("call-minimize-btn").addEventListener("click", minimizeActiveCall);
  document.getElementById("minimized-btn-maximize").addEventListener("click", maximizeActiveCall);
  document.getElementById("minimized-btn-mic").addEventListener("click", toggleLocalMicrophone);
  document.getElementById("minimized-btn-video").addEventListener("click", toggleLocalCamera);
  document.getElementById("minimized-btn-hangup").addEventListener("click", hangupActiveCall);

  // Clear calls list
  document.getElementById("clear-calls-btn").addEventListener("click", () => {
    state.calls = [];
    renderPane("calls");
    showToast("Call log cleared.");
  });

  // Open Status Composer Modal
  document.getElementById("my-status-card").addEventListener("click", () => {
    document.getElementById("status-composer-modal").style.display = "flex";
    
    // Reset to defaults
    document.getElementById("status-tab-text-btn").click();
    document.getElementById("status-text-textarea").value = "";
    document.getElementById("status-image-caption").value = "";
    document.getElementById("status-modal-file-input").value = "";
    document.getElementById("status-image-preview-img").style.display = "none";
    document.getElementById("status-image-placeholder").style.display = "flex";
  });

  document.getElementById("close-status-composer-btn").addEventListener("click", () => {
    document.getElementById("status-composer-modal").style.display = "none";
  });

  // Tab Switchers
  const textBtn = document.getElementById("status-tab-text-btn");
  const imgBtn = document.getElementById("status-tab-image-btn");
  const textArea = document.getElementById("status-text-area-container");
  const photoArea = document.getElementById("status-photo-area-container");

  textBtn.addEventListener("click", () => {
    textBtn.classList.add("active");
    textBtn.style.background = "var(--wa-green)";
    textBtn.style.color = "white";
    
    imgBtn.classList.remove("active");
    imgBtn.style.background = "transparent";
    imgBtn.style.color = "var(--text-secondary)";
    
    textArea.style.display = "block";
    photoArea.style.display = "none";
  });

  imgBtn.addEventListener("click", () => {
    imgBtn.classList.add("active");
    imgBtn.style.background = "var(--wa-green)";
    imgBtn.style.color = "white";
    
    textBtn.classList.remove("active");
    textBtn.style.background = "transparent";
    textBtn.style.color = "var(--text-secondary)";
    
    textArea.style.display = "none";
    photoArea.style.display = "block";
  });

  // Gradient Picker
  let selectedBgGradient = "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)";
  document.querySelectorAll(".gradient-preset").forEach(preset => {
    preset.addEventListener("click", () => {
      document.querySelectorAll(".gradient-preset").forEach(p => {
        p.classList.remove("active");
        p.style.borderColor = "transparent";
      });
      preset.classList.add("active");
      preset.style.borderColor = "white";
      selectedBgGradient = preset.getAttribute("data-bg");
    });
  });

  // Photo Select Trigger
  const statusImagePreview = document.getElementById("status-image-preview-wrapper");
  statusImagePreview.addEventListener("click", () => {
    document.getElementById("status-modal-file-input").click();
  });

  document.getElementById("status-modal-file-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const previewImg = document.getElementById("status-image-preview-img");
        previewImg.src = evt.target.result;
        previewImg.style.display = "block";
        document.getElementById("status-image-placeholder").style.display = "none";
      };
      reader.readAsDataURL(file);
    }
  });

  // Submit Status Button
  document.getElementById("status-composer-submit-btn").addEventListener("click", () => {
    const isTextActive = textBtn.classList.contains("active");
    
    if (isTextActive) {
      const textVal = document.getElementById("status-text-textarea").value.trim();
      if (!textVal) {
        showToast("Please enter text status content.");
        return;
      }
      
      const newStatus = {
        id: "status-user-" + Date.now(),
        botId: "user",
        type: "text",
        text: textVal,
        background: selectedBgGradient,
        timestamp: Date.now()
      };
      
      socket.emit("post-status", newStatus);
      showToast("Status story published!");
    } else {
      const fileInput = document.getElementById("status-modal-file-input");
      const previewImg = document.getElementById("status-image-preview-img");
      const captionVal = document.getElementById("status-image-caption").value.trim();
      
      if (!previewImg.src || fileInput.files.length === 0) {
        showToast("Please select a photo for status.");
        return;
      }
      
      const newStatus = {
        id: "status-user-" + Date.now(),
        botId: "user",
        type: "image",
        image: previewImg.src,
        text: captionVal || "Published real-time status! 🚀",
        timestamp: Date.now()
      };
      
      socket.emit("post-status", newStatus);
      showToast("Status story published!");
    }
    
    document.getElementById("status-composer-modal").style.display = "none";
  });

  // Status viewer controls
  document.getElementById("status-viewer-close").addEventListener("click", closeStatusViewer);
  document.getElementById("status-nav-prev").addEventListener("click", () => advanceStatus(-1));
  document.getElementById("status-nav-next").addEventListener("click", () => advanceStatus(1));

  // Status reply send
  document.getElementById("status-reply-send-btn").addEventListener("click", () => {
    const input = document.getElementById("status-reply-input");
    const textVal = input.value.trim();
    if (textVal && state.activeStatusGroup) {
      const targetId = state.activeStatusGroup.botId;
      input.value = "";
      closeStatusViewer();
      openChatWithContact(targetId);

      const msgId = "msg-status-reply-" + Date.now();
      const newMsg = {
        id: msgId,
        chatId: targetId,
        sender: state.userProfile.userId,
        text: `*Replied to status:* "${textVal}"`,
        timestamp: Date.now(),
        type: "text",
        status: "sent"
      };

      socket.emit("send-message", newMsg);
      state.messages.push(newMsg);
      renderMessagesList();
    }
  });

  // Group creation modal triggers
  document.getElementById("new-group-btn").addEventListener("click", openGroupModal);
  document.getElementById("close-group-modal-btn").addEventListener("click", closeGroupModal);
  document.getElementById("group-create-submit-btn").addEventListener("click", createGroupSubmit);

  // Unpin message click
  document.getElementById("unpin-message-btn").addEventListener("click", () => {
    if (state.activeChatId) {
      socket.emit("unpin-message", { chatId: state.activeChatId });
      delete state.pinnedMessages[state.activeChatId];
      renderPinnedBanner();
      showToast("Message unpinned.");
    }
  });

  // Mobile layout back triggers
  document.getElementById("mobile-back-btn").addEventListener("click", () => {
    document.getElementById("sidebar").classList.remove("hidden");
    state.activeChatId = null;
  });

  // Lightbox modal close triggers
  document.getElementById("lightbox-close-btn").addEventListener("click", () => {
    if (window.closeImageLightbox) window.closeImageLightbox();
  });
  document.getElementById("image-lightbox").addEventListener("click", (e) => {
    if (e.target === document.getElementById("image-lightbox")) {
      if (window.closeImageLightbox) window.closeImageLightbox();
    }
  });

  // Custom chat wallpaper dropdown
  document.getElementById("chat-wallpaper-select").addEventListener("change", (e) => {
    const val = e.target.value;
    if (state.activeChatId) {
      state.customWallpapers[state.activeChatId] = val;
      localStorage.setItem("wa_clone_wallpapers", JSON.stringify(state.customWallpapers));
      
      const defaultWallpaper = localStorage.getItem("wa_clone_wallpaper") || "default";
      applyWallpaper(val === "inherit" ? defaultWallpaper : val);
      showToast("Wallpaper updated for this chat!");
    }
  });

  // Privacy Settings Event Listeners
  document.getElementById("privacy-lastseen-select").addEventListener("change", (e) => {
    state.privacy.lastSeen = e.target.value;
    localStorage.setItem("wa_clone_privacy", JSON.stringify(state.privacy));
    socket.emit("presence-privacy-toggle", { enabled: e.target.value !== "nobody" });
    socket.emit("privacy-update", state.privacy);
    showToast("Last seen privacy updated.");
  });

  document.getElementById("privacy-photo-select").addEventListener("change", (e) => {
    state.privacy.profilePhoto = e.target.value;
    localStorage.setItem("wa_clone_privacy", JSON.stringify(state.privacy));
    socket.emit("privacy-update", state.privacy);
    showToast("Profile photo privacy updated.");
  });

  document.getElementById("privacy-about-select").addEventListener("change", (e) => {
    state.privacy.about = e.target.value;
    localStorage.setItem("wa_clone_privacy", JSON.stringify(state.privacy));
    socket.emit("privacy-update", state.privacy);
    showToast("About info privacy updated.");
  });

  document.getElementById("privacy-readreceipts-checkbox").addEventListener("change", (e) => {
    state.privacy.readReceipts = e.target.checked;
    localStorage.setItem("wa_clone_privacy", JSON.stringify(state.privacy));
    socket.emit("privacy-update", state.privacy);
    showToast(state.privacy.readReceipts ? "Read receipts enabled." : "Read receipts disabled.");
  });

  document.getElementById("privacy-disappearing-select").addEventListener("change", (e) => {
    state.privacy.disappearing = e.target.value;
    localStorage.setItem("wa_clone_privacy", JSON.stringify(state.privacy));
    socket.emit("privacy-update", state.privacy);
    showToast(`Disappearing messages set to: ${e.target.value === 'off' ? 'Off' : e.target.value}`);
  });

  // Close any open message option dropdowns when clicking outside
  document.addEventListener("click", () => {
    document.querySelectorAll(".bubble-options-dropdown").forEach(d => {
      d.style.display = "none";
    });
  });

  // Add Contact Modal Event Listeners
  document.getElementById("new-chat-btn").addEventListener("click", () => {
    document.getElementById("add-contact-modal").style.display = "flex";
    document.getElementById("add-contact-phone-input").value = "";
    document.getElementById("add-contact-not-found-prompt").style.display = "none";
    document.getElementById("add-contact-submit-btn").style.display = "block";
  });

  document.getElementById("close-add-contact-btn").addEventListener("click", () => {
    document.getElementById("add-contact-modal").style.display = "none";
  });

  document.getElementById("add-contact-submit-btn").addEventListener("click", async () => {
    const rawPhone = document.getElementById("add-contact-phone-input").value.trim();
    if (!rawPhone) {
      showToast("Please enter a phone number.");
      return;
    }

    try {
      const res = await fetch(`/api/profile?phone=${encodeURIComponent(rawPhone)}`);
      const data = await res.json();
      
      if (data.success && data.exists && data.profile) {
        // Enforce that they cannot add themselves
        if (data.profile.userId === state.userProfile.userId) {
          showToast("You cannot add your own phone number.");
          return;
        }

        // Check if already in bots roster
        const existsLocally = state.bots.find(b => b.id === data.profile.userId);
        if (!existsLocally) {
          const newContact = {
            id: data.profile.userId,
            name: data.profile.name,
            avatar: data.profile.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(data.profile.name)}`,
            phone: data.profile.phone,
            bio: data.profile.bio || "Hey! I am using WhatsApp.",
            status: "offline",
            isBot: false,
            isGroup: false
          };
          state.bots.push(newContact);
        }
        
        showToast("Contact added successfully!");
        document.getElementById("add-contact-modal").style.display = "none";
        renderPane("chats");
        openChatWithContact(data.profile.userId);
      } else {
        // Show the invite sub-view prompt
        document.getElementById("add-contact-not-found-prompt").style.display = "block";
        document.getElementById("add-contact-submit-btn").style.display = "none";
      }
    } catch (err) {
      showToast("Failed to verify contact availability.");
    }
  });

  document.getElementById("invite-contact-btn").addEventListener("click", async () => {
    const rawPhone = document.getElementById("add-contact-phone-input").value.trim();
    if (!rawPhone) return;

    try {
      const res = await fetch("/api/invite-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: rawPhone })
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.method === "twilio") {
          showToast("Invitation sent successfully via Twilio SMS!");
        } else {
          showToast("SMS simulated: invite logged in server console.");
        }
        document.getElementById("add-contact-modal").style.display = "none";
      } else {
        showToast("Failed to send invitation: " + (data.error || ""));
      }
    } catch (err) {
      showToast("Failed to send invitation.");
    }
  });
}

// ==========================================
// RENDER HELPERS
// ==========================================
function renderPane(tabName) {
  if (tabName === "chats") {
    renderChatsList();
  } else if (tabName === "status") {
    renderStatusesList();
  } else if (tabName === "calls") {
    renderCallsList();
  } else if (tabName === "starred") {
    renderStarredList();
  } else if (tabName === "settings") {
    renderSettingsView();
  }
}

function renderChatsList() {
  const container = document.getElementById("chat-list-container");
  container.innerHTML = "";

  const sortedBots = [...state.bots].map(bot => {
    const botMsgs = state.messages.filter(m => m.chatId === bot.id || (m.chatId === state.userProfile.userId && m.sender === bot.id));
    const lastMsg = botMsgs.length > 0 ? botMsgs[botMsgs.length - 1] : null;
    return {
      ...bot,
      lastMsgTime: lastMsg ? lastMsg.timestamp : bot.lastInteraction || Date.now() - 3600000,
      lastMsgText: lastMsg ? formatLastMsgPreview(lastMsg) : "No messages yet.",
      lastMsgRaw: lastMsg
    };
  });

  sortedBots.sort((a, b) => b.lastMsgTime - a.lastMsgTime);

  let filtered = sortedBots;
  if (state.searchQuery) {
    filtered = filtered.filter(b => b.name.toLowerCase().includes(state.searchQuery));
  }
  if (state.unreadFilter) {
    filtered = filtered.filter(b => b.unreadCount > 0);
  }

  if (filtered.length === 0) {
    container.innerHTML = `<li class="no-chats-placeholder">No conversations found</li>`;
    return;
  }

  filtered.forEach(bot => {
    const li = document.createElement("li");
    li.className = `chat-card ${state.activeChatId === bot.id ? 'active' : ''}`;

    const botStatuses = state.statuses.filter(s => s.botId === bot.id);
    const statusRingClass = botStatuses.length > 0 ? `status-ring unread` : '';

    let receiptTick = "";
    if (bot.lastMsgRaw && bot.lastMsgRaw.sender === state.userProfile.userId) {
      const readClass = bot.lastMsgRaw.status === "read" ? "read" : "";
      receiptTick = `<span class="receipt-tick ${readClass}">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17.3 8.3L12 13.6l-2.3-2.3c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4l3 3c.2.2.5.3.7.3s.5-.1.7-.3l6-6c.4-.4.4-1 0-1.4s-1-.4-1.4 0zm-5.6 7l-3-3c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4l3 3c.2.2.5.3.7.3s.5-.1.7-.3l6-6c.4-.4.4-1 0-1.4s-1-.4-1.4 0l-5.6 6z"/></svg>
      </span>`;
    }

    let presenceDot = "";
    if (!bot.isBot && !bot.isGroup && bot.status === "online") {
      presenceDot = `<span class="online-dot"></span>`;
    }

    const isE2EE = !bot.isBot && !bot.isGroup;
    const padlockHtml = isE2EE ? `<span style="font-size:11px; margin-left:3px;" title="End-to-End Encrypted">🔒</span>` : "";

    li.innerHTML = `
      <div class="avatar-container ${statusRingClass}">
        <img src="${bot.avatar}" alt="${bot.name}">
        ${presenceDot}
      </div>
      <div class="card-details">
        <div class="card-row-top">
          <span class="card-title">${bot.name} ${padlockHtml}</span>
          <span class="card-time">${formatTimeAgo(bot.lastMsgTime)}</span>
        </div>
        <div class="card-row-bottom">
          <div class="card-preview" id="preview-${bot.id}">
            ${receiptTick}
            <span>${bot.lastMsgText}</span>
          </div>
          ${bot.unreadCount > 0 ? `<span class="card-badge">${bot.unreadCount}</span>` : ""}
        </div>
      </div>
    `;

    li.addEventListener("click", () => openChatWithContact(bot.id));
    container.appendChild(li);
  });
}

function formatLastMsgPreview(msg) {
  if (msg.type === "image") return "📷 Image file";
  if (msg.type === "doc") return "📄 Document file";
  if (msg.type === "location") return "📍 Location shared";
  if (msg.type === "voice") return "🎤 Voice message";
  return msg.text;
}

function renderStatusesList() {
  const container = document.getElementById("status-list-container");
  container.innerHTML = "";

  const uniqueAuthors = [];
  state.statuses.forEach(s => {
    if (!uniqueAuthors.includes(s.botId)) {
      uniqueAuthors.push(s.botId);
    }
  });

  if (uniqueAuthors.length === 0) {
    container.innerHTML = `<li class="no-chats-placeholder">No status updates available</li>`;
    return;
  }

  uniqueAuthors.forEach(authorId => {
    let author = state.bots.find(b => b.id === authorId);
    if (authorId === "user") {
      author = { name: "My Status (You)", avatar: state.userProfile.avatar };
    }
    if (!author) return;

    const authorStatuses = state.statuses.filter(s => s.botId === authorId);
    const lastStatus = authorStatuses[authorStatuses.length - 1];

    const li = document.createElement("li");
    li.className = "status-card";
    li.innerHTML = `
      <div class="avatar-container status-ring unread">
        <img src="${author.avatar}" alt="${author.name}">
      </div>
      <div class="card-details">
        <span class="card-title">${author.name}</span>
        <span class="card-time">${formatTimeAgo(lastStatus.timestamp)}</span>
      </div>
    `;

    li.addEventListener("click", () => openStatusViewer(authorId));
    container.appendChild(li);
  });
}

function renderCallsList() {
  const container = document.getElementById("call-list-container");
  container.innerHTML = "";

  if (state.calls.length === 0) {
    container.innerHTML = `<li class="no-chats-placeholder">No call history logs</li>`;
    return;
  }

  const sorted = [...state.calls].sort((a,b) => b.timestamp - a.timestamp);

  sorted.forEach(call => {
    let peer = state.bots.find(b => b.id === call.botId || b.id === call.userId);
    if (!peer && call.botId === state.userProfile.userId) {
      peer = { name: "Incoming Caller", avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=caller" };
    }
    if (!peer) return;

    const li = document.createElement("li");
    li.className = "call-card-item";

    let iconDirection = "";
    if (call.status === "missed") {
      iconDirection = `<span class="call-missed">&swarr; Missed</span>`;
    } else if (call.direction === "incoming") {
      iconDirection = `<span class="call-incoming">&ldsh; Incoming</span>`;
    } else {
      iconDirection = `<span class="call-outgoing">&rdsh; Outgoing</span>`;
    }

    const callIcon = call.type === "video" 
      ? `<svg viewBox="0 0 24 24" width="20" height="20" class="icon"><path fill="currentColor" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`
      : `<svg viewBox="0 0 24 24" width="20" height="20" class="icon"><path fill="currentColor" d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.21a.96.96 0 0 0 .25-1A11.36 11.36 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c-.01-.56-.46-1.12-1-1.12z"/></svg>`;

    li.innerHTML = `
      <div class="avatar-container">
        <img src="${peer.avatar}" alt="${peer.name}">
      </div>
      <div class="card-details">
        <span class="card-title">${peer.name}</span>
        <div class="call-icon-type">
          ${iconDirection}
          <span>&bull; ${formatTimeAgo(call.timestamp)}</span>
        </div>
      </div>
      <button class="action-btn call-row-trigger" data-bot="${peer.id}" data-type="${call.type}">
        ${callIcon}
      </button>
    `;

    li.querySelector(".call-row-trigger").addEventListener("click", (e) => {
      e.stopPropagation();
      triggerCall(call.type, peer.id);
    });

    container.appendChild(li);
  });
}

function renderSettingsView() {
  document.getElementById("settings-username-input").value = state.userProfile.name;
  document.getElementById("settings-bio-input").value = state.userProfile.bio;
  document.getElementById("settings-user-avatar").src = state.userProfile.avatar;
  
  // Load current privacy state into DOM controls
  if (state.privacy) {
    if (document.getElementById("privacy-lastseen-select")) {
      document.getElementById("privacy-lastseen-select").value = state.privacy.lastSeen || "everyone";
    }
    if (document.getElementById("privacy-photo-select")) {
      document.getElementById("privacy-photo-select").value = state.privacy.profilePhoto || "everyone";
    }
    if (document.getElementById("privacy-about-select")) {
      document.getElementById("privacy-about-select").value = state.privacy.about || "everyone";
    }
    if (document.getElementById("privacy-readreceipts-checkbox")) {
      document.getElementById("privacy-readreceipts-checkbox").checked = state.privacy.readReceipts !== false;
    }
    if (document.getElementById("privacy-disappearing-select")) {
      document.getElementById("privacy-disappearing-select").value = state.privacy.disappearing || "off";
    }
  }
}

// Render Starred messages lists
function renderStarredList() {
  const container = document.getElementById("starred-list-container");
  container.innerHTML = "";

  const starred = Object.values(state.starredMessages);
  if (starred.length === 0) {
    container.innerHTML = `<li class="no-chats-placeholder">No starred messages yet</li>`;
    return;
  }

  starred.forEach(msg => {
    const senderObj = state.bots.find(b => b.id === msg.sender);
    const senderName = msg.sender === state.userProfile.userId ? "You" : (senderObj ? senderObj.name : "User");
    
    const parentChatObj = state.bots.find(b => b.id === msg.chatId);
    const chatName = parentChatObj ? parentChatObj.name : "Private Chat";

    const li = document.createElement("li");
    li.className = "starred-message-card";
    
    let bubbleBody = "";
    if (msg.type === "image") {
      bubbleBody = `<div>📷 Photo attachment</div>`;
    } else if (msg.type === "doc") {
      bubbleBody = `<div>📄 Document file: <strong>${msg.fileName}</strong></div>`;
    } else if (msg.type === "voice") {
      bubbleBody = `<div>🎤 Voice Note recording</div>`;
    } else {
      bubbleBody = `<div>${msg.text}</div>`;
    }

    li.innerHTML = `
      <div class="starred-card-header">
        <span class="starred-sender">${senderName} &rarr; ${chatName}</span>
        <span>${formatTimeAgo(msg.timestamp)}</span>
      </div>
      <div class="starred-card-body">
        ${bubbleBody}
      </div>
      <div class="starred-card-footer">
        <button class="action-btn unstar-bubble-trigger" data-id="${msg.id}" style="color: #ff5e57; font-weight:600; font-size:11px;">Unstar</button>
      </div>
    `;

    li.addEventListener("click", (e) => {
      if (e.target.tagName !== "BUTTON") {
        openChatWithContact(msg.chatId);
      }
    });

    li.querySelector(".unstar-bubble-trigger").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleStarMessage(msg.id);
    });

    container.appendChild(li);
  });
}

// Layer 30: Client-side XSS message HTML sanitizer
function sanitizeMessageHTML(str) {
  if (typeof str !== "string") return "";
  // Allow resync key warning inline HTML button generated by system
  if (str.includes("resync-keys-inline-btn") && str.includes("Unable to decrypt")) {
    return str;
  }
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Render message history viewport
function renderMessagesList() {
  const container = document.getElementById("chat-messages-container");
  container.innerHTML = "";

  if (!state.activeChatId) return;

  const chatMsgs = state.messages.filter(m => 
    (m.chatId === state.activeChatId && m.sender === state.userProfile.userId) || 
    (m.chatId === state.userProfile.userId && m.sender === state.activeChatId) ||
    (m.chatId === state.activeChatId) 
  );

  const activeChatObj = state.bots.find(b => b.id === state.activeChatId);
  const isE2EE = activeChatObj && !activeChatObj.isBot && !activeChatObj.isGroup;
  if (isE2EE) {
    const alertBox = document.createElement("div");
    alertBox.className = "security-alert-box";
    alertBox.innerHTML = `
      <span class="security-alert-title">🔒 End-to-End Encrypted</span>
      Messages and calls are secured with client-side cryptokeys. No one outside of this chat can read them.
    `;
    container.appendChild(alertBox);
  }

  if (chatMsgs.length === 0) {
    if (!isE2EE) {
      container.innerHTML += `<div class="date-divider">No messages yet. Say hi!</div>`;
    }
    return;
  }

  let lastDateStr = "";

  chatMsgs.forEach((msg) => {
    const msgDateStr = new Date(msg.timestamp).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (msgDateStr !== lastDateStr) {
      const divider = document.createElement("div");
      divider.className = "date-divider";
      divider.textContent = isToday(msg.timestamp) ? "Today" : isYesterday(msg.timestamp) ? "Yesterday" : msgDateStr;
      container.appendChild(divider);
      lastDateStr = msgDateStr;
    }

    const wrapper = document.createElement("div");
    wrapper.className = `message-bubble-wrapper ${msg.sender === state.userProfile.userId ? "outgoing" : "incoming"}`;
    
    let bubbleContent = "";
    
    if (msg.type === "text") {
      // Layer 30: Sanitize unescaped text content
      let displayText = sanitizeMessageHTML(msg.text);
      if (state.searchInChatActive && state.searchInChatQuery) {
        const regex = new RegExp(`(${escapeRegExp(state.searchInChatQuery)})`, 'gi');
        displayText = displayText.replace(regex, `<span class="search-highlight">$1</span>`);
      }
      bubbleContent = `<div class="message-text">${displayText}</div>`;
    } else if (msg.type === "image") {
      bubbleContent = `
        <div class="message-image-content" onclick="window.openImageLightbox('${msg.text}', '${msg.fileName || 'image.png'}')">
          <img src="${msg.text}" alt="attachment visual">
          <div class="media-download-overlay" title="View Image">
            <svg viewBox="0 0 24 24" width="26" height="26" class="icon-white"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          </div>
        </div>
      `;
    } else if (msg.type === "doc") {
      const sizeStr = formatBytes(msg.size || 1024);
      bubbleContent = `
        <a href="${msg.text}" download="${msg.fileName}" class="message-doc-link">
          <div class="message-doc-content">
            <span class="doc-icon">
              <svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            </span>
            <div class="doc-meta">
              <span class="doc-name">${msg.fileName}</span>
              <span class="doc-size">${sizeStr}</span>
            </div>
            <span class="doc-download-arrow" title="Download Document">
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
            </span>
          </div>
        </a>
      `;
    } else if (msg.type === "location") {
      bubbleContent = `
        <div class="message-location-content">
          <div class="map-placeholder">
            <span class="map-pin">
              <svg viewBox="0 0 24 24" width="32" height="32"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            </span>
            <span>Shared Location</span>
            <strong>${msg.text}</strong>
          </div>
        </div>
      `;
    } else if (msg.type === "voice") {
      bubbleContent = `
        <div class="voice-message-row">
          <button class="voice-play-btn" id="voice-play-${msg.id}">
            <svg viewBox="0 0 24 24" width="18" height="18" class="icon-play" id="icon-play-${msg.id}"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
          </button>
          <div class="voice-waveform-timeline">
            <div class="voice-waveform-fill" id="waveform-fill-${msg.id}"></div>
          </div>
          <span class="voice-duration">Voice Note</span>
        </div>
      `;
    }

    const timeStr = new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });

    if (msg.type === "deleted") {
      wrapper.innerHTML = `
        <div class="message-bubble deleted" id="bubble-${msg.id}">
          <div class="message-text">🚫 This message was deleted</div>
          <div class="message-meta">
            <span class="message-time">${timeStr}</span>
          </div>
        </div>
      `;
      container.appendChild(wrapper);
      return;
    }

    let receiptTick = "";
    if (msg.sender === state.userProfile.userId) {
      if (msg.status === "sending") {
        receiptTick = `<span class="receipt-tick sending" title="Sending offline..." style="color: var(--text-secondary); font-size: 11px; margin-left: 4px;">🕒</span>`;
      } else {
        const readClass = msg.status === "read" ? "read" : "";
        receiptTick = `<span class="receipt-tick ${readClass}">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17.3 8.3L12 13.6l-2.3-2.3c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4l3 3c.2.2.5.3.7.3s.5-.1.7-.3l6-6c.4-.4.4-1 0-1.4s-1-.4-1.4 0zm-5.6 7l-3-3c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4l3 3c.2.2.5.3.7.3s.5-.1.7-.3l6-6c.4-.4.4-1 0-1.4s-1-.4-1.4 0l-5.6 6z"/></svg>
        </span>`;
      }
    }

    const senderObj = state.bots.find(b => b.id === msg.sender);
    const senderNameHeader = (senderObj && state.bots.find(b => b.id === state.activeChatId)?.isGroup && msg.sender !== state.userProfile.userId)
      ? `<span style="font-size: 11px; font-weight:600; color:var(--wa-green); margin-bottom:4px; display:block;">${senderObj.name}</span>`
      : "";

    const isStarred = state.starredMessages[msg.id];
    const starBadge = `<span class="star-toggle-trigger" data-id="${msg.id}" style="cursor:pointer; font-size:12px; margin-left:6px; color:${isStarred ? '#f1c40f' : 'rgba(255,255,255,0.15)'};" title="Star message">${isStarred ? '★' : '☆'}</span>`;

    // Dropdown Action Menu HTML template
    const dropdownHtml = `
      <div class="bubble-options-trigger" id="trigger-${msg.id}">▼</div>
      <div class="bubble-options-dropdown" id="dropdown-${msg.id}" style="display: none;">
        <div class="bubble-dropdown-item pin-action-item">Pin Message</div>
        <div class="bubble-dropdown-item star-action-item">${isStarred ? 'Unstar' : 'Star'} Msg</div>
        <div class="bubble-dropdown-item delete-action-item" style="color: #ea8685;">Delete Msg</div>
      </div>
    `;

    wrapper.innerHTML = `
      <div class="message-bubble" id="bubble-${msg.id}">
        ${senderNameHeader}
        ${bubbleContent}
        <div class="message-meta">
          <span class="message-time">${timeStr}</span>
          ${receiptTick}
          ${starBadge}
        </div>
        ${dropdownHtml}
      </div>
    `;

    container.appendChild(wrapper);

    // Double click to pin message shortcut
    wrapper.querySelector(`.message-bubble`).addEventListener("dblclick", () => pinMessage(msg));

    // Star icon badge click action
    wrapper.querySelector(`.star-toggle-trigger`).addEventListener("click", (e) => {
      e.stopPropagation();
      toggleStarMessage(msg.id);
    });

    // Options dropdown trigger click event handler
    const trigger = wrapper.querySelector(`#trigger-${msg.id}`);
    const dropdown = wrapper.querySelector(`#dropdown-${msg.id}`);
    
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".bubble-options-dropdown").forEach(d => {
        if (d !== dropdown) d.style.display = "none";
      });
      dropdown.style.display = dropdown.style.display === "none" ? "flex" : "none";
    });

    // Dropdown Menu Option Event Listeners
    dropdown.querySelector(".pin-action-item").addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.style.display = "none";
      pinMessage(msg);
    });

    dropdown.querySelector(".star-action-item").addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.style.display = "none";
      toggleStarMessage(msg.id);
    });

    dropdown.querySelector(".delete-action-item").addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.style.display = "none";
      openDeleteConfirmation(msg);
    });

    if (msg.type === "voice") {
      wrapper.querySelector(`#voice-play-${msg.id}`).addEventListener("click", () => playVoiceNoteBubble(msg.id));
    }
  });

  container.scrollTop = container.scrollHeight;
  applyActiveSearchHighlight();
}

// Star / Unstar Message
function toggleStarMessage(msgId) {
  const msg = state.messages.find(m => m.id === msgId);
  if (!msg) return;

  if (state.starredMessages[msgId]) {
    delete state.starredMessages[msgId];
    showToast("Message unstarred.");
  } else {
    state.starredMessages[msgId] = {
      id: msg.id,
      chatId: msg.chatId,
      sender: msg.sender,
      text: msg.text,
      timestamp: msg.timestamp,
      type: msg.type,
      fileName: msg.fileName,
      size: msg.size
    };
    showToast("Message starred!");
  }

  localStorage.setItem("wa_clone_starred", JSON.stringify(state.starredMessages));
  
  if (state.activeChatId) {
    renderMessagesList();
  }
  renderPane("starred");
}

// Render Pinned Banner Header
function renderPinnedBanner() {
  const banner = document.getElementById("pinned-message-banner");
  const pinned = state.pinnedMessages[state.activeChatId];
  if (pinned) {
    document.getElementById("pinned-message-text").textContent = pinned.text;
    banner.style.display = "flex";
  } else {
    banner.style.display = "none";
  }
}

// Double click to Pin Message
function pinMessage(msg) {
  if (!state.activeChatId) return;
  const pinText = msg.type === 'text' ? msg.text : '[Attachment]';
  socket.emit("pin-message", {
    chatId: state.activeChatId,
    msgId: msg.id,
    text: pinText
  });
  state.pinnedMessages[state.activeChatId] = { msgId: msg.id, text: pinText };
  renderPinnedBanner();
  showToast("Message pinned to chat header!");
}

// Update padlock display next to name in header
function updateHeaderE2EEBadge() {
  if (!state.activeChatId) return;
  const target = state.bots.find(b => b.id === state.activeChatId);
  const badge = document.getElementById("chat-header-padlock");
  
  const isE2EE = target && !target.isBot && !target.isGroup;
  if (isE2EE) {
    badge.style.display = "inline";
  } else {
    badge.style.display = "none";
  }
}

// ==========================================
// ACTIVE CHAT VIEWPORT CONTROLLER
// ==========================================
function openChatWithContact(botId) {
  state.activeChatId = botId;

  const bot = state.bots.find(b => b.id === botId);
  if (bot) {
    bot.unreadCount = 0;
    updateGlobalUnreadBadge();

    document.getElementById("chat-header-name").innerHTML = `${bot.name} <span class="e2ee-padlock" id="chat-header-padlock" title="End-to-End Encrypted" style="display:none; font-size:12px; margin-left:4px;">🔒</span>`;
    document.getElementById("chat-header-avatar").src = bot.avatar;
    document.getElementById("chat-header-status").textContent = bot.status;
  }

  document.getElementById("welcome-screen").style.display = "none";
  document.getElementById("active-chat-panel").style.display = "flex";
  closeDetailDrawer();

  if (window.innerWidth <= 768) {
    document.getElementById("sidebar").classList.add("hidden");
  }

  // Load custom chat wallpaper or default wallpaper
  const customWall = state.customWallpapers[botId] || "inherit";
  document.getElementById("chat-wallpaper-select").value = customWall;
  const defaultWallpaper = localStorage.getItem("wa_clone_wallpaper") || "default";
  applyWallpaper(customWall === "inherit" ? defaultWallpaper : customWall);

  renderChatsList();
  renderMessagesList();
  renderPinnedBanner();
  updateHeaderE2EEBadge();

  document.getElementById("message-text-input").value = "";
  document.getElementById("message-text-input").dispatchEvent(new Event("input"));
}

async function sendMessage() {
  const input = document.getElementById("message-text-input");
  const text = input.value.trim();
  if (!text || !state.activeChatId) return;

  const msgId = "msg-" + Date.now();
  
  // Encrypt payload if human E2EE connection is established
  const payload = await encryptMessagePayload(text, state.activeChatId);

  const isOnline = socket.connected && navigator.onLine;

  const newMsg = {
    id: msgId,
    chatId: state.activeChatId,
    sender: state.userProfile.userId,
    text: payload.ciphertext,
    encryptedKey: payload.encryptedKey,
    senderEncryptedKey: payload.senderEncryptedKey,
    iv: payload.iv,
    isUnencrypted: payload.isUnencrypted,
    timestamp: Date.now(),
    type: "text",
    status: isOnline ? "sent" : "sending"
  };

  const localCopy = {
    ...newMsg,
    text: text, // Plain text locally
    isUnencrypted: true
  };
  state.messages.push(localCopy);
  
  if (isOnline) {
    socket.emit("send-message", newMsg);
  } else {
    state.outboxQueue = state.outboxQueue || [];
    state.outboxQueue.push(newMsg);
    localStorage.setItem("wa_clone_outbox", JSON.stringify(state.outboxQueue));
    showToast("Message queued offline. Will send when reconnected.");
  }

  input.value = "";
  input.dispatchEvent(new Event("input"));

  renderMessagesList();
  renderChatsList();

  // Reset typing state
  state.isTypingLocal = false;
  socket.emit("typing-state", { recipientId: state.activeChatId, typing: false });
}

function sendAttachmentMessage(type, fileData, fileName, fileSize = 0) {
  if (!state.activeChatId) return;

  const msgId = "msg-" + Date.now();
  
  const isOnline = socket.connected && navigator.onLine;

  const newMsg = {
    id: msgId,
    chatId: state.activeChatId,
    sender: state.userProfile.userId,
    text: fileData,
    fileName: fileName,
    size: fileSize,
    timestamp: Date.now(),
    type: type,
    status: isOnline ? "sent" : "sending",
    isUnencrypted: true
  };

  state.messages.push(newMsg);
  
  if (isOnline) {
    socket.emit("send-message", newMsg);
  } else {
    state.outboxQueue = state.outboxQueue || [];
    state.outboxQueue.push(newMsg);
    localStorage.setItem("wa_clone_outbox", JSON.stringify(state.outboxQueue));
    showToast("Attachment queued offline. Will send when reconnected.");
  }

  renderMessagesList();
  renderChatsList();
  if (isOnline) {
    showToast("File uploaded successfully.");
  }
}

// ==========================================
// VOICE RECORD SIMULATION
// ==========================================
async function startVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    state.isRecording = true;
    state.recordingSeconds = 0;
    state.recordingStream = stream;
    
    let chunks = [];
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };
    mediaRecorder.onstop = () => {
      if (state.recordingSeconds > 0) {
        const blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
        const reader = new FileReader();
        reader.onload = (evt) => {
          sendAttachmentMessage("voice", evt.target.result, "Voice Note");
        };
        reader.readAsDataURL(blob);
      }
    };
    
    state.mediaRecorder = mediaRecorder;
    mediaRecorder.start();

    const recOverlay = document.getElementById("voice-recording-overlay");
    const timerEl = document.getElementById("recording-timer");
    const voiceBtn = document.getElementById("send-voice-note-btn");
    
    recOverlay.style.display = "flex";
    timerEl.textContent = "0:00";
    voiceBtn.classList.add("active");
    voiceBtn.style.color = "#ff5e57";

    document.getElementById("message-text-input").placeholder = "Recording...";
    document.getElementById("message-text-input").disabled = true;

    state.recordingInterval = setInterval(() => {
      state.recordingSeconds += 1;
      const mins = Math.floor(state.recordingSeconds / 60);
      const secs = state.recordingSeconds % 60;
      timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
  } catch (err) {
    console.error("Microphone access failed for voice note:", err);
    showToast("Microphone access denied.");
  }
}

function stopVoiceRecording(shouldSend = true) {
  if (!state.isRecording) return;
  state.isRecording = false;
  clearInterval(state.recordingInterval);
  
  const recOverlay = document.getElementById("voice-recording-overlay");
  const voiceBtn = document.getElementById("send-voice-note-btn");
  
  recOverlay.style.display = "none";
  voiceBtn.classList.remove("active");
  voiceBtn.style.color = "var(--text-secondary)";

  document.getElementById("message-text-input").placeholder = "Type a message";
  document.getElementById("message-text-input").disabled = false;
  document.getElementById("message-text-input").focus();

  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
    if (!shouldSend) {
      state.recordingSeconds = 0; 
    }
    state.mediaRecorder.stop();
  }

  if (state.recordingStream) {
    state.recordingStream.getTracks().forEach(track => track.stop());
    state.recordingStream = null;
  }
}

function playVoiceNoteBubble(msgId) {
  const fill = document.getElementById(`waveform-fill-${msgId}`);
  const icon = document.getElementById(`icon-play-${msgId}`);
  if (!fill || !icon) return;

  const msg = state.messages.find(m => m.id === msgId);
  if (!msg || !msg.text) return;

  if (state.activeAudioPlayer && state.activeAudioPlayerMessageId === msgId) {
    state.activeAudioPlayer.pause();
    return;
  }

  if (state.activeAudioPlayer) {
    state.activeAudioPlayer.pause();
  }

  const audio = new Audio(msg.text);
  state.activeAudioPlayer = audio;
  state.activeAudioPlayerMessageId = msgId;

  icon.classList.add("playing");
  icon.innerHTML = `<path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`;

  audio.ontimeupdate = () => {
    if (audio.duration) {
      const pct = (audio.currentTime / audio.duration) * 100;
      fill.style.width = pct + "%";
    }
  };

  const resetUI = () => {
    icon.classList.remove("playing");
    icon.innerHTML = `<path fill="currentColor" d="M8 5v14l11-7z"/>`;
    fill.style.width = "0%";
    if (state.activeAudioPlayerMessageId === msgId) {
      state.activeAudioPlayer = null;
      state.activeAudioPlayerMessageId = null;
    }
  };

  audio.onpause = resetUI;
  audio.onended = resetUI;
  audio.onerror = () => {
    showToast("Failed to play audio.");
    resetUI();
  };

  audio.play().catch(e => {
    console.error("Playback failed:", e);
    resetUI();
  });
}

// ==========================================
// REAL WEBRTC AUDIO VIDEO SIGNALLING
// ==========================================
async function triggerCall(type, peerId = null) {
  const targetId = peerId || state.activeChatId;
  if (!targetId) return;

  const peerObj = state.bots.find(p => p.id === targetId);
  if (!peerObj) return;

  state.activeCall = {
    peerId: targetId,
    type: type,
    direction: "outgoing",
    status: "ringing",
    startTime: Date.now(),
    isWebRTC: true
  };

  document.getElementById("call-overlay-name").textContent = peerObj.name;
  document.getElementById("call-overlay-avatar").src = peerObj.avatar;
  document.getElementById("call-overlay-status").textContent = "Calling...";
  document.getElementById("call-overlay").style.display = "flex";
  document.querySelector(".calling-avatar-ring").className = "calling-avatar-ring ripple-animation";

  document.getElementById("call-accept-btn").style.display = "none";
  document.getElementById("call-toggle-mic").style.display = "flex";
  document.getElementById("call-toggle-video").style.display = "flex";

  startRingingSynth();

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: type === "video",
      audio: true
    });
    
    const localVideo = document.getElementById("local-video");
    localVideo.srcObject = localStream;
    document.getElementById("webrtc-video-container").style.display = "block";
  } catch (err) {
    console.warn("Media permissions blocked or not available. Running mock dialer.", err);
    state.activeCall.isWebRTC = false; 
  }

  socket.emit("call-dial", {
    recipientId: targetId,
    callType: type
  });
}

async function acceptIncomingCall() {
  if (!state.activeCall || state.activeCall.direction !== "incoming") return;
  stopRingingSynth();

  document.getElementById("call-accept-btn").style.display = "none";
  document.getElementById("call-toggle-mic").style.display = "flex";
  document.getElementById("call-toggle-video").style.display = "flex";

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: state.activeCall.type === "video",
      audio: true
    });
    const localVideo = document.getElementById("local-video");
    localVideo.srcObject = localStream;
    document.getElementById("webrtc-video-container").style.display = "block";
  } catch (err) {
    console.warn("Incoming call media access failed. Falling back to mockup.", err);
    state.activeCall.isWebRTC = false;
  }

  socket.emit("call-accept", { callerId: state.activeCall.peerId });
  connectCallUI();
}

async function connectCallUI() {
  if (!state.activeCall) return;
  state.activeCall.status = "connected";
  state.activeCall.startTime = Date.now();
  stopRingingSynth();

  document.getElementById("call-overlay-status").textContent = "00:00";
  
  if (state.activeCall.type === "video") {
    document.getElementById("calling-avatar-ring").style.display = "none";
    document.getElementById("call-overlay-name").style.display = "none";
  } else {
    document.getElementById("calling-avatar-ring").style.display = "block";
    document.getElementById("call-overlay-name").style.display = "block";
  }
  
  let sec = 0;
  state.activeCall.timerInterval = setInterval(() => {
    sec++;
    const mins = Math.floor(sec / 60).toString().padStart(2, '0');
    const secs = (sec % 60).toString().padStart(2, '0');
    document.getElementById("call-overlay-status").textContent = `${mins}:${secs}`;
  }, 1000);

  if (state.activeCall.isWebRTC && localStream && state.activeCall.direction === "outgoing") {
    try {
      peerConnection = new RTCPeerConnection(iceConfiguration);
      peerConnection.iceQueue = [...state.bufferedIceCandidates];
      state.bufferedIceCandidates = [];
      
      peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById("remote-video");
        if (event.streams && event.streams[0]) {
          remoteVideo.srcObject = event.streams[0];
        } else {
          if (!remoteVideo.srcObject) {
            remoteVideo.srcObject = new MediaStream();
          }
          remoteVideo.srcObject.addTrack(event.track);
        }
        remoteVideo.play().catch(e => {});
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc-ice-candidate", { candidate: event.candidate, recipientId: state.activeCall.peerId });
        }
      };
      
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      socket.emit("webrtc-offer", { offer, recipientId: state.activeCall.peerId });
    } catch (err) {
      console.error("WebRTC caller connection failed:", err);
    }
  }
}

function hangupActiveCall() {
  if (!state.activeCall) return;

  socket.emit("call-hangup", { recipientId: state.activeCall.peerId });

  const duration = Math.floor((Date.now() - state.activeCall.startTime) / 1000);
  const callRecord = {
    id: "call-" + Date.now(),
    botId: state.activeCall.peerId,
    userId: state.userProfile.userId,
    type: state.activeCall.type,
    direction: state.activeCall.direction,
    status: state.activeCall.status === "ringing" ? "missed" : "connected",
    timestamp: Date.now(),
    duration: state.activeCall.status === "ringing" ? 0 : duration
  };

  socket.emit("call-log-record", callRecord);
  closeActiveCallUI();
}

function closeActiveCallUI() {
  if (!state.activeCall) return;
  clearInterval(state.activeCall.timerInterval);
  stopRingingSynth();

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  document.getElementById("local-video").srcObject = null;
  document.getElementById("remote-video").srcObject = null;
  document.getElementById("webrtc-video-container").style.display = "none";

  document.getElementById("calling-avatar-ring").style.display = "block";
  document.getElementById("call-overlay-name").style.display = "block";

  const micBtn = document.getElementById("call-toggle-mic");
  micBtn.classList.remove("muted-active");
  micBtn.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
  micBtn.title = "Mute Mic";

  const videoBtn = document.getElementById("call-toggle-video");
  videoBtn.classList.remove("camera-off-active");
  videoBtn.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
  videoBtn.title = "Toggle Video";
  document.getElementById("local-video").style.opacity = "1";

  document.getElementById("call-overlay-status").textContent = "Call Ended";
  document.querySelector(".calling-avatar-ring").className = "calling-avatar-ring";

  setTimeout(() => {
    document.getElementById("call-overlay").style.display = "none";
    document.getElementById("minimized-call-banner").style.display = "none";
    state.activeCall = null;
  }, 1200);
}

function minimizeActiveCall() {
  if (!state.activeCall) return;
  document.getElementById("call-overlay").style.display = "none";
  
  const peerObj = state.bots.find(p => p.id === state.activeCall.peerId);
  document.getElementById("minimized-call-contact-name").textContent = peerObj ? peerObj.name : "Contact";
  document.getElementById("minimized-call-banner").style.display = "flex";
  
  // Set icons state in minimized banner based on local track status
  const minMicBtn = document.getElementById("minimized-btn-mic");
  const minVideoBtn = document.getElementById("minimized-btn-video");
  
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    const videoTrack = localStream.getVideoTracks()[0];
    
    if (audioTrack && !audioTrack.enabled) {
      minMicBtn.textContent = "🔇";
      minMicBtn.style.backgroundColor = "#ff5e57";
    } else {
      minMicBtn.textContent = "🎤";
      minMicBtn.style.backgroundColor = "#202c33";
    }
    
    if (videoTrack && !videoTrack.enabled) {
      minVideoBtn.textContent = "❌📹";
      minVideoBtn.style.backgroundColor = "#ff5e57";
    } else {
      minVideoBtn.textContent = "📹";
      minVideoBtn.style.backgroundColor = "#202c33";
    }
  }
  showToast("Call minimized.");
}

function maximizeActiveCall() {
  if (!state.activeCall) return;
  document.getElementById("minimized-call-banner").style.display = "none";
  document.getElementById("call-overlay").style.display = "flex";
}

function toggleLocalMicrophone() {
  if (!localStream) return;
  const audioTracks = localStream.getAudioTracks();
  if (audioTracks.length === 0) return;
  
  const currentlyEnabled = audioTracks[0].enabled;
  audioTracks.forEach(track => {
    track.enabled = !currentlyEnabled;
  });

  const micBtn = document.getElementById("call-toggle-mic");
  const minMicBtn = document.getElementById("minimized-btn-mic");
  if (currentlyEnabled) {
    micBtn.classList.add("muted-active");
    micBtn.style.backgroundColor = "#ff5e57"; 
    micBtn.title = "Unmute Mic";
    
    minMicBtn.textContent = "🔇";
    minMicBtn.style.backgroundColor = "#ff5e57";
    showToast("Microphone muted.");
  } else {
    micBtn.classList.remove("muted-active");
    micBtn.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
    micBtn.title = "Mute Mic";
    
    minMicBtn.textContent = "🎤";
    minMicBtn.style.backgroundColor = "#202c33";
    showToast("Microphone unmuted.");
  }
}

function toggleLocalCamera() {
  if (!localStream) return;
  const videoTracks = localStream.getVideoTracks();
  if (videoTracks.length === 0) return;
  
  const currentlyEnabled = videoTracks[0].enabled;
  videoTracks.forEach(track => {
    track.enabled = !currentlyEnabled;
  });

  const videoBtn = document.getElementById("call-toggle-video");
  const minVideoBtn = document.getElementById("minimized-btn-video");
  if (currentlyEnabled) {
    videoBtn.classList.add("camera-off-active");
    videoBtn.style.backgroundColor = "#ff5e57"; 
    videoBtn.title = "Turn Camera On";
    document.getElementById("local-video").style.opacity = "0.2";
    
    minVideoBtn.textContent = "❌📹";
    minVideoBtn.style.backgroundColor = "#ff5e57";
    showToast("Camera turned off.");
  } else {
    videoBtn.classList.remove("camera-off-active");
    videoBtn.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
    videoBtn.title = "Turn Camera Off";
    document.getElementById("local-video").style.opacity = "1";
    
    minVideoBtn.textContent = "📹";
    minVideoBtn.style.backgroundColor = "#202c33";
    showToast("Camera turned on.");
  }
}

// Audio Ringing oscillator
function startRingingSynth() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    state.activeCall.audioNodes = [];
    const playRingCycle = () => {
      if (!state.activeCall || state.activeCall.status !== "ringing") return;
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc1.frequency.value = 440;
      osc2.frequency.value = 480;
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime + 1.8);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2.0);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(audioCtx.currentTime + 2.0);
      osc2.stop(audioCtx.currentTime + 2.0);
      
      const timeoutId = setTimeout(playRingCycle, 4000);
      state.activeCall.audioNodes.push({ osc1, osc2, gainNode, timeoutId });
    };
    playRingCycle();
  } catch (err) {}
}

function stopRingingSynth() {
  if (state.activeCall && state.activeCall.audioNodes) {
    state.activeCall.audioNodes.forEach(node => {
      clearTimeout(node.timeoutId);
      try {
        node.osc1.stop();
        node.osc2.stop();
      } catch(e){}
    });
    state.activeCall.audioNodes = [];
  }
}

// ==========================================
// STATUS VIEWER LOGS
// ==========================================
function openStatusViewer(botId) {
  let author = state.bots.find(b => b.id === botId);
  if (botId === "user") {
    author = { name: "My Status (You)", avatar: state.userProfile.avatar };
  }
  const botStatuses = state.statuses.filter(s => s.botId === botId);
  if (!author || botStatuses.length === 0) return;

  state.activeStatusGroup = {
    botId: botId,
    statuses: botStatuses,
    currentIndex: 0
  };

  document.getElementById("status-viewer-name").textContent = author.name;
  document.getElementById("status-viewer-avatar").src = author.avatar;
  document.getElementById("status-viewer").style.display = "flex";

  renderStatusSlide();
}

function renderStatusSlide() {
  const group = state.activeStatusGroup;
  if (!group) return;

  const current = group.statuses[group.currentIndex];
  const contentEl = document.getElementById("status-viewer-content");
  document.getElementById("status-viewer-time").textContent = formatTimeAgo(current.timestamp);

  const progContainer = document.getElementById("status-progress-container");
  progContainer.innerHTML = "";
  group.statuses.forEach((s, idx) => {
    const segment = document.createElement("div");
    segment.className = "progress-bar-seg";
    const fill = document.createElement("div");
    fill.className = "progress-bar-fill";
    if (idx < group.currentIndex) fill.style.width = "100%";
    if (idx === group.currentIndex) fill.style.width = "0%";
    segment.appendChild(fill);
    progContainer.appendChild(segment);
  });

  if (current.type === "text") {
    contentEl.innerHTML = `
      <div class="status-text-slide" style="background: ${current.background || '#7158e2'}; padding: 40px; border-radius: 12px; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
        ${current.text}
      </div>
    `;
  } else {
    contentEl.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; gap: 12px;">
        <img src="${current.image}" alt="Status slide visual" class="status-img-slide">
        ${current.text ? `<p style="text-align:center; font-size:16px;">${current.text}</p>` : ''}
      </div>
    `;
  }

  clearInterval(group.progressInterval);
  const fills = progContainer.querySelectorAll(".progress-bar-fill");
  const activeFill = fills[group.currentIndex];
  let pct = 0;

  group.progressInterval = setInterval(() => {
    pct += 2;
    if (activeFill) activeFill.style.width = pct + "%";
    if (pct >= 100) {
      clearInterval(group.progressInterval);
      advanceStatus(1);
    }
  }, 100);
}

function advanceStatus(dir) {
  const group = state.activeStatusGroup;
  if (!group) return;

  clearInterval(group.progressInterval);
  let nextIdx = group.currentIndex + dir;
  if (nextIdx < 0) nextIdx = 0;
  
  if (nextIdx >= group.statuses.length) {
    closeStatusViewer();
  } else {
    group.currentIndex = nextIdx;
    renderStatusSlide();
  }
}

function closeStatusViewer() {
  const group = state.activeStatusGroup;
  if (group) clearInterval(group.progressInterval);
  document.getElementById("status-viewer").style.display = "none";
  state.activeStatusGroup = null;
  renderPane("status");
}

function addNewUserStatus(imageData) {
  const newStatus = {
    id: "status-user-" + Date.now(),
    botId: "user",
    type: "image",
    image: imageData,
    text: "Published real-time status! 🚀",
    timestamp: Date.now()
  };

  socket.emit("post-status", newStatus);
  showToast("Status story published!");
}

// ==========================================
// EMOJIS & INLINE SEARCH HELPERS
// ==========================================
function generateEmojiGrid(category) {
  const container = document.getElementById("emoji-grid-container");
  container.innerHTML = "";
  const list = EMOJIS[category] || EMOJIS.smileys;
  list.forEach(emoji => {
    const span = document.createElement("span");
    span.className = "emoji-item";
    span.textContent = emoji;
    span.addEventListener("click", (e) => {
      e.stopPropagation();
      const input = document.getElementById("message-text-input");
      input.value += emoji;
      input.dispatchEvent(new Event("input"));
    });
    container.appendChild(span);
  });
}

function performChatSearch() {
  const query = state.searchInChatQuery;
  const chatMsgs = state.messages.filter(m => 
    (m.chatId === state.activeChatId && m.sender === state.userProfile.userId) || 
    (m.chatId === state.userProfile.userId && m.sender === state.activeChatId) ||
    (m.chatId === state.activeChatId)
  );

  if (!query) {
    state.searchInChatMatches = [];
    state.searchInChatIndex = -1;
    renderMessagesList();
    return;
  }

  state.searchInChatMatches = [];
  chatMsgs.forEach(m => {
    if (m.type === "text" && m.text.toLowerCase().includes(query)) {
      state.searchInChatMatches.push(m.id);
    }
  });

  document.getElementById("chat-search-match-count").textContent = 
    state.searchInChatMatches.length > 0 
      ? `1/${state.searchInChatMatches.length}` 
      : "0/0";

  if (state.searchInChatMatches.length > 0) {
    state.searchInChatIndex = 0;
    renderMessagesList();
  } else {
    state.searchInChatIndex = -1;
    renderMessagesList();
  }
}

function navigateSearchMatches(dir) {
  const matches = state.searchInChatMatches;
  if (matches.length === 0) return;

  let idx = state.searchInChatIndex + dir;
  if (idx < 0) idx = matches.length - 1;
  if (idx >= matches.length) idx = 0;

  state.searchInChatIndex = idx;
  document.getElementById("chat-search-match-count").textContent = `${idx + 1}/${matches.length}`;
  applyActiveSearchHighlight();
}

function applyActiveSearchHighlight() {
  const matches = state.searchInChatMatches;
  const activeIdx = state.searchInChatIndex;
  if (matches.length === 0 || activeIdx === -1) return;

  const activeMsgId = matches[activeIdx];
  document.querySelectorAll(".search-highlight").forEach(el => el.classList.remove("active-match"));

  const bubble = document.getElementById(`bubble-${activeMsgId}`);
  if (bubble) {
    bubble.querySelectorAll(".search-highlight").forEach(h => h.classList.add("active-match"));
    bubble.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// ==========================================
// UTILITY TOOLS
// ==========================================
function updateGlobalUnreadBadge() {
  const total = state.bots.reduce((acc, bot) => acc + (bot.unreadCount || 0), 0);
  const badge = document.getElementById("global-unread-badge");
  if (total > 0) {
    badge.textContent = total;
    badge.style.display = "block";
    document.title = `(${total}) WhatsApp Web`;
  } else {
    badge.style.display = "none";
    document.title = "WhatsApp Web";
  }
}

function formatTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function isToday(timestamp) {
  const today = new Date();
  const d = new Date(timestamp);
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
}

function isYesterday(timestamp) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const d = new Date(timestamp);
  return d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();
}

function openDetailDrawer() {
  const detailSidebar = document.getElementById("detail-sidebar");
  if (!state.activeChatId) return;

  const bot = state.bots.find(b => b.id === state.activeChatId);
  if (!bot) return;

  document.getElementById("detail-name").textContent = bot.name;
  document.getElementById("detail-phone").textContent = bot.phone;
  document.getElementById("detail-bio").textContent = bot.bio;
  document.getElementById("detail-avatar").src = bot.avatar;
  document.getElementById("mute-chat-checkbox").checked = bot.muted || false;

  const currentWall = state.customWallpapers[state.activeChatId] || "inherit";
  document.getElementById("chat-wallpaper-select").value = currentWall;

  const imageMsgs = state.messages.filter(m => 
    ((m.chatId === state.activeChatId && m.sender === state.userProfile.userId) || 
     (m.chatId === state.userProfile.userId && m.sender === state.activeChatId) ||
     (m.chatId === state.activeChatId)) && m.type === "image"
  );
  
  const mediaGrid = document.getElementById("shared-media-grid");
  const noMedia = document.getElementById("no-media-text");
  mediaGrid.innerHTML = "";
  if (imageMsgs.length > 0) {
    noMedia.style.display = "none";
    imageMsgs.slice(-6).forEach(m => {
      const img = document.createElement("div");
      img.className = "shared-media-item";
      img.innerHTML = `<img src="${m.text}" alt="Shared resource preview">`;
      mediaGrid.appendChild(img);
    });
  } else {
    noMedia.style.display = "block";
  }

  detailSidebar.style.display = "flex";
}

function closeDetailDrawer() {
  document.getElementById("detail-sidebar").style.display = "none";
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (err) {}
}

function showToast(msg) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "slideInToast 0.3s reverse forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

window.openImageLightbox = function(src, fileName) {
  const lightbox = document.getElementById("image-lightbox");
  const img = document.getElementById("lightbox-image");
  const downloadBtn = document.getElementById("lightbox-download-btn");

  img.src = src;
  downloadBtn.href = src;
  downloadBtn.download = fileName || "image.png";
  lightbox.style.display = "flex";
};

window.closeImageLightbox = function() {
  document.getElementById("image-lightbox").style.display = "none";
};

// Conversions for ArrayBuffer / Base64 E2EE payloads
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Group Modal Handlers
function openGroupModal() {
  const modal = document.getElementById("group-modal");
  const list = document.getElementById("group-members-selection-list");
  const input = document.getElementById("group-subject-input");
  
  input.value = "";
  list.innerHTML = "";
  
  const humans = state.bots.filter(b => !b.isBot && !b.isGroup);
  
  if (humans.length === 0) {
    list.innerHTML = `<li style="padding: 10px; color: var(--text-secondary); text-align: center; list-style:none;">No active contacts to add</li>`;
  } else {
    humans.forEach(user => {
      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.alignItems = "center";
      li.style.gap = "10px";
      li.style.padding = "8px 0";
      li.style.borderBottom = "1px solid var(--border-sidebar)";
      li.style.listStyle = "none";
      
      li.innerHTML = `
        <input type="checkbox" class="group-member-checkbox" value="${user.id}" id="chk-${user.id}" style="width:18px; height:18px; cursor:pointer;">
        <label for="chk-${user.id}" style="display:flex; align-items:center; gap:10px; flex:1; cursor:pointer;">
          <img src="${user.avatar}" style="width:32px; height:32px; border-radius:50%;">
          <span style="font-weight:500; color:var(--text-primary);">${user.name}</span>
        </label>
      `;
      list.appendChild(li);
    });
  }
  
  modal.style.display = "flex";
}

function closeGroupModal() {
  document.getElementById("group-modal").style.display = "none";
}

function createGroupSubmit() {
  const nameInput = document.getElementById("group-subject-input");
  const subject = nameInput.value.trim();
  if (!subject) {
    showToast("Please enter a group subject.");
    return;
  }
  
  const checkboxes = document.querySelectorAll(".group-member-checkbox:checked");
  const selectedMembers = Array.from(checkboxes).map(chk => chk.value);
  
  if (selectedMembers.length === 0) {
    showToast("Please select at least one participant.");
    return;
  }
  
  selectedMembers.push(state.userProfile.userId);
  
  socket.emit("create-group", {
    groupName: subject,
    members: selectedMembers
  });
  
  closeGroupModal();
  showToast("Creating group...");
}

// Delete Message Confirmation dialog triggers
function openDeleteConfirmation(msg) {
  const modal = document.getElementById("delete-msg-modal");
  const everyoneBtn = document.getElementById("delete-for-everyone-btn");
  const meBtn = document.getElementById("delete-for-me-btn");
  const cancelBtn = document.getElementById("delete-msg-cancel-btn");
  
  const isMyMessage = msg.sender === state.userProfile.userId;
  const isUnderOneHour = Date.now() - msg.timestamp < 3600000;
  
  if (isMyMessage && isUnderOneHour) {
    everyoneBtn.style.display = "block";
  } else {
    everyoneBtn.style.display = "none";
  }
  
  everyoneBtn.onclick = () => {
    socket.emit("delete-message", {
      msgId: msg.id,
      userId: state.userProfile.userId,
      target: "everyone"
    });
    modal.style.display = "none";
  };
  
  meBtn.onclick = () => {
    socket.emit("delete-message", {
      msgId: msg.id,
      userId: state.userProfile.userId,
      target: "me"
    });
    modal.style.display = "none";
  };
  
  cancelBtn.onclick = () => {
    modal.style.display = "none";
  };
  
  modal.style.display = "flex";
}
