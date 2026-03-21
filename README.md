# NeuroCyn - Secure Consultation Platform

NeuroCynx is a modern, secure, and user-friendly platform designed to facilitate private consultations. Built with performance and privacy in mind, it provides a seamless experience for users seeking professional advice.

![NeuroCynx Hero Image](screenshot.png)

## 🚀 Features

-   **Secure & Private:** Built with top-tier security standards to ensure user data and conversations remain confidential.
-   **Modern UI/UX:** A clean, responsive interface designed with the latest web aesthetics (Glassmorphism, Inter font).
-   **Dark/Light Mode:** Full support for both dark and light themes for visual comfort.
-   **Responsive Design:** Fully optimized for desktops, tablets, and mobile devices.
-   **Smooth Animations:** Engaging scroll animations for a polished user experience.

## 🛠 Tech Stack

-   **Frontend:** React 18 (via CDN for lightweight deployment), HTML5, CSS3.
-   **Backend:** Node.js + Express (Gemini proxy API).
-   **Styling:** Custom CSS with CSS Variables, Flexbox/Grid.
-   **Icons:** Ionicons.
-   **Markdown Rendering:** Marked.js.

## 📂 Project Structure

```
NeuroCynx/
├── index.html      # Main application file (contains React components)
├── styles.css      # Core styles and variables
├── server.js       # Backend server and Gemini proxy endpoint
├── .env.example    # Environment variable template
├── package.json    # Node dependencies and scripts
└── README.md       # Project documentation
```

## ⚡ Getting Started

The frontend uses React via CDN and the backend runs a lightweight Express server to keep API keys secure.

### Prerequisites
-   A modern web browser (Chrome, Firefox, Edge, Safari).
-   Node.js 18+.

### Running the Project

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/NeuroCynx.git
    cd NeuroCynx
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure environment variables:**
    ```bash
    cp .env.example .env
    ```
    Then set `GEMINI_API_KEY` in `.env`.

4.  **Start the app:**
    ```bash
    npm start
    ```
    Open `http://localhost:3000`.

## 🔐 Security Notes

-   Gemini API calls now go through `POST /api/gemini/generate` on the backend.
-   Keep `GEMINI_API_KEY` only on the server (environment variable), never in frontend code.
-   Ensure `.env` is not committed to git.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
