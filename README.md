# Splatform (Species Label Automated Transcription) Web Edition

**Splatform** is a powerful client-side web application designed to automate the transcription of species specimen labels. It leverages modern Large Language Models (LLMs) to convert images of labels into structured Darwin Core (DWC) JSON data.

Check out the live demo: **[https://gbif-norway.github.io/splatform/](https://gbif-norway.github.io/splatform/)**

![Splatform Screenshot](https://via.placeholder.com/800x400?text=Splatform+Interface+Preview)

## ✨ Features

- **Multi-Model Support**: Integrate with top-tier LLM providers directly from your browser:
  - **OpenAI** (GPT-4o, GPT-4 Turbo)
  - **Google Gemini** (1.5 Pro, Flash)
  - **Anthropic** (Claude 3.5 Sonnet)
  - **xAI** (Grok Vision)
- **Two-Step Pipeline**:
  1.  **Transcription**: Converts raw label images into faithfulness markdown text.
  2.  **Standardization**: specific prompt to convert text into Darwin Core standard JSON.
- **Privacy First**: API keys and history are stored **locally** in your browser's LocalStorage. No data is sent to our servers.
- **CORS Proxy Support**: Includes a deployable proxy to bypass browser restrictions for Anthropic and xAI APIs.
- **Responsive Design**: Built with React, Vite, and TailwindCSS for a premium, mobile-friendly experience.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- API Keys for one or more supported providers.

### Local Development

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/gbif-norway/splatform.git
    cd splatform
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Start the development server**:
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` to view it in your browser.

## 🛠 Deployment to GitHub Pages

This repository relies on **GitHub Actions** for deployment to handle proper routing and build optimization.

1.  Push your changes to the `main` branch.
2.  The workflow `.github/workflows/deploy.yml` will automatically build and deploy the app.
3.  Ensure your repository settings under **Pages** are set to **Source: GitHub Actions**.

## 🌐 CORS Proxy Setup

Direct browser calls to APIs like **Anthropic (Claude)** and **xAI (Grok)** are often blocked by browser security policies (CORS). To use these providers, you must deploy a simple proxy.

### 1. Build & Deploy the Proxy
A ready-to-use Node.js proxy is included in the `/proxy` directory.

**Build for x86 (Standard Server/Cluster):**
```bash
podman build --platform linux/amd64 -t ghcr.io/gbif-norway/splat-proxy:latest ./proxy
podman push ghcr.io/gbif-norway/splat-proxy:latest
```

**Deploy to Kubernetes:**
Apply the included manifest in `/k8s/deployment.yaml` (edit the environment variables first!):
```bash
kubectl apply -f k8s/deployment.yaml
```

### 2. Configure the Web App
1.  Open **Settings** in the Splatform web app.
2.  Enter your **CORS Proxy URL** (e.g., `https://proxy.your-domain.org`).
3.  The app will transparently route requests effectively.

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a Pull Request.

## 📄 License

MIT License. See `LICENSE` for details.
