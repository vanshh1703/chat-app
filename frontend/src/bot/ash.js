/**
 * ASH - App System Helper
 * Neural-Lite Engine v3.2 (Multilingual-Pro)
 * 
 * Features:
 * - Language Detection (EN / HI / Hinglish)
 * - Multilingual Response Generation
 * - Levenshtein Fuzzy Matching (Spelling Resilience)
 * - Conversation Memory (Contextual follow-ups)
 */

import ashAvatar from '../assets/ash-avatar.svg';

export const ashPersona = {
    name: "ASH",
    id: "bot_ash_001",
    avatar_url: ashAvatar,
    bio: "Neural-Logic Unit optimized for your assistance. I monitor the nebula and synchronize your data with precision.",
    version: "3.2.1-feminine-active"
};

// --- LANGUAGE DETECTION ---
const HINDI_KEYWORDS = [
    "kaise", "haal", "kaun", "kya", "madad", "chahiye", "badlo", "parda", "dikhao",
    "purana", "pichla", "pehle", "bheja", "tha", "raat", "andhera", "mita", "hata",
    "upar", "rakho", "dimag", "ishara", "kon", "hai", "mere", "sab", "dikha", "kise",
    "batao", "bolo", "kar", "de", "karo", "kese", "kru", "kre", "karu", "kaise", "kya", "baatao",
    "yaar", "yr", "krega", "kregi", "karoge", "kaam", "kam", "bata", "bhao", "bhai", "bol", "kuch", "batayega", "call", "kiski", "thi", "kisne", "kab"
];

const detectLanguage = (input) => {
    const text = input.toLowerCase();
    const words = text.split(/\s+/);
    const hindiCount = words.filter(w => HINDI_KEYWORDS.includes(w)).length;
    // Special check for common particle "hai" or "yr" which might not be caught if single word
    const hasHindiParticles = ["hai", "hai?", "yr", "kr", "kre", "kru"].some(p => text.includes(p));
    return (hindiCount > 0 || hasHindiParticles) ? 'hinglish' : 'english';
};

// --- FUZZY LOGIC HELPERS ---
const getLevenshteinDistance = (a, b) => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

const isFuzzyMatch = (target, input) => {
    if (input.length < 3) return false;
    const distance = getLevenshteinDistance(target.toLowerCase(), input.toLowerCase());
    const maxLength = Math.max(target.length, input.length);
    const similarity = 1 - distance / maxLength;
    // Lower threshold for shorter words to catch 1-letter typos
    const threshold = target.length <= 4 ? 0.7 : 0.8;
    return similarity >= threshold;
};

