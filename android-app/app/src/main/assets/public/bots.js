/**
 * ==========================================
 * BOTS & CHAT SIMULATOR ENGINE (bots.js)
 * ==========================================
 */

// Initial Bot Profiles Data
const INITIAL_BOTS = [
  {
    id: "bot-alice",
    name: "Alice 💻 (Dev Friend)",
    avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Alice",
    phone: "+1 (555) 349-2041",
    bio: "Main branch contains bugs. Proceed with caution. 🚀",
    status: "online",
    unreadCount: 2,
    muted: false,
    themeColor: "default",
    lastInteraction: Date.now() - 3600000 * 2 // 2 hours ago
  },
  {
    id: "bot-bob",
    name: "Bob 💼 (Project Lead)",
    avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Bob",
    phone: "+1 (555) 892-4410",
    bio: "In meetings all day. Email if urgent.",
    status: "offline",
    unreadCount: 0,
    muted: false,
    themeColor: "solid-dark",
    lastInteraction: Date.now() - 3600000 * 5 // 5 hours ago
  },
  {
    id: "bot-charlie",
    name: "Charlie  Grandma ❤️",
    avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Charlie",
    phone: "+1 (555) 438-1992",
    bio: "Baking cookies today! 👵🍪",
    status: "online",
    unreadCount: 1,
    muted: false,
    themeColor: "sunny-gold",
    lastInteraction: Date.now() - 3600000 * 1 // 1 hour ago
  },
  {
    id: "bot-david",
    name: "Coach David 🏋️‍♂️",
    avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=David",
    phone: "+1 (555) 723-5591",
    bio: "Eat, sleep, lift, repeat. 💪 No excuses!",
    status: "online",
    unreadCount: 0,
    muted: false,
    themeColor: "minimal-grey",
    lastInteraction: Date.now() - 3600000 * 12 // 12 hours ago
  },
  {
    id: "bot-eva",
    name: "Eva ✈️ (Travel Vlog)",
    avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Eva",
    phone: "+1 (555) 234-9008",
    bio: "Currently exploring Tokyo! 🇯🇵🗼",
    status: "online",
    unreadCount: 0,
    muted: false,
    themeColor: "neon-violet",
    lastInteraction: Date.now() - 3600000 * 24 // 1 day ago
  }
];

