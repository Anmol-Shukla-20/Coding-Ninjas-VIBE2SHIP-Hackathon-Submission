import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration using Vite environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Request Scopes for Google APIs
provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
provider.addScope('https://www.googleapis.com/auth/classroom.courses.readonly');
provider.addScope('https://www.googleapis.com/auth/classroom.coursework.me.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');

// Global variable for API Token
let googleAccessToken = null;

// Global Tasks Array for Dashboard Sync
let globalTasks = [];

const renderDashboard = () => {
    const deadlineList = document.getElementById('deadline-list');
    const aiRecommendations = document.querySelector('.ai-recommendations');
    
    if (!deadlineList || !aiRecommendations) return;
    
    const now = new Date();
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(now.getDate() + 2);
    
    // Filter tasks due <= 2 days
    let urgentTasks = globalTasks.filter(t => {
        if (!t.dueDate) return true; // If no date, consider it urgent (e.g. emails)
        return t.dueDate <= twoDaysFromNow;
    });
    
    // Sort: earliest deadline first, then newer added first
    urgentTasks.sort((a, b) => {
        const dateA = a.dueDate ? a.dueDate.getTime() : now.getTime();
        const dateB = b.dueDate ? b.dueDate.getTime() : now.getTime();
        if (dateA !== dateB) return dateA - dateB;
        return b.timestamp - a.timestamp;
    });
    
    // 1. Render Upcoming Deadlines
    deadlineList.innerHTML = '';
    if (urgentTasks.length === 0) {
        deadlineList.innerHTML = '<li class="deadline-item"><span class="name" style="color: var(--text-secondary);">No upcoming deadlines within 2 days!</span></li>';
    } else {
        urgentTasks.forEach(t => {
            const isToday = t.dueDate && t.dueDate.toDateString() === now.toDateString();
            const timeStr = t.dueDate ? (isToday ? `Today` : t.dueDate.toLocaleDateString()) : 'Immediate';
            
            let icon = '<i class="fa-regular fa-clock"></i>';
            if (t.source === 'gmail') icon = '<i class="fa-solid fa-envelope" style="color: #EA4335;"></i>';
            if (t.source === 'classroom') icon = '<i class="fa-solid fa-chalkboard-user" style="color: #129E5E;"></i>';
            
            deadlineList.innerHTML += `
                <li class="deadline-item ${isToday ? 'critical' : ''}">
                    <span class="time">${icon} ${timeStr}</span>
                    <span class="name">${t.title}</span>
                </li>
            `;
        });
    }
    
    // 2. Render AI Priority Suggestions
    const headerHtml = `
        <div class="section-header">
            <h3><i class="fa-solid fa-brain"></i> AI Priority Suggestions</h3>
            <span class="badge warning">High Urgency</span>
        </div>
    `;
    
    let recommendationsHtml = headerHtml;
    
    if (urgentTasks.length === 0) {
        recommendationsHtml += `<p style="padding: 1rem; color: var(--text-secondary);">You are all caught up! Great job.</p>`;
    } else {
        // Take top 3 for AI suggestions
        urgentTasks.slice(0, 3).forEach((t, index) => {
            let urgencyText = index === 0 ? "Highest Priority" : "Next Priority";
            recommendationsHtml += `
                <div class="recommendation-card ${index === 0 ? 'active-task' : ''}">
                    <div class="task-info">
                        <h4>${t.title}</h4>
                        <p>${urgencyText} • Source: ${t.source}</p>
                    </div>
                    <button class="btn secondary-btn">Start Now</button>
                </div>
            `;
        });
    }
    aiRecommendations.innerHTML = recommendationsHtml;
};

// --- Custom Toast Notifications ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'glass-panel';
    toast.style.cssText = `
        padding: 1rem 1.5rem;
        border-radius: 8px;
        background: var(--panel-bg);
        border-left: 4px solid ${type === 'success' ? 'var(--success)' : 'var(--danger)'};
        color: var(--text-primary);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
        backdrop-filter: blur(10px);
    `;
    
    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check" style="color: var(--success);"></i>' 
                                    : '<i class="fa-solid fa-circle-exclamation" style="color: var(--danger);"></i>';
    
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// UI Elements
const smartInput = document.getElementById('smart-task-input');
const aiSubmitBtn = document.getElementById('ai-submit-btn');
const breakdownSection = document.getElementById('ai-breakdown-section');
const closeBreakdownBtn = document.getElementById('close-breakdown-btn');
const loginBtn = document.getElementById('login-btn'); // Sidebar button
const mainLoginBtn = document.getElementById('main-login-btn'); // Full screen button
const userProfileDiv = document.querySelector('.user-profile');
const loginScreen = document.getElementById('login-screen');
const mainDashboard = document.getElementById('main-dashboard');
const navLinks = document.querySelectorAll('.nav-links li');

