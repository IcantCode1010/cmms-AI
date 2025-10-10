# Mobile Application Architecture

## Technology Stack

### Core Framework
- **Framework**: React Native 0.71.3
- **Platform**: Expo 48.0.0 (managed workflow with dev client)
- **Language**: TypeScript 4.9.4
- **Runtime**: React 18.2.0

### State Management
- **Redux Toolkit**: @reduxjs/toolkit 1.9.3
- **React Redux**: react-redux 8.0.5
- **Redux Persist**: redux-persist 6.0.0 (offline persistence)
- **Redux Thunk**: redux-thunk 2.4.2

### Navigation
- **React Navigation**: @react-navigation/native 6.0.2
- **Stack Navigator**: @react-navigation/native-stack 6.1.0
- **Bottom Tabs**: @react-navigation/bottom-tabs 6.0.5

### UI Components
- **React Native Paper**: react-native-paper 5.9.1 (Material Design)
- **Vector Icons**: react-native-vector-icons 9.2.0
- **Expo Vector Icons**: @expo/vector-icons 13.0.0

### Forms & Validation
- **Formik**: formik 2.2.9
- **Yup**: yup 1.0.0

### Real-Time Communication
- **WebSocket**: @stomp/stompjs 7.0.0
- **SockJS**: sockjs-client 1.6.1
- **Text Encoding**: text-encoding 0.7.0 (polyfill)
- **URL Polyfill**: react-native-url-polyfill 2.0.0

### Device Features
- **Camera**: expo-image-picker 14.1.1
- **Barcode Scanner**: expo-barcode-scanner 12.3.2
- **Document Picker**: expo-document-picker 11.2.2
- **Notifications**: expo-notifications 0.18.1
- **NFC**: react-native-nfc-manager 3.14.7
- **Date/Time Picker**: @react-native-community/datetimepicker 6.7.3

### Storage & Files
- **Async Storage**: @react-native-async-storage/async-storage 2.1.2
- **File System**: react-native-fs 2.20.0

### Authentication
- **JWT**: react-native-pure-jwt 3.0.2
- **Base64**: base-64 1.0.0

### Networking
- **Network Info**: @react-native-community/netinfo 9.3.7

### Analytics
- **Firebase Analytics**: @react-native-firebase/analytics 17.4.0
- **Firebase App**: @react-native-firebase/app 17.4.0

### Other Features
- **Flash Messages**: react-native-flash-message 0.4.1
- **Modal**: react-native-modal-datetime-picker 14.0.1
- **Image Viewer**: react-native-image-viewing 0.2.2
- **WebView**: react-native-webview 11.26.0
- **Dropdown**: react-native-dropdown-picker 5.4.4
- **Action Sheet**: react-native-actions-sheet 0.8.21

### Internationalization
- **i18next**: i18next 22.4.10
- **React i18next**: react-i18next 12.2.0

## Application Structure

### Directory Structure

