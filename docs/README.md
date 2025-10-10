# Atlas CMMS Technical Documentation

Comprehensive technical documentation for the Atlas CMMS project.

## Table of Contents

### 1. [Infrastructure & Deployment](01-infrastructure.md)
**Topics**: Docker Compose architecture, environment configuration, deployment instructions

- Docker services (PostgreSQL, API, Frontend, MinIO)
- Environment variables reference
- Local and remote deployment
- Security hardening
- Scaling considerations
- Troubleshooting

**Audience**: DevOps engineers, System administrators, Developers

---

### 2. [Licensing Model](02-licensing.md)
**Topics**: Dual-licensing (GPLv3 and Commercial), compliance, obtaining licenses

- Open source (GPLv3) license terms
- Commercial license tiers and features
- When you need a commercial license
- Licensed features (SSO, white-labeling, MUI X Pro)
- Intellectual property rights
- Compliance requirements
- FAQ and contact information

**Audience**: Business decision makers, Legal teams, Developers

---

### 3. [Backend API Architecture](03-backend-architecture.md)
**Topics**: Spring Boot backend, API endpoints, database architecture, security

- Technology stack (Java 8, Spring Boot 2.6.7, PostgreSQL)
- Package structure and organization
- Core API endpoints
- Database migration (Liquibase)
- Multi-tenancy architecture
- Authentication and authorization
- Storage backends (MinIO/GCP)
- Real-time features (WebSocket)
- Scheduled jobs (Quartz)
- Caching strategy (Caffeine)
- Monitoring and observability
- API documentation (Swagger)

**Audience**: Backend developers, API consumers, Architects

---

### 4. [Frontend Architecture](04-frontend-architecture.md)
**Topics**: React web application, state management, UI components, API integration

- Technology stack (React 17, TypeScript, Material-UI)
- Application structure
- State management (Redux Toolkit)
- Routing (React Router v6)
- UI architecture and theming
- Authentication flow
- API integration (Axios)
- Real-time features (WebSocket)
- Internationalization (10 languages)
- Forms and validation (Formik)
- File management
- Analytics and visualization
- Google services integration
- Build and deployment
- Code quality (ESLint, Prettier, Husky)
- Performance optimization
- PWA support

**Audience**: Frontend developers, UI/UX designers

---

### 5. [Mobile Application Architecture](05-mobile-architecture.md)
**Topics**: React Native mobile app, Expo configuration, device features

- Technology stack (React Native 0.71.3, Expo 48)
- Application structure
- Expo configuration
- Navigation architecture (React Navigation)
- Backend integration
- Authentication and authorization
- State management (Redux Persist)
- Device features (Camera, QR scanner, Push notifications, NFC)
- Offline support
- Real-time features (WebSocket)
- UI components and theming (React Native Paper)
- Forms and validation
- File upload
- Internationalization
- Build and deployment (EAS Build)
- Analytics (Firebase)
- Performance optimization

**Audience**: Mobile developers, React Native developers

---

### 6. [Database Schema & Migrations](06-database-schema.md)
**Topics**: PostgreSQL database design, entity relationships, Liquibase migrations

- Database technology (PostgreSQL 16)
- Migration management (Liquibase)
- Multi-tenancy architecture
- Core entity relationships
- Core tables reference (Company, Users, Work Orders, Assets, Locations, Parts, etc.)
- Auditing and history (Hibernate Envers)
- Indexes and performance
- Data integrity constraints
- Data seeding (super admin, subscription plans, default roles)
- Database maintenance (backups, vacuuming, monitoring)
- Schema evolution best practices
- Connection pooling

**Audience**: Database administrators, Backend developers, Data architects

---

### 7. [Storage Configuration](07-storage-configuration.md)
**Topics**: MinIO and Google Cloud Storage setup, file management

- Storage backend overview (MinIO vs GCP)
- **MinIO Storage**:
  - Docker architecture
  - Configuration and environment variables
  - Setup and usage (MinIO Console)
  - File upload/download flow
  - Security and access control
  - Backup and recovery
  - Monitoring
- **Google Cloud Storage**:
  - GCP setup and prerequisites
  - Configuration
  - File operations
  - Security and IAM
  - Backup and recovery
  - Monitoring and cost optimization
- Switching storage backends
- File management best practices
- Troubleshooting
- Performance optimization
- Compliance and data residency

**Audience**: DevOps engineers, Backend developers, System administrators

---

### 8. [Authentication & Security](08-authentication-security.md)
**Topics**: JWT authentication, OAuth2/SSO, authorization, security best practices

- **Authentication Methods**:
  - JWT authentication (default)
  - OAuth2/SSO (Google, Microsoft) - commercial license required
- **JWT Authentication**:
  - Configuration and secret key management
  - Registration and login flows
  - Token structure and validation
  - Token usage (web, mobile)
  - Password security (BCrypt)
- **OAuth2/SSO**:
  - Supported providers (Google, Microsoft)
  - Setup and configuration
  - OAuth2 flow and user mapping
- **Authorization**:
  - Role-based access control (RBAC)
  - Permission model (CREATE, VIEW, EDIT_OTHER, etc.)
  - Permission checking (backend, frontend, mobile)
  - Multi-tenancy security
- **Security Features**:
  - CORS configuration
  - CSRF protection
  - Rate limiting (Bucket4j)
  - Input validation
  - SQL injection prevention
  - XSS protection
  - API security headers