// --- Navigation Logic ---
const pages = {
    'Dashboard': document.getElementById('dashboard-page'),
    'Calendar': document.getElementById('calendar-page'),
    'Projects': document.getElementById('projects-page'),
    'Insights': document.getElementById('insights-page'),
    'Connect Platforms': document.getElementById('platforms-page'),
    'Profile': document.getElementById('profile-page')
};

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const targetPageName = e.target.closest('li').innerText.trim();
        
        // Remove active class from all links and hide all pages
        navLinks.forEach(l => l.classList.remove('active'));
        Object.values(pages).forEach(page => {
            if (page) page.classList.add('hidden');
            if (page) page.classList.remove('active'); // Remove active for grid layouts if needed
        });

        // Activate clicked link and show corresponding page
        link.classList.add('active');
        if (pages[targetPageName]) {
            pages[targetPageName].classList.remove('hidden');
            pages[targetPageName].classList.add('active');
        }
    });
});

// Profile UI Elements
const profileMenuContainer = document.getElementById('profile-menu-container');
const profileMenuBtn = document.getElementById('profile-menu-btn');
const profileDropdownMenu = document.getElementById('profile-dropdown-menu');
const profileAvatar = document.getElementById('profile-avatar');

// Dropdown Nav Links
const navDashboardDropdown = document.getElementById('nav-dashboard-dropdown');
const navProfileDropdown = document.getElementById('nav-profile-dropdown');
const dropdownLogoutBtn = document.getElementById('dropdown-logout-btn');

// --- Authentication Logic ---

const handleLogin = () => {
    console.log("Login button clicked, attempting signInWithPopup...");
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log("User signed in:", result.user.displayName);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential) {
                googleAccessToken = credential.accessToken;
            }
        })
        .catch((error) => {
            console.error("Auth Error:", error.message);
            alert("Auth Error: " + error.message);
        });
};

// Handle Login Button Clicks
if (loginBtn) loginBtn.addEventListener('click', handleLogin);
if (mainLoginBtn) mainLoginBtn.addEventListener('click', handleLogin);

// Dropdown Logic
if (profileMenuBtn) {
    profileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdownMenu.classList.toggle('hidden');
    });
}
document.addEventListener('click', (e) => {
    if (profileMenuContainer && !profileMenuContainer.contains(e.target)) {
        if(profileDropdownMenu) profileDropdownMenu.classList.add('hidden');
    }
});

const switchToPage = (pageName) => {
    navLinks.forEach(l => l.classList.remove('active'));
    Object.values(pages).forEach(page => {
        if (page) {
            page.classList.add('hidden');
            page.classList.remove('active');
        }
    });
    if (pages[pageName]) {
        pages[pageName].classList.remove('hidden');
        pages[pageName].classList.add('active');
    }
};

if (navDashboardDropdown) {
    navDashboardDropdown.addEventListener('click', (e) => {
        e.preventDefault();
        switchToPage('Dashboard');
        profileDropdownMenu.classList.add('hidden');
    });
}

if (navProfileDropdown) {
    navProfileDropdown.addEventListener('click', (e) => {
        e.preventDefault();
        switchToPage('Profile');
        profileDropdownMenu.classList.add('hidden');
    });
}

if (dropdownLogoutBtn) {
    dropdownLogoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth);
        profileDropdownMenu.classList.add('hidden');
    });
}