// --- KNOWLEDGE BASE ---
export const KNOWLEDGE = {
    APP_CORE: {
        keywords: ["app details", "about app", "what is this", "ash app", "feature list", "functions", "intro"],
        response: {
            english: "Nebula Chat is a premium real-time communication interface built with a glassmorphic aesthetic. It features telepathy signals, sorry-power blasts, and offline-capable system help (me!).",
            hinglish: "Nebula Chat ek premium real-time chat app hai jisme glassmorphic design hai. Isme telepathy signals, sorry-power blasts aur offline system help (main!) jaise features hain."
        }
    },
    TECH_STACK: {
        keywords: ["tech", "stack", "built with", "kise bana", "language", "code"],
        response: {
            english: "Our synchronization layer uses React for the interface, Tailwind for styling, and Socket.IO for transmissions. I process everything locally on your device.",
            hinglish: "Ye app React, Tailwind aur Socket.IO se bani hai. Main saara data aapke device par locally process karti hoon."
        }
    },
    DARK_MODE: {
        keywords: ["dark", "night", "kala", "raat", "andhera", "theme", "appearance"],
        response: {
            english: "Dark Mode can be toggled in the Settings sector. It uses a deep slate-900 nebula background.",
            hinglish: "Aap Settings mein jaakar Dark Mode on kar sakte hain. Isse interface ka rang gehra slate-900 ho jayega."
        }
    },
    WALLPAPER: {
        keywords: ["wallpaper", "parda", "background", "badlo", "change", "wallpaper badlo", "theme", "theame", "interface", "look", "chat screen"],
        response: {
            english: "You can modify your chat wallpaper in Settings > Personalization. We support gradients and starfields.",
            hinglish: "Settings > Personalization mein jaakar aap wallpaper badal sakte hain. Yaha gradients aur stars wale options hain."
        }
    },
    TELEPATHY: {
        keywords: ["telepathy", "dimag", "brain", "ishara", "signal", "isara"],
        response: {
            english: "Telepathy Mode (Brain icon) allows for rapid neural synchronization without typing.",
            hinglish: "Telepathy Mode (dimag wala icon) se aap bina type kiye fast signals bhej sakte hain."
        }
    },
    SORRY_POWER: {
        keywords: ["sorry", "maafi", "zap", "power", "sorry power", "mafi"],
        response: {
            english: "The Sorry Power unit (Zap icon) is for high-intensity apologies. Resonance increases as you tap.",
            hinglish: "Sorry Power (zap icon) maafi mangne ka ek fast tarika hai. Jitna zyada aap tap karenge, resonance utni badhegi."
        }
    },
    PINNING: {
        keywords: ["pin", "upar", "sticky", "save", "pin karo"],
        response: {
            english: "To pin a chat or message, click the Pin icon. Pinned items stay at the top.",
            hinglish: "Kisi bhi chat ya message ko pin karne ke liye Pin icon dabayein. Pin kiye huye items sabse upar rehte hain."
        }
    },
    SECURITY: {
        keywords: ["safe", "privacy", "secure", "data", "bachao", "security"],
        response: {
            english: "All transmissions are processed through our secure socket layer. ASH works entirely offline.",
            hinglish: "Saari transmissions secure hain. ASH (main) puri tarah offline kaam karta hai, isliye aapka data safe hai."
        }
    },
    ACTIONS: {
        keywords: ["text", "bhejo", "send", "bolo", "message kar"],
        response: {
            english: "I am a local system assistant. Currently, I cannot send transmissions to other users directly, but I can help you find their logs!",
            hinglish: "Main ek local assistant hoon. Abhi main doosre users ko message nahi bhej sakti, par main unke chat logs dhundne mein aapki madad kar sakti hoon!"
        }
    },
    COPY_MESSAGE: {
        keywords: ["copy", "clipboard", "nakaal", "copy kaise kare", "message copy"],
        response: {
            english: "To copy a message, hover over it and click the Copy icon (clipboard). The content will be synchronized to your local clipboard buffer.",
            hinglish: "Message copy karne ke liye uspar mouse rakhein aur Copy icon dabayein. Text aapke clipboard mein save ho jayega."
        }
    }
};