- **Secrets Management**: Environment variables, database credentials, JWT keys, OAuth2 credentials
- **Audit Logging**: Hibernate Envers, application logging
- **Security Best Practices**: Password management, token security, API security, multi-tenancy
- **Compliance**: GDPR, HIPAA, SOC 2
- **Security Monitoring**: Metrics, alerting, testing

**Audience**: Security engineers, Backend developers, DevOps engineers, Compliance officers

---

### 9. AI Assistant Integration (New Feature)
**Topics**: ChatKit-powered AI agent, natural language queries, draft actions, tool invocations

- **Overview**:
  - AI-powered maintenance assistant for natural language interaction
  - ChatKit agent integration with custom CMMS tools
  - Draft action workflow with user confirmation
  - Tool invocation logging and auditing
- **Backend Components**:
  - AgentController (`/api/agent/*`) for chat and draft management
  - AgentService for tool orchestration and AI runtime communication
  - AgentDraftService for pending action management
  - AgentToolRegistry for CMMS-specific tool registration
  - Database tables: `agent_tool_invocation_log`, `agent_draft_action`
- **Frontend Components**:
  - ChatDock component for chat interface
  - Redux store integration (`agentChat` slice)
  - Draft action confirmation UI
  - Tool invocation status display
- **Agent Proxy Service**:
  - Node.js proxy (`agents-proxy`) for AI runtime communication
  - OpenAI API integration
  - Request routing and response formatting
- **Configuration**:
  - `AGENT_CHATKIT_ENABLED`: Enable/disable AI assistant feature
  - `AGENT_RUNTIME_URL`: AI runtime service endpoint
  - `AGENT_RUNTIME_TOKEN`: Authentication token for AI runtime
  - `CHATKIT_AGENT_ID`: ChatKit agent identifier
  - `OPENAI_API_KEY`: OpenAI API key for agent proxy
- **Features**:
  - Natural language queries for work orders, assets, inventory
  - Draft action proposals (e.g., "close my highest priority work order")
  - User confirmation workflow for sensitive operations
  - Audit trail for all tool invocations
  - Session-based conversation tracking

**Audience**: Full-stack developers, AI/ML engineers, Product managers

---

## Quick Start

**For Developers**:
1. Read [Infrastructure & Deployment](01-infrastructure.md) for environment setup
2. Review [Backend Architecture](03-backend-architecture.md) or [Frontend Architecture](04-frontend-architecture.md) based on your role
3. Check [Authentication & Security](08-authentication-security.md) for security implementation

**For System Administrators**:
1. Start with [Infrastructure & Deployment](01-infrastructure.md)
2. Review [Storage Configuration](07-storage-configuration.md)
3. Understand [Database Schema](06-database-schema.md) for backup/maintenance
4. Study [Authentication & Security](08-authentication-security.md) for security hardening

**For Business Users**:
1. Read [Licensing Model](02-licensing.md) to understand licensing requirements
2. Review commercial features in other documentation sections

## Project Structure

```
atlas-cmms/
├── api/                  # Backend (Spring Boot)
├── frontend/             # Web frontend (React)
├── mobile/               # Mobile app (React Native)
├── agents-proxy/         # AI agent proxy service (Node.js)
├── docs/                 # This documentation
├── docker-compose.yml    # Docker orchestration
├── .env.example          # Environment template
├── LICENSE               # GPLv3 license
└── COMMERCIAL_LICENSE.MD # Commercial license
```

## External Resources

- **User Documentation**: https://docs.atlas-cmms.com
- **Super Admin Docs**: [../dev-docs/](../dev-docs/)
- **Live Demo**: https://atlas-cmms.com
- **Mobile App**: https://play.google.com/store/apps/details?id=com.atlas.cmms
- **Discord Community**: https://discord.gg/cHqyVRYpkA
- **GitHub Repository**: https://github.com/grashjs/cmms
- **Support Email**: contact@atlas-cmms.com

## Contributing

See `CONTRIBUTING.md` in each subproject:
- [Backend Contributing](../api/CONTRIBUTING.md)
- [Frontend Contributing](../frontend/CONTRIBUTING.md)
- [Mobile Contributing](../mobile/CONTRIBUTING.md)

## License

This project is dual-licensed:
- **GPLv3**: See [LICENSE](../LICENSE)
- **Commercial**: See [COMMERCIAL_LICENSE.MD](../COMMERCIAL_LICENSE.MD)

For commercial licensing inquiries: contact@atlas-cmms.com

## Documentation Maintenance

**Last Updated**: October 2025

**Version**: Based on project snapshot as of October 2025

**Maintainers**: Atlas CMMS Development Team

**Updates**: Documentation is updated with each major release. For the latest changes, refer to:
- Backend: [api/CHANGELOG.md](../api/CHANGELOG.md)
- Frontend: [frontend/CHANGELOG.md](../frontend/CHANGELOG.md)
- Mobile: [mobile/CHANGELOG.md](../mobile/CHANGELOG.md)

## Feedback

Found an issue with the documentation or have suggestions for improvement?

- **GitHub Issues**: https://github.com/grashjs/cmms/issues
- **Email**: contact@atlas-cmms.com
- **Discord**: https://discord.gg/cHqyVRYpkA

---

**Thank you for using Atlas CMMS!**