// Listen for Auth State Changes
onAuthStateChanged(auth, (user) => {
    try {
        if (user) {
            // User is signed in -> Hide login screen, show dashboard
            loginScreen.classList.add('hidden');
            mainDashboard.classList.remove('hidden');
            
            // Hide sidebar sign in, show top right profile
            if (userProfileDiv) {
                userProfileDiv.style.display = 'block';
                let displayName = user.displayName || "User";
                userProfileDiv.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="Profile" style="width: 40px; height: 40px; border-radius: 50%;">
                        <div>
                            <p style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">${displayName}</p>
                            <button id="logout-btn" class="btn secondary-btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; margin-top: 5px;">Sign Out</button>
                        </div>
                    </div>
                `;
                document.getElementById('logout-btn').addEventListener('click', () => {
                    signOut(auth);
                });
            }
            if (profileMenuContainer) profileMenuContainer.classList.remove('hidden');
            
            let displayName = user.displayName || "User";
            if (profileAvatar) profileAvatar.innerText = displayName.charAt(0).toUpperCase();

            // Update Dashboard Greeting
            const greetingEl = document.getElementById('user-greeting');
            if (greetingEl) greetingEl.innerText = `Good Morning, ${displayName.split(' ')[0]}!`;
            
            // Load data
            if(typeof loadProjectsFromDB === 'function') loadProjectsFromDB();
            if(typeof loadProfileFromDB === 'function') loadProfileFromDB();
            if(typeof loadTasksFromDB === 'function') loadTasksFromDB();
            
        } else {
            // User is signed out -> Show login screen, hide dashboard
            loginScreen.classList.remove('hidden');
            mainDashboard.classList.add('hidden');
            
            if (userProfileDiv) {
                userProfileDiv.style.display = 'block';
                userProfileDiv.innerHTML = `<button id="login-btn" class="btn primary-btn" style="width: 100%;"><i class="fa-brands fa-google"></i> Sign In</button>`;
                document.getElementById('login-btn').addEventListener('click', handleLogin);
            }
            
            if (profileMenuContainer) profileMenuContainer.classList.add('hidden');

            const greetingEl = document.getElementById('user-greeting');
            if (greetingEl) greetingEl.innerText = `Good Morning!`;
        }
    } catch (error) {
        console.error("Error in onAuthStateChanged:", error);
        alert("UI update error after login: " + error.message);
    }
});

// AI API Configurations
const GEMINI_API_KEY = "AQ.Ab8RN6KPzCbkO46IO_sfFv_PhPLWT6trUtwrbcwz7s3sUFOoig"; // From your screenshot
const GROQ_API_KEY = "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"; // Fallback (Get free key from console.groq.com)

// --- AI Interaction Logic ---

// Handle Smart AI Input
aiSubmitBtn.addEventListener('click', handleSmartInput);
smartInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSmartInput();
});

// Close Breakdown Section
closeBreakdownBtn.addEventListener('click', () => {
    breakdownSection.classList.add('hidden');
    smartInput.value = '';
});

// --- Functions ---

async function handleSmartInput() {
    const userInput = smartInput.value.trim();
    if (!userInput) return;

    if (!auth.currentUser) {
        alert("Please sign in first to use the AI Agent!");
        return;
    }

    if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE" && GROQ_API_KEY === "YOUR_GROQ_API_KEY_HERE") {
        alert("Please add at least one AI API Key in app.js (Gemini or Groq)!");
        return;
    }

    console.log("User Input for AI:", userInput);

    // Show loading state
    aiSubmitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    smartInput.disabled = true;

    try {
        console.log("Trying Gemini API first...");
        const aiResponse = await callGeminiAI(userInput);
        showTaskBreakdown(userInput, aiResponse);
    } catch (geminiError) {
        console.warn("Gemini API failed. Falling back to Groq API...", geminiError);
        try {
            const aiResponse = await callGroqAI(userInput);
            showTaskBreakdown(userInput, aiResponse);
        } catch (groqError) {
            console.error("Both Gemini and Groq APIs failed:", groqError);
            alert("Failed to get AI breakdown from both Gemini and Groq. Check console for details.");
        }
    } finally {
        // Reset button
        aiSubmitBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        smartInput.disabled = false;
    }
}

async function callGroqAI(taskString) {
    const endpoint = `https://api.groq.com/openai/v1/chat/completions`;
    
    const promptText = `
    You are an expert productivity assistant. A user has given you a task/project: "${taskString}".
    Your goal is to break this task down into 3-5 smaller, actionable sub-tasks.
    Return ONLY a raw JSON array.
    Format each object in the array like this:
    {
      "title": "String, the name of the sub-task",
      "estimated_minutes": Number,
      "urgency": "High", "Medium", or "Low"
    }
    `;

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: "llama-3.1-8b-instant", 
            messages: [{ role: "user", content: promptText }],
            temperature: 0.5
        })
    });

    if (!response.ok) {
        const errorData = await response.text();
        throw new Error("Groq API Error: " + errorData);
    }
    
    const data = await response.json();
    let responseText = data.choices[0].message.content;
    
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Could not find JSON array in response");
    
    return JSON.parse(jsonMatch[0]);
}

async function callGeminiAI(taskString) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

    const promptText = `
    You are an expert productivity assistant. A user has given you a task/project: "${taskString}".
    Your goal is to break this task down into 3-5 smaller, actionable sub-tasks.
    Return ONLY a raw JSON array.
    Format each object in the array like this:
    {
      "title": "String, the name of the sub-task",
      "estimated_minutes": Number,
      "urgency": "High", "Medium", or "Low"
    }
    `;

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
        })
    });

    if (!response.ok) {
        const errorData = await response.text();
        console.error("Gemini API Error:", errorData);
        throw new Error("Network response was not ok: " + errorData);
    }

    const data = await response.json();
    let responseText = data.candidates[0].content.parts[0].text;

    console.log("Raw AI Response:", responseText); // Helpful for debugging

    // Extract JSON array using regex in case AI added extra conversational text
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        throw new Error("Could not find JSON array in response");
    }

    return JSON.parse(jsonMatch[0]);
}

function showTaskBreakdown(originalTask, subTasks) {
    // Render the breakdown UI dynamically
    const breakdownContent = breakdownSection.querySelector('.breakdown-content');

    let html = `<p class="context-text">Breaking down: <strong>"${originalTask}"</strong></p><div class="sub-tasks">`;

    subTasks.forEach(task => {
        let hours = Math.floor(task.estimated_minutes / 60);
        let mins = task.estimated_minutes % 60;
        let timeStr = hours > 0 ? `${hours}h ${mins > 0 ? mins + 'm' : ''}` : `${mins}m`;

        html += `
            <label class="custom-checkbox">
                <input type="checkbox">
                <span class="checkmark"></span>
                ${task.title} (Est. ${timeStr}) - <span style="font-size: 0.8rem; opacity: 0.7;">${task.urgency} Priority</span>
            </label>
        `;
    });

    html += `</div><button id="save-task-db-btn" class="btn primary-btn mt-1"><i class="fa-solid fa-cloud-arrow-up"></i> Save to Database</button>`;

    breakdownContent.innerHTML = html;

    // Show the breakdown section
    breakdownSection.classList.remove('hidden');
    breakdownSection.scrollIntoView({ behavior: 'smooth' });

    // Add listener to the new save button for Phase 2 Database logic
    document.getElementById('save-task-db-btn').addEventListener('click', () => {
        alert("Database saving coming next!");
    });
}