// Initial pre-loaded message logs
const INITIAL_MESSAGES = [
  // Alice messages
  {
    id: "msg-a1",
    chatId: "bot-alice",
    sender: "bot-alice",
    text: "Hey! Did you check out the new CSS Nesting syntax?",
    timestamp: Date.now() - 3600000 * 2.2,
    type: "text",
    status: "read"
  },
  {
    id: "msg-a2",
    chatId: "bot-alice",
    sender: "user",
    text: "Yeah, it makes CSS structure look like SASS! Quite clean.",
    timestamp: Date.now() - 3600000 * 2.1,
    type: "text",
    status: "read"
  },
  {
    id: "msg-a3",
    chatId: "bot-alice",
    sender: "bot-alice",
    text: "Exactly! Oh by the way, my code is throwing a memory leak in dev environment...",
    timestamp: Date.now() - 3600000 * 2.05,
    type: "text",
    status: "read"
  },
  {
    id: "msg-a4",
    chatId: "bot-alice",
    sender: "bot-alice",
    text: "Can you review this code snippet if you have a minute? 😭",
    timestamp: Date.now() - 3600000 * 2,
    type: "text",
    status: "read"
  },

  // Bob messages
  {
    id: "msg-b1",
    chatId: "bot-bob",
    sender: "bot-bob",
    text: "Hi there. Hope you're doing well. Do you have the weekly status update presentation ready?",
    timestamp: Date.now() - 3600000 * 6,
    type: "text",
    status: "read"
  },
  {
    id: "msg-b2",
    chatId: "bot-bob",
    sender: "user",
    text: "Hi Bob, yes! I'm reviewing the final slide deck. Will send it in 10 mins.",
    timestamp: Date.now() - 3600000 * 5.8,
    type: "text",
    status: "read"
  },
  {
    id: "msg-b3",
    chatId: "bot-bob",
    sender: "bot-bob",
    text: "Excellent. Let's make sure our API latency metrics are highlighted in the intro slide.",
    timestamp: Date.now() - 3600000 * 5.7,
    type: "text",
    status: "read"
  },

  // Charlie messages
  {
    id: "msg-c1",
    chatId: "bot-charlie",
    sender: "bot-charlie",
    text: "Hello dear, hope you had a good day. Don't work too late!",
    timestamp: Date.now() - 3600000 * 1.5,
    type: "text",
    status: "read"
  },
  {
    id: "msg-c2",
    chatId: "bot-charlie",
    sender: "bot-charlie",
    text: "Did you eat dinner? I made beef stew and baked cinnamon cookies. Let me know when you can visit! 🍪👵🍲",
    timestamp: Date.now() - 3600000 * 1,
    type: "text",
    status: "read"
  },

  // David messages
  {
    id: "msg-d1",
    chatId: "bot-david",
    sender: "bot-david",
    text: "Morning champ! Hope you did not skip your leg workout yesterday.",
    timestamp: Date.now() - 3600000 * 13,
    type: "text",
    status: "read"
  },
  {
    id: "msg-d2",
    chatId: "bot-david",
    sender: "user",
    text: "Hey coach, did the squats and lunges. Sore today, but feeling great!",
    timestamp: Date.now() - 3600000 * 12.5,
    type: "text",
    status: "read"
  },
  {
    id: "msg-d3",
    chatId: "bot-david",
    sender: "bot-david",
    text: "Outstanding! Remember, hydration is key. 4 liters of water today. Keep pushing! 💪🏋️‍♂️",
    timestamp: Date.now() - 3600000 * 12,
    type: "text",
    status: "read"
  },

  // Eva messages
  {
    id: "msg-e1",
    chatId: "bot-eva",
    sender: "bot-eva",
    text: "Just landed in Tokyo! The neon lights are absolutely insane here.",
    timestamp: Date.now() - 3600000 * 25,
    type: "text",
    status: "read"
  },
  {
    id: "msg-e2",
    chatId: "bot-eva",
    sender: "user",
    text: "Wow! Have a blast. Make sure to visit Shinjuku at night.",
    timestamp: Date.now() - 3600000 * 24.5,
    type: "text",
    status: "read"
  },
  {
    id: "msg-e3",
    chatId: "bot-eva",
    sender: "bot-eva",
    text: "Here is the exact location of my hotel. Highly recommend it if you visit!",
    timestamp: Date.now() - 3600000 * 24,
    type: "location",
    text: "Tokyo, Japan",
    latitude: 35.6895,
    longitude: 139.6917,
    status: "read"
  }
];

// Initial pre-loaded calls log
const INITIAL_CALLS = [
  {
    id: "call-1",
    botId: "bot-alice",
    type: "voice",
    direction: "incoming",
    status: "missed",
    timestamp: Date.now() - 3600000 * 4,
    duration: 0
  },
  {
    id: "call-2",
    botId: "bot-david",
    type: "voice",
    direction: "outgoing",
    status: "connected",
    timestamp: Date.now() - 3600000 * 12.8,
    duration: 184 // 3 mins 4 secs
  },
  {
    id: "call-3",
    botId: "bot-charlie",
    type: "video",
    direction: "incoming",
    status: "connected",
    timestamp: Date.now() - 3600000 * 20,
    duration: 425 // 7 mins 5 secs
  }
];

// Initial pre-loaded status updates
const INITIAL_STATUSES = [
  {
    id: "status-alice-1",
    botId: "bot-alice",
    type: "text",
    text: "Refactoring legacy code is like walking through a minefield blindfolded... 💣👀",
    background: "linear-gradient(135deg, #7158e2 0%, #3d3d3d 100%)",
    timestamp: Date.now() - 3600000 * 2
  },
  {
    id: "status-david-1",
    botId: "bot-david",
    type: "image",
    image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&q=80&w=400",
    text: "Rise and grind! Empty gym is the best gym. 🏋️‍♂️🏆",
    timestamp: Date.now() - 3600000 * 4
  },
  {
    id: "status-eva-1",
    botId: "bot-eva",
    type: "image",
    image: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&q=80&w=400",
    text: "Cherry blossoms in full bloom today! 🌸🇯🇵",
    timestamp: Date.now() - 3600000 * 8
  }
];

