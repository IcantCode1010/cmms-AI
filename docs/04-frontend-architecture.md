# Frontend Architecture

## Technology Stack

### Core Framework
- **Framework**: React 17.0.2
- **Language**: TypeScript 4.7.3
- **Build Tool**: React Scripts 5.0.1 (Create React App)
- **Package Manager**: npm

### UI Framework & Styling
- **Material-UI**: @mui/material 5.8.2
- **Styling**: @emotion/react 11.9.0, @emotion/styled 11.8.1
- **Icons**: @mui/icons-material 5.8.2

### State Management
- **Redux**: redux 4.2.0
- **Redux Toolkit**: @reduxjs/toolkit 1.8.2
- **React Redux**: react-redux 8.0.2
- **Redux Thunk**: redux-thunk 2.4.1

### Routing
- **React Router**: react-router-dom 6.3.0
- **History**: history 5.3.0

### Forms & Validation
- **Formik**: formik 2.2.9
- **Yup**: yup 0.32.11
- **Formik MUI**: formik-mui 4.0.0-alpha.3

### Data Visualization
- **ApexCharts**: apexcharts 3.35.3, react-apexcharts 1.4.0
- **Recharts**: recharts 2.2.0
- **Gauges**: react-gauge-chart 0.4.0
- **CountUp**: react-countup 6.2.0

### Authentication
- **JWT**: jsonwebtoken 8.5.1
- **OAuth**: @auth0/auth0-spa-js 1.22.0

### Real-Time Communication
- **WebSocket**: @stomp/stompjs 7.0.0, sockjs-client 1.6.1, stompjs 2.3.3

### Internationalization
- **i18next**: i18next 21.8.8
- **React i18next**: react-i18next 11.17.0
- **Language Detector**: i18next-browser-languagedetector 6.1.4