// --- Insights / Chat Logic ---

const chatInput = document.getElementById('chat-input');
const chatSubmitBtn = document.getElementById('chat-submit-btn');
const chatHistory = document.getElementById('chat-history');

async function handleChatSubmit() {
    const text = chatInput.value.trim();
    
    if (!text) return;
    
    if (!auth.currentUser) {
        alert("Please sign in first!");
        return;
    }

    // 1. Append User Message to UI
    let userMessageHtml = `<div class="chat-message user-message"><p>${text}</p></div>`;
    
    chatHistory.insertAdjacentHTML('beforeend', userMessageHtml);
    chatHistory.scrollTop = chatHistory.scrollHeight; // Auto-scroll
    
    // Clear inputs
    chatInput.value = '';
    
    // Show AI loading state
    const loadingId = 'loading-' + Date.now();
    chatHistory.insertAdjacentHTML('beforeend', `
        <div class="chat-message ai-message" id="${loadingId}">
            <i class="fa-solid fa-robot text-accent"></i>
            <p><i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing...</p>
        </div>
    `);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    
    // 2. Call AI API (Groq for Text)
    try {
        let aiText = "";
        
        const endpoint = `https://api.groq.com/openai/v1/chat/completions`;
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant", 
                messages: [{ role: "user", content: text }],
                temperature: 0.5
            })
        });
            if (!response.ok) throw new Error(await response.text());
            const data = await response.json();
            aiText = data.choices[0].message.content;
        
        // 3. Update UI with AI Response
        const loadingEl = document.getElementById(loadingId);
        loadingEl.querySelector('p').innerHTML = aiText.replace(/\n/g, '<br>');
        
        // 4. Speak the response aloud (Text-to-Speech)
        const shouldSpeak = !text.toLowerCase().match(/don\'t speak|do not speak|silently|text only|no speech/);
        
        if (shouldSpeak && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Stop current speech
            const utterance = new SpeechSynthesisUtterance(aiText);
            
            const setVoiceAndSpeak = () => {
                const voices = window.speechSynthesis.getVoices();
                const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium'))) || voices[0];
                if (preferred) utterance.voice = preferred;
                
                const stopBtn = document.getElementById('stop-tts-btn');
                if (stopBtn) stopBtn.classList.remove('hidden');
                
                utterance.onend = () => { if (stopBtn) stopBtn.classList.add('hidden'); };
                utterance.onerror = () => { if (stopBtn) stopBtn.classList.add('hidden'); };
                window.speechSynthesis.speak(utterance);
            };

            let voices = window.speechSynthesis.getVoices();
            if (voices.length === 0) {
                window.speechSynthesis.onvoiceschanged = () => {
                    setVoiceAndSpeak();
                };
            } else {
                setVoiceAndSpeak();
            }
        }
        
    } catch (error) {
        console.error("Chat API Error:", error);
        let displayError = "Could not connect to AI.";
        try {
            const parsed = JSON.parse(error.message);
            if (parsed.error && parsed.error.message) displayError = parsed.error.message;
        } catch(e) {
            displayError = error.message;
        }
        document.getElementById(loadingId).querySelector('p').innerHTML = `<span style="color: red;">Error: ${displayError}</span>`;
    }
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

chatSubmitBtn.addEventListener('click', handleChatSubmit);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleChatSubmit();
});

const stopTtsBtn = document.getElementById('stop-tts-btn');
if (stopTtsBtn) {
    stopTtsBtn.addEventListener('click', () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            stopTtsBtn.classList.add('hidden');
        }
    });
}

// --- Voice Input Logic (Speech-to-Text) ---
const voiceInputBtn = document.getElementById('voice-input-btn');
let recognition;

if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = function() {
        voiceInputBtn.style.color = 'var(--danger)';
        voiceInputBtn.innerHTML = '<i class="fa-solid fa-microphone-lines"></i>';
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        chatInput.value += (chatInput.value ? ' ' : '') + transcript;
    };

    recognition.onerror = function(event) {
        console.error("Speech recognition error", event.error);
        voiceInputBtn.style.color = 'var(--text-secondary)';
        voiceInputBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    };

    recognition.onend = function() {
        voiceInputBtn.style.color = 'var(--text-secondary)';
        voiceInputBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    };

    voiceInputBtn.addEventListener('click', () => {
        try {
            recognition.start();
        } catch(e) {
            recognition.stop();
        }
    });
} else {
    voiceInputBtn.style.display = 'none'; // Hide if browser doesn't support it
    console.warn("Web Speech API is not supported in this browser.");
}

// --- Calendar / Manual Tasks Logic ---
const addManualTaskBtn = document.getElementById('add-manual-task-btn');
const manualTaskNameInput = document.getElementById('manual-task-name');
const manualTaskDateInput = document.getElementById('manual-task-date');
const manualTaskList = document.getElementById('manual-task-list');
const noTasksMsg = document.getElementById('no-tasks-msg');