// Contextual Bot Responses Dictionary
const BOT_RESPONSE_ENGINE = {
  "bot-alice": {
    greetings: [
      "Hey! What's coding today? 💻",
      "Hi! Hope your compilers aren't throwing warnings.",
      "Hello! Just finished updating my node dependencies (all 10,000 of them) 💀"
    ],
    keywords: [
      {
        keys: ["leak", "bug", "error", "leak", "crash", "compile", "run", "broken"],
        replies: [
          "Ugh! Did you try console.logging every line? 😅 Or check stackoverflow?",
          "Check if there is a circular dependency. That always leaks memory in JS.",
          "It works on my machine! 🤷‍♀️ Let's do a git pull and verify."
        ]
      },
      {
        keys: ["work", "project", "app", "website", "code"],
        replies: [
          "Building a WhatsApp clone? That's awesome! Make sure the CSS matches exactly.",
          "Check out the browser AudioContext API, it's super cool for custom dial ringers!",
          "JavaScript is fun until you try to compare `[] === ![]` which is somehow true... 😂"
        ]
      },
      {
        keys: ["help", "review", "look"],
        replies: [
          "Sure! Send me a screenshot of the traceback or push it to git.",
          "Yeah, paste the code snippet here, I'll take a look before I merge this branch."
        ]
      }
    ],
    default: [
      "Let's grab coffee soon! ☕ I need to step away from this terminal.",
      "Git commit -m 'Fixed formatting (broken whole app)'. Classic! 😭",
      "I'm currently playing around with HTML5 canvas particles. They look super trippy!",
      "Did you know that 'Ctrl+C' is the most pressed combination in a developer's career?"
    ]
  },
  "bot-bob": {
    greetings: [
      "Good day. Hope we are making progress on our sprints.",
      "Hello. Please share your status update for the daily standup.",
      "Hi. Let me know if you need assistance unblocking any tasks."
    ],
    keywords: [
      {
        keys: ["update", "status", "ready", "finish", "done", "slide", "presentation"],
        replies: [
          "Excellent work. Please upload the deck to the shared workspace for feedback.",
          "Perfect. Let's make sure the client deliverables are clearly defined on slide 4.",
          "Great. Send me the link so I can review before the sync call with stakeholders."
        ]
      },
      {
        keys: ["delay", "bug", "block", "problem", "broken"],
        replies: [
          "Let's create a ticket for this. Do you need additional resources to unblock?",
          "Let's flag this as high-priority. I will coordinate with the QA team.",
          "Ensure this doesn't push back the milestone deadline. Let's hop on a call if needed."
        ]
      },
      {
        keys: ["vacation", "leave", "holiday", "off"],
        replies: [
          "Understood. Ensure your tasks are handed over and update your Out of Office calendar.",
          "Make sure the active branches are merged before you sign off. Have a good break!"
        ]
      }
    ],
    default: [
      "Let's schedule a alignment sync tomorrow at 10 AM. 📅",
      "We need to streamline our deployment workflow. The latency metrics look high.",
      "Please make sure all changes are documented in the project wiki. 💼",
      "Let's stay focused on the core KPIs for Q3. High quality and fast iterations."
    ]
  },
  "bot-charlie": {
    greetings: [
      "Hello my dear! How are you doing? ❤️👵",
      "Hi sweetie! Hope you are taking proper care of yourself.",
      "Hello child! Just checking in on you. Sending big hugs!"
    ],
    keywords: [
      {
        keys: ["eat", "food", "dinner", "lunch", "hungry", "cookie", "cook"],
        replies: [
          "You must eat healthy meals! I am making delicious pot roast today. 🍲",
          "I will bake some fresh chocolate chip cookies and send them over to you!",
          "Make sure to drink enough warm soup, the weather can get chilly!"
        ]
      },
      {
        keys: ["sick", "sore", "cold", "headache", "tired"],
        replies: [
          "Oh no! Get some proper sleep. I'll make ginger tea for you. ☕❤️",
          "Don't work yourself too hard. Health is the real wealth, dear!"
        ]
      },
      {
        keys: ["visit", "come", "sunday", "saturday", "weekend"],
        replies: [
          "I'd love that! I will prepare your favorite pie. Let me know when you leave.",
          "Can't wait to see you! Bring along your friends too."
        ]
      }
    ],
    default: [
      "Remember to take small breaks and rest your eyes, dear. 👀👵",
      "Sending you lots of love and prayers for your week. ❤️",
      "My garden roses are blooming beautifully today. I wish I could show you!",
      "I'm trying to learn how to send these emoji symbols. Hope I got it right! 😊🌟"
    ]
  },
  "bot-david": {
    greetings: [
      "Let's get it! Ready to crush today's goals? 💪",
      "Rise and shine! The weights are waiting. No excuses!",
      "Hey champ! How's the discipline levels today?"
    ],
    keywords: [
      {
        keys: ["workout", "gym", "squat", "lift", "lazy", "tired", "run"],
        replies: [
          "Tired? That is just mental weakness. Get up, put your shoes on, and push! 👟🏆",
          "Focus on form over weight. Squat deep! Let's get that progress.",
          "Consistency beats talent every single time. 45 minutes of heavy sweat today. Let's go!"
        ]
      },
      {
        keys: ["diet", "cheat", "eat", "protein", "water", "food"],
        replies: [
          "Double the protein intake! Chicken breast, broccoli, and clean carbs. 🥗🥤",
          "A cheat meal is earned, not given. Stay away from the sugary sodas!",
          "Drink 1 liter of water as soon as you read this. Hydration = Performance!"
        ]
      },
      {
        keys: ["hurt", "injury", "sore", "pain"],
        replies: [
          "Soreness is normal, sharp pain is not. Do some light stretching and foam rolling today.",
          "Active recovery: Go for a 5km brisk walk and take a warm Epsom salt bath."
        ]
      }
    ],
    default: [
      "Excuses don't burn calories. Sweat does! 🏋️‍♂️💪",
      "Your only limit is you. Break through that mental barrier!",
      "Sleep 8 hours, hit your macros, train hard. Simple formula for greatness.",
      "Success isn't owned, it's leased. And rent is due every single day! 🏆"
    ]
  },
  "bot-eva": {
    greetings: [
      "Kon'nichiwa! 🇯🇵 Spot me in the streets of Shibuya!",
      "Hey wanderer! Where is our next flight heading? ✈️🗺️",
      "Aloha! Sending sunny vibes from my latest adventure!"
    ],
    keywords: [
      {
        keys: ["where", "location", "hotel", "tokyo", "japan", "coordinate"],
        replies: [
          "Currently filming near Senso-ji Temple. The architecture is breathtaking! 🏮",
          "Check the shared location I sent earlier. It's the best local ramen shop!",
          "Heading to Mount Fuji tomorrow morning. Hope the weather clears up!"
        ]
      },
      {
        keys: ["photo", "video", "vlog", "youtube", "camera"],
        replies: [
          "I'm editing the Tokyo vlog right now! The color grading looks cinematic. 🎥🍿",
          "Just bought a new wide-angle lens. The bokeh effects are so smooth!",
          "Subscribe and hit that bell icon! Haha just kidding, I'll send you the preview link."
        ]
      },
      {
        keys: ["food", "sushi", "eat", "ramen"],
        replies: [
          "You haven't lived until you've tried fresh sushi from Tsukiji Market! 🍣🔥",
          "Ramen broth boiled for 24 hours is a spiritual experience. Trust me!"
        ]
      }
    ],
    default: [
      "Travel is the only thing you buy that makes you richer. ✈️🗺️",
      "Packing bags is an art form. I'm currently down to a single 30L backpack!",
      "Met some awesome local creators today. Language barriers disappear with good food.",
      "Next stop: Kyoto! The bamboo forest awaits. 🎋"
    ]
  }
};

/**
 * Returns a response based on keywords inside user text
 * @param {string} botId 
 * @param {string} messageText 
 * @returns {string} replyText
 */
function generateBotResponse(botId, messageText) {
  const engine = BOT_RESPONSE_ENGINE[botId] || BOT_RESPONSE_ENGINE["bot-alice"];
  const textClean = messageText.toLowerCase().trim();
  
  // 1. Check Keywords matching
  for (const group of engine.keywords) {
    if (group.keys.some(k => textClean.includes(k))) {
      const idx = Math.floor(Math.random() * group.replies.length);
      return group.replies[idx];
    }
  }
  
  // 2. Check Greetings
  const greetingsList = ["hi", "hello", "hey", "morning", "good morning", "yo", "hola"];
  if (greetingsList.some(g => textClean.startsWith(g) || textClean === g)) {
    const idx = Math.floor(Math.random() * engine.greetings.length);
    return engine.greetings[idx];
  }
  
  // 3. Fallback to general persona responses
  const idx = Math.floor(Math.random() * engine.default.length);
  return engine.default[idx];
}