### Additional Libraries
- **Date Handling**: date-fns 2.28.0, dayjs 1.11.7
- **Google Maps**: react-google-maps 9.4.5
- **File Upload**: react-dropzone 14.2.1
- **Rich Text**: react-quill 2.0.0-beta.4
- **Excel Export**: xlsx 0.18.5
- **PDF Download**: downloadjs 1.4.7
- **Notifications**: notistack 2.0.5
- **Calendar**: @fullcalendar/* 5.11.0
- **Drag & Drop**: react-beautiful-dnd 13.1.0

## Application Structure

### Source Directory Structure

```
frontend/src/
├── App.tsx                    # Root component
├── index.tsx                  # Application entry point
├── config.ts                  # Configuration constants
│
├── components/                # Reusable UI components
│   ├── buttons/
│   ├── forms/
│   ├── tables/
│   ├── modals/
│   ├── ChatDock/               # AI assistant chat interface
│   └── ...
│
├── content/                   # Page content/screens
│   ├── auth/                 # Authentication pages
│   ├── work-orders/          # Work order management
│   ├── assets/               # Asset management
│   ├── locations/            # Location management
│   ├── inventory/            # Parts & inventory
│   ├── analytics/            # Dashboards & reports
│   └── settings/             # Settings pages
│
├── contexts/                  # React Context providers
│   ├── AuthContext.tsx
│   ├── ThemeContext.tsx
│   └── ...
│
├── hooks/                     # Custom React hooks
│   ├── useAuth.ts
│   ├── usePermissions.ts
│   └── ...
│
├── i18n/                      # Internationalization
│   ├── i18n.ts
│   └── locales/
│       ├── en.json
│       ├── es.json
│       ├── fr.json
│       └── ...
│
├── layouts/                   # Layout components
│   ├── DashboardLayout/
│   ├── AuthLayout/
│   └── ...
│
├── models/                    # TypeScript interfaces/types
│   ├── user.ts
│   ├── workOrder.ts
│   ├── asset.ts
│   └── ...
│
├── router/                    # Routing configuration
│   ├── index.tsx
│   └── routes.ts
│
├── slices/                    # Redux Toolkit slices
│   ├── authSlice.ts
│   ├── workOrderSlice.ts
│   ├── assetSlice.ts
│   ├── agentChat.ts            # AI agent chat state
│   └── ...
│
├── store/                     # Redux store configuration
│   └── index.ts
│
└── theme/                     # Material-UI theme customization
    ├── ThemeProvider.tsx
    ├── base.ts
    └── schemes/
        ├── PureLightTheme.ts
        └── NebulaFighterTheme.ts
```

### Entry Point

**File**: `frontend/src/index.tsx`

**Initialization**:
1. Load runtime environment variables
2. Initialize i18n
3. Create Redux store
4. Render React app with providers
5. Register service worker for PWA

### Root Component

**File**: `frontend/src/App.tsx`

**Provider Hierarchy**:
```tsx
<HelmetProvider>
  <Provider store={store}>
    <BrowserRouter>
      <ThemeProvider>
        <SnackbarProvider>
          <Router />
        </SnackbarProvider>
      </ThemeProvider>
    </BrowserRouter>
  </Provider>
</HelmetProvider>
```

## Configuration

### Environment Variables

**File**: `frontend/.env.example`

```env
API_URL=http://localhost:8080        # Backend API URL
GOOGLE_KEY=                          # Google Maps API key
GOOGLE_TRACKING_ID=                  # Google Analytics ID
MUI_X_LICENSE=                       # MUI X Pro license
INVITATION_VIA_EMAIL=false
CLOUD_VERSION=false
ENABLE_SSO=false
OAUTH2_PROVIDER=
LOGO_PATHS=
CUSTOM_COLORS=
BRAND_CONFIG=
```

### Runtime Configuration

**File**: `frontend/src/config.ts`

Loads environment variables at runtime using `runtime-env-cra`:

```typescript
export const API_URL = window._env_.API_URL || 'http://localhost:8080';
export const GOOGLE_KEY = window._env_.GOOGLE_KEY || '';
export const MUI_X_LICENSE = window._env_.MUI_X_LICENSE || '';
// ...
```

### Build Scripts

```json
{
  "scripts": {
    "start": "cross-env NODE_ENV=development runtime-env-cra --config-name=./public/runtime-env.js && react-scripts start --max_old_space_size=6096",
    "build": "react-scripts build",
    "lint": "eslint .",
    "lint:fix": "eslint --fix",
    "format": "prettier --write \"./**/*.{ts,tsx,js,jsx,json}\" --config ./.prettierrc"
  }
}
```

## State Management

### Redux Architecture

**Store**: `frontend/src/store/index.ts`

**Slices** (Redux Toolkit):
Each domain has its own slice managing:
- State shape
- Reducers (state mutations)
- Async thunks (API calls)
- Selectors

Example slices:
- `authSlice` - Authentication state
- `workOrderSlice` - Work order data and operations
- `assetSlice` - Asset data and operations
- `userSlice` - User preferences and profile

**State Shape Example**:
```typescript
interface WorkOrderState {
  workOrders: WorkOrder[];
  currentWorkOrder: WorkOrder | null;
  loading: boolean;
  error: string | null;
  filters: WorkOrderFilters;
  pagination: PaginationState;
}
```

**Async Thunks** (API Integration):
```typescript
export const fetchWorkOrders = createAsyncThunk(
  'workOrders/fetchAll',
  async (filters: WorkOrderFilters) => {
    const response = await api.get('/work-orders', { params: filters });
    return response.data;
  }
);
```

### React Context

**Contexts**:
- `AuthContext` - Authentication state and methods
- `ThemeContext` - Theme selection and customization
- `WebSocketContext` - Real-time communication

**Usage**:
```typescript
const { user, login, logout } = useAuth();
const { theme, toggleTheme } = useTheme();
```

## Routing

### React Router v6

**Configuration**: `frontend/src/router/index.tsx`

**Route Structure**:
```
/ (Public)
├── /login
├── /signup
├── /forgot-password
└── /oauth2/success

/app (Protected - requires authentication)
├── /dashboard
├── /work-orders
│   ├── /
│   ├── /new
│   └── /:id
├── /assets
│   ├── /
│   ├── /new
│   └── /:id
├── /locations
├── /inventory
├── /analytics
├── /settings
│   ├── /profile
│   ├── /team
│   ├── /roles
│   └── /company
└── ...
```

**Protected Routes**:
```typescript
<Route
  path="/app/*"
  element={
    <RequireAuth>
      <DashboardLayout />
    </RequireAuth>
  }
/>
```

### Navigation Guards

**Authentication Check**:
```typescript
function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} />;
  }

  return children;
}
```

**Permission-Based Rendering**:
```typescript
const canEdit = hasPermission('WORK_ORDER', 'EDIT_OTHER');