```
mobile/
├── App.tsx                    # Root component
├── index.js                   # Entry point
├── app.config.ts              # Expo configuration
├── config.ts                  # App configuration
│
├── components/                # Reusable UI components
│   ├── buttons/
│   ├── forms/
│   ├── cards/
│   └── ...
│
├── screens/                   # Screen components
│   ├── auth/                 # Authentication screens
│   │   ├── LoginScreen.tsx
│   │   ├── SignupScreen.tsx
│   │   └── ForgotPasswordScreen.tsx
│   ├── workOrders/           # Work order screens
│   │   ├── WorkOrderListScreen.tsx
│   │   ├── WorkOrderDetailScreen.tsx
│   │   └── CreateWorkOrderScreen.tsx
│   ├── assets/               # Asset screens
│   ├── locations/            # Location screens
│   ├── inventory/            # Parts & inventory screens
│   └── settings/             # Settings screens
│
├── navigation/                # Navigation configuration
│   ├── AppNavigator.tsx      # Main navigator
│   ├── AuthNavigator.tsx     # Auth flow navigator
│   └── MainTabNavigator.tsx  # Bottom tab navigator
│
├── contexts/                  # React Context providers
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
│
├── hooks/                     # Custom React hooks
│   ├── useAuth.ts
│   ├── usePermissions.ts
│   └── useNetwork.ts
│
├── slices/                    # Redux Toolkit slices
│   ├── authSlice.ts
│   ├── workOrderSlice.ts
│   ├── assetSlice.ts
│   └── ...
│
├── store/                     # Redux store configuration
│   └── index.ts
│
├── models/                    # TypeScript interfaces
│   ├── User.ts
│   ├── WorkOrder.ts
│   ├── Asset.ts
│   └── ...
│
├── utils/                     # Helper utilities
│   ├── api.ts
│   ├── storage.ts
│   └── permissions.ts
│
├── i18n/                      # Internationalization
│   └── i18n.ts
│
├── constants/                 # Constants & config
│   ├── Colors.ts
│   ├── Layout.ts
│   └── ...
│
├── assets/                    # Static assets
│   ├── images/
│   ├── fonts/
│   └── icons/
│
└── android/                   # Android native project
    └── ios/                   # iOS native project (if built)
```

## Expo Configuration

### App Configuration

**File**: `mobile/app.config.ts`

**Key Settings**:
```typescript
export default {
  name: 'Atlas CMMS',
  slug: 'atlas-cmms',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  updates: {
    fallbackToCacheTimeout: 0
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.atlas.cmms'
  },
  android: {
    package: 'com.atlas.cmms',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF'
    },
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'ACCESS_FINE_LOCATION',
      'NFC'
    ]
  }
};
```

### EAS Build Configuration

**File**: `mobile/eas.json`

**Build Profiles**:
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

## Navigation Architecture

### Navigation Stack

**Main Navigator** (`AppNavigator.tsx`):
```
App
├── Auth Stack (not authenticated)
│   ├── Login
│   ├── Signup
│   └── Forgot Password
│
└── Main Tabs (authenticated)
    ├── Home Tab
    │   ├── Dashboard
    │   └── Analytics
    ├── Work Orders Tab
    │   ├── Work Order List
    │   ├── Work Order Detail
    │   └── Create Work Order
    ├── Assets Tab
    │   ├── Asset List
    │   ├── Asset Detail
    │   └── QR Scanner
    ├── Requests Tab
    │   ├── Request List
    │   └── Create Request
    └── Profile Tab
        ├── Profile
        ├── Settings
        └── Logout
```

### Bottom Tab Navigator

**Icons**: Material Design icons from `react-native-vector-icons`

**Tabs**:
- 🏠 Home
- 🔧 Work Orders
- 📦 Assets
- 📝 Requests
- 👤 Profile

### Navigation Guards

**Authentication Check**:
```typescript
function AppNavigator() {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <MainTabNavigator /> : <AuthNavigator />;
}
```

## Backend Integration

### API Configuration

**File**: `mobile/config.ts`

**Backend URL**:
```typescript
export const API_URL = process.env.API_URL || 'http://localhost:8080';
```

**Important**: For local development, use your computer's IP address (not localhost):
```typescript
export const API_URL = 'http://192.168.1.10:8080';
```

### API Service Layer

**File**: `mobile/utils/api.ts`

**Axios Instance**:
```typescript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Request interceptor - add JWT token
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Token expired, logout
      AsyncStorage.removeItem('token');
      // Navigate to login
    }
    return Promise.reject(error);
  }
);

export default api;
```

## Authentication & Authorization

### Authentication Flow

#### JWT-Based Login

**Login Screen** (`screens/auth/LoginScreen.tsx`):
```typescript
const handleLogin = async (email, password) => {
  try {
    const { data } = await api.post('/auth/signin', { email, password });

    // Store token
    await AsyncStorage.setItem('token', data.accessToken);

    // Store user data
    await AsyncStorage.setItem('user', JSON.stringify(data.user));

    // Update Redux state
    dispatch(setUser(data.user));
    dispatch(setAuthenticated(true));
  } catch (error) {
    showError('Invalid credentials');
  }
};
```