export const INTENTS = {
    GREETINGS: {
        keywords: ["hello", "hi", "hey", "greetings", "ash", "morning", "evening", "namaste", "kaise", "kese", "ho", "hoo", "kaise ho", "kese ho", "kaise hoo", "kese hoo", "salam", "how are you", "kya haal hai", "fine", "yaar", "yr", "kaam", "kam", "krega", "kregi", "karoge", "bhai", "buddy"],
        response: {
            english: ["Greetings, traveler. How is your navigation today?", "ASH standing by. Systems nominal.", "I am functioning within optimal parameters. How can I assist you?", "Yes? I am ready for your command."],
            hinglish: ["Namaste traveler! Aaj aapki navigation kaisi hai?", "ASH haazir hai. Saare systems theek kaam kar rahe hain.", "Main bilkul badhiya hoon. Boliye, main aapki kaise madad kar sakti hoon?", "Haan bilkul, boliye kya kaam/help chahiye? Main taiyaar hoon."]
        }
    },
    LOGS: {
        keywords: ["chat logs", "message logs", "pichla message", "purana", "text dikhao", "history"],
        response: {
            english: "Your direct logs are in the sidebar. For deep archival call data, use the Clock icon in the header.",
            hinglish: "Aapke chat logs sidebar mein hain. Call history ke liye header mein Clock icon dekhein."
        }
    },
    STATS: {
        keywords: ["stats", "score", "level", "resonance", "performance", "haal", "friends", "score"],
        response: (ctx, lang) => {
            if (lang === 'hinglish') return `Nebula Stats: ${ctx.contactsCount} active log hain. System Resonance: ${ctx.isOnline ? 'Online' : 'Offline'}. Aapki profile ekdum mast chal rahi hai.`;
            return `Nebula Stats: Active Transmission Lines: ${ctx.contactsCount}. System Resonance: ${ctx.isOnline ? 'Interstellar (Online)' : 'Gravity (Offline)'}. Your profile is performing optimally.`;
        }
    },
    CONTACTS: {
        keywords: ["contact", "people", "log", "talked to", "friends", "list", "naam", "name"],
        response: (ctx, lang) => {
            const users = ctx.sidebarUsers || [];
            const filtered = users.filter(u => u.id !== ashPersona.id);
            if (filtered.length === 0) {
                return lang === 'hinglish' ? "Abhi aapke paas koi active contacts nahi hain. Search bar mein logo ko dhundhein." : "You currently have no active transmission lines open. Try searching for travelers in the search bar.";
            }
            const names = filtered.map(u => u.alias || u.username).join(", ");
            if (lang === 'hinglish') return `Mujhe ye log mile hain: ${names}. Aapke paas kul ${filtered.length} connections hain.`;
            return `I detect signals from the following travelers: ${names}. You have ${filtered.length} active connections.`;
        }
    },
    HELP: {
        keywords: ["help", "madad", "commands", "kya kar sakte ho", "guide"],
        response: {
            english: "I can assist with App Knowledge, User Stats, History Retrieval, and Performance Metrics. Try asking 'What is telepathy?' or 'Who am I?'.",
            hinglish: "Main App Knowledge, Stats, Chat History aur Performance mein madad kar sakti hoon. 'Telepathy kya hai?' ya 'Main kaun hoon?' puch kar dekhein."
        }
    },
    PROFILE: {
        keywords: ["who am i", "my name", "kaun hoon main", "mera naam", "profile details"],
        response: (ctx, lang) => {
            if (lang === 'hinglish') return `Aapki Pehchaan Confirmed: ${ctx.user?.username}. Location: Local Nebula. Email: ${ctx.user?.email || 'N/A'}.`;
            return `User Identity Confirmed: ${ctx.user?.username}. Location: Local Nebula. Frequency: ${ctx.user?.email || 'N/A'}.`;
        }
    },
    TIME: {
        keywords: ["time", "clock", "samay", "waqt", "baje"],
        response: (ctx, lang) => {
            const time = new Date().toLocaleTimeString();
            return lang === 'hinglish' ? `Abhi waqt ho raha hai: ${time}.` : `System cycle is currently: ${time}.`;
        }
    }
};

const FOLLOW_UP_KEYWORDS = ["tell me more", "how", "why", "kyu", "kise", "aur dikhao", "more", "explain", "baatao", "batao"];
const HISTORY_TRIGGERS = ["last", "latest", "what did", "pichla", "pehle", "message from", "text by", "call", "phone"];

// --- REASONING ENGINE ---

