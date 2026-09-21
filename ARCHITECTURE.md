# Ferretería App - Architecture Diagram

## System Overview

This is an **offline-first** hardware store management system built with TypeScript, using a monorepo structure with pnpm workspaces.

```mermaid
graph TB
    subgraph "Root Workspace"
        Root[ferreteria-app<br/>pnpm workspace]
        Root --> Client[packages/client<br/>Electron + React]
        Root --> Shared[packages/shared<br/>Common types/utils]
    end

    subgraph "Client Package (Electron App)"
        Client --> MainProcess[src/main<br/>Node.js Process]
        Client --> RendererProcess[src/renderer<br/>React UI]
        Client --> Preload[src/preload<br/>IPC Bridge]
        
        MainProcess --> SQLite[(SQLite<br/>Local DB)]
        MainProcess --> IPC[IPC Handlers]
        
        Preload -->|contextBridge| RendererProcess
        RendererProcess -->|IPC invoke| IPC
        IPC -->|Drizzle ORM| SQLite
    end

    subgraph "Shared Package"
        Shared --> SyncTypes[sync/types.ts<br/>SyncState, SyncableEntity]
        Shared --> SyncID[sync/id.ts<br/>UUID generation]
        Shared --> Config[config/terminal.ts<br/>Terminal config]
    end

    Client -.-> Shared
```

## Architecture Layers

```mermaid
graph TB
    subgraph "Presentation Layer"
        UI[React Components<br/>Views: Login, Home]
        Router[React Router<br/>Memory Router]
        Context[AuthContext<br/>Session Management]
    end

    subgraph "IPC Bridge"
        Preload[Preload Script<br/>contextBridge]
        IPCMain[IPC Main Handlers<br/>auth:login, auth:logout]
    end

    subgraph "Business Logic"
        Auth[Auth Module<br/>hash, guard, session, seed]
        DB[Database Client<br/>Drizzle + SQLite]
        Schema[DB Schema<br/>5 domain modules]
    end

    subgraph "Data Layer"
        SQLite[(SQLite Database<br/>WAL mode, FK enabled)]
        Migrations[Drizzle Migrations]
    end

    UI --> Context
    Context -->|window.ferreteria| Preload
    Preload -->|ipcRenderer.invoke| IPCMain
    IPCMain --> Auth
    Auth --> DB
    DB --> Schema
    DB --> Migrations
    Migrations --> SQLite
```

## Database Schema Structure

```mermaid
graph LR
    subgraph "Schema Modules"
        Catalog[catalog.ts<br/>7 tables]
        Seguridad[seguridad.ts<br/>5 tables]
        Personas[personas.ts<br/>2 tables]
        Precios[precios.ts<br/>2 tables]
        Ventas[ventas.ts<br/>5 tables]
    end

    subgraph "Catalog Tables"
        C1[categoria]
        C2[marca]
        C3[impuesto]
        C4[ubicacion]
        C5[producto]
        C6[existencias]
        C7[movimiento_stock]
    end

    subgraph "Security Tables"
        S1[rol]
        S2[permiso]
        S3[rol_permiso]
        S4[usuario]
        S5[usuario_preferencias]
    end

    Catalog --> C1
    Catalog --> C2
    Catalog --> C3
    Catalog --> C4
    Catalog --> C5
    Catalog --> C6
    Catalog --> C7
    
    Seguridad --> S1
    Seguridad --> S2
    Seguridad --> S3
    Seguridad --> S4
    Seguridad --> S5
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant User as User
    participant UI as React UI
    participant Context as AuthContext
    participant Preload as Preload
    participant IPC as IPC Main
    participant DB as SQLite DB
    participant Session as Session Manager

    User->>UI: Enter credentials
    UI->>Context: login({nombreUsuario, password/pin})
    Context->>Preload: window.ferreteria.auth.login()
    Preload->>IPC: ipcRenderer.invoke('auth:login')
    IPC->>DB: Query usuario table
    DB->>IPC: User record
    IPC->>DB: Query rol_permiso
    DB->>IPC: Permission IDs
    IPC->>DB: Query permiso
    DB->>IPC: Permission codes
    IPC->>DB: Query usuario_preferencias
    DB->>IPC: User preferences
    IPC->>Session: setSession()
    IPC->>Preload: SessionData
    Preload->>Context: SessionData
    Context->>UI: Apply preferences
    Context->>UI: Navigate to Home
```

## Data Flow: Product Management

```mermaid
graph TB
    subgraph "UI Layer"
        ProductForm[Product Form]
    end

    subgraph "IPC Layer"
        ProductIPC[Product IPC Handlers<br/>Not yet implemented]
    end

    subgraph "Business Logic"
        ProductService[Product Service<br/>Not yet implemented]
    end

    subgraph "Data Layer"
        ProductoTable[producto table]
        ExistenciasTable[existencias table]
        MovimientoStockTable[movimiento_stock table]
    end

    ProductForm --> ProductIPC
    ProductIPC --> ProductService
    ProductService --> ProductoTable
    ProductService --> ExistenciasTable
    ProductService --> MovimientoStockTable
```

## Key Design Patterns