const loadTasksFromDB = async () => {
    if (!auth.currentUser) return;
    try {
        const querySnapshot = await getDocs(collection(db, "users", auth.currentUser.uid, "tasks"));
        manualTaskList.innerHTML = '';
        
        // Clear manual tasks from global array to prevent duplicates on reload
        globalTasks = globalTasks.filter(t => t.source !== 'manual');
        
        let hasTasks = false;
        querySnapshot.forEach((docSnap) => {
            hasTasks = true;
            const data = docSnap.data();
            const li = createManualTaskItem(data.title, data.dueDate, docSnap.id);
            manualTaskList.appendChild(li);
            
            globalTasks.push({
                id: docSnap.id,
                title: data.title,
                dueDate: data.dueDate ? new Date(data.dueDate) : null,
                source: 'manual',
                timestamp: data.timestamp || Date.now()
            });
        });
        
        if (noTasksMsg) {
            noTasksMsg.style.display = hasTasks ? 'none' : 'block';
        }
        
        renderDashboard();
    } catch(e) {
        console.error("Error loading tasks", e);
    }
};

function createManualTaskItem(name, dateStr, dbId = null) {
    const li = document.createElement('li');
    li.className = 'deadline-item glass-panel';
    li.style.borderLeftColor = 'var(--accent-color)';
    li.style.display = 'flex';
    li.style.flexDirection = 'row';
    li.style.justifyContent = 'space-between';
    li.style.alignItems = 'center';

    const infoDiv = document.createElement('div');
    infoDiv.innerHTML = `
        <span class="name" style="font-size: 1.1rem;">${name}</span>
        ${dateStr ? `<span class="time" style="color: var(--text-secondary); font-size: 0.85rem;"><i class="fa-regular fa-clock"></i> Due: ${new Date(dateStr).toLocaleDateString()}</span>` : ''}
    `;

    const actionsDiv = document.createElement('div');
    actionsDiv.style.display = 'flex';
    actionsDiv.style.gap = '10px';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn';
    deleteBtn.style.color = 'var(--danger)';
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    deleteBtn.onclick = async () => {
        if(confirm("Are you sure you want to delete this task?")) {
            li.remove();
            
            // Remove from global array
            globalTasks = globalTasks.filter(t => t.id !== dbId);
            renderDashboard();
            
            if (manualTaskList.querySelectorAll('li').length === 0) {
                if (noTasksMsg) noTasksMsg.style.display = 'block';
            }
            
            if (dbId && auth.currentUser) {
                try {
                    await deleteDoc(doc(db, "users", auth.currentUser.uid, "tasks", dbId));
                } catch(e) {
                    console.error("Error deleting from db", e);
                }
            }
        }
    };

    actionsDiv.appendChild(deleteBtn);
    
    li.appendChild(infoDiv);
    li.appendChild(actionsDiv);
    
    return li;
}

addManualTaskBtn.addEventListener('click', async () => {
    const taskName = manualTaskNameInput.value.trim();
    const taskDate = manualTaskDateInput.value;

    if (!taskName) {
        alert("Please enter a task name.");
        return;
    }
    
    if (!auth.currentUser) {
        alert("Please sign in first to save tasks!");
        return;
    }

    if (noTasksMsg) noTasksMsg.style.display = 'none';
    
    const timestamp = Date.now();
    try {
        addManualTaskBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        const docRef = await addDoc(collection(db, "users", auth.currentUser.uid, "tasks"), {
            title: taskName,
            dueDate: taskDate,
            timestamp: timestamp
        });
        
        const newTaskLi = createManualTaskItem(taskName, taskDate, docRef.id);
        manualTaskList.appendChild(newTaskLi);
        
        globalTasks.push({
            id: docRef.id,
            title: taskName,
            dueDate: taskDate ? new Date(taskDate) : null,
            source: 'manual',
            timestamp: timestamp
        });
        
        renderDashboard();
        showToast("Task Added", "success");
        
    } catch(e) {
        console.error("Add task error", e);
        showToast("Error adding task", "danger");
    } finally {
        addManualTaskBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Task';
    }

    // Clear inputs
    manualTaskNameInput.value = '';
    manualTaskDateInput.value = '';
});

// --- Theme Switching Logic ---
const themeSelect = document.getElementById('theme-select');

// Load saved theme
const savedTheme = localStorage.getItem('app-theme') || 'default';
themeSelect.value = savedTheme;
if (savedTheme !== 'default') {
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Listen for changes
themeSelect.addEventListener('change', (e) => {
    const selectedTheme = e.target.value;
    if (selectedTheme === 'default') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', selectedTheme);
    }
    localStorage.setItem('app-theme', selectedTheme);
});

// --- Google Calendar Sync ---
const syncGcalBtn = document.getElementById('sync-gcal-btn');