#### Token Persistence

**Using AsyncStorage**:
```typescript
// Save token
await AsyncStorage.setItem('token', token);

// Retrieve token
const token = await AsyncStorage.getItem('token');

// Remove token (logout)
await AsyncStorage.removeItem('token');
```

**Using Redux Persist**:
```typescript
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'settings'], // Persist auth and settings slices
};

const persistedReducer = persistReducer(persistConfig, rootReducer);
```

### Permission System

**Hook**: `usePermissions`

```typescript
const { hasPermission } = usePermissions();

// Check permission before rendering
{hasPermission('WORK_ORDER', 'CREATE') && (
  <Button onPress={createWorkOrder}>New Work Order</Button>
)}
```

## State Management

### Redux Store

**File**: `mobile/store/index.ts`

**Configuration**:
```typescript
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'settings'],
};

const store = configureStore({
  reducer: persistReducer(persistConfig, rootReducer),
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Required for redux-persist
    }),
});

export const persistor = persistStore(store);
export default store;
```

### Redux Slices

**Auth Slice Example**:
```typescript
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password }) => {
    const response = await api.post('/auth/signin', { email, password });
    await AsyncStorage.setItem('token', response.data.accessToken);
    return response.data;
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      AsyncStorage.removeItem('token');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.token = action.payload.accessToken;
        state.isAuthenticated = true;
        state.loading = false;
      })
      .addCase(loginUser.rejected, (state) => {
        state.loading = false;
      });
  },
});
```

## Device Features

### Camera & Image Picker

**Usage**:
```typescript
import * as ImagePicker from 'expo-image-picker';

const pickImage = async () => {
  // Request permissions
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    alert('Camera permission required');
    return;
  }

  // Pick image
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8,
  });

  if (!result.canceled) {
    uploadImage(result.assets[0]);
  }
};

const takePhoto = async () => {
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.8,
  });

  if (!result.canceled) {
    uploadImage(result.assets[0]);
  }
};
```

### Barcode/QR Code Scanner

**Usage**:
```typescript
import { BarCodeScanner } from 'expo-barcode-scanner';

function ScannerScreen() {
  const [hasPermission, setHasPermission] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = ({ type, data }) => {
    // data contains the scanned QR code/barcode value
    // Use it to look up asset or work order
    fetchAssetByQRCode(data);
  };

  return (
    <BarCodeScanner
      onBarCodeScanned={handleBarCodeScanned}
      style={StyleSheet.absoluteFillObject}
    />
  );
}
```

### Push Notifications

**Configuration**:
```typescript
import * as Notifications from 'expo-notifications';

// Request permissions
const { status } = await Notifications.requestPermissionsAsync();

// Get push token
const token = await Notifications.getExpoPushTokenAsync();

// Send token to backend
await api.post('/users/push-token', { token: token.data });

// Handle incoming notifications
Notifications.addNotificationReceivedListener(notification => {
  console.log('Notification received:', notification);
});

// Handle notification tap
Notifications.addNotificationResponseReceivedListener(response => {
  // Navigate to relevant screen
  const workOrderId = response.notification.request.content.data.workOrderId;
  navigation.navigate('WorkOrderDetail', { id: workOrderId });
});
```

**Backend Integration**:
Backend uses `expo-server-sdk` to send push notifications to registered devices.

### NFC Reader

**Usage** (Android only):
```typescript
import NfcManager, { NfcTech } from 'react-native-nfc-manager';

async function readNfc() {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    console.log('NFC Tag:', tag);
    // Use tag ID to identify asset
  } catch (error) {
    console.error('NFC Error:', error);
  } finally {
    NfcManager.cancelTechnologyRequest();
  }
}
```

### Network Status

