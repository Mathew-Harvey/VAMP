# MarineStream Platform — Complete Build Specification

> **Purpose**: This document is a comprehensive specification for rebuilding the MarineStream vessel management platform as a self-hosted application. It replaces the current Rise-X SaaS backend with a custom-built system. The target audience is an AI coding agent (Claude in Cursor) that should be able to build this software from this spec alone.

> **Deployment**: Render.com (Web Service + PostgreSQL)
> **Philosophy**: Simple tech, comprehensive tests, ship fast.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Authentication & Permissions](#5-authentication--permissions)
6. [Core Domain Models](#6-core-domain-models)
7. [API Design](#7-api-design)
8. [Feature Specifications](#8-feature-specifications)
9. [File & Media Management](#9-file--media-management)
10. [Audit Trail / Immutable Ledger](#10-audit-trail--immutable-ledger)
11. [Workflow Engine](#11-workflow-engine)
12. [Notifications](#12-notifications)
13. [Reporting & PDF Generation](#13-reporting--pdf-generation)
14. [Frontend Application](#14-frontend-application)
15. [Testing Strategy](#15-testing-strategy)
16. [Deployment & Infrastructure](#16-deployment--infrastructure)
17. [Environment Variables](#17-environment-variables)
18. [Migration & Seed Data](#18-migration--seed-data)
19. [Future Considerations](#19-future-considerations)

---

## 1. Project Overview

### What MarineStream Does

MarineStream is a **multi-party vessel maintenance and compliance platform** used by Franmarine Underwater Services to manage biofouling inspections, hull cleaning, engineering maintenance, and compliance reporting across defence and commercial maritime fleets.

### Core Value Proposition

- **Digital work capture**: Field teams record inspections on tablets/mobile with photos, video, GPS, and notes — replacing paper forms
- **Multi-party workflows**: Multiple stakeholders (vessel operators, contractors, port authorities, regulators) collaborate on shared processes with parallel approvals
- **Automated compliance reporting**: Auto-generate Biofouling Management Plans (BFMPs), inspection reports, maintenance logs, and audit trails
- **Immutable audit trail**: Every action is logged with timestamps, user identity, and cryptographic hashing for tamper-proof compliance records
- **Asset management**: Complete digital twin of each vessel — holds inspection history, coating data, maintenance schedules, compliance status

### What We're Replacing

Currently MarineStream runs on the **Rise-X Ecosystem Orchestration Platform** — a third-party SaaS that provides multi-party workflow orchestration with blockchain-based audit trails. We are rebuilding this as a self-owned application to reduce vendor dependency and licensing costs while retaining all functional capabilities.

### Key Metrics the Platform Must Support

- 85+ vessels managed simultaneously
- 193+ work orders per contract cycle
- 5-level permission hierarchy
- 100% compliance rate tracking
- 10TB+ media storage (photos, video, documents)
- Sub-second page loads for field workers on mobile

---

## 2. Tech Stack

### Backend
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Runtime | **Node.js 20 LTS** | Simple, well-supported, large ecosystem |
| Framework | **Express.js** | Minimal, battle-tested, easy to reason about |
| Language | **TypeScript** | Type safety catches bugs before runtime |
| Database | **PostgreSQL 16** (Render managed) | Relational integrity for compliance data, JSONB for flexible fields |
| ORM | **Prisma** | Type-safe queries, excellent migrations, good DX |
| Validation | **Zod** | Runtime validation matching TypeScript types |
| Auth | **Passport.js + JWT** | Session-based with JWT for API/mobile |
| File Storage | **AWS S3** (or S3-compatible like Cloudflare R2) | Cost-effective media storage at scale |
| PDF Generation | **Puppeteer** | HTML-to-PDF for compliance reports |
| Email | **Nodemailer + SendGrid** | Transactional notifications |
| Job Queue | **BullMQ + Redis** | Background jobs (PDF gen, notifications, audit hashing) |
| Testing | **Vitest** | Fast, TypeScript-native, Jest-compatible API |
| API Docs | **Swagger/OpenAPI via tsoa** | Auto-generated from controllers |

### Frontend
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | **React 18** | Industry standard, large talent pool |
| Build | **Vite** | Fast builds, good DX |
| Routing | **React Router v6** | Standard SPA routing |
| State | **TanStack Query (React Query)** | Server state management, caching, optimistic updates |
| Forms | **React Hook Form + Zod** | Performant forms with shared validation schemas |
| UI Components | **shadcn/ui + Tailwind CSS** | Accessible components, utility-first CSS |
| Tables | **TanStack Table** | Powerful data tables for work orders, assets |
| Maps | **Leaflet** | For GPS position display on inspections |
| Charts | **Recharts** | Dashboard visualizations |
| Mobile | **Progressive Web App (PWA)** | Installable on tablets, works with camera API |

### Infrastructure
| Component | Technology |
|-----------|-----------|
| Hosting | **Render.com** (Web Service) |
| Database | **Render PostgreSQL** |
| Redis | **Render Redis** (for BullMQ) |
| File Storage | **AWS S3 / Cloudflare R2** |
| CDN | **Cloudflare** (optional) |
| DNS | **Cloudflare** |
| CI/CD | **GitHub Actions** → Render auto-deploy |

---

## 3. Project Structure

```
marinestream/
├── package.json                    # Root workspace
├── turbo.json                      # Turborepo config (optional, or just npm workspaces)
├── render.yaml                     # Render blueprint
├── .env.example
├── packages/
│   └── shared/                     # Shared types & validation
│       ├── src/
│       │   ├── types/              # Shared TypeScript interfaces
│       │   │   ├── vessel.ts
│       │   │   ├── work-order.ts
│       │   │   ├── user.ts
│       │   │   ├── inspection.ts
│       │   │   └── index.ts
│       │   ├── validation/         # Zod schemas (shared between FE & BE)
│       │   │   ├── vessel.schema.ts
│       │   │   ├── work-order.schema.ts
│       │   │   ├── user.schema.ts
│       │   │   └── index.ts
│       │   ├── constants/          # Enums, fouling ratings, IALA codes, etc.
│       │   │   ├── fouling-ratings.ts
│       │   │   ├── vessel-types.ts
│       │   │   ├── work-order-status.ts
│       │   │   └── permissions.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── apps/
│   ├── api/                        # Express backend
│   │   ├── src/
│   │   │   ├── index.ts            # App entry point
│   │   │   ├── app.ts              # Express app setup
│   │   │   ├── config/
│   │   │   │   ├── database.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── storage.ts
│   │   │   │   └── env.ts          # Environment variable validation with Zod
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts         # JWT verification
│   │   │   │   ├── permissions.ts  # Role/permission checking
│   │   │   │   ├── audit.ts        # Auto-audit-log middleware
│   │   │   │   ├── upload.ts       # Multer config for file uploads
│   │   │   │   ├── validate.ts     # Zod request validation
│   │   │   │   └── error.ts        # Global error handler
│   │   │   ├── routes/
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── vessel.routes.ts
│   │   │   │   ├── work-order.routes.ts
│   │   │   │   ├── inspection.routes.ts
│   │   │   │   ├── asset.routes.ts
│   │   │   │   ├── workflow.routes.ts
│   │   │   │   ├── report.routes.ts
│   │   │   │   ├── media.routes.ts
│   │   │   │   ├── user.routes.ts
│   │   │   │   ├── organisation.routes.ts
│   │   │   │   ├── dashboard.routes.ts
│   │   │   │   └── audit.routes.ts
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── vessel.service.ts
│   │   │   │   ├── work-order.service.ts
│   │   │   │   ├── inspection.service.ts
│   │   │   │   ├── workflow.service.ts
│   │   │   │   ├── report.service.ts
│   │   │   │   ├── media.service.ts
│   │   │   │   ├── audit.service.ts
│   │   │   │   ├── notification.service.ts
│   │   │   │   ├── pdf.service.ts
│   │   │   │   └── dashboard.service.ts
│   │   │   ├── jobs/               # BullMQ job processors
│   │   │   │   ├── pdf-generation.job.ts
│   │   │   │   ├── notification.job.ts
│   │   │   │   └── audit-hash.job.ts
│   │   │   └── utils/
│   │   │       ├── hash.ts         # SHA-256 chaining for audit trail
│   │   │       ├── pagination.ts
│   │   │       └── helpers.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── templates/              # HTML templates for PDF reports
│   │   │   ├── bfmp.html
│   │   │   ├── inspection-report.html
│   │   │   ├── work-order-report.html
│   │   │   └── compliance-summary.html
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── services/
│   │   │   │   │   ├── auth.service.test.ts
│   │   │   │   │   ├── vessel.service.test.ts
│   │   │   │   │   ├── work-order.service.test.ts
│   │   │   │   │   ├── workflow.service.test.ts
│   │   │   │   │   ├── audit.service.test.ts
│   │   │   │   │   └── report.service.test.ts
│   │   │   │   ├── middleware/
│   │   │   │   │   ├── auth.test.ts
│   │   │   │   │   └── permissions.test.ts
│   │   │   │   └── utils/
│   │   │   │       └── hash.test.ts
│   │   │   ├── integration/
│   │   │   │   ├── auth.test.ts
│   │   │   │   ├── vessel.test.ts
│   │   │   │   ├── work-order.test.ts
│   │   │   │   └── workflow.test.ts
│   │   │   └── helpers/
│   │   │       ├── setup.ts        # Test database setup/teardown
│   │   │       ├── factories.ts    # Test data factories
│   │   │       └── auth.ts         # Test auth helpers
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── web/                        # React frontend
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── api/                # API client layer
│       │   │   ├── client.ts       # Axios instance with auth interceptors
│       │   │   ├── vessels.ts
│       │   │   ├── work-orders.ts
│       │   │   ├── inspections.ts
│       │   │   └── auth.ts
│       │   ├── components/
│       │   │   ├── ui/             # shadcn components
│       │   │   ├── layout/
│       │   │   │   ├── Sidebar.tsx
│       │   │   │   ├── Header.tsx
│       │   │   │   └── MainLayout.tsx
│       │   │   ├── vessels/
│       │   │   │   ├── VesselCard.tsx
│       │   │   │   ├── VesselList.tsx
│       │   │   │   ├── VesselDetail.tsx
│       │   │   │   └── VesselForm.tsx
│       │   │   ├── work-orders/
│       │   │   │   ├── WorkOrderBoard.tsx   # Kanban-style view
│       │   │   │   ├── WorkOrderCard.tsx
│       │   │   │   ├── WorkOrderDetail.tsx
│       │   │   │   ├── WorkOrderForm.tsx
│       │   │   │   └── WorkOrderTimeline.tsx
│       │   │   ├── inspections/
│       │   │   │   ├── InspectionForm.tsx   # Field data capture form
│       │   │   │   ├── InspectionGallery.tsx
│       │   │   │   ├── FoulingRatingSelector.tsx
│       │   │   │   └── InspectionReport.tsx
│       │   │   ├── workflows/
│       │   │   │   ├── WorkflowStepper.tsx
│       │   │   │   └── TaskPanel.tsx
│       │   │   ├── media/
│       │   │   │   ├── MediaUploader.tsx
│       │   │   │   ├── PhotoCapture.tsx     # Camera API integration
│       │   │   │   └── MediaGallery.tsx
│       │   │   ├── reports/
│       │   │   │   └── ReportGenerator.tsx
│       │   │   ├── dashboard/
│       │   │   │   ├── ComplianceOverview.tsx
│       │   │   │   ├── FleetStatus.tsx
│       │   │   │   └── RecentActivity.tsx
│       │   │   └── audit/
│       │   │       └── AuditLog.tsx
│       │   ├── hooks/
│       │   │   ├── useAuth.ts
│       │   │   ├── useVessels.ts
│       │   │   ├── useWorkOrders.ts
│       │   │   └── useMediaUpload.ts
│       │   ├── pages/
│       │   │   ├── LoginPage.tsx
│       │   │   ├── DashboardPage.tsx
│       │   │   ├── VesselsPage.tsx
│       │   │   ├── VesselDetailPage.tsx
│       │   │   ├── WorkOrdersPage.tsx
│       │   │   ├── WorkOrderDetailPage.tsx
│       │   │   ├── InspectionPage.tsx       # Field capture page (mobile-optimised)
│       │   │   ├── ReportsPage.tsx
│       │   │   ├── AuditLogPage.tsx
│       │   │   ├── UsersPage.tsx
│       │   │   └── SettingsPage.tsx
│       │   ├── stores/
│       │   │   └── auth.store.ts
│       │   └── utils/
│       │       └── formatters.ts
│       ├── public/
│       │   ├── manifest.json       # PWA manifest
│       │   └── sw.js               # Service worker (basic caching)
│       ├── index.html
│       ├── package.json
│       ├── tailwind.config.ts
│       ├── vite.config.ts
│       └── tsconfig.json
```

---

## 4. Database Schema

### Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// ORGANISATIONS & USERS
// ============================================================

model Organisation {
  id          String   @id @default(cuid())
  name        String
  type        OrganisationType
  abn         String?              // Australian Business Number
  contactEmail String?
  contactPhone String?
  address     String?
  logoUrl     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users       OrganisationUser[]
  vessels     Vessel[]
  workOrders  WorkOrder[]          // Work orders created by this org
  invitations Invitation[]

  @@map("organisations")
}

enum OrganisationType {
  SERVICE_PROVIDER     // Franmarine
  VESSEL_OPERATOR      // e.g., Svitzer, RAN
  PORT_AUTHORITY       // e.g., South Ports Authority
  REGULATOR            // e.g., DAFF, DPIRD
  SUBCONTRACTOR        // Diving contractors, etc.
  CONSULTANT           // Marine engineers, coating manufacturers
}

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  firstName     String
  lastName      String
  phone         String?
  avatarUrl     String?
  isActive      Boolean  @default(true)
  lastLoginAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  organisations OrganisationUser[]
  workOrderAssignments WorkOrderAssignment[]
  taskSubmissions TaskSubmission[]
  mediaUploads  Media[]
  auditEntries  AuditEntry[]     @relation("AuditActor")
  notifications Notification[]

  @@map("users")
}

model OrganisationUser {
  id             String   @id @default(cuid())
  userId         String
  organisationId String
  role           UserRole
  permissions    Permission[]    // Array of permission flags
  isDefault      Boolean  @default(false)  // Default org for user
  joinedAt       DateTime @default(now())

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organisation Organisation @relation(fields: [organisationId], references: [id], onDelete: Cascade)

  @@unique([userId, organisationId])
  @@map("organisation_users")
}

enum UserRole {
  ECOSYSTEM_ADMIN       // Franmarine admin — full access
  ORGANISATION_ADMIN    // Admin within their org
  MANAGER               // Can create/assign work orders
  OPERATOR              // Field workers — capture data
  VIEWER                // Read-only stakeholder access
}

enum Permission {
  // Vessel permissions
  VESSEL_CREATE
  VESSEL_EDIT
  VESSEL_VIEW
  VESSEL_DELETE
  // Work order permissions
  WORK_ORDER_CREATE
  WORK_ORDER_EDIT
  WORK_ORDER_ASSIGN
  WORK_ORDER_APPROVE
  WORK_ORDER_VIEW
  WORK_ORDER_DELETE
  // Inspection permissions
  INSPECTION_CREATE
  INSPECTION_EDIT
  INSPECTION_APPROVE
  INSPECTION_VIEW
  // Report permissions
  REPORT_GENERATE
  REPORT_VIEW
  // User management
  USER_MANAGE
  USER_INVITE
  // Audit
  AUDIT_VIEW
  // Admin
  ADMIN_FULL_ACCESS
}

model Invitation {
  id             String   @id @default(cuid())
  email          String
  organisationId String
  role           UserRole
  token          String   @unique
  expiresAt      DateTime
  acceptedAt     DateTime?
  createdAt      DateTime @default(now())

  organisation Organisation @relation(fields: [organisationId], references: [id])

  @@map("invitations")
}

// ============================================================
// VESSELS (ASSETS)
// ============================================================

model Vessel {
  id                String   @id @default(cuid())
  organisationId    String
  name              String
  imoNumber         String?  @unique
  mmsi              String?
  callSign          String?
  flagState         String?
  vesselType        VesselType
  grossTonnage      Float?
  lengthOverall     Float?   // metres
  beam              Float?   // metres
  maxDraft          Float?   // metres
  minDraft          Float?   // metres
  yearBuilt         Int?
  homePort          String?
  classificationSociety String?

  // Anti-fouling system details
  afsCoatingType    String?
  afsManufacturer   String?
  afsProductName    String?
  afsApplicationDate DateTime?
  afsServiceLife    Int?     // months
  lastDrydockDate   DateTime?
  nextDrydockDate   DateTime?

  // Operating profile
  typicalSpeed      Float?   // knots
  tradingRoutes     String?
  operatingArea     String?
  climateZones      String[] // Array of climate zones

  // Status
  status            VesselStatus @default(ACTIVE)
  complianceStatus  ComplianceStatus @default(COMPLIANT)

  // BFMP
  bfmpDocumentUrl   String?
  bfmpRevision      String?
  bfmpRevisionDate  DateTime?

  // Metadata
  metadata          Json?    // Flexible additional fields
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  organisation    Organisation    @relation(fields: [organisationId], references: [id])
  workOrders      WorkOrder[]
  inspections     Inspection[]
  nicheAreas      NicheArea[]
  media           Media[]
  documents       Document[]

  @@map("vessels")
}

enum VesselType {
  CARGO_SHIP
  TANKER
  BULK_CARRIER
  CONTAINER_SHIP
  PASSENGER_VESSEL
  FISHING_VESSEL
  TUG
  OFFSHORE_VESSEL
  NAVAL_FRIGATE
  NAVAL_DESTROYER
  NAVAL_SUBMARINE
  NAVAL_PATROL
  NAVAL_LANDING_SHIP
  NAVAL_AUXILIARY
  RESEARCH_VESSEL
  NAVIGATION_AID      // Buoys, beacons, etc. (for SPA work)
  OTHER
}

enum VesselStatus {
  ACTIVE
  INACTIVE
  IN_DRYDOCK
  DECOMMISSIONED
}

enum ComplianceStatus {
  COMPLIANT
  NON_COMPLIANT
  DUE_FOR_INSPECTION
  UNDER_REVIEW
}

model NicheArea {
  id          String   @id @default(cuid())
  vesselId    String
  name        String   // e.g., "Sea Chest 1", "Bow Thruster", "Rudder"
  location    String?  // Description of location on vessel
  afsType     String?  // Coating type on this area
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  vessel      Vessel   @relation(fields: [vesselId], references: [id], onDelete: Cascade)
  inspectionFindings InspectionFinding[]

  @@map("niche_areas")
}

// ============================================================
// WORK ORDERS
// ============================================================

model WorkOrder {
  id              String   @id @default(cuid())
  referenceNumber String   @unique  // Auto-generated: WO-YYYYMMDD-XXXX
  vesselId        String
  organisationId  String   // Creating organisation
  workflowId      String?  // Which workflow template to follow

  title           String
  description     String?
  type            WorkOrderType
  priority        WorkOrderPriority @default(NORMAL)
  status          WorkOrderStatus   @default(DRAFT)

  // Location & scheduling
  location        String?  // Port, berth, etc.
  latitude        Float?
  longitude       Float?
  scheduledStart  DateTime?
  scheduledEnd    DateTime?
  actualStart     DateTime?
  actualEnd       DateTime?

  // Current workflow position
  currentStepId   String?
  currentTaskId   String?

  // Compliance references
  regulatoryRef   String?  // IMO reference, biosecurity act, etc.
  complianceFramework String[] // ["IMO_MEPC_378", "AU_BIOSECURITY", "IALA"]

  metadata        Json?    // Flexible additional data
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  completedAt     DateTime?

  vessel          Vessel       @relation(fields: [vesselId], references: [id])
  organisation    Organisation @relation(fields: [organisationId], references: [id])
  workflow        Workflow?    @relation(fields: [workflowId], references: [id])
  assignments     WorkOrderAssignment[]
  inspections     Inspection[]
  taskSubmissions TaskSubmission[]
  media           Media[]
  comments        Comment[]
  documents       Document[]

  @@index([status])
  @@index([vesselId])
  @@index([organisationId])
  @@map("work_orders")
}

enum WorkOrderType {
  BIOFOULING_INSPECTION
  HULL_CLEANING
  NICHE_AREA_CLEANING
  ENGINEERING_MAINTENANCE
  STRUCTURAL_ASSESSMENT
  CATHODIC_PROTECTION
  COATING_ASSESSMENT
  NAVIGATION_AID_INSPECTION    // For SPA
  NAVIGATION_AID_MAINTENANCE   // For SPA
  MOORING_INSPECTION
  FUNCTIONAL_TESTING
  EMERGENCY_REPAIR
  GENERAL
}

enum WorkOrderPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}

enum WorkOrderStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  IN_PROGRESS
  AWAITING_REVIEW
  UNDER_REVIEW
  COMPLETED
  CANCELLED
  ON_HOLD
}

model WorkOrderAssignment {
  id           String   @id @default(cuid())
  workOrderId  String
  userId       String
  role         AssignmentRole
  assignedAt   DateTime @default(now())

  workOrder    WorkOrder @relation(fields: [workOrderId], references: [id], onDelete: Cascade)
  user         User      @relation(fields: [userId], references: [id])

  @@unique([workOrderId, userId])
  @@map("work_order_assignments")
}

enum AssignmentRole {
  LEAD               // Primary responsible person
  TEAM_MEMBER        // Field team
  REVIEWER           // Approval authority
  OBSERVER           // Read-only stakeholder
}

// ============================================================
// INSPECTIONS
// ============================================================

model Inspection {
  id            String   @id @default(cuid())
  workOrderId   String
  vesselId      String
  type          InspectionType
  status        InspectionStatus @default(IN_PROGRESS)

  // Inspector details
  inspectorName String
  inspectorOrg  String?
  inspectorCert String?  // Certification number

  // Environmental conditions
  waterTemp     Float?   // °C
  waterVisibility Float? // metres
  waterSalinity Float?   // PSU
  weatherConditions String?
  seaState      String?
  tideState     String?

  // Location
  location      String?
  latitude      Float?
  longitude     Float?

  // Overall findings
  overallRating Int?     // 0-5 fouling rating (IMO scale)
  summary       String?
  recommendations String?

  // Timestamps
  startedAt     DateTime @default(now())
  completedAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  workOrder     WorkOrder @relation(fields: [workOrderId], references: [id])
  vessel        Vessel    @relation(fields: [vesselId], references: [id])
  findings      InspectionFinding[]
  media         Media[]

  @@index([vesselId])
  @@map("inspections")
}

enum InspectionType {
  CLOSE_VISUAL            // CVI — land or above water
  UNDERWATER_VISUAL       // Diver or ROV
  HULL_SURVEY
  NICHE_AREA
  DRY_FILM_THICKNESS
  ULTRASONIC_THICKNESS
  DYE_PENETRANT
  CATHODIC_PROTECTION
  FUNCTIONAL_TEST         // Lanterns, fog signals, GPS, etc.
  MOORING_INSPECTION
  PULL_TEST
  GENERAL
}

enum InspectionStatus {
  IN_PROGRESS
  COMPLETED
  UNDER_REVIEW
  APPROVED
  REJECTED
}

model InspectionFinding {
  id            String   @id @default(cuid())
  inspectionId  String
  nicheAreaId   String?  // If finding relates to specific niche area

  area          String   // e.g., "Hull Flat Bottom", "Sea Chest Port 1"
  foulingRating Int?     // 0-5 (0=clean, 5=heavy macrofouling)
  foulingType   String?  // e.g., "Slime", "Barnacles", "Tubeworm"
  coverage      Float?   // Percentage 0-100
  condition     String?  // e.g., "Good", "Fair", "Poor", "Critical"

  // Measurements (for technical inspections)
  measurementType  String?  // DFT, UT, CP reading, etc.
  measurementValue Float?
  measurementUnit  String?
  referenceStandard String? // Standard being measured against

  // Corrosion / coating
  coatingCondition String?
  corrosionType    String?
  corrosionSeverity String?

  description   String?
  recommendation String?
  actionRequired Boolean @default(false)
  priority       WorkOrderPriority @default(NORMAL)

  metadata      Json?    // Flexible additional measurements
  createdAt     DateTime @default(now())

  inspection    Inspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)
  nicheArea     NicheArea? @relation(fields: [nicheAreaId], references: [id])
  media         Media[]

  @@map("inspection_findings")
}

// ============================================================
// WORKFLOW ENGINE
// ============================================================

model Workflow {
  id          String   @id @default(cuid())
  name        String
  description String?
  version     Int      @default(1)
  isActive    Boolean  @default(true)
  isTemplate  Boolean  @default(true)  // Template vs instance

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  steps       WorkflowStep[]
  workOrders  WorkOrder[]

  @@map("workflows")
}

model WorkflowStep {
  id          String   @id @default(cuid())
  workflowId  String
  name        String
  description String?
  order       Int      // Sequential order
  type        StepType

  // Who can action this step
  requiredRole      UserRole?
  requiredPermission Permission?

  // Auto-advance rules
  autoAdvance Boolean @default(false) // Auto-move to next step when all tasks complete

  createdAt   DateTime @default(now())

  workflow    Workflow      @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  tasks       WorkflowTask[]

  @@unique([workflowId, order])
  @@map("workflow_steps")
}

enum StepType {
  DATA_CAPTURE      // Field data entry
  REVIEW            // Review/approval gate
  PARALLEL_REVIEW   // Multiple reviewers in parallel
  NOTIFICATION      // Send notification only
  REPORT_GENERATION // Auto-generate report
  COMPLETION        // Final step
}

model WorkflowTask {
  id          String   @id @default(cuid())
  stepId      String
  name        String
  description String?
  order       Int
  isRequired  Boolean @default(true)

  // Task configuration
  taskType    TaskType
  config      Json?    // Task-specific configuration (form fields, etc.)

  createdAt   DateTime @default(now())

  step        WorkflowStep     @relation(fields: [stepId], references: [id], onDelete: Cascade)
  submissions TaskSubmission[]

  @@unique([stepId, order])
  @@map("workflow_tasks")
}

enum TaskType {
  FORM_FILL          // Fill in form fields
  PHOTO_CAPTURE      // Take photos
  VIDEO_CAPTURE      // Record video
  FILE_UPLOAD        // Upload document
  INSPECTION_RECORD  // Record inspection findings
  MEASUREMENT        // Record measurements
  APPROVAL           // Approve/reject
  SIGNATURE          // Digital signature
  CHECKLIST          // Tick off items
  NOTE               // Free text note
}

model TaskSubmission {
  id          String   @id @default(cuid())
  taskId      String
  workOrderId String
  userId      String
  status      SubmissionStatus @default(PENDING)

  data        Json     // Submitted data (form values, checklist items, etc.)
  notes       String?
  signature   String?  // Base64 signature image or reference

  submittedAt DateTime?
  reviewedAt  DateTime?
  reviewedBy  String?
  reviewNotes String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  task        WorkflowTask @relation(fields: [taskId], references: [id])
  workOrder   WorkOrder    @relation(fields: [workOrderId], references: [id])
  user        User         @relation(fields: [userId], references: [id])
  media       Media[]

  @@map("task_submissions")
}

enum SubmissionStatus {
  PENDING
  SUBMITTED
  APPROVED
  REJECTED
  REVISION_REQUIRED
}

// ============================================================
// MEDIA & DOCUMENTS
// ============================================================

model Media {
  id            String   @id @default(cuid())
  uploaderId    String
  vesselId      String?
  workOrderId   String?
  inspectionId  String?
  findingId     String?
  submissionId  String?

  filename      String
  originalName  String
  mimeType      String
  size          Int      // bytes
  storageKey    String   // S3 key
  url           String   // Presigned or CDN URL
  thumbnailUrl  String?

  // Metadata
  capturedAt    DateTime?
  latitude      Float?
  longitude     Float?
  deviceInfo    String?
  tags          String[]

  createdAt     DateTime @default(now())

  uploader      User              @relation(fields: [uploaderId], references: [id])
  vessel        Vessel?           @relation(fields: [vesselId], references: [id])
  workOrder     WorkOrder?        @relation(fields: [workOrderId], references: [id])
  inspection    Inspection?       @relation(fields: [inspectionId], references: [id])
  finding       InspectionFinding? @relation(fields: [findingId], references: [id])
  submission    TaskSubmission?   @relation(fields: [submissionId], references: [id])

  @@index([vesselId])
  @@index([workOrderId])
  @@map("media")
}

model Document {
  id            String   @id @default(cuid())
  vesselId      String?
  workOrderId   String?

  name          String
  type          DocumentType
  version       Int      @default(1)
  storageKey    String
  url           String
  size          Int
  mimeType      String

  // For generated reports
  generatedFrom Json?    // Reference data used to generate

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  vessel        Vessel?    @relation(fields: [vesselId], references: [id])
  workOrder     WorkOrder? @relation(fields: [workOrderId], references: [id])

  @@map("documents")
}

enum DocumentType {
  BFMP                    // Biofouling Management Plan
  BFRB                    // Biofouling Record Book
  INSPECTION_REPORT
  WORK_ORDER_REPORT
  COMPLIANCE_CERTIFICATE
  COATING_CERTIFICATE
  CLASSIFICATION_REPORT
  SAFETY_PLAN
  ENVIRONMENTAL_PLAN
  GENERAL_DOCUMENT
}

// ============================================================
// COMMENTS
// ============================================================

model Comment {
  id          String   @id @default(cuid())
  workOrderId String
  authorId    String
  parentId    String?  // For threaded comments
  content     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workOrder   WorkOrder @relation(fields: [workOrderId], references: [id], onDelete: Cascade)
  replies     Comment[] @relation("CommentReplies")
  parent      Comment?  @relation("CommentReplies", fields: [parentId], references: [id])

  @@map("comments")
}

// ============================================================
// AUDIT TRAIL (IMMUTABLE LEDGER)
// ============================================================

model AuditEntry {
  id            String   @id @default(cuid())
  sequence      Int      @unique @default(autoincrement()) // Global ordering
  actorId       String?
  actorEmail    String?  // Denormalised for when user is deleted
  actorOrg      String?

  entityType    String   // "WorkOrder", "Inspection", "Vessel", etc.
  entityId      String
  action        AuditAction
  description   String

  // Change tracking
  previousData  Json?    // Snapshot before change
  newData       Json?    // Snapshot after change
  changedFields String[] // List of changed field names

  // Integrity
  hash          String   // SHA-256 hash of this entry + previous hash
  previousHash  String?  // Hash of the previous entry (chain)

  // Context
  ipAddress     String?
  userAgent     String?
  latitude      Float?
  longitude     Float?

  createdAt     DateTime @default(now())

  actor         User?    @relation("AuditActor", fields: [actorId], references: [id])

  @@index([entityType, entityId])
  @@index([actorId])
  @@index([createdAt])
  @@map("audit_entries")
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  STATUS_CHANGE
  APPROVAL
  REJECTION
  ASSIGNMENT
  SUBMISSION
  FILE_UPLOAD
  FILE_DELETE
  REPORT_GENERATED
  LOGIN
  LOGOUT
  PERMISSION_CHANGE
}

// ============================================================
// NOTIFICATIONS
// ============================================================

model Notification {
  id          String   @id @default(cuid())
  userId      String
  type        NotificationType
  title       String
  message     String
  entityType  String?
  entityId    String?
  isRead      Boolean  @default(false)
  readAt      DateTime?
  createdAt   DateTime @default(now())

  user        User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@map("notifications")
}

enum NotificationType {
  WORK_ORDER_ASSIGNED
  WORK_ORDER_STATUS_CHANGE
  APPROVAL_REQUIRED
  APPROVAL_GRANTED
  APPROVAL_REJECTED
  INSPECTION_COMPLETED
  REPORT_READY
  COMMENT_ADDED
  SYSTEM_ALERT
}
```

---

## 5. Authentication & Permissions

### Authentication Flow

1. **Email/password login** → returns JWT access token (15min) + refresh token (7 days)
2. **Refresh token** stored in httpOnly cookie, access token in memory
3. **JWT payload**: `{ userId, email, organisationId, role, permissions[] }`
4. **Multi-org support**: User selects active organisation at login; can switch without re-authenticating

### Permission Model (5-Level Hierarchy)

```
Level 1: ECOSYSTEM_ADMIN    → Full access to everything (Franmarine admins)
Level 2: ORGANISATION_ADMIN → Full access within their organisation
Level 3: MANAGER            → Create/assign work orders, approve submissions
Level 4: OPERATOR           → Field data capture, submit tasks
Level 5: VIEWER             → Read-only access to authorised data
```

### Multi-Party Access Rules

- **Work orders** are visible to: creating org + assigned users' orgs + explicitly shared orgs
- **Vessels** are visible to: owning org + orgs with active work orders on that vessel
- **Inspections** inherit visibility from their work order
- **Audit logs** are visible to: ECOSYSTEM_ADMIN + org admins for their own org's entries

### Middleware Implementation

```typescript
// Example permission check middleware
const requirePermission = (...permissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user; // Set by auth middleware
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const hasPermission = permissions.some(p =>
      user.permissions.includes(p) ||
      user.permissions.includes(Permission.ADMIN_FULL_ACCESS)
    );

    if (!hasPermission) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
};
```

### Unit Tests Required

- `auth.service.test.ts`: Login, token refresh, password hashing, token expiry
- `permissions.test.ts`: Each role level, permission inheritance, cross-org access denial
- `auth.middleware.test.ts`: Valid token, expired token, malformed token, missing token

---

## 6. Core Domain Models

### Vessel Lifecycle

```
Created → Active → In Drydock → Active → ... → Decommissioned
                ↕
         DUE_FOR_INSPECTION ↔ COMPLIANT ↔ NON_COMPLIANT ↔ UNDER_REVIEW
```

### Work Order Lifecycle

```
DRAFT → PENDING_APPROVAL → APPROVED → IN_PROGRESS → AWAITING_REVIEW → UNDER_REVIEW → COMPLETED
  ↓           ↓                                          ↓
CANCELLED   CANCELLED                                  REJECTED → IN_PROGRESS (rework)
```

### Inspection Flow

```
1. Work order assigned to field team
2. Team arrives on site, opens inspection form on tablet
3. For each area/niche:
   - Take photos/video (auto-tagged with GPS + timestamp)
   - Record fouling rating (IMO 0-5 scale)
   - Record measurements (DFT, UT, CP, etc.)
   - Add notes and recommendations
4. Submit inspection for review
5. Reviewer approves or requests rework
6. Approved inspection triggers report generation
```

### Fouling Rating Scale (IMO)

```typescript
// packages/shared/src/constants/fouling-ratings.ts
export const FOULING_RATINGS = {
  0: { label: 'No Fouling', color: '#22c55e', description: 'Clean, no visible fouling' },
  1: { label: 'Light Slime', color: '#86efac', description: 'Light slime layer only' },
  2: { label: 'Heavy Slime', color: '#fbbf24', description: 'Heavy slime, possible biofilm' },
  3: { label: 'Light Macrofouling', color: '#f97316', description: 'Light calcareous/non-calcareous growth' },
  4: { label: 'Heavy Macrofouling', color: '#ef4444', description: 'Heavy macrofouling, significant coverage' },
  5: { label: 'Severe Macrofouling', color: '#991b1b', description: 'Severe, extensive macrofouling' },
} as const;
```

---

## 7. API Design

### Base URL: `/api/v1`

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate refresh token |
| POST | `/auth/forgot-password` | Send password reset email |
| POST | `/auth/reset-password` | Reset password with token |
| GET | `/auth/me` | Get current user profile |

### Vessels
| Method | Path | Description |
|--------|------|-------------|
| GET | `/vessels` | List vessels (paginated, filtered) |
| POST | `/vessels` | Create vessel |
| GET | `/vessels/:id` | Get vessel detail (includes niche areas, recent inspections) |
| PUT | `/vessels/:id` | Update vessel |
| DELETE | `/vessels/:id` | Soft-delete vessel |
| GET | `/vessels/:id/inspections` | List inspections for vessel |
| GET | `/vessels/:id/work-orders` | List work orders for vessel |
| GET | `/vessels/:id/media` | List media for vessel |
| GET | `/vessels/:id/compliance` | Get compliance summary |
| GET | `/vessels/:id/timeline` | Activity timeline |

### Work Orders
| Method | Path | Description |
|--------|------|-------------|
| GET | `/work-orders` | List (paginated, filtered by status/type/vessel/assignee) |
| POST | `/work-orders` | Create work order |
| GET | `/work-orders/:id` | Get detail (includes tasks, assignments, timeline) |
| PUT | `/work-orders/:id` | Update work order |
| PATCH | `/work-orders/:id/status` | Change status (triggers workflow) |
| POST | `/work-orders/:id/assign` | Assign users |
| DELETE | `/work-orders/:id/assign/:userId` | Unassign user |
| GET | `/work-orders/:id/tasks` | Get workflow tasks for this work order |
| POST | `/work-orders/:id/tasks/:taskId/submit` | Submit task data |
| POST | `/work-orders/:id/tasks/:taskId/approve` | Approve task submission |
| POST | `/work-orders/:id/tasks/:taskId/reject` | Reject task submission |
| GET | `/work-orders/:id/comments` | List comments |
| POST | `/work-orders/:id/comments` | Add comment |

### Inspections
| Method | Path | Description |
|--------|------|-------------|
| GET | `/inspections` | List inspections |
| POST | `/inspections` | Create inspection (linked to work order) |
| GET | `/inspections/:id` | Get inspection detail |
| PUT | `/inspections/:id` | Update inspection |
| POST | `/inspections/:id/findings` | Add finding |
| PUT | `/inspections/:id/findings/:findingId` | Update finding |
| PATCH | `/inspections/:id/complete` | Mark complete |
| PATCH | `/inspections/:id/approve` | Approve inspection |

### Media
| Method | Path | Description |
|--------|------|-------------|
| POST | `/media/upload` | Upload file(s) — multipart form data |
| GET | `/media/:id` | Get media metadata + presigned URL |
| DELETE | `/media/:id` | Delete media |
| POST | `/media/upload/batch` | Batch upload (for offline sync) |

### Reports
| Method | Path | Description |
|--------|------|-------------|
| POST | `/reports/generate` | Generate report (async job, returns job ID) |
| GET | `/reports/:jobId/status` | Check report generation status |
| GET | `/reports/:documentId/download` | Download generated report |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/overview` | Fleet compliance summary |
| GET | `/dashboard/work-orders` | Work order statistics |
| GET | `/dashboard/recent-activity` | Recent activity feed |

### Audit
| Method | Path | Description |
|--------|------|-------------|
| GET | `/audit` | Query audit log (paginated, filtered) |
| GET | `/audit/verify` | Verify audit chain integrity |

### Organisations & Users
| Method | Path | Description |
|--------|------|-------------|
| GET | `/organisations` | List organisations |
| POST | `/organisations` | Create organisation |
| GET | `/users` | List users in current org |
| POST | `/users/invite` | Invite user to organisation |
| PUT | `/users/:id` | Update user (admin) |
| PATCH | `/users/:id/role` | Change user role |

### Query Parameters (standard across all list endpoints)

```
?page=1&limit=20               # Pagination
&sort=createdAt&order=desc      # Sorting
&search=keyword                 # Full-text search
&status=IN_PROGRESS             # Enum filter
&vesselId=xxx                   # Relation filter
&from=2024-01-01&to=2024-12-31  # Date range
```

### Response Format

```typescript
// Success
{
  success: true,
  data: T | T[],
  meta?: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}

// Error
{
  success: false,
  error: {
    code: string,        // e.g., "VALIDATION_ERROR", "NOT_FOUND"
    message: string,
    details?: any        // Zod validation errors, etc.
  }
}
```

---

## 8. Feature Specifications

### 8.1 Digital Work Capture (Field Use)

The inspection form must be mobile-optimised (tablets and phones). Key requirements:

- **Camera integration**: Use browser `getUserMedia` API for photo/video capture directly from the form
- **GPS auto-tagging**: Capture device location for each photo/finding
- **Timestamp auto-tagging**: Every submission auto-stamped with UTC time
- **Offline tolerance**: Form should not lose data if connectivity drops mid-entry (use localStorage as write-ahead buffer, sync when online). Full offline is a future feature but the form should be resilient.
- **Photo annotation**: Basic ability to mark up photos (draw circles, arrows) — can use a canvas overlay
- **Fouling rating visual selector**: Tap-to-select fouling rating 0-5 with colour-coded visual reference images

### 8.2 Parallel Multi-Party Workflows

This is the core differentiator from sequential email-based processes:

- **Workflow templates** define the steps and tasks for each work order type
- **Parallel review steps** allow multiple reviewers to act simultaneously (all must approve, or first-to-approve)
- **Step transitions** are automatic when all required tasks in a step are complete
- **Notifications** are sent to relevant parties when a step transitions
- **Dashboard** shows each stakeholder only their pending tasks

**Default Workflow Templates to Seed:**

1. **Biofouling Inspection Workflow**
   - Step 1: Pre-Inspection Planning (Data Capture) — Operator
   - Step 2: Field Inspection (Data Capture + Photo) — Operator
   - Step 3: Parallel Review — Manager + Client Representative
   - Step 4: Report Generation (Auto) — System
   - Step 5: Final Approval — Manager

2. **Hull Cleaning Workflow**
   - Step 1: Pre-Clean Inspection — Operator
   - Step 2: Cleaning Execution — Operator
   - Step 3: Post-Clean Inspection — Operator
   - Step 4: Environmental Compliance Check — Manager
   - Step 5: Report Generation — System
   - Step 6: Client Sign-off — Client (Parallel with Manager Approval)

3. **Navigation Aid Inspection Workflow** (for SPA)
   - Step 1: CVI Inspection — Operator
   - Step 2: Functional Testing — Operator
   - Step 3: Technical Testing (if required) — Operator
   - Step 4: Subsea Inspection (if required) — Diver
   - Step 5: Findings Review — Manager
   - Step 6: Report Generation — System
   - Step 7: SPA Review — Client (Viewer)

### 8.3 Dashboard

The dashboard is role-aware:

**ECOSYSTEM_ADMIN / MANAGER view:**
- Fleet compliance overview (pie chart: compliant/non-compliant/due)
- Work orders by status (kanban or bar chart)
- Overdue work orders (table)
- Recent activity feed (last 20 actions)
- Vessels due for inspection (next 30/60/90 days)

**OPERATOR view:**
- My assigned work orders (prioritised list)
- My pending tasks
- Recent submissions

**VIEWER view:**
- Their organisation's vessels and compliance status
- Work orders related to their vessels
- Available reports

### 8.4 Compliance Status Engine

Compliance status is computed, not manually set:

```typescript
function computeComplianceStatus(vessel: Vessel): ComplianceStatus {
  const lastInspection = getLastApprovedInspection(vessel.id);

  if (!lastInspection) return 'DUE_FOR_INSPECTION';

  const daysSinceInspection = daysBetween(lastInspection.completedAt, now());
  const inspectionInterval = vessel.afsServiceLife
    ? vessel.afsServiceLife * 30 // Convert months to days, inspect at half-life
    : 180; // Default 6 months

  if (lastInspection.overallRating >= 4) return 'NON_COMPLIANT';
  if (daysSinceInspection > inspectionInterval) return 'DUE_FOR_INSPECTION';
  if (hasOpenNonCompliantFindings(vessel.id)) return 'UNDER_REVIEW';

  return 'COMPLIANT';
}
```

Run as a scheduled job (daily) and on inspection completion.

---

## 9. File & Media Management

### Storage Architecture

- **S3 Bucket Structure**: `marinestream-media/{organisationId}/{vesselId}/{workOrderId}/{filename}`
- **Upload flow**: Client → API (multer) → S3 → store metadata in `media` table
- **Presigned URLs**: Generate time-limited download URLs (1 hour expiry)
- **Thumbnails**: Generate on upload for images using `sharp` (200x200)
- **Max file size**: 100MB per file (video), 20MB per image
- **Accepted types**: JPEG, PNG, MP4, MOV, PDF, DOCX, XLSX

### Upload Endpoint

```typescript
// POST /api/v1/media/upload
// Content-Type: multipart/form-data
// Fields: file (binary), vesselId?, workOrderId?, inspectionId?, findingId?, tags[]

// Returns:
{
  id: string,
  url: string,
  thumbnailUrl: string,
  filename: string,
  size: number,
  mimeType: string
}
```

---

## 10. Audit Trail / Immutable Ledger

### Hash Chain Implementation

This replaces Rise-X's blockchain with a **hash-chained audit log** that provides the same tamper-evidence guarantees without blockchain infrastructure.

```typescript
// utils/hash.ts
import crypto from 'crypto';

export function computeAuditHash(entry: {
  sequence: number;
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  description: string;
  previousHash: string | null;
  createdAt: Date;
}): string {
  const payload = JSON.stringify({
    seq: entry.sequence,
    actor: entry.actorId,
    entity: `${entry.entityType}:${entry.entityId}`,
    action: entry.action,
    desc: entry.description,
    prev: entry.previousHash,
    ts: entry.createdAt.toISOString(),
  });

  return crypto.createHash('sha256').update(payload).digest('hex');
}
```

### Verification Endpoint

`GET /api/v1/audit/verify` — walks the chain and verifies each hash matches. Returns:

```json
{
  "valid": true,
  "entriesChecked": 15432,
  "lastVerifiedSequence": 15432,
  "lastHash": "a3f2...",
  "verifiedAt": "2025-02-10T12:00:00Z"
}
```

If any hash doesn't match, returns the sequence number where the chain broke.

### What Gets Audited (automatically via middleware)

Every mutating API call creates an audit entry. The audit middleware wraps service calls:

- All CRUD operations on vessels, work orders, inspections
- All status changes
- All approvals/rejections
- All file uploads/deletions
- All user permission changes
- All login/logout events
- All report generations

### Unit Tests Required

- `hash.test.ts`: Hash computation determinism, chain verification, tamper detection
- `audit.service.test.ts`: Entry creation, chain integrity, concurrent writes, query filtering

---

## 11. Workflow Engine

### How It Works

1. Admin creates a **Workflow Template** with steps and tasks
2. When a work order is created with a workflow, the engine instantiates the workflow
3. The work order tracks its current position (`currentStepId`, `currentTaskId`)
4. When a task is submitted, the engine checks if the step is complete
5. When a step is complete, the engine advances to the next step
6. Parallel review steps require all assigned reviewers to approve

### Engine Logic

```typescript
// services/workflow.service.ts

async function submitTask(workOrderId: string, taskId: string, data: any, userId: string) {
  // 1. Validate user has permission for this task
  // 2. Create TaskSubmission record
  // 3. Check if all required tasks in current step are complete
  // 4. If yes, auto-advance to next step
  // 5. If next step is PARALLEL_REVIEW, notify all reviewers
  // 6. If next step is REPORT_GENERATION, queue report job
  // 7. If no more steps, complete the work order
  // 8. Create audit entry
}

async function advanceWorkflow(workOrderId: string) {
  const workOrder = await getWorkOrderWithWorkflow(workOrderId);
  const currentStep = getCurrentStep(workOrder);
  const allTasksComplete = await checkStepCompletion(workOrder.id, currentStep.id);

  if (!allTasksComplete) return;

  const nextStep = getNextStep(workOrder.workflow, currentStep.order);

  if (!nextStep) {
    // Workflow complete
    await updateWorkOrderStatus(workOrderId, 'COMPLETED');
    return;
  }

  await updateWorkOrderCurrentStep(workOrderId, nextStep.id);

  // Handle step-type-specific logic
  switch (nextStep.type) {
    case 'NOTIFICATION':
      await sendStepNotifications(workOrderId, nextStep);
      await advanceWorkflow(workOrderId); // Auto-advance past notification steps
      break;
    case 'REPORT_GENERATION':
      await queueReportGeneration(workOrderId);
      break;
    case 'PARALLEL_REVIEW':
      await notifyAllReviewers(workOrderId, nextStep);
      break;
  }
}
```

### Unit Tests Required

- `workflow.service.test.ts`:
  - Sequential step advancement
  - Parallel review (all must approve)
  - Auto-advance on completion
  - Report generation trigger
  - Cannot submit task out of order
  - Cannot submit task without permission
  - Work order completion when all steps done

---

## 12. Notifications

### Types & Delivery

| Event | Recipient | Channel |
|-------|-----------|---------|
| Work order assigned | Assignee | In-app + Email |
| Task ready for action | Assigned user | In-app + Email |
| Approval required | Reviewers | In-app + Email |
| Approval granted/rejected | Submitter + Manager | In-app |
| Work order completed | All stakeholders | In-app + Email |
| Compliance status change | Vessel org admin | In-app + Email |
| Report ready | Requestor | In-app |

### In-App Notifications

- Stored in `notifications` table
- Fetched via `GET /api/v1/notifications?unread=true`
- Marked read via `PATCH /api/v1/notifications/:id/read`
- Bell icon in header shows unread count
- Real-time updates via Server-Sent Events (SSE) — simpler than WebSockets

### Email Notifications

- Queued via BullMQ job
- Sent via SendGrid or SMTP
- Simple HTML templates (not over-engineered)
- Unsubscribe link per notification type

---

## 13. Reporting & PDF Generation

### Report Types

1. **Inspection Report**: Findings, photos, measurements, recommendations per vessel
2. **Work Order Report**: Complete work order lifecycle with all submissions
3. **BFMP (Biofouling Management Plan)**: IMO-compliant vessel-specific document
4. **Compliance Summary**: Fleet-wide compliance status dashboard export
5. **Audit Report**: Filtered audit trail export

### Generation Pipeline

```
Request → Validate → Queue Job (BullMQ) → Worker picks up →
  Fetch data → Render HTML template → Puppeteer PDF → Upload to S3 →
  Create Document record → Notify requestor
```

### HTML Templates

Located in `apps/api/templates/`. Use Handlebars for templating. Each template receives a data object and renders to HTML, which Puppeteer converts to PDF.

Templates should be A4 format with:
- Franmarine/MarineStream header and logo
- Page numbers
- Generated timestamp and report ID
- Version number
- Signature blocks where required

### Unit Tests Required

- `report.service.test.ts`: Data assembly for each report type, template rendering, PDF output validation
- `pdf.service.test.ts`: HTML-to-PDF conversion, file size within bounds

---

## 14. Frontend Application

### Key Pages

**Login Page**
- Email/password form
- Organisation selector (if user belongs to multiple orgs)
- Forgot password link

**Dashboard** (`/dashboard`)
- Role-aware widgets (see §8.3)
- Quick actions: Create work order, Start inspection
- Fleet map (Leaflet) showing vessel positions

**Vessels** (`/vessels`)
- Table view with search, sort, filter by status/type/compliance
- Click through to vessel detail

**Vessel Detail** (`/vessels/:id`)
- Vessel info card (editable by authorised users)
- Tabs: Overview, Inspections, Work Orders, Media, Compliance, Niche Areas
- Compliance status badge (colour-coded)
- Timeline of all activity

**Work Orders** (`/work-orders`)
- Kanban board view (columns = status) AND table view (toggle)
- Create work order button
- Filters: status, type, vessel, assignee, date range

**Work Order Detail** (`/work-orders/:id`)
- Header: reference, status, vessel, priority, dates
- Workflow stepper: visual progress through workflow steps
- Current task panel: form/action for active task
- Assignments panel: show assigned users and roles
- Comments thread
- Media gallery
- Timeline/audit trail for this work order

**Inspection Page** (`/inspections/:id`) — MOBILE OPTIMISED
- Large touch targets
- Camera capture button (prominent)
- Fouling rating visual selector (coloured circles, tap to select)
- Area-by-area findings form
- Swipe between areas
- Auto-save every 10 seconds

**Reports** (`/reports`)
- Generate report form (select type, vessel, date range)
- List of generated reports with download links
- Status indicator for in-progress generations

**Audit Log** (`/audit`)
- Searchable, filterable table of all audit entries
- Chain verification button (shows pass/fail)
- Export to CSV

**Users & Settings** (`/settings`)
- User management (invite, edit role, deactivate)
- Organisation settings
- Notification preferences
- Workflow template editor (admin only)

### Mobile / PWA Requirements

- `manifest.json` for installability
- Service worker for basic asset caching (not full offline — future feature)
- Responsive breakpoints: mobile (< 768px), tablet (768-1024px), desktop (> 1024px)
- Touch-optimised inspection forms
- Camera API integration for photo capture

### UI Design Direction

- Clean, professional maritime aesthetic
- Primary colour: Deep Navy (#0f172a)
- Accent: Ocean Blue (#0ea5e9)
- Success: Marine Green (#22c55e)
- Warning: Amber (#f59e0b)
- Danger: Coral Red (#ef4444)
- White/light grey backgrounds
- Inter or IBM Plex Sans typography

---

## 15. Testing Strategy

### Philosophy

Every service function has unit tests. Integration tests cover the API endpoints. The goal is confidence that changes don't break existing functionality.

### Test Structure

```
tests/
├── unit/           # Pure function tests, mocked dependencies
│   ├── services/   # Business logic
│   ├── middleware/  # Auth, permissions, validation
│   └── utils/      # Hash, pagination, helpers
├── integration/    # API endpoint tests with real DB
│   ├── auth.test.ts
│   ├── vessel.test.ts
│   ├── work-order.test.ts
│   └── workflow.test.ts
└── helpers/
    ├── setup.ts       # Create/destroy test database
    ├── factories.ts   # Generate test data
    └── auth.ts        # Generate test JWTs
```

### Test Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/helpers/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      }
    }
  }
});
```

### Test Database

- Use a separate PostgreSQL database for tests (or use `@prisma/client` with a test schema)
- Reset database between test suites (not between individual tests for speed)
- Seed with minimal required data per suite

### Required Unit Tests (Minimum)

| File | What to Test |
|------|-------------|
| `auth.service.test.ts` | Login success/failure, token generation, password hashing, refresh flow |
| `vessel.service.test.ts` | CRUD operations, compliance computation, filtering, authorisation |
| `work-order.service.test.ts` | CRUD, status transitions (valid and invalid), reference number generation |
| `workflow.service.test.ts` | Step advancement, parallel review, task submission, completion |
| `audit.service.test.ts` | Entry creation, hash chain computation, chain verification |
| `report.service.test.ts` | Data assembly for each report type |
| `auth.middleware.test.ts` | Token validation, expiry, role extraction |
| `permissions.middleware.test.ts` | Role-based access, cross-org denial |
| `hash.test.ts` | Deterministic hashing, chain integrity, tamper detection |

### Required Integration Tests (Minimum)

| File | What to Test |
|------|-------------|
| `auth.test.ts` | Full login/refresh/logout flow via HTTP |
| `vessel.test.ts` | Create/read/update/list vessels via HTTP, permission enforcement |
| `work-order.test.ts` | Full lifecycle: create → assign → progress → complete |
| `workflow.test.ts` | Submit task → advance step → parallel review → complete |

### Test Data Factories

```typescript
// tests/helpers/factories.ts
import { faker } from '@faker-js/faker';

export function buildUser(overrides = {}) {
  return {
    email: faker.internet.email(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    passwordHash: '$2b$10$...', // Pre-computed hash for 'testpassword'
    ...overrides,
  };
}

export function buildVessel(overrides = {}) {
  return {
    name: `${faker.company.name()} ${faker.number.int({ min: 1, max: 999 })}`,
    vesselType: 'TUG',
    status: 'ACTIVE',
    complianceStatus: 'COMPLIANT',
    ...overrides,
  };
}

export function buildWorkOrder(overrides = {}) {
  return {
    title: `Inspection - ${faker.date.recent().toISOString().slice(0, 10)}`,
    type: 'BIOFOULING_INSPECTION',
    priority: 'NORMAL',
    status: 'DRAFT',
    ...overrides,
  };
}
```

---

## 16. Deployment & Infrastructure

### Render Configuration

```yaml
# render.yaml
services:
  - type: web
    name: marinestream-api
    runtime: node
    buildCommand: cd apps/api && npm install && npx prisma generate && npm run build
    startCommand: cd apps/api && npx prisma migrate deploy && npm start
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: marinestream-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: marinestream-redis
          type: redis
          property: connectionString
      - key: NODE_ENV
        value: production
    healthCheckPath: /api/v1/health
    plan: starter

  - type: web
    name: marinestream-web
    runtime: static
    buildCommand: cd apps/web && npm install && npm run build
    staticPublishPath: ./apps/web/dist
    headers:
      - path: /*
        name: Cache-Control
        value: public, max-age=31536000
    routes:
      - type: rewrite
        source: /*
        destination: /index.html

  - type: worker
    name: marinestream-worker
    runtime: node
    buildCommand: cd apps/api && npm install && npx prisma generate && npm run build
    startCommand: cd apps/api && npm run worker
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: marinestream-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: marinestream-redis
          type: redis
          property: connectionString

databases:
  - name: marinestream-db
    plan: starter
    postgresMajorVersion: 16

  - name: marinestream-redis
    type: redis
    plan: starter
```

### Health Check

```typescript
// GET /api/v1/health
app.get('/api/v1/health', async (req, res) => {
  const dbHealthy = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
  });
});
```

### CI/CD (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: marinestream_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/marinestream_test
      - run: npm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/marinestream_test
      - run: npm run lint
```

---

## 17. Environment Variables

```bash
# .env.example

# Database
DATABASE_URL=postgresql://user:password@host:5432/marinestream

# Redis (for BullMQ)
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Storage (S3 or compatible)
S3_BUCKET=marinestream-media
S3_REGION=ap-southeast-2
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx
S3_ENDPOINT=                    # Leave blank for AWS, set for R2/MinIO

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
EMAIL_FROM=noreply@marinestream.io

# App
APP_URL=https://marinestream.io
API_URL=https://api.marinestream.io
NODE_ENV=development
PORT=3001
```

---

## 18. Migration & Seed Data

### Seed Script

```typescript
// prisma/seed.ts
async function main() {
  // 1. Create Franmarine organisation
  const franmarine = await prisma.organisation.create({
    data: {
      name: 'Franmarine Underwater Services',
      type: 'SERVICE_PROVIDER',
      abn: '12345678901',
      contactEmail: 'admin@franmarine.com.au',
    }
  });

  // 2. Create admin user (Mat)
  const admin = await prisma.user.create({
    data: {
      email: 'mharvey@marinestream.com.au',
      passwordHash: await hash('changeme'),
      firstName: 'Mat',
      lastName: 'Harvey',
    }
  });

  // 3. Link admin to Franmarine with ECOSYSTEM_ADMIN role
  await prisma.organisationUser.create({
    data: {
      userId: admin.id,
      organisationId: franmarine.id,
      role: 'ECOSYSTEM_ADMIN',
      permissions: ['ADMIN_FULL_ACCESS'],
      isDefault: true,
    }
  });

  // 4. Create default workflow templates
  await createBiofoulingInspectionWorkflow();
  await createHullCleaningWorkflow();
  await createNavAidInspectionWorkflow();

  // 5. Create sample vessel (optional, for development)
  if (process.env.NODE_ENV === 'development') {
    await prisma.vessel.create({
      data: {
        organisationId: franmarine.id,
        name: 'Demo Vessel',
        vesselType: 'TUG',
        status: 'ACTIVE',
        complianceStatus: 'COMPLIANT',
      }
    });
  }
}
```

---

## 19. Future Considerations

These are **NOT** in scope for the initial build but should be architecturally considered:

1. **Full offline mode**: Service worker with IndexedDB cache, background sync queue
2. **Remote video collaboration**: WebRTC live streaming from dive sites to shore (dedicated feature)
3. **AI-powered fouling classification**: Image classification model for auto-rating fouling from photos
4. **API integrations**: Connect to external vessel management systems, port management systems, ERP
5. **White-labelling**: Allow client organisations to brand their portal
6. **Mobile native app**: React Native or Capacitor wrapper for app store distribution
7. **IoT integration**: Direct data feed from ROV systems, cleaning equipment sensors
8. **Advanced analytics**: Performance trending, predictive maintenance, fuel savings calculations
9. **Multi-language support**: i18n for international deployment
10. **BFMP Generator**: Port the existing web tool (marinestream.com.au/interactive-tools/bfmpGen.html) into the platform as a native feature

---

## Build Order (Recommended)

For the agent building this, the recommended order is:

### Phase 1: Foundation (Do First)
1. Project scaffolding (monorepo, packages, configs)
2. Database schema + Prisma setup + migrations
3. Auth system (login, JWT, refresh, middleware)
4. Permission system (roles, middleware)
5. **Tests for all of the above**

### Phase 2: Core CRUD
6. Vessel CRUD + API endpoints
7. Work Order CRUD + API endpoints
8. Inspection CRUD + API endpoints
9. Media upload/download (S3)
10. **Tests for all of the above**

### Phase 3: Workflow Engine
11. Workflow template CRUD
12. Workflow execution engine (advance, parallel review)
13. Task submission system
14. **Tests for workflow engine**

### Phase 4: Audit & Compliance
15. Audit trail middleware + hash chain
16. Audit verification endpoint
17. Compliance status computation
18. **Tests for audit system**

### Phase 5: Reporting
19. HTML report templates
20. PDF generation pipeline (Puppeteer + BullMQ)
21. Report download endpoints

### Phase 6: Frontend
22. Project setup (Vite, React, Tailwind, shadcn)
23. Auth pages (login, forgot password)
24. Layout (sidebar, header, navigation)
25. Dashboard page
26. Vessel pages (list, detail, form)
27. Work order pages (list, kanban, detail, form)
28. Inspection pages (mobile-optimised form)
29. Reports page
30. Audit log page
31. Users/settings pages

### Phase 7: Polish
32. Notifications (in-app + email)
33. SSE for real-time updates
34. PWA manifest + service worker
35. Seed data for demo
36. Final integration tests

---

## Critical Implementation Notes

1. **Never delete data** — soft-delete everything. Compliance records must be retained.
2. **Always audit** — every mutation creates an audit entry. No exceptions.
3. **Hash chain must be sequential** — use a database sequence to guarantee ordering. Handle concurrent writes with a queue or advisory lock.
4. **Presigned URLs expire** — never store S3 URLs directly; always generate fresh presigned URLs.
5. **Timestamps in UTC** — all database timestamps are UTC. Frontend converts to local time.
6. **Reference numbers are human-readable** — `WO-20250210-0001` format. Auto-increment per day.
7. **Zod schemas are shared** — same validation on frontend and backend. Single source of truth in `packages/shared`.
8. **Mobile first for inspection forms** — these are used on tablets at docksides and on dive boats. Big buttons, big text, easy photo capture.
9. **Error handling** — every API endpoint has try/catch with structured error responses. Never leak stack traces in production.
10. **Rate limiting** — apply rate limiting to auth endpoints (5 attempts per minute per IP).

---

*End of specification. This document should provide sufficient detail for an AI coding agent to build the complete MarineStream platform.*