{canEdit && <EditButton onClick={handleEdit} />}
```

## UI Architecture

### Material-UI Theming

**Theme Files**:
- `frontend/src/theme/ThemeProvider.tsx`
- `frontend/src/theme/base.ts`
- `frontend/src/theme/schemes/`

**Theme Configuration**:
```typescript
const theme = createTheme({
  palette: {
    primary: { main: '#EE4B2B' },
    secondary: { main: '#6E759F' },
    // Customizable via CUSTOM_COLORS env var
  },
  typography: {
    fontFamily: 'Inter, sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8 }
      }
    }
  }
});
```

**White-Labeling Support**:
Custom colors loaded from `CUSTOM_COLORS` environment variable:
```json
{
  "primary": "#EE4B2B",
  "secondary": "#6E759F",
  "success": "#57CA22",
  "warning": "#FFA319",
  "error": "#FF1943"
}
```

### Layout System

**Dashboard Layout**:
- Persistent sidebar navigation
- Top app bar with user menu
- Breadcrumb navigation
- Content area

**Responsive Design**:
- Mobile-first approach
- Breakpoints: xs, sm, md, lg, xl
- Collapsible sidebar on mobile
- Adaptive tables and forms

### Data Grid

**Library**: MUI X Data Grid Pro (requires license)

**Features**:
- Server-side pagination
- Sorting and filtering
- Column visibility toggle
- CSV export
- Row selection
- Inline editing (where permitted)

**Usage**:
```typescript
<DataGridPro
  rows={workOrders}
  columns={columns}
  pagination
  paginationMode="server"
  onPageChange={handlePageChange}
  onSortModelChange={handleSort}
  onFilterModelChange={handleFilter}
  licenseKey={MUI_X_LICENSE}
/>
```

## Authentication & Authorization

### Authentication Flow

#### JWT-Based Authentication

1. **Login**:
   ```typescript
   const { data } = await api.post('/auth/signin', { email, password });
   localStorage.setItem('token', data.accessToken);
   setAuthHeader(data.accessToken);
   ```

2. **Token Storage**:
   - Stored in `localStorage`
   - Included in Axios interceptor

3. **Token Refresh**:
   - Token expires after 14 days
   - User must re-authenticate

4. **Logout**:
   ```typescript
   localStorage.removeItem('token');
   delete axios.defaults.headers.common['Authorization'];
   ```

#### OAuth2/SSO Flow

**Configuration**:
```env
ENABLE_SSO=true
OAUTH2_PROVIDER=google
```

**Flow**:
1. User clicks "Sign in with Google"
2. Redirected to `/oauth2/authorization/google` (backend)
3. OAuth2 provider authentication
4. Callback to `/oauth2/callback/google` (backend)
5. Backend redirects to `/oauth2/success?token=<jwt>`
6. Frontend extracts token and stores

**Components**:
- `OAuth2Success.tsx` - Handles OAuth2 callback
- `OAuth2RedirectHandler.tsx` - Processes token

### Permission System

**Hook**: `usePermissions`

```typescript
const { hasPermission, hasAnyPermission } = usePermissions();

const canEditWorkOrder = hasPermission('WORK_ORDER', 'EDIT_OTHER');
const canManageAssets = hasAnyPermission('ASSET', ['CREATE', 'EDIT_OTHER']);
```

**Conditional Rendering**:
```typescript
{hasPermission('WORK_ORDER', 'CREATE') && (
  <Button onClick={createWorkOrder}>New Work Order</Button>
)}
```

## API Integration

### Axios Configuration

**Base URL**: Configured from `API_URL` environment variable

**Interceptors**:

Request Interceptor (add auth token):
```typescript
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

Response Interceptor (handle errors):
```typescript
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Token expired, logout user
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### API Service Layer

**Pattern**: Each domain has a service file

Example: `frontend/src/services/workOrderService.ts`
```typescript
export const workOrderService = {
  getAll: (filters) => axios.get('/work-orders', { params: filters }),
  getById: (id) => axios.get(`/work-orders/${id}`),
  create: (data) => axios.post('/work-orders', data),
  update: (id, data) => axios.patch(`/work-orders/${id}`, data),
  delete: (id) => axios.delete(`/work-orders/${id}`),
};
```

## Real-Time Features

### WebSocket Integration

**Library**: @stomp/stompjs

**Connection Setup**:
```typescript
const client = new Client({
  brokerURL: 'ws://localhost:8080/ws',
  connectHeaders: {
    Authorization: `Bearer ${token}`
  },
  onConnect: () => {
    client.subscribe('/topic/notifications', message => {
      const notification = JSON.parse(message.body);
      showNotification(notification);
    });
  }
});

client.activate();
```

**Use Cases**:
- Real-time work order updates
- Live notifications
- Multi-user collaboration alerts

## Internationalization (i18n)

### Supported Languages

- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Turkish (tr)
- Polish (pl)
- Portuguese - Brazil (pt-BR)
- Arabic (ar)
- Swedish (sv)
- Italian (it)

### Configuration

**File**: `frontend/src/i18n/i18n.ts`

**Usage**:
```typescript
import { useTranslation } from 'react-i18next';