if (syncGcalBtn) {
    syncGcalBtn.addEventListener('click', async () => {
        if (!googleAccessToken) {
            alert("Please sign in again to grant Calendar permissions.");
            handleLogin(); // re-trigger login to get token
            return;
        }
        
        syncGcalBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...';
        
        try {
            const timeMin = new Date().toISOString();
            const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&maxResults=10&singleEvents=true&orderBy=startTime`, {
                headers: {
                    'Authorization': `Bearer ${googleAccessToken}`
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }
            
            const data = await response.json();
            const events = data.items;
            
            if (events && events.length > 0) {
                events.forEach(event => {
                    const title = event.summary;
                    const start = event.start.dateTime || event.start.date;
                    const li = createManualTaskItem(title, start);
                    li.style.borderLeftColor = '#4285F4'; // Google Blue
                    li.querySelector('.name').innerHTML = `<i class="fa-brands fa-google" style="color: #4285F4; margin-right: 5px;"></i> ${title}`;
                    manualTaskList.appendChild(li);
                });
                noTasksMsg.style.display = 'none';
            } else {
                alert("No upcoming Google Calendar events found.");
            }
        } catch (error) {
            console.error("Calendar Sync Error:", error);
            
            let errMsg = "Error syncing Calendar. Make sure you granted permissions.";
            try {
                const parsed = JSON.parse(error.message);
                if (parsed.error && parsed.error.message) {
                    errMsg = parsed.error.message;
                }
            } catch(e) {
                errMsg = error.message;
            }
            
            alert("Google API Error:\n\n" + errMsg + "\n\n(If it says 'API has not been used or is disabled', you must enable the Google Calendar API in your Firebase project's Google Cloud Console.)");
        }
        
        syncGcalBtn.innerHTML = '<i class="fa-brands fa-google"></i> Sync Google Calendar';
    });
}

// --- Platform Connect Buttons ---
const connectGcalBtn = document.getElementById('connect-gcal-btn');
const connectClassroomBtn = document.getElementById('connect-classroom-btn');
const connectGmailBtn = document.getElementById('connect-gmail-btn');
const connectDriveBtn = document.getElementById('connect-drive-btn');

if (connectGcalBtn) {
    connectGcalBtn.addEventListener('click', () => {
        // Navigate to Calendar page and click sync
        const calLink = Array.from(navLinks).find(l => l.innerText.trim() === 'Calendar');
        if (calLink) calLink.click();
        if (syncGcalBtn) syncGcalBtn.click();
    });
}

const handlePlatformConnect = (btn, platformName, fetchLogic, disconnectLogic) => {
    if (!btn) return;
    
    const isConnected = localStorage.getItem(`connected_${platformName}`) === 'true';
    
    const setConnectedUI = () => {
        btn.innerHTML = '<i class="fa-solid fa-unlink"></i> Disconnect';
        btn.classList.remove('primary-btn');
        btn.classList.add('secondary-btn');
        btn.style.background = 'var(--destructive)';
    };
    
    const setDisconnectedUI = () => {
        btn.innerHTML = '<i class="fa-solid fa-link"></i> Connect';
        btn.classList.add('primary-btn');
        btn.classList.remove('secondary-btn');
        btn.style.background = '';
    };

    if (isConnected) setConnectedUI();

    btn.addEventListener('click', async () => {
        const currentlyConnected = localStorage.getItem(`connected_${platformName}`) === 'true';
        
        if (currentlyConnected) {
            // Disconnect
            localStorage.removeItem(`connected_${platformName}`);
            setDisconnectedUI();
            if (disconnectLogic) disconnectLogic();
            showToast(`Disconnected from ${platformName}.`, 'success');
        } else {
            // Connect
            if (!googleAccessToken) {
                showToast(`Please sign in first to connect ${platformName}.`, 'danger');
                handleLogin();
                return;
            }
            
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';
            try {
                if (fetchLogic) await fetchLogic();
                localStorage.setItem(`connected_${platformName}`, 'true');
                setConnectedUI();
                showToast(`Connected Successfully!`, 'success');
            } catch (error) {
                console.error(`${platformName} Error:`, error);
                setDisconnectedUI();
                
                let errMsg = "Unknown error";
                try {
                    const parsed = JSON.parse(error.message);
                    if (parsed.error && parsed.error.message) errMsg = parsed.error.message;
                } catch(e) {
                    errMsg = error.message;
                }
                showToast(`Failed to connect ${platformName}: ${errMsg}`, 'danger');
            }
        }
    });
};

// --- Gmail Logic ---
const fetchGmail = async () => {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=5', {
        headers: { 'Authorization': `Bearer ${googleAccessToken}` }
    });
    if (!response.ok) throw new Error(await response.text());
    
    const data = await response.json();
    const emailList = document.getElementById('email-list');
    const gmailSection = document.getElementById('gmail-section');
    emailList.innerHTML = '';
    
    if (data.messages && data.messages.length > 0) {
        gmailSection.classList.remove('hidden');
        
        // Remove old gmail tasks from global
        globalTasks = globalTasks.filter(t => t.source !== 'gmail');
        
        for (const msg of data.messages) {
            const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, {
                headers: { 'Authorization': `Bearer ${googleAccessToken}` }
            });
            if (!msgRes.ok) continue;
            const msgData = await msgRes.json();
            const subjectHeader = msgData.payload.headers.find(h => h.name === 'Subject');
            const fromHeader = msgData.payload.headers.find(h => h.name === 'From');
            
            const subject = subjectHeader ? subjectHeader.value : 'No Subject';
            const from = fromHeader ? fromHeader.value.split('<')[0].substring(0, 20) : 'Unknown';
            
            emailList.innerHTML += `
                <li class="deadline-item">
                    <span class="time"><i class="fa-solid fa-envelope" style="color: #EA4335;"></i> ${from}</span>
                    <span class="name">${subject}</span>
                </li>
            `;
            
            globalTasks.push({
                id: msg.id,
                title: `Email from ${from}: ${subject}`,
                dueDate: new Date(), // Consider unread emails as due today
                source: 'gmail',
                timestamp: Date.now()
            });
        }
        renderDashboard();
    }
};

const disconnectGmail = () => {
    document.getElementById('gmail-section').classList.add('hidden');
    document.getElementById('email-list').innerHTML = '';
};

handlePlatformConnect(connectGmailBtn, 'Gmail', fetchGmail, disconnectGmail);

// --- Google Classroom Logic ---
const fetchClassroom = async () => {
    const response = await fetch('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE', {
        headers: { 'Authorization': `Bearer ${googleAccessToken}` }
    });
    if (!response.ok) throw new Error(await response.text());
    
    const data = await response.json();
    const dashboardDeadlineList = document.getElementById('deadline-list');
    
    if (data.courses && data.courses.length > 0) {
        // Fetch coursework for the first course
        const courseId = data.courses[0].id;
        const cwRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`, {
             headers: { 'Authorization': `Bearer ${googleAccessToken}` }
        });
        if (cwRes.ok) {
            const cwData = await cwRes.json();
            if (cwData.courseWork) {
                // Clear old classroom tasks
                globalTasks = globalTasks.filter(t => t.source !== 'classroom');
                
                cwData.courseWork.slice(0, 3).forEach(work => {
                    const li = document.createElement('li');
                    li.className = 'deadline-item classroom-item';
                    li.innerHTML = `
                        <span class="time" style="color: #129E5E;"><i class="fa-solid fa-chalkboard-user"></i> Classroom</span>
                        <span class="name">${work.title}</span>
                    `;
                    dashboardDeadlineList.appendChild(li);
                    
                    let dueDate = null;
                    if (work.dueDate) {
                         dueDate = new Date(work.dueDate.year, work.dueDate.month - 1, work.dueDate.day);
                    }
                    
                    globalTasks.push({
                        id: work.id,
                        title: work.title,
                        dueDate: dueDate || new Date(),
                        source: 'classroom',
                        timestamp: Date.now()
                    });
                });
                renderDashboard();
            }
        }
    }
};

const disconnectClassroom = () => {
    const items = document.querySelectorAll('.classroom-item');
    items.forEach(i => i.remove());
};

handlePlatformConnect(connectClassroomBtn, 'Google Classroom', fetchClassroom, disconnectClassroom);

// --- Google Drive Logic ---
const openDrive = async () => {
    const email = auth.currentUser ? auth.currentUser.email : '';
    if (email) {
        window.open(`https://accounts.google.com/AccountChooser?continue=https://drive.google.com&Email=${encodeURIComponent(email)}`, '_blank');
    } else {
        window.open('https://drive.google.com', '_blank');
    }
    return true;
};
handlePlatformConnect(connectDriveBtn, 'Google Drive', openDrive, null);

// --- Projects Logic ---
const addProjectBtn = document.getElementById('add-project-btn');
const projectNameInput = document.getElementById('project-name-input');
const projectPriorityInput = document.getElementById('project-priority-input');
const projectsList = document.getElementById('projects-list');
const noProjectsMsg = document.getElementById('no-projects-msg');
const projectFilter = document.getElementById('project-filter');

let currentEditProjectId = null;

const getPriorityColor = (priority) => {
    if (priority === 'most-important') return 'var(--danger)';
    if (priority === 'important') return 'var(--warning)';
    return 'var(--success)';
};

const getPriorityLabel = (priority) => {
    if (priority === 'most-important') return 'Most Important';
    if (priority === 'important') return 'Important';
    return 'Less Important';
};

const renderProjects = (filter = 'all') => {
    const projects = document.querySelectorAll('.project-card');
    let visibleCount = 0;
    
    projects.forEach(card => {
        const priority = card.getAttribute('data-priority');
        if (filter === 'all' || filter === priority) {
            card.style.display = 'flex';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    if (projects.length === 0 || visibleCount === 0) {
        if(noProjectsMsg) noProjectsMsg.style.display = 'block';
    } else {
        if(noProjectsMsg) noProjectsMsg.style.display = 'none';
    }
};

const appendProjectToDOM = (id, name, priority) => {
    const projectCard = document.createElement('div');
    projectCard.className = 'project-card glass-panel';
    projectCard.setAttribute('data-id', id);
    projectCard.setAttribute('data-priority', priority);
    projectCard.style.cssText = `
        padding: 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-left: 4px solid ${getPriorityColor(priority)};
    `;
    
    projectCard.innerHTML = `
        <div>
            <h4 style="margin: 0; color: var(--text-primary);">${name}</h4>
            <span class="badge" style="background: ${getPriorityColor(priority)}; color: #fff; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; margin-top: 5px; display: inline-block;">
                ${getPriorityLabel(priority)}
            </span>
        </div>
        <div>
            <button class="icon-btn edit-project-btn" style="color: var(--text-secondary); margin-right: 5px;"><i class="fa-solid fa-pencil"></i></button>
            <button class="icon-btn delete-project-btn" style="color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;
    
    // Delete Logic
    projectCard.querySelector('.delete-project-btn').addEventListener('click', async () => {
        if (!auth.currentUser) return;
        try {
            await deleteDoc(doc(db, "users", auth.currentUser.uid, "projects", id));
            projectCard.remove();
            renderProjects(projectFilter.value);
            showToast("Project deleted", "success");
        } catch (e) {
            showToast("Failed to delete project", "danger");
        }
    });
    
    // Edit Logic
    projectCard.querySelector('.edit-project-btn').addEventListener('click', () => {
        currentEditProjectId = id;
        projectNameInput.value = name;
        projectPriorityInput.value = priority;
        addProjectBtn.innerHTML = '<i class="fa-solid fa-check"></i> Update Project';
        projectNameInput.focus();
    });
    
    projectsList.appendChild(projectCard);
};

const loadProjectsFromDB = async () => {
    if (!auth.currentUser || !projectsList) return;
    
    // Keep the "no projects" message but clear others
    const msgHtml = noProjectsMsg ? noProjectsMsg.outerHTML : '';
    projectsList.innerHTML = msgHtml; 
    
    try {
        const querySnapshot = await getDocs(collection(db, "users", auth.currentUser.uid, "projects"));
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            appendProjectToDOM(docSnap.id, data.name, data.priority);
        });
        renderProjects(projectFilter.value);
    } catch (e) {
        console.error("Error loading projects:", e);
    }
};

if (addProjectBtn) {
    addProjectBtn.addEventListener('click', async () => {
        if (!auth.currentUser) {
            showToast("Please sign in to save projects.", "danger");
            return;
        }
        
        const name = projectNameInput.value.trim();
        const priority = projectPriorityInput.value;
        
        if (!name) {
            showToast("Please enter a project name", "danger");
            return;
        }
        
        if(noProjectsMsg) noProjectsMsg.style.display = 'none';
        const projectBtnOriginalHtml = addProjectBtn.innerHTML;
        addProjectBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        
        try {
            if (currentEditProjectId) {
                // Update existing project
                await updateDoc(doc(db, "users", auth.currentUser.uid, "projects", currentEditProjectId), {
                    name: name,
                    priority: priority
                });
                showToast("Project updated successfully!", "success");
                currentEditProjectId = null;
                addProjectBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Project';
            } else {
                // Add new project
                await addDoc(collection(db, "users", auth.currentUser.uid, "projects"), {
                    name: name,
                    priority: priority,
                    createdAt: new Date().toISOString()
                });
                showToast("Project added successfully!", "success");
            }
            
            projectNameInput.value = '';
            // Reload the list from DB to ensure sync
            await loadProjectsFromDB(); 
            
        } catch (e) {
            console.error("Database Error:", e);
            showToast(`Database Error: ${e.message}`, "danger");
        } finally {
            if (!currentEditProjectId) {
                addProjectBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Project';
            }
        }
    });
}

if (projectFilter) {
    projectFilter.addEventListener('change', (e) => {
        renderProjects(e.target.value);
    });
}

// --- Profile Data Logic ---
const saveProfileBtn = document.getElementById('save-profile-btn');
const profileNameInput = document.getElementById('profile-name');
const profileAgeInput = document.getElementById('profile-age');
const profileGenderInput = document.getElementById('profile-gender');
const profileDobInput = document.getElementById('profile-dob');

const loadProfileFromDB = async () => {
    if (!auth.currentUser || !profileNameInput) return;
    try {
        const docRef = doc(db, "users", auth.currentUser.uid, "profile", "data");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            profileNameInput.value = data.name || '';
            profileAgeInput.value = data.age || '';
            profileGenderInput.value = data.gender || '';
            profileDobInput.value = data.dob || '';
        }
    } catch (e) {
        console.error("Error loading profile data:", e);
    }
};

if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
        if (!auth.currentUser) return;
        saveProfileBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        
        try {
            await setDoc(doc(db, "users", auth.currentUser.uid, "profile", "data"), {
                name: profileNameInput.value,
                age: profileAgeInput.value,
                gender: profileGenderInput.value,
                dob: profileDobInput.value,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            
            showToast("Profile saved securely to database!", "success");
            
            // Update Avatar if name changed
            if (profileNameInput.value && profileAvatar) {
                profileAvatar.innerText = profileNameInput.value.charAt(0).toUpperCase();
            }
            
        } catch (e) {
            console.error("Error saving profile:", e);
            showToast("Failed to save profile. Ensure Firestore is enabled.", "danger");
        } finally {
            saveProfileBtn.innerHTML = '<i class="fa-solid fa-save"></i> Save Profile';
        }
    });
}