**Usage**:
```typescript
import NetInfo from '@react-native-community/netinfo';

// Subscribe to network state changes
const unsubscribe = NetInfo.addEventListener(state => {
  console.log('Connected:', state.isConnected);
  console.log('Internet reachable:', state.isInternetReachable);

  if (!state.isConnected) {
    showOfflineMessage();
  }
});

// Unsubscribe
unsubscribe();
```

## Offline Support

### Redux Persist

**Automatic State Persistence**:
- Auth state (user, token)
- Settings (language, theme)
- Recently viewed items

**Configuration**:
```typescript
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'settings', 'cache'],
};
```

### Offline Queue

**Pattern**: Queue API requests when offline, sync when online

```typescript
const queuedRequests = [];

async function makeRequest(config) {
  const isOnline = await NetInfo.fetch().then(state => state.isConnected);

  if (isOnline) {
    return api.request(config);
  } else {
    // Queue for later
    queuedRequests.push(config);
    await AsyncStorage.setItem('queuedRequests', JSON.stringify(queuedRequests));
    throw new Error('Offline - request queued');
  }
}

// When coming back online
NetInfo.addEventListener(state => {
  if (state.isConnected) {
    syncQueuedRequests();
  }
});
```

## Real-Time Features

### WebSocket Integration

**Connection Setup**:
```typescript
import { Client } from '@stomp/stompjs';
import 'text-encoding';  // Required polyfill
import 'react-native-url-polyfill/auto';

const client = new Client({
  brokerURL: `ws://${API_URL.replace('http://', '')}/ws`,
  connectHeaders: {
    Authorization: `Bearer ${token}`
  },
  onConnect: () => {
    // Subscribe to notifications
    client.subscribe('/topic/notifications', message => {
      const notification = JSON.parse(message.body);
      showNotification(notification);
    });

    // Subscribe to work order updates
    client.subscribe('/user/queue/updates', message => {
      const update = JSON.parse(message.body);
      dispatch(updateWorkOrder(update));
    });
  },
  onStompError: (frame) => {
    console.error('STOMP error:', frame);
  }
});

client.activate();
```

## UI Components & Theming

### React Native Paper

**Theme Configuration**:
```typescript
import { Provider as PaperProvider } from 'react-native-paper';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#EE4B2B',
    accent: '#6E759F',
  },
};

function App() {
  return (
    <PaperProvider theme={theme}>
      <AppNavigator />
    </PaperProvider>
  );
}
```

**Components**:
- `Button`, `IconButton`, `FAB`
- `TextInput`
- `Card`
- `List`, `DataTable`
- `Dialog`, `Portal`
- `Snackbar`
- `ActivityIndicator`

### Custom Theme Provider

**White-labeling support** via custom colors from backend:
```typescript
const customColors = await fetchBrandColors();

const theme = {
  colors: {
    primary: customColors.primary,
    secondary: customColors.secondary,
    // ...
  }
};
```

## Forms & Validation

### Formik Integration

**Example**:
```typescript
import { Formik } from 'formik';
import * as Yup from 'yup';
import { TextInput, Button } from 'react-native-paper';

const validationSchema = Yup.object({
  title: Yup.string().required('Title is required'),
  description: Yup.string(),
  priority: Yup.string().oneOf(['LOW', 'MEDIUM', 'HIGH']),
});