function Component() {
  const { t, i18n } = useTranslation();

  return (
    <h1>{t('workOrders.title')}</h1>
    <Button onClick={() => i18n.changeLanguage('es')}>
      Español
    </Button>
  );
}
```

**Translation Files**: `frontend/src/i18n/locales/*.json`

## Forms & Validation

### Formik Integration

**Pattern**: Form state management with Formik + Yup validation

Example:
```typescript
const validationSchema = Yup.object({
  title: Yup.string().required('Title is required'),
  description: Yup.string(),
  priority: Yup.string().oneOf(['LOW', 'MEDIUM', 'HIGH']),
});

<Formik
  initialValues={initialValues}
  validationSchema={validationSchema}
  onSubmit={handleSubmit}
>
  {({ values, errors, handleChange }) => (
    <Form>
      <TextField
        name="title"
        label="Title"
        value={values.title}
        onChange={handleChange}
        error={!!errors.title}
      />
      <Button type="submit">Save</Button>
    </Form>
  )}
</Formik>
```

### Formik MUI Components

Pre-integrated Material-UI components:
- `TextField`
- `Select`
- `DatePicker`
- `Autocomplete`
- `Checkbox`
- `Switch`

## File Management

### File Upload

**Component**: `react-dropzone`

**Implementation**:
```typescript
<Dropzone onDrop={handleDrop} accept="image/*,application/pdf">
  {({ getRootProps, getInputProps }) => (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      <p>Drag files here or click to browse</p>
    </div>
  )}
</Dropzone>
```

**Upload Process**:
1. User selects file(s)
2. Files uploaded to backend `/api/files`
3. Backend stores in MinIO/GCP
4. Returns file metadata (ID, URL)
5. Associate file IDs with work order/asset

### File Download

```typescript
const handleDownload = async (fileId) => {
  const response = await axios.get(`/api/files/${fileId}`, {
    responseType: 'blob'
  });
  download(response.data, fileName);
};
```

## Analytics & Visualization

### Chart Libraries

**ApexCharts** (primary):
- Line charts
- Bar charts
- Pie charts
- Area charts

**Recharts** (alternative):
- Responsive charts
- Customizable tooltips

**Gauge Charts**:
- Performance metrics
- KPI displays

### Dashboard Components

**Metrics Cards**:
- Total work orders
- Completion rate
- Average response time
- Cost tracking

**Charts**:
- Work order trends over time
- Asset downtime analysis
- Parts inventory levels
- Cost analysis

## AI Assistant Integration

### ChatDock Component

**Location**: `frontend/src/components/ChatDock/`

**Purpose**: AI-powered maintenance assistant for natural language interaction with CMMS

**Features**:
- Natural language queries for work orders, assets, and inventory
- Draft action proposals requiring user confirmation
- Tool invocation logging and real-time status display
- Session-based conversation tracking
- Floating chat dock interface

**Component Structure**:
```typescript
<ChatDock>
  <ChatHeader>
    <Typography>Atlas Assistant</Typography>
    <LoadingIndicator />
    <CloseButton />
  </ChatHeader>

  <MessageList>
    {messages.map(message => (
      <Message role={message.role}>
        {message.content}
      </Message>
    ))}
  </MessageList>

  {toolCalls.length > 0 && (
    <ToolActivityPanel>
      <ToolCallSummary {...toolCall} />
    </ToolActivityPanel>
  )}

  {drafts.length > 0 && (
    <DraftList>
      <DraftAction onConfirm={handleConfirm} onDecline={handleDecline} />
    </DraftList>
  )}

  <ChatInput onSubmit={handleSubmit} />
  <RefreshDraftsButton />
</ChatDock>
```

**State Management** (`agentChat` slice):
```typescript
interface AgentChatState {
  enabled: boolean;              // Feature flag
  open: boolean;                 // Dock open/closed
  messages: ChatMessage[];       // Conversation history
  sending: boolean;              // Request in flight
  drafts: AgentDraftAction[];    // Pending confirmations
  toolCalls: ToolInvocation[];   // Tool activity log
  error: string | null;          // Error state
  loadingDrafts: boolean;        // Draft refresh state
}
```

**Redux Actions**:
- `sendPrompt(prompt)` - Send user message to AI agent
- `loadDrafts()` - Fetch pending draft actions
- `confirmDraft(draftId)` - Confirm and execute draft action
- `declineDraft(draftId)` - Decline and discard draft action
- `toggleDock(open)` - Show/hide chat interface

**API Integration** (`utils/agentApi.ts`):
```typescript
export const agentApi = {
  sendPrompt: (prompt: string) =>
    axios.post('/api/agent/chat', { prompt }),

  getDrafts: () =>
    axios.get('/api/agent/drafts'),

  confirmDraft: (draftId: number) =>
    axios.post(`/api/agent/drafts/${draftId}/confirm`),

  declineDraft: (draftId: number) =>
    axios.delete(`/api/agent/drafts/${draftId}`)
};
```

**Configuration**:
```env
CHATKIT_ENABLED=true                        # Enable AI assistant
CHATKIT_AGENT_ID=<agent-id>                 # ChatKit agent identifier
AGENT_API_BASE=http://localhost:4005        # Agent proxy URL
```

**Draft Action Workflow**:
1. User sends prompt (e.g., "close my highest priority work order")
2. AI agent proposes draft action
3. Draft appears in ChatDock with summary
4. User confirms or declines draft
5. On confirmation, action executes via API
6. Chat displays result

**Tool Invocation Display**:
Shows real-time status of AI agent tool calls:
- Tool name (e.g., "get_work_orders", "update_work_order")
- Status (success/pending/error)
- Result count or error message

**TypeScript Types** (`types/agentChat.ts`):
```typescript
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentDraftAction {
  id: number;
  agentSessionId: string;
  operationType: string;
  payload: string;              // JSON with summary and data
  status: 'pending' | 'confirmed' | 'declined';
  createdAt: string;
}

interface ToolInvocation {
  toolName: string;
  status: 'success' | 'pending' | 'error';
  resultCount?: number;
  arguments?: Record<string, unknown>;
}
```

## Google Services Integration

### Google Maps

**Configuration**: `GOOGLE_KEY` environment variable

**Features**:
- Location selection on map
- Geocoding (address → coordinates)
- Marker placement
- Interactive maps for locations and assets

**Usage**:
```typescript
<GoogleMap
  center={{ lat: location.latitude, lng: location.longitude }}
  zoom={15}
  onClick={handleMapClick}
>
  <Marker position={{ lat, lng }} />
</GoogleMap>
```

### Google Analytics

**Configuration**: `GOOGLE_TRACKING_ID` environment variable

**Library**: react-ga4

**Tracking**:
- Page views
- User interactions
- Custom events

## Build & Deployment

### Development Build

```bash
cd frontend
npm install
npm start
```

**Dev Server**: http://localhost:3000
**Hot Reload**: Enabled
**Source Maps**: Enabled

### Production Build

```bash
npm run build
```

**Output**: `frontend/build/`
**Optimizations**:
- Code minification
- Tree shaking
- Bundle splitting
- Asset optimization

### Docker Deployment

**Dockerfile**: `frontend/Dockerfile`

**Build Process**:
1. Multi-stage build
2. React app built in Node container
3. Served via nginx
4. Runtime environment variables injected

**Nginx Configuration**: `frontend/nginx-custom.conf`

## Code Quality

### Linting

**ESLint Configuration**: `frontend/.eslintrc.json`

**Rules**:
- Airbnb TypeScript style guide
- Prettier integration
- React hooks rules
- Accessibility rules (jsx-a11y)

**Run Linter**:
```bash
npm run lint
npm run lint:fix
```

### Formatting

**Prettier Configuration**: `frontend/.prettierrc`

**Run Formatter**:
```bash
npm run format
```

### Git Hooks

**Husky** pre-commit hook:
- Runs linter on staged files
- Formats code automatically
- Prevents commits with errors

**Configuration**: `frontend/.husky/`

### Commit Conventions

**Commitlint** enforces conventional commits:
- `feat: Add new feature`
- `fix: Fix bug`
- `docs: Update documentation`
- `style: Code formatting`
- `refactor: Code refactoring`
- `test: Add tests`
- `chore: Maintenance tasks`

## Performance Optimization

### Code Splitting

React.lazy() for route-based code splitting:
```typescript
const WorkOrders = React.lazy(() => import('./content/work-orders'));

<Suspense fallback={<Loader />}>
  <WorkOrders />
</Suspense>
```

### Memoization

**React.memo** for expensive components:
```typescript
export default React.memo(WorkOrderCard);
```

**useMemo** for expensive calculations:
```typescript
const sortedWorkOrders = useMemo(
  () => workOrders.sort((a, b) => a.priority - b.priority),
  [workOrders]
);
```

### Bundle Analysis

Analyze bundle size:
```bash
npm run build
source-map-explorer build/static/js/*.js
```

## PWA Support

**Service Worker**: `frontend/src/serviceWorker.ts`

**Features**:
- Offline functionality
- App installation
- Background sync
- Push notifications

**Manifest**: `frontend/public/manifest.json`