### 1. Offline-First Architecture
- **SQLite** is the source of truth locally
- All writes go to SQLite first
- Future sync to cloud (PostgreSQL) via outbox pattern

### 2. IPC Communication Pattern
```mermaid
graph LR
    Renderer[Renderer Process] -->|contextBridge| Preload[Preload Script]
    Preload -->|ipcRenderer.invoke| IPCMain[IPC Main Handlers]
    IPCMain -->|Business Logic| Services[Service Layer]
    Services -->|Drizzle ORM| DB[SQLite]
```

### 3. Sync Fields Pattern
Every syncable table includes:
- `version`: Integer version number
- `origin_id`: Terminal ID that created the record
- `sync_state`: enum('pending', 'synced', 'conflict')
- `updated_at`: Timestamp for conflict resolution

### 4. Immutable Ledger Pattern
Stock, cash, and account balances use:
- **Movement tables** (movimiento_stock, movimiento_caja, movimiento_cta_cte)
- **Running balance** (*_resultante field)
- Movements are never edited, only appended

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Build System** | pnpm workspaces, TypeScript |
| **Desktop App** | Electron 32.x |
| **UI Framework** | React 18.x, React Router 6.x |
| **Database** | SQLite (better-sqlite3), Drizzle ORM |
| **Testing** | Vitest, React Testing Library |
| **Packaging** | Electron Forge |

## Package Dependencies

```mermaid
graph TD
    Client[ferreteria-client] -->|workspace:*| Shared[@ferreteria/shared]
    Client --> Electron[electron]
    Client --> React[react, react-dom]
    Client --> Router[react-router-dom]
    Client --> SQLite[better-sqlite3]
    Client --> Drizzle[drizzle-orm, drizzle-kit]
    
    Shared[@ferreteria/shared] --> TS[typescript]
    Shared --> Vitest[vitest]
```

## Current Implementation Status

### ✅ Implemented (R1 - Bootstrap)
- Monorepo structure with pnpm workspaces
- Electron + React basic setup
- SQLite database with Drizzle ORM
- Authentication system (RBAC with 2 roles)
- User preferences (theme, accent, font, density)
- IPC bridge pattern
- Basic routing (Login, Home)
- Database schema for 5 domains (21 tables)

### 🚧 Planned (Future Releases)
- **R2**: Fiscal integration (AFIP/ARCA), invoicing
- **R3**: Purchases, credit accounts
- **R4**: Cloud sync (Node.js + PostgreSQL backend)
- **R5**: Consolidated reports, multi-branch preparation

## File Structure

```
ferreteria-app/
├── packages/
│   ├── client/                 # Electron + React app
│   │   ├── src/
│   │   │   ├── main/          # Node.js main process
│   │   │   │   ├── auth/      # Authentication logic
│   │   │   │   ├── db/        # Database & schema
│   │   │   │   ├── ipc/       # IPC handlers
│   │   │   │   └── config.ts
│   │   │   ├── preload/       # IPC bridge
│   │   │   └── renderer/      # React UI
│   │   │       ├── components/
│   │   │       ├── context/
│   │   │       ├── views/
│   │   │       └── routes/
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   └── shared/                # Shared types & utilities
│       └── src/
│           ├── config/        # Terminal config
│           ├── sync/          # Sync types & ID generation
│           └── index.ts
├── docs/                      # Complete documentation
│   ├── TechSpec-ferreteria.md
│   ├── PRD-ferreteria.md
│   ├── Sistema-Diseno-ferreteria.md
│   └── ADR-Log-ferreteria.md
├── AGENTS.md                  # Project context for AI agents
├── CLAUDE.md                  # Permanent project context
├── package.json               # Root package.json
└── pnpm-workspace.yaml        # Workspace configuration
```

## Security Architecture

```mermaid
graph TB
    subgraph "Electron Security"
        ContextIsolation[contextIsolation: true]
        NodeIntegration[nodeIntegration: false]
        ContextBridge[contextBridge API]
    end

    subgraph "Authentication Security"
        PasswordHash[bcrypt password hashing]
        PinHash[bcrypt PIN hashing]
        SessionManagement[In-memory session]
        RBAC[Role-based access control]
    end

    subgraph "Database Security"
        WAL[WAL mode for performance]
        FK[Foreign keys enabled]
        LogicalDelete[Soft delete with activo flag]
    end

    ContextIsolation --> ContextBridge
    NodeIntegration --> ContextBridge
    ContextBridge --> RBAC
    PasswordHash --> SessionManagement
    PinHash --> SessionManagement
    SessionManagement --> RBAC
    RBAC --> FK
```

## Key Business Rules

1. **Offline-first**: All operations work without internet
2. **UUID generation**: All IDs generated on client
3. **Sync fields**: Every syncable table has version, origin_id, sync_state
4. **Immutable ledgers**: Stock/cash/account movements never edited
5. **RBAC**: Two roles (OPERADOR, SUPERVISOR) with permission codes
6. **Logical delete**: Soft delete with `activo` flag
7. **Audit trail**: All tables have creation/modification tracking
8. **Price calculation**: Base → % of list → line discount → global discount
9. **Rounding**: Total rounded to $1, difference in adjustment field
10. **Stock validation**: No sale without available stock