function CreateWorkOrderScreen() {
  return (
    <Formik
      initialValues={{ title: '', description: '', priority: 'MEDIUM' }}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
    >
      {({ values, errors, touched, handleChange, handleBlur, handleSubmit }) => (
        <View>
          <TextInput
            label="Title"
            value={values.title}
            onChangeText={handleChange('title')}
            onBlur={handleBlur('title')}
            error={touched.title && errors.title}
          />
          {touched.title && errors.title && (
            <Text style={styles.error}>{errors.title}</Text>
          )}

          <Button mode="contained" onPress={handleSubmit}>
            Create
          </Button>
        </View>
      )}
    </Formik>
  );
}
```

## File Upload

**Implementation**:
```typescript
const uploadFile = async (uri) => {
  const formData = new FormData();
  formData.append('file', {
    uri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  });

  const response = await api.post('/files', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data; // { id, url }
};
```

## Internationalization

**Configuration**:
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: require('./locales/en.json') },
      es: { translation: require('./locales/es.json') },
      // ...
    },
    lng: 'en',
    fallbackLng: 'en',
  });

export default i18n;
```

**Usage**:
```typescript
import { useTranslation } from 'react-i18next';

function Component() {
  const { t } = useTranslation();
  return <Text>{t('workOrders.title')}</Text>;
}
```

## Build & Deployment

### Development

```bash
cd mobile
npm install
npx expo start
```

**Run on Device**:
- Install Expo Go app on your device
- Scan QR code from terminal
- Or use `npx expo run:android` / `npx expo run:ios`

### Android Build (APK/AAB)

**Using EAS Build**:
```bash
npm install -g eas-cli
eas login
eas build --platform android --profile production
```

**Output**: APK or AAB file for distribution

### Play Store

**Live App**: https://play.google.com/store/apps/details?id=com.atlas.cmms

**Update Process**:
1. Increment version in `app.config.ts`
2. Build with EAS: `eas build --platform android`
3. Download AAB file
4. Upload to Google Play Console
5. Submit for review

### Over-the-Air (OTA) Updates

**Expo Updates** allows pushing updates without app store review:

```bash
eas update --branch production --message "Fix work order bug"
```

**Configuration**: `app.config.ts`
```typescript
updates: {
  url: 'https://u.expo.dev/[project-id]'
}
```

## Analytics

### Firebase Analytics

**Initialization**:
```typescript
import analytics from '@react-native-firebase/analytics';

// Track screen view
await analytics().logScreenView({
  screen_name: 'WorkOrderList',
  screen_class: 'WorkOrderListScreen',
});

// Track custom event
await analytics().logEvent('create_work_order', {
  priority: 'HIGH',
  asset_id: 123,
});
```

## Performance Optimization

### React Native Performance

**List Optimization** (FlatList):
```typescript
<FlatList
  data={workOrders}
  renderItem={renderItem}
  keyExtractor={item => item.id.toString()}
  initialNumToRender={10}
  maxToRenderPerBatch={10}
  windowSize={5}
  removeClippedSubviews={true}
/>
```

**Image Optimization**:
```typescript
<Image
  source={{ uri: imageUrl }}
  resizeMode="cover"
  style={{ width: 200, height: 200 }}
  // Cache image
  cachePolicy="memory-disk"
/>
```

### Bundle Size

**Remove unused code**:
- Tree shaking enabled by default in production builds
- Use Hermes JavaScript engine for faster startup (enabled by default)

## Platform-Specific Code

**Conditional Rendering**:
```typescript
import { Platform } from 'react-native';

{Platform.OS === 'ios' ? <IOSComponent /> : <AndroidComponent />}
```

**Platform-specific files**:
- `Component.ios.tsx`
- `Component.android.tsx`

## Debugging

### Expo Dev Tools

```bash
npx expo start
```

Then press:
- `j` - Open debugger
- `r` - Reload
- `m` - Toggle menu

### React Native Debugger

**Remote debugging**:
- Shake device → "Debug" option
- Opens Chrome DevTools
- Redux DevTools extension supported

### Logging

```typescript
console.log('Debug info:', data);
console.warn('Warning!');
console.error('Error!', error);
```

**Production logging**: Use a service like Sentry or Bugsnag

## Security Considerations

### Secure Storage

For sensitive data (not applicable here, but for reference):
```typescript
import * as SecureStore from 'expo-secure-store';

await SecureStore.setItemAsync('token', token);
const token = await SecureStore.getItemAsync('token');
```

### SSL Pinning

For additional security, implement SSL certificate pinning to prevent man-in-the-middle attacks.

### Code Obfuscation

Production builds are automatically minified and obfuscated.
