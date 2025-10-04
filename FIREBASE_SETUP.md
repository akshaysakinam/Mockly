# Firebase Setup Guide

## 🔧 Firebase Configuration

### 1. Firebase Project Setup

1. **Create Firebase Project**:
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Click "Create a project"
   - Enter project name: `mockly-a4b1f`
   - Enable Google Analytics (optional)

2. **Enable Authentication**:
   - Go to Authentication → Sign-in method
   - Enable "Email/Password" provider
   - Save changes

3. **Create Firestore Database**:
   - Go to Firestore Database
   - Click "Create database"
   - Choose "Start in test mode" (for development)
   - Select a location (choose closest to your users)

### 2. Service Account Setup

1. **Generate Service Account Key**:
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download the JSON file
   - Extract the values for your `.env.local`

2. **Required Values**:
   ```env
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_CLIENT_EMAIL=your_service_account_email
   FIREBASE_PRIVATE_KEY=your_private_key
   ```

### 3. Client Configuration

1. **Get Web App Config**:
   - Go to Project Settings → General
   - Scroll to "Your apps" section
   - Click "Add app" → Web app
   - Register app with nickname
   - Copy the config values

2. **Environment Variables**:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

## 🗄️ Firestore Security Rules

### Development Rules (Test Mode)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### Production Rules (Recommended)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /completed_interviews/{interviewId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // Allow users to create new interviews
    match /completed_interviews/{interviewId} {
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

## 🔍 Testing Firebase Connection

### 1. Test Authentication
```bash
# Start development server
npm run dev

# Navigate to http://localhost:3000
# Try signing up with a test email
```

### 2. Test Firestore
```bash
# Check browser console for any Firebase errors
# Verify data is being saved to Firestore
```

### 3. Verify Environment Variables
```bash
# Check if all environment variables are loaded
curl http://localhost:3000/api/test-voice-integration
```

## 🚨 Common Issues & Solutions

### Issue 1: Firebase Index Required
**Error**: `FAILED_PRECONDITION: The query requires an index`

**Solution**: The application uses client-side sorting to avoid index requirements.

### Issue 2: Authentication Not Working
**Check**:
- Environment variables are correctly set
- Firebase project has Authentication enabled
- Email/Password provider is enabled

### Issue 3: Firestore Permission Denied
**Check**:
- Security rules are properly configured
- User is authenticated
- Data structure matches security rules

## 📊 Current Status

✅ **Firebase Client**: Properly configured with environment variables  
✅ **Firebase Admin**: Server-side operations working  
✅ **Authentication**: Email/Password signup and signin  
✅ **Firestore**: Data persistence and retrieval  
✅ **Security**: No hardcoded secrets in codebase  

## 🎯 Next Steps

1. **Test the application** with Firebase integration
2. **Configure production security rules** before deployment
3. **Monitor Firebase usage** in the console
4. **Set up Firebase Analytics** for user insights (optional)
