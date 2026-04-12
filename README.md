<div align="center">

<img src="./assets/images/header.png" width="100%" alt="Second Brain Header" />

# 🧠 Second Brain

**Empower your mind with AI-driven knowledge management.**

[![React Native](https://img.shields.io/badge/React_Native-0.84-blue?logo=react&logoColor=white)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-56-000020?logo=expo&logoColor=white)](https://expo.dev)
[![AI Powered](https://img.shields.io/badge/AI_Powered-Gemini-orange?logo=google-gemini&logoColor=white)](https://ai.google.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Features](#-features) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started) • [Architecture](#-architecture)

</div>

---

## ✨ Overview

**Second Brain** is a next-generation note-taking and knowledge management application designed to help you capture, connect, and resurface your thoughts effortlessly. Built with a focus on performance and intelligence, it transforms raw notes into a living web of knowledge.

## 🚀 Features

### 🤖 AI-Powered Intelligence
Integrate with **Google Gemini** to chat with your notes, summarize long content, and generate insights automatically. Your notes aren't just text; they're data for your personal intelligence.

### 🕸️ Knowledge Graph
Visualize connections between your ideas with a dynamic **D3-force graph**. Discover hidden relationships and navigate through your second brain spatially.

### ✍️ Rich Text Editor
A premium writing experience powered by **Tentap Editor**. Support for Markdown, task lists, and advanced formatting ensures your thoughts are captured beautifully.

### 🔋 High Performance
Powered by **OP-SQLite** with FTS5 for lightning-fast full-text search across thousands of notes, all stored securely on your device.

### ☁️ Sync & Backup
Never lose a thought. Seamlessly backup and sync your knowledge base using **Google Drive** integration.

### 📅 Daily Resurface
Keep your knowledge fresh. The daily resurface feature uses spaced-repetition logic to bring back old notes for review.

---

## 🛠 Tech Stack

- **Framework**: [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [OP-SQLite](https://github.com/op-engineering/op-sqlite) (High-performance SQLite)
- **AI**: [Google Generative AI (Gemini)](https://ai.google.dev/)
- **UI/Layout**: [React Navigation](https://reactnavigation.org/), [Reanimated](https://docs.swmansion.com/react-native-reanimated/)
- **Visuals**: [D3.js](https://d3js.org/) (Force-directed graphs), [Lucide Icons](https://lucide.dev/)

---

## 🚦 Getting Started

### Prerequisites
- Node.js (>= 22.11)
- Expo CLI
- Android / iOS development environment

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/SecondBrain.git
   cd SecondBrain
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Environment Variables**
   Create a `.env` file and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Run the application**
   ```bash
   # Android
   npm run android
   
   # iOS
   npm run ios
   ```

---

## 📂 Architecture

The project follows a modular structure for scalability:

```text
src/
├── components/   # Reusable UI components
├── db/           # SQLite schema and migrations
├── hooks/        # Custom React hooks
├── navigation/   # Navigation stack definitions
├── screens/      # Functional app screens
├── services/     # Business logic (AI, Sync, Search)
├── store/        # State management
├── theme/        # Theme & design tokens
└── utils/        # Helper functions
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

<div align="center">
  Built with ❤️ for digital gardeners.
</div>