export const processMessage = (text, context) => {
    const input = text.toLowerCase().trim();
    const words = input.split(/\s+/);
    const { sidebarUsers = [], lastIntent = null } = context;
    const lang = detectLanguage(input);

    // 1. Contextual Follow-up Check
    const isFollowUp = FOLLOW_UP_KEYWORDS.some(k => input.includes(k));
    if (isFollowUp && lastIntent) {
        return `Deepening data on '${lastIntent}' [${lang}]: ${getDeepKnowledge(lastIntent, lang)}`;
    }

    // 2. Chat History Retrieval (Grammar-aware + Fuzzy Name detection)
    const hasHistorySignal = HISTORY_TRIGGERS.some(t => {
        const regex = new RegExp(`\\b${t}\\b`, 'i');
        return regex.test(input) || isFuzzyMatch(t, input, 0.85);
    });

    if (hasHistorySignal) {
        const userMatch = sidebarUsers.find(u => {
            const name = u.username.toLowerCase();
            const alias = u.alias ? u.alias.toLowerCase() : "";
            if (input.includes(name) || (alias && input.includes(alias))) return true;
            return words.some(w => isFuzzyMatch(name, w, 0.8) || (alias && isFuzzyMatch(alias, w, 0.8)));
        });

        if (userMatch) {
            const msgPrefix = lang === 'hinglish' ? `Archival log mil gaya. ${userMatch.alias || userMatch.username} ka aakhri message tha:` : `Archival log retrieved. The last transmission from ${userMatch.alias || userMatch.username} was:`;
            return userMatch.lastmsg
                ? `${msgPrefix} "${userMatch.lastmsg}"`
                : (lang === 'hinglish' ? `Maine ${userMatch.alias || userMatch.username} ke logs dekhe, par koi message nahi mila.` : `I've opened the connection for ${userMatch.alias || userMatch.username}, but no recent transmission logs exist.`);
        }
    }

    // 3. Multi-Intent Scoring (Includes Fuzzy Logic)
    let candidates = [];

    for (const [key, data] of Object.entries(KNOWLEDGE)) {
        let score = calculateScore(input, data.keywords);
        if (score > 0) candidates.push({ key, type: 'knowledge', score, response: data.response });
    }

    for (const [key, data] of Object.entries(INTENTS)) {
        let score = calculateScore(input, data.keywords);
        if (score > 0) candidates.push({ key, type: 'intent', score, response: data.response });
    }

    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
        const best = candidates[0];
        let resp = best.response || best.responses; // Handle both naming conventions

        if (!resp) return "Error: Response frequency out of range.";

        if (typeof resp === 'function') {
            return resp(context, lang);
        }

        const langSpecific = resp[lang] || resp['english'];
        return Array.isArray(langSpecific) ? langSpecific[Math.floor(Math.random() * langSpecific.length)] : langSpecific;
    }

    // 4. GPT-like Fallback (Simulated reasoning)
    if (input.length > 3) {
        if (lang === 'hinglish') {
            return `Maine aapka signal analyze kiya: "${input}". Iske liye mere paas koi specific command nahi hai, par main aapko app features ya stats ke baare mein bata sakti hoon. Aapko kya jaanna hai?`;
        }
        return `I've analyzed your signal: "${input}". While I don't have a specific command for this, I can monitor your transmissions or provide guidance on 'stats' and 'app features'. What specifically within the nebula can I help you find?`;
    }

    return lang === 'hinglish' ? "Signal kamzor hai. Stand-by rahein. Madad ke liye 'help' type karein." : "Signal weak. Monitor stand-by. Use 'help' to see my available sectors.";
};

const calculateScore = (input, keywords) => {
    let score = 0;
    const words = input.split(/\s+/);
    keywords.forEach(word => {
        const lowerWord = word.toLowerCase();
        // Exact inclusion or phrase match
        if (input.includes(lowerWord)) score += 2;
        // Whole word check
        const regex = new RegExp(`\\b${lowerWord}\\b`, 'i');
        if (regex.test(input)) score += 5;
        // Fuzzy part
        words.forEach(w => {
            if (isFuzzyMatch(lowerWord, w)) score += 3;
        });
    });
    return score;
};

const getDeepKnowledge = (key, lang) => {
    const depth = {
        TELEPATHY: {
            english: "It uses a custom signaling server with optimized payload sizes to reduce latency below 50ms.",
            hinglish: "Ye custom signaling server use karta hai jisse latency 50ms se bhi kam rehti hai."
        },
        WALLPAPER: {
            english: "We use CSS background-attachment properties and high-definition asset caching for smooth rendering.",
            hinglish: "Hum CSS properties aur HD caching ka use karte hain taaki wallpaper ekdum smooth dikhe."
        },
        SORRY_POWER: {
            english: "It calculates tapping frequency and maps it to a visually expanding glow-effect using CSS filters.",
            hinglish: "Ye aapke tapping frequency ko calculate karke ek mast glow-effect banata hai."
        },
        DARK_MODE: {
            english: "Our dark mode palette is chosen specifically to reduce blue-light emission and battery consumption.",
            hinglish: "Humaara dark mode blue-light kam karta hai aur battery bhi bachata hai."
        }
    };
    const node = depth[key] || { english: "Operational details are classified.", hinglish: "Is baare mein adhik jaankari abhi available nahi hai." };
    return node[lang] || node['english'];
};
