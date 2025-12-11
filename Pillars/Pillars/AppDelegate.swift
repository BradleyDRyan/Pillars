//
//  AppDelegate.swift
//  Pillars
//
//  Handles Firebase configuration and APNs token management for Phone Auth.
//  When FirebaseAppDelegateProxyEnabled is false, we must manually pass
//  APNs tokens and notifications to Firebase Auth.
//

import UIKit
import FirebaseCore
import FirebaseAuth
import FirebaseMessaging
import FirebaseAppCheck
import UserNotifications

class AppDelegate: NSObject, UIApplicationDelegate {
    
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        print("📱 AppDelegate: didFinishLaunching")
        
        // Set up App Check BEFORE configuring Firebase
        let providerFactory = PillarsAppCheckProviderFactory()
        AppCheck.setAppCheckProviderFactory(providerFactory)
        
        // Configure Firebase FIRST - this must happen before any Firebase services are used
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
            print("📱 Firebase configured in AppDelegate")
        } else {
            print("📱 Firebase was already configured")
        }
        
        // App Check is now active
        print("📱 Firebase App Check configured with App Attest")
        
        let proxyEnabled = Bundle.main.object(forInfoDictionaryKey: "FirebaseAppDelegateProxyEnabled") as? Bool
        print("📱 FirebaseAppDelegateProxyEnabled: \(String(describing: proxyEnabled))")
        
        // Set up delegates (required when swizzling is disabled)
        UNUserNotificationCenter.current().delegate = self
        Messaging.messaging().delegate = self
        
        // Register for remote notifications (required for phone auth silent push)
        // This triggers didRegisterForRemoteNotificationsWithDeviceToken
        application.registerForRemoteNotifications()
        print("📱 Registered for remote notifications")
        
        return true
    }
    
    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("📱 Failed to register for remote notifications: \(error)")
        // Phone auth will fall back to reCAPTCHA verification
    }
    
    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("📱 didRegisterForRemoteNotificationsWithDeviceToken: \(tokenString)")
        
        // Pass APNs token to BOTH Firebase Auth AND Messaging
        // Use .unknown so Firebase can determine sandbox vs production automatically
        Auth.auth().setAPNSToken(deviceToken, type: .unknown)
        Messaging.messaging().apnsToken = deviceToken
        print("📱 Passed APNs token to Firebase Auth and Messaging")
    }
    
    func application(_ application: UIApplication,
                     didReceiveRemoteNotification notification: [AnyHashable: Any],
                     fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        print("📱 didReceiveRemoteNotification: \(notification)")
        
        // Check if this is a Firebase Auth notification (silent push for phone auth)
        if Auth.auth().canHandleNotification(notification) {
            print("📱 Notification handled by Firebase Auth (phone auth verification)")
            completionHandler(.noData)
            return
        }
        
        // Not a Firebase Auth notification
        completionHandler(.noData)
    }
    
    func application(_ application: UIApplication,
                     open url: URL,
                     options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        print("📱 open url: \(url)")
        // Handle reCAPTCHA callback URL for phone auth
        if Auth.auth().canHandle(url) {
            print("📱 URL handled by Firebase Auth")
            return true
        }
        return false
    }
}

// MARK: - UNUserNotificationCenterDelegate
extension AppDelegate: UNUserNotificationCenterDelegate {
    
    // Handle notifications when app is in foreground
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        let userInfo = notification.request.content.userInfo
        print("📱 Will present notification: \(userInfo)")
        
        // Check if Firebase Auth can handle it (it shouldn't show UI for silent push)
        if Auth.auth().canHandleNotification(userInfo) {
            completionHandler([])
            return
        }
        
        // For other notifications, show them
        completionHandler([[.banner, .sound]])
    }
    
    // Handle notification tap
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo
        print("📱 Did receive notification response: \(userInfo)")
        completionHandler()
    }
}

// MARK: - MessagingDelegate
extension AppDelegate: MessagingDelegate {
    
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        print("📱 FCM registration token: \(fcmToken ?? "nil")")
        // This token can be used to send push notifications to this device
    }
}

// MARK: - App Check Provider Factory
class PillarsAppCheckProviderFactory: NSObject, FirebaseAppCheck.AppCheckProviderFactory {
    func createProvider(with app: FirebaseApp) -> (any AppCheckProvider)? {
        #if DEBUG
        // Use debug provider for development/simulator
        print("📱 App Check: Using Debug Provider")
        return AppCheckDebugProvider(app: app)
        #else
        // Use App Attest for production on real devices
        if #available(iOS 14.0, *) {
            print("📱 App Check: Using App Attest Provider")
            return AppAttestProvider(app: app)
        } else {
            // Fallback for older iOS versions
            print("📱 App Check: Using Device Check Provider")
            return DeviceCheckProvider(app: app)
        }
        #endif
    }
}
