# Last-Minute Life Saver

## 🎯 Problem Statement Selected
Students, professionals, and hackathon participants often face overwhelming amounts of dispersed deadlines across multiple platforms (emails, calendars, classroom portals). Under extreme time constraints, the mental fatigue of simply deciding **what to do first** leads to reduced productivity and missed deadlines. There is a critical need for an intelligent aggregator that not only centralizes these tasks but dynamically prioritizes them based on urgency.

## 💡 Solution Overview
**Last-Minute Life Saver** is a smart, unified productivity dashboard designed to eliminate deadline anxiety. By seamlessly integrating with Google Workspace (Classroom, Calendar, Gmail), it aggregates all pending tasks into a single view. The platform features an intelligent AI sorting algorithm that dynamically prioritizes tasks based on impending deadlines and creation timestamps. Furthermore, it includes a built-in AI conversational agent capable of breaking down complex, overwhelming tasks into bite-sized, actionable steps using text-to-speech interaction.

## ✨ Key Features
- **Centralized Dashboard:** A single pane of glass for all upcoming deadlines and active projects.
- **AI Priority Suggestions:** Automatically sorts and filters tasks due within 48 hours, highlighting the absolute most urgent tasks so you know exactly where to start.
- **Google Workspace Sync:** One-click integration to fetch unread urgent emails from Gmail, assignments from Google Classroom, and events from Google Calendar.
- **Interactive AI Agent:** A text-based conversational assistant powered by Llama 3.1 that helps brainstorm, schedule, and decompose large projects. Includes Web Speech API for Text-to-Speech (TTS) and Speech-to-Text (STT) capabilities.
- **Persistent Cloud Storage:** Real-time saving of user profiles, manual calendar tasks, and project states using Firebase Firestore.
- **Dynamic Theming:** Premium glass-morphic UI with multiple themes (Dark, Light, Green, Brown, Blue) that adapt globally to user preference.

## 🛠️ Technologies Used
- **Frontend:** HTML5, CSS3 (Custom Properties & Glassmorphism), Vanilla JavaScript.
- **Build Tool:** Vite (for environment variable injection and bundling).
- **Backend/Database:** Firebase Firestore (NoSQL Cloud Database).
- **AI Integration:** Groq API (Llama-3.1-8b-instant).
- **Native Web APIs:** Web Speech API (Speech Synthesis & Recognition).

## 🚀 Google Technologies Utilized
- **Firebase Authentication:** Secure, frictionless user login via Google Sign-In.
- **Firebase Firestore:** Real-time data persistence for projects, tasks, and profiles.
- **Firebase Hosting:** Fast, secure deployment of the web application.
- **Google Workspace APIs:** 
  - **Gmail API:** Fetches recent, unread emails to highlight potential hidden deadlines.
  - **Google Classroom API:** Aggregates pending active coursework.
  - **Google Calendar API:** Syncs upcoming schedule events directly into the dashboard.

---

## 📖 How to Use

### 1. Installation & Setup
1. Clone the repository to your local machine.
2. Ensure you have [Node.js](https://nodejs.org/) installed.
3. Open a terminal in the project root directory and run:
   ```bash
   npm install
   ```

### 2. Environment Variables
Create a `.env` file in the root directory and add your API keys using the `VITE_` prefix:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GROQ_API_KEY=your_groq_api_key
```

### 3. Running Locally
Because the project uses secure `.env` variables, it requires a bundler to run. 
We have provided a custom build script that injects these variables into static files:
```bash
node build.js
```
This will generate a `/dist` folder. You can serve this folder using any static server (like VS Code Live Server or `npx serve dist`).

### 4. Navigating the App
- **Login:** Click "Sign In with Google" to authenticate.
- **Dashboard:** View your AI Priority Suggestions. Click "Sync Google Calendar", "Connect Gmail", or "Connect Classroom" to pull in external tasks.
- **Calendar:** Manually add tasks. Any task due within 2 days automatically moves to your priority list.
- **Projects:** Track larger assignments and categorize them by importance (Most Important, Important, Less Important).
- **AI Agent:** Use the chat box (or the microphone icon) to ask the AI to break down a specific task.
- **Profile:** Access the top-right menu to update your user data (Name, Age, Gender, DOB) or change the global theme.
