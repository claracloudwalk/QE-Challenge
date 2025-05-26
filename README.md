# QE-Challenge 🚀

> Next-Gen Banking Platform powered by LLM and Quality Engineering

## Overview

This project represents a cutting-edge banking dashboard that seamlessly integrates Large Language Models (LLM) with modern banking operations. Built with a strong focus on Quality Engineering principles, it demonstrates how AI can enhance financial services while maintaining robust testing and reliability standards.

## Key Features

### 🤖 AI-Powered Banking
- **LLM Integration**: Intelligent transaction processing and customer support
- **Smart Automation**: Automated responses and transaction categorization
- **Natural Language Processing**: Enhanced user interaction through conversational interfaces

### 💳 Banking Operations
- Secure user authentication and session management
- Real-time transaction dashboard with balance tracking
- Multi-payment method support (PIX, POS, Payment Links, Cards)
- PDF receipt generation with professional formatting

### 🎯 Quality Engineering Highlights
- Comprehensive test coverage for critical banking operations
- Automated testing pipeline integration
- Performance optimization and monitoring
- Security-first approach to financial transactions

### 🎨 Modern Tech Stack
- **Frontend**: React with Next.js for optimal performance
- **Styling**: TailwindCSS for responsive and modern UI
- **State Management**: Efficient local storage and real-time updates
- **API Integration**: RESTful services with error handling

## Getting Started

```bash
# Clone the repository
git clone https://github.com/yourusername/QE-Challenge.git

# Install dependencies
npm install

# Start development server
npm run dev
```

Access the application at [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
  app/
    dashboard/      # Main banking dashboard
    login/          # Authentication system
    transfer/       # Payment processing
    globals.css     # Global styles
  services/         # API and local storage services
  data/             # Mock user data
public/             # Static assets
```

## Quality Engineering Practices

- **Test Automation**: Comprehensive test suite for critical paths
- **Code Quality**: Strict linting and code style enforcement
- **Performance**: Optimized rendering and data handling
- **Security**: Secure authentication and data encryption
- **Monitoring**: Real-time error tracking and logging

## Development Guidelines

- Follow TypeScript best practices
- Maintain test coverage above 80%
- Document all API endpoints
- Use conventional commits
- Keep dependencies updated

## User Synchronization

To ensure local users are synchronized with the backend, use the script:

```bash
npm run sync-users
```

This command will download all users from the backend and update the `src/data/users.json` file.

## How to Use the System

### 3. Create a user

- Use a handle to create a user.

### 2. Login

- Go to the login screen.
- Use the following credentials to access a sample account:
  - **User ID:** `125300`
  - **Password:** `125300`
- Click "Enter".

### 3. Make a Transfer via Chat

- After logging in, you will be redirected to the dashboard.
- In the chat, send a transfer command. Examples:
  - In English: `transfer R$50 to 2955` or `pay 50 to clarawalk`
  - In Portuguese: `transfira R$50 para 2955` or `transfira 50 para clarawalk`
- The system will ask for the payment method. Choose one of the buttons (PIX, POS, Link, Card).
- Follow the on-screen instructions to complete the transfer.

> **Tip:** The chat understands commands in both English and Portuguese, and accepts as recipient the ID, handle, email, or CPF.

## License

MIT

---

> Developed for CloudWalk's Quality Engineering Challenge, showcasing modern banking solutions with AI integration.
