# Claude Instructions for Squirrel2 Development

## 🏗️ Architecture Overview

### Technology Stack
- **iOS App**: SwiftUI + MVVM pattern
- **Backend**: Node.js API (Vercel deployment)
- **Database**: Firebase Firestore
- **Real-time**: Firestore snapshot listeners
- **Authentication**: Firebase Auth
- **AI Integration**: Dual approach - Voice (WebRTC) & Chat (SwiftOpenAI)

### Hybrid Architecture Approach
We use a flexible, pragmatic approach that combines the best of both worlds:

1. **Backend API** (`https://backend-sigma-drab.vercel.app`)
   - All WRITE operations (create, update, delete)
   - Complex business logic and validation
   - Data aggregation and processing
   - Security-critical operations

2. **Firebase Direct Access** (iOS App)
   - READ operations via Firestore snapshot listeners
   - Real-time updates for live UI
   - Authentication state management
   - Optimistic UI updates

This hybrid approach provides:
- ✅ Real-time updates without polling
- ✅ Security through backend validation
- ✅ Reduced latency for reads
- ✅ Centralized business logic
- ✅ Scalable architecture

### Real-time Updates Pattern
```swift
// ✅ CORRECT - Use Firestore snapshots for READING data (real-time updates)
db.collection("collections")
    .whereField("userId", isEqualTo: userId)
    .addSnapshotListener { snapshot, error in
        // Handle real-time updates
    }

// ✅ CORRECT - Use backend API for WRITING data (create, update, delete)
let token = try await user.getIDToken()
guard let url = URL(string: "\(AppConfig.apiBaseURL)/collections") else { return }
var request = URLRequest(url: url)
request.httpMethod = "POST" // or PUT, DELETE
request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
// ... make request
```

### Backend-First Development for Write Operations
When implementing any feature that modifies data:
1. First check `/backend/src/routes/` for existing endpoints
2. If endpoint doesn't exist, create it in the backend
3. Test the endpoint with proper authentication
4. Only then implement the iOS client code

### Correct Pattern
```swift
// ✅ CORRECT - Use backend API
// ⚠️ IMPORTANT: AppConfig.apiBaseURL already includes "/api" prefix!
let token = try await user.getIDToken()
guard let url = URL(string: "\(AppConfig.apiBaseURL)/collections") else { return }
// This creates: https://backend-sigma-drab.vercel.app/api/collections
var request = URLRequest(url: url)
request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
// ... make request
```

### Common Mistakes to Avoid
```swift
// ❌ WRONG - This creates /api/api/collections (double /api)
URL(string: "\(AppConfig.apiBaseURL)/api/collections")

// ✅ CORRECT - apiBaseURL already has /api
URL(string: "\(AppConfig.apiBaseURL)/collections")

// ❌ NEVER DO THIS - Direct Firestore access
db.collection("anything").document(id).setData(data)
```

## Project Structure

```
Squirrel2/
├── backend/                    # Node.js backend (Vercel)
│   ├── src/
│   │   ├── routes/            # API endpoints - CHECK HERE FIRST
│   │   ├── models/            # Data models
│   │   └── middleware/        # Auth & validation
│   └── api/                   # Vercel deployment
├── Squirrel2/                 # iOS app (SwiftUI + MVVM)
│   ├── Models/                # Data models & structs
│   ├── Views/                 # SwiftUI views (UI only)
│   ├── ViewModels/            # ViewModels (business logic & data)
│   ├── Services/              # API & Firebase services
│   └── Config/                # App configuration
└── docs/                      # Documentation
```

## iOS App Architecture (MVVM)

### ViewModels Pattern
All views that need data should use ViewModels:

```swift
// ViewModel handles data and business logic
@MainActor
class CollectionsViewModel: ObservableObject {
    @Published var collections: [Collection] = []
    @Published var isLoading = true
    
    private var listener: ListenerRegistration?
    
    func startListening(userId: String) {
        // Set up Firestore snapshot listener
    }
    
    func stopListening() {
        listener?.remove()
    }
}

// View handles UI only
struct CollectionsView: View {
    @StateObject private var viewModel = CollectionsViewModel()
    
    var body: some View {
        // Pure UI code, uses viewModel.collections
    }
}
```

### Key MVVM Principles
1. **Views**: UI only, no business logic
2. **ViewModels**: Data fetching, state management, business logic
3. **Models**: Pure data structures
4. **Services**: Reusable API/Firebase operations

## AI Integration Architecture

We use a **dual-approach architecture** for AI interactions, optimized for different use cases:

### 1. Voice Mode (VoiceAIManager)
- **Technology**: OpenAI Realtime API via WebRTC
- **Communication**: WebSocket + WebRTC data channels
- **Audio**: Real-time bidirectional audio streaming
- **Authentication**: Ephemeral tokens from backend
- **Functions**: Executed on backend, results sent back
- **Use Case**: Low-latency voice conversations

```swift
// Voice mode initialization
await VoiceAIManager.shared.initialize(withChatHistory: messages, conversationId: id)
VoiceAIManager.shared.setSharedChatViewModel(chatViewModel)
```

### 2. Chat Mode (ConversationViewModel + Backend Proxy)
- **Technology**: Backend SSE bridge to OpenAI chat completions
- **Library**: Native `URLSession` async SSE reader
- **Communication**: Client ↔️ Backend only (server holds OpenAI key)
- **Authentication**: Firebase ID token on every request
- **Use Case**: Text-based chat with streaming responses

### Why Two Approaches?

1. **Voice Mode** requires:
   - Ultra-low latency (< 300ms)
   - Bidirectional audio streaming
   - WebRTC for optimal performance
   - Backend routing for security

2. **Chat Mode** benefits from:
   - Single backend integration point
   - No API keys on device
   - Consistent logging/error handling
   - Reusable across platforms

### Message Persistence
Both modes persist messages through the same backend API:
- Ensures consistency across modes
- Single source of truth in Firestore
- Seamless switching between voice and chat

## Available Backend Endpoints

See `BACKEND_API_GUIDELINES.md` for full list. Key endpoints:
- `/api/conversations` - Conversation management
- `/api/messages` - Message operations
- `/api/tasks` - Task management
- `/api/spaces` - Space operations
- `/api/realtime/token` - Voice mode ephemeral tokens
- `/api/ai/chat/stream` - Chat streaming (backup)

## Testing & Building

**IMPORTANT**: Do NOT attempt to build the iOS app yourself. The user will handle building and will report any build errors that need to be fixed.

## Backend Deployment

**IMPORTANT**: Vercel is connected to the Git repository and automatically deploys when you push to GitHub.

For backend changes:
```bash
# Just commit and push - Vercel will auto-deploy!
git add .
git commit -m "Backend updates"
git push
```

⚠️ **DO NOT USE `vercel --prod`**: This is unnecessary and creates deployment conflicts. Vercel automatically deploys from the Git repository when you push changes.

## Firestore Security Rules

**IMPORTANT**: After modifying `firestore.rules`, always deploy them:
```bash
firebase deploy --only firestore:rules
```

Common permission errors ("Missing or insufficient permissions") are usually fixed by:
1. Checking that the collection is listed in `firestore.rules`
2. Ensuring authenticated users can read (at minimum)
3. Deploying the rules after any changes

Current collections that need rules:
- `users`, `conversations`, `messages`, `tasks`, `collections`, `entries`, `spaces`

## Key Development Principles

### 1. Security & Data Flow
- **WRITES** go through backend API (validation, business logic)
- **READS** use Firestore snapshots (real-time updates)
- **AUTH** always verify user tokens in backend
- **VALIDATION** happens in backend, not iOS

### 2. Code Organization (MVVM)
- **Views** = UI only, no business logic
- **ViewModels** = Data management, state, listeners
- **Models** = Pure data structures (Codable)
- **Services** = Reusable API/Firebase operations

### 3. Real-time Updates
```swift
// In ViewModel
private var listener: ListenerRegistration?

func startListening(userId: String) {
    listener = db.collection("items")
        .whereField("userId", isEqualTo: userId)
        .addSnapshotListener { [weak self] snapshot, error in
            // Handle updates
        }
}

func stopListening() {
    listener?.remove()
}
```

### 4. Backend Operations
```swift
// For WRITE operations - use backend API
let token = try await user.getIDToken()
guard let url = URL(string: "\(AppConfig.apiBaseURL)/collections") else { return }
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
```

## When Working on Features

### For NEW Features:
1. **Determine** if it needs real-time updates
2. **Create** ViewModel if handling data
3. **Check** backend routes for existing endpoints
4. **Create** backend endpoint for write operations
5. **Implement** Firestore listener for reads (if real-time needed)
6. **Test** both online and offline scenarios

### For EXISTING Features:
1. **Check** if ViewModel exists
2. **Review** current data flow pattern
3. **Maintain** consistency with existing approach
4. **Update** CLAUDE.md if patterns change

## Common Patterns

### Creating a New View with Data:
1. Create Model (if needed)
2. Create ViewModel with Firestore listener
3. Create View using ViewModel
4. Add backend endpoint for modifications

### Adding Real-time Updates:
1. Add Firestore listener in ViewModel
2. Use `@Published` properties
3. Clean up in `stopListening()`
4. Handle errors gracefully

## UI & Styling Preferences

### Use Actual Numbers, Not Design System Tokens
When writing SwiftUI code, prefer explicit numeric values over design system spacing/sizing tokens:

```swift
// ❌ AVOID - Design system tokens hide the actual values
.padding(S2.Spacing.lg)
.cornerRadius(S2.CornerRadius.md)

// ✅ PREFER - Actual numbers are clearer
.padding(12)
.cornerRadius(16)
```

This makes it easier to see and adjust values during development.

## Remember

> "Backend for writes, Firebase for reads, ViewModels for logic, Views for UI"

This flexible approach gives us:
- 🚀 Real-time updates
- 🔒 Secure write operations  
- 🧪 Testable code
- 🎯 Clear separation of concerns
- 📱 Responsive UI
