# QuickChat Frontend

A modern real-time chat application frontend built with Angular 19, featuring a clean and responsive UI with real-time messaging capabilities.

## Features

- **Real-time messaging** via Socket.IO
- **User authentication** with JWT tokens
- **Private and group chats**
- **Typing indicators**
- **Online/offline status**
- **File uploads** (images, videos, audio, documents)
- **Voice message recording**
- **Message reactions, editing, and deletion**
- **Message search**
- **Responsive design** for mobile and desktop
- **Dark/Light theme support**
- **Emoji picker**
- **Video call integration**

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Angular CLI (v19 or higher)

## Installation

1. Clone the repository and navigate to the frontend directory:

```bash
cd "QuickChat frontend/client"
```

2. Install dependencies:

```bash
npm install
```

3. Install Angular CLI globally (if not already installed):

```bash
npm install -g @angular/cli
```

## Running the Application

### Development Mode

```bash
npm start
```

The application will start on `http://localhost:4200` and automatically open in your browser.

### Build for Production

```bash
npm run build
```

The build artifacts will be stored in the `dist/client/browser/` directory.

### Watch Mode

```bash
npm run watch
```

This will build the application and watch for changes.

## Project Structure

```
src/
├── app/
│   ├── core/                    # Core functionality
│   │   ├── guards/             # Route guards
│   │   ├── interceptors/       # HTTP interceptors
│   │   ├── interfaces/         # TypeScript interfaces
│   │   ├── pipes/             # Custom pipes
│   │   └── services/          # Core services
│   ├── layouts/               # Layout components
│   │   ├── auth-layout/       # Authentication layout
│   │   └── main-layout/       # Main application layout
│   ├── pages/                 # Page components
│   │   ├── auth/              # Authentication pages
│   │   └── features/          # Feature pages
│   │       ├── chat/          # Chat functionality
│   │       ├── groups/        # Group management
│   │       ├── header/        # Header component
│   │       ├── profile/       # User profile
│   │       └── settings/      # Settings page
│   └── shared/                # Shared components
│       ├── components/        # Reusable components
│       └── directives/        # Custom directives
├── environments/              # Environment configurations
├── styles/                    # Global styles
└── utils/                     # Utility functions
    ├── file.utils.ts         # File operations and formatting
    ├── message.utils.ts      # Message formatting and grouping
    └── constants.utils.ts    # Application constants
```

## Key Components

### Chat Components

- **ChatComponent** - Main chat container
- **ChatWindowComponent** - Chat window with message display
- **ChatSidebarComponent** - Sidebar with user/group lists

### Services

- **SocketService** - Handles real-time communication
- **ChatService** - Manages chat functionality
- **AuthService** - Handles authentication
- **GroupService** - Manages group operations

### Shared Components

- **FileUploadComponent** - File upload functionality
- **VoiceRecorderComponent** - Voice message recording
- **VideoCallComponent** - Video call integration
- **ThemeSelectorComponent** - Theme switching

## Environment Configuration

The application uses environment files for configuration:

### Development (`src/environments/environment.ts`)

```typescript
export const environment = {
  production: false,
  apiUrl: "http://localhost:3000/api",
  socketUrl: "http://localhost:3000",
};
```

### Production (`src/environments/environment.prod.ts`)

```typescript
export const environment = {
  production: true,
  apiUrl: "https://your-api-domain.com/api",
  socketUrl: "https://your-api-domain.com",
};
```

## Socket.IO Integration

The application uses Socket.IO for real-time communication:

### Connection Setup

```typescript
// Socket service automatically connects on initialization
this.socket = io("http://localhost:3000", {
  auth: { token: authToken },
  transports: ["websocket", "polling"],
});
```

### Event Handling

- **Message Events**: `message_received`, `message_updated`, `message_deleted`
- **Typing Events**: `user_typing`, `user_stopped_typing`
- **Status Events**: `user_online`, `user_offline`, `online_users`
- **Room Events**: `join_room`, `leave_room`

## State Management

The application uses Angular signals for reactive state management:

```typescript
// Example: Message state
public messages = signal<Message[]>([]);
public typingUsers = signal<any[]>([]);
public isTyping = signal(false);
```

## Styling

The application uses:

- **SCSS** for styling
- **PrimeNG** components for UI elements
- **Responsive design** with CSS Grid and Flexbox
- **Theme support** with CSS custom properties

## File Upload

Supports multiple file types:

- **Images**: jpg, png, gif, webp
- **Videos**: mp4, webm, avi, mov
- **Audio**: mp3, wav, webm, m4a
- **Documents**: pdf, doc, docx, xls, xlsx, ppt, pptx, txt, zip, rar

Files are converted to base64 and sent via Socket.IO. The backend automatically uploads files to Cloudinary and creates messages in real-time.

## Video Calls

The application supports peer-to-peer video calls using WebRTC:

- **WebRTC** for peer-to-peer connections
- **Socket.IO** for signaling
- **STUN servers** for NAT traversal
- **Real-time audio/video** streaming
- **Mute/unmute** and **video on/off** controls
- **Group video calls** support

Video calls require camera and microphone permissions from the browser.

## Voice Recording

Voice messages are recorded using the Web Audio API:

- Real-time recording with visual feedback
- Automatic upload after recording
- Support for multiple audio formats

## Testing

Run unit tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Linting

The project uses ESLint for code quality:

```bash
npm run lint
```

## Building and Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Vercel

The project includes `vercel.json` for easy deployment to Vercel:

```bash
vercel --prod
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance Optimizations

- **OnPush change detection** for better performance
- **Lazy loading** for routes
- **Tree shaking** for smaller bundle sizes
- **Image optimization** for faster loading
- **Message virtualization** for large chat histories

## Security Features

- **JWT token authentication**
- **HTTP interceptors** for automatic token handling
- **Route guards** for protected routes
- **XSS protection** with Angular's built-in sanitization
- **CSRF protection** via HTTP-only cookies

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License
