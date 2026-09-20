# PMS JCAR Labs Inc 🏨

**Property Management System** — A comprehensive hotel and lodging management platform built for modern hospitality businesses.

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=flat-square)](https://pms-jcar-labs-inc.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-black?style=flat-square)](https://github.com/jhoncharlesjcar/pms-jcar-labs-inc)

---

## 🎯 Overview

PMS JCAR Labs Inc is a **full-stack property management solution** designed to help hotels, resorts, and vacation rentals manage operations efficiently. From reservations to guest management, billing, and reporting — everything you need in one platform.

### Key Metrics
- 📊 Manages **50+ properties**
- 👥 Supports **1000+ monthly bookings**
- 🌍 Multi-property management
- 📱 Responsive & mobile-friendly

---

## ✨ Features

### 🛏️ Reservation Management
- Real-time booking system
- Multiple room types & pricing tiers
- Calendar-based availability
- Guest preferences tracking

### 👤 Guest Management
- Complete guest profiles
- Contact information & history
- Special requests & notes
- Multi-language support

### 💳 Billing & Payments
- Automated invoicing
- Multiple payment methods
- Tax calculations
- Financial reporting

### 📊 Analytics & Reports
- Occupancy rates
- Revenue tracking
- Guest statistics
- Performance dashboards

### 🔐 Security & Access Control
- Role-based permissions
- Secure authentication
- Data encryption
- Audit logs

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Vite |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) |
| **Database** | PostgreSQL with RLS |
| **Deployment** | Vercel, AWS |
| **Authentication** | JWT, OAuth2, Supabase Auth |
| **AI** | Qwen (DashScope), Google Gemini 2.0 |
| **Payments** | Stripe, PayPal integration |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- pnpm 9
- Supabase account
- PostgreSQL database

### Installation

```bash
# Clone repository
git clone https://github.com/jhoncharlesjcar/pms-jcar-labs-inc.git
cd pms-jcar-labs-inc

# Install dependencies
pnpm install --frozen-lockfile

# Configure environment variables
cp .env.example .env.local

# Run development server
pnpm dev
```

Visit `http://localhost:5173` to access the application.

### Environment Configuration

```env
# Supabase
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_TURNSTILE_SITE_KEY=<turnstile-site-key>

# AI Gateway (Edge Functions)
DASHSCOPE_API_KEY=your_key
GEMINI_API_KEY=your_key
```

---

## 📁 Project Structure

```
pms-jcar-labs-inc/
├── src/
│   ├── api/              # Data access & multi-tenant scope
│   ├── components/       # Shared & business components
│   ├── constants/        # Permissions & operational states
│   ├── contexts/         # Auth & active property context
│   ├── hooks/            # Queries & UI orchestration
│   ├── pages/            # App modules & routes
│   ├── services/         # Reusable business logic
│   └── store/            # Session & active hotel state
├── supabase/
│   ├── functions/        # Privileged operations & integrations
│   └── migrations/       # Schema, RLS policies & data evolution
├── docs/                 # Operations, design & deployment
├── specs/                # Domain contracts
└── public/               # Static assets
```

---

## 📚 API Documentation

### Rooms
```bash
GET    /api/rooms          # List all rooms
POST   /api/rooms          # Create new room
GET    /api/rooms/:id      # Get room details
PUT    /api/rooms/:id      # Update room
DELETE /api/rooms/:id      # Delete room
```

### Bookings
```bash
GET    /api/bookings       # List bookings
POST   /api/bookings       # Create booking
GET    /api/bookings/:id   # Get booking details
PUT    /api/bookings/:id   # Update booking
DELETE /api/bookings/:id   # Cancel booking
```

### Billing & Payments
```bash
GET    /api/invoices       # List invoices
POST   /api/invoices       # Create invoice
GET    /api/invoices/:id   # Get invoice details
POST   /api/payments       # Process payment
```

### AI Assistant
```bash
POST   /api/ai/chat        # Send message to AI assistant
POST   /api/ai/tools       # Execute AI tool calling
```

---

## 🧪 Testing & Quality

```bash
# Lint
pnpm lint

# Type check
pnpm typecheck

# Unit tests
pnpm test:coverage

# E2E tests
pnpm test:e2e

# Check Edge Functions
pnpm check:edge

# Check migrations
pnpm check:migrations

# Check secrets
pnpm check:secrets

# Full build
pnpm build
```

---

## 🚀 Deployment

### Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel deploy
```

### Deploy to AWS

```bash
# Build for production
pnpm build

# Deploy using AWS CLI
aws lambda deploy-function ...
```

### Production Quality Gate

The workflow `Production Quality Gate` in `.github/workflows/deploy.yml` runs:
- Reproducible installation
- Linting & type checking
- Secret scanning
- Migration validation
- Unit tests (122+ tests)
- Edge Function validation
- Production build verification

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📖 Documentation

- [Complete Documentation Index](docs/README.md)
- [Changelog](docs/CHANGELOG.md)
- [Architecture](specs/architecture.md)
- [Business Flow](docs/FLUJO_NEGOCIO.md)
- [Design System](docs/DESIGN_SYSTEM.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Operations Runbook](docs/OPERATIONS_RUNBOOK.md)

---

## 🔐 Security

- Never commit `.env` files or credentials
- Don't use `service_role` in browser
- Don't edit applied migrations
- All queries must preserve `hotel_id` context
- Public routes must never depend on direct anonymous queries to sensitive tables
- User cache is purged on identity change

---

## 📝 License

MIT License — See [LICENSE](LICENSE) for details

---

## 🆘 Support

For issues, questions, or feature requests:
- 📧 [Open an Issue](https://github.com/jhoncharlesjcar/pms-jcar-labs-inc/issues)
- 💬 [Start a Discussion](https://github.com/jhoncharlesjcar/pms-jcar-labs-inc/discussions)
- 🐦 [@jhoncharlesjcar](https://github.com/jhoncharlesjcar)

---

## 👤 Author

**Jhon Charles Almanacén Romero** — Full-Stack Developer

- 🌐 [GitHub](https://github.com/jhoncharlesjcar)
- 💼 [LinkedIn](#)
- 📧 [Email](#)

---

<div align="center">

Made with ❤️ by [JCAR Labs](https://jcarlabs.com)

⭐ If you find this project useful, please consider starring it!

</div>
