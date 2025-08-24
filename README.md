# VoidChat 🚀

 <!-- It's highly recommended to create a nice banner for your project -->

A modern, feature-rich, real-time chat application built with Next.js, Firebase, and WebRTC. VoidChat provides a seamless and interactive communication experience, featuring one-on-one text messaging, file sharing, voice messages, and peer-to-peer video/audio calls.

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)

---

## ✨ Features

VoidChat is packed with modern features designed for a fluid user experience:

*   **⚡ Real-Time Messaging:** Instant one-on-one text messaging powered by Firestore's real-time listeners.
*   **🔐 Authentication:** Secure user authentication using Firebase Authentication.
*   **🤙 Video & Audio Calls:** Peer-to-peer video and audio calls implemented with WebRTC, orchestrated via Firestore for signaling.
*   **📞 In-Call Controls:** Mute/unmute microphone and enable/disable camera during calls.
*   **🔔 Incoming Call Notifications:** Receive a toast notification for incoming calls with options to accept or decline.
*   **📎 Rich Media Sharing:**
    *   **Image Sharing:** Send and view images directly in the chat.
    *   **File Sharing:** Attach and send any file type.
    *   **🎙️ Voice Messages:** Record and send voice notes using the `mic-recorder-to-mp3` library.
*   **😎 Emoji Picker:** Add flair to your messages with a built-in emoji picker.
*   **📝 Typing Indicators & Read Receipts:** (Future enhancement)
*   **🎨 Sleek & Modern UI:** A beautiful, responsive interface built with Tailwind CSS and enhanced with smooth animations from Framer Motion.
*   **🔍 User Search:** Easily find and start conversations with other users.
*   **📱 Responsive Design:** Fully functional on both desktop and mobile devices.

## 🛠️ Tech Stack

### Frontend
*   **Framework:** [Next.js](https://nextjs.org/) (with App Router)
*   **Language:** JavaScript, JSX
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Animation:** [Framer Motion](https://www.framer.com/motion/)
*   **Icons:** [Lucide React](https://lucide.dev/)
*   **UI Components:** Toasts with [Sonner](https://sonner.emilkowal.ski/)

### Backend & Real-Time
*   **Backend-as-a-Service:** [Firebase](https://firebase.google.com/)
    *   **Authentication:** Firebase Authentication
    *   **Database:** Firestore (for user data, messages, and WebRTC signaling)
    *   **Storage:** Firebase Cloud Storage (for images, files, and voice messages)
*   **P2P Communication:** [WebRTC](https://webrtc.org/)

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18.x or later recommended)
*   `npm` or `yarn`
*   A Google account to create a Firebase project

### Installation & Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/iamqitmeer/nextjs_chat_app_voidchat.git
    cd nextjs_chat_app_voidchat
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Set up Firebase**
    *   Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
    *   Go to **Project Settings** > **General** tab.
    *   Under "Your apps", click the Web icon (`</>`) to add a new web app.
    *   Register the app and copy the `firebaseConfig` object. You will need these credentials.
    *   In the console, go to **Authentication** > **Sign-in method** and enable an authentication provider (e.g., Google, Email/Password).
    *   Go to **Firestore Database** and create a new database in **Test mode** (for easy setup).
    *   Go to **Storage** and create a default storage bucket.

4.  **Configure Environment Variables**
    *   Create a file named `.env.local` in the root of your project.
    *   Add your Firebase configuration details to this file:
    ```.env.local
    NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
    NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"
    ```

5.  **Run the Development Server**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

##  Firestore Data Structure

To help you understand the database schema, here's a brief overview:

*   **`users` collection:**
    *   Stores information for each registered user (e.g., `uid`, `displayName`, `email`, `photoURL`).
*   **`chats` collection:**
    *   Each document represents a unique chat room between two users. The document ID is a sorted, concatenated string of the two user UIDs (e.g., `uid1_uid2`).
    *   Contains a `members` array and a `call` object for WebRTC signaling.
    *   **`messages` sub-collection:**
        *   Each document is a message within that chat, containing `text`, `senderId`, `createdAt`, `type`, `mediaUrl`, etc.

## 🌐 Deployment

This application is ready to be deployed on [Vercel](https://vercel.com), the platform from the creators of Next.js.

1.  Push your code to a GitHub repository.
2.  Sign up on Vercel and import your repository.
3.  Add the same environment variables from your `.env.local` file to the Vercel project settings.
4.  Click **Deploy** and you're live!

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/iamqitmeer/nextjs_chat_app_voidchat/issues).

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by [Qitmeer](https://github.com/iamqitmeer)