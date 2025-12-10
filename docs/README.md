# Squirrel2 - AI-Powered Task Management Platform

A comprehensive iOS application with real-time AI integration for intelligent task management and productivity enhancement.

## 🏗️ Architecture Overview

### Backend (Node.js + Express)
- **Hosting**: Vercel (Serverless Functions)
- **Database**: Firebase Firestore (NoSQL)
- **Authentication**: Firebase Auth (JWT tokens)
- **AI Integration**: OpenAI API (GPT-4 for chat, Realtime API for voice)
- **Real-time**: WebSocket + WebRTC for voice streaming
- **File Storage**: Firebase Storage
- **Rate Limiting**: Express rate limiter
- **Security**: Helmet.js, CORS configuration

### iOS App (SwiftUI + MVVM)
- **Minimum iOS**: 17.0
- **Architecture**: MVVM with Combine
- **UI Framework**: SwiftUI
- **Networking**: URLSession + Firebase SDK
- **AI Chat**: SwiftOpenAI library
- **Voice**: WebRTC with OpenAI Realtime API
- **State Management**: @StateObject, @EnvironmentObject

### Hybrid Data Architecture
- **Write Operations**: Through backend API (validation & security)
- **Read Operations**: Direct Firestore snapshots (real-time updates)
- **Authentication**: Firebase Auth with ID tokens

## 🚀 Getting Started

### Prerequisites
- **Xcode**: 15.0 or later
- **Node.js**: 18.0 or later
- **Vercel CLI**: `npm i -g vercel`
- **Firebase CLI**: `npm i -g firebase-tools`
- **Team Access**: Vercel team member account

### Backend Setup

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Variables**
   Create `.env` file in `backend/`:
   ```env
   OPENAI_API_KEY=sk-...
   FIREBASE_SERVICE_ACCOUNT='{...}' # JSON string
   NODE_ENV=development
   ```

3. **Local Development**
   ```bash
   npm run dev  # Starts on http://localhost:3000
   ```

### iOS App Setup

1. **Open in Xcode**
   ```bash
   open Squirrel2/Squirrel2.xcodeproj
   ```

2. **Configure Bundle ID**
   - Change bundle identifier to your company's
   - Update signing team

3. **Firebase Configuration**
   - Download `GoogleService-Info.plist` from Firebase Console
   - Replace existing file in Xcode project

4. **Build & Run**
   - Select target device/simulator
   - Press Cmd+R

## 📦 Deployment

### Backend Deployment (Vercel)

**For team members with Vercel access:**
```bash
cd backend
vercel --prod
# Select team scope when prompted
```

**Automatic deployment via GitHub:**
- Push to `main` branch triggers deployment
- GitHub Actions handles Vercel deployment

### iOS App Distribution

1. **TestFlight (Beta)**
   - Archive in Xcode (Product → Archive)
   - Upload to App Store Connect
   - Distribute to testers

2. **App Store (Production)**
   - Submit for review via App Store Connect
   - Ensure all app metadata is complete

## 🔑 API Endpoints

Base URL: `https://backend-sigma-drab.vercel.app/api`

### Core Endpoints
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id` - Get conversation
- `POST /api/messages` - Send message
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/collections` - Create collection
- `POST /api/entries` - Create entry
- `POST /api/spaces` - Create space
- `POST /api/realtime/token` - Get voice session token

### Authentication
All endpoints require Bearer token:
```javascript
headers: {
  'Authorization': 'Bearer ${firebaseIdToken}'
}
```

## 🛠️ Development Workflow

### Feature Development

1. **Backend Changes**
   - Create/modify endpoints in `backend/src/routes/`
   - Test locally with `npm run dev`
   - Deploy with `vercel --prod`

2. **iOS Changes**
   - Create/update ViewModels for business logic
   - Implement Views for UI
   - Use Services for API calls
   - Test on simulator and device

### Real-time Updates Pattern

```swift
// ViewModel with Firestore listener
class TasksViewModel: ObservableObject {
    @Published var tasks: [Task] = []
    private var listener: ListenerRegistration?

    func startListening(userId: String) {
        listener = db.collection("tasks")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { snapshot, error in
                // Update tasks array
            }
    }

    func stopListening() {
        listener?.remove()
    }
}
```

## 🔐 Security

### Firebase Rules
After modifying `firestore.rules`:
```bash
firebase deploy --only firestore:rules
```

### Environment Security
- Never commit `.env` files
- Use Vercel environment variables for production
- Rotate API keys regularly
- Use Firebase Auth for all user operations
- Enable rate limiting on sensitive endpoints

## 📱 Features

### Current Features
- ✅ AI-powered chat conversations
- ✅ Voice mode with real-time transcription
- ✅ Task management with categories
- ✅ Collections and entries organization
- ✅ Space-based content organization
- ✅ Real-time synchronization
- ✅ Offline support with sync
- ✅ Rich text formatting
- ✅ File attachments

### Upcoming Features
- 🚧 Collaborative spaces
- 🚧 Advanced AI task automation
- 🚧 Analytics dashboard
- 🚧 Third-party integrations
- 🚧 Apple Watch app

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test
```

### iOS Testing
- Unit tests: Cmd+U in Xcode
- UI tests: Separate test target
- Manual testing on various devices

## 📚 Documentation

- **Architecture**: See `CLAUDE.md` for detailed architecture decisions
- **API Docs**: See `backend/BACKEND_API_GUIDELINES.md`
- **Firebase Setup**: See `docs/firebase-setup.md`
- **iOS Guidelines**: See Xcode project README

## 🤝 Team Development

### Branch Strategy
- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: Individual features
- `bugfix/*`: Bug fixes
- `hotfix/*`: Urgent production fixes

### Code Review Process
1. Create feature branch
2. Make changes
3. Push and create PR
4. Request review from team
5. Merge after approval

### Commit Message Format
```
type(scope): description

[optional body]
[optional footer]
```
Types: feat, fix, docs, style, refactor, test, chore

## 🐛 Troubleshooting

### Common Issues

1. **"Missing or insufficient permissions" (Firestore)**
   - Update `firestore.rules`
   - Deploy with `firebase deploy --only firestore:rules`

2. **Backend API errors**
   - Check Vercel function logs
   - Verify environment variables
   - Ensure Firebase service account is valid

3. **Build failures (iOS)**
   - Clean build folder (Cmd+Shift+K)
   - Delete derived data
   - Update Swift package dependencies

4. **Voice mode not working**
   - Check WebRTC permissions
   - Verify ephemeral token generation
   - Ensure microphone access granted

## 📊 Monitoring

- **Backend Logs**: Vercel dashboard → Functions tab
- **Firebase Usage**: Firebase Console → Usage tab
- **Crash Reports**: App Store Connect → TestFlight
- **Performance**: Firebase Performance Monitoring

## 📞 Support

- **Internal**: Post in #squirrel2-dev Slack channel
- **Issues**: Create GitHub issue in company repo
- **Urgent**: Contact backend/iOS team leads directly
- **Documentation**: Check internal wiki

## 📄 License

Proprietary - [Company Name] Internal Use Only

---

**Last Updated**: January 2025
**Version**: 2.0.0
**Maintainers**: iOS Team, Backend Team
