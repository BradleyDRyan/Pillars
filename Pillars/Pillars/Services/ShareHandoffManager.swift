//
//  ShareHandoffManager.swift
//  Squirrel2
//
//  Handles files handed to the app from the iOS share sheet ("Copy to Squirrel2")
//  by copying them into a temporary inbox and notifying interested views.
//

import Foundation

/// Payload persisted between launches so we can resume uploads when the user opens the app.
private struct SharedFilePayload: Codable {
    let projectId: String?
    let filePaths: [String]
}

final class ShareHandoffManager {
    static let shared = ShareHandoffManager()
    
    // Notification fired whenever new files are queued from the share sheet.
    static let sharedFilesQueuedNotification = Notification.Name("ShareHandoffManager.sharedFilesQueued")
    
    private let pendingKey = "share.pending.files"
    private let lastProjectIdKey = "share.last.projectId"
    private let lastProjectNameKey = "share.last.projectName"
    private let recentProjectsKey = "share.recent.projects"
    private let inboxFolder: URL
    private let defaults: UserDefaults
    private let fileManager: FileManager
    
    private static let appGroupId = "group.com.msldesign.sidekick"
    
    private init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
        
        if let suite = UserDefaults(suiteName: ShareHandoffManager.appGroupId) {
            self.defaults = suite
        } else {
            self.defaults = .standard
        }
        
        if let container = fileManager.containerURL(forSecurityApplicationGroupIdentifier: ShareHandoffManager.appGroupId) {
            let inbox = container.appendingPathComponent("SharedImports", isDirectory: true)
            self.inboxFolder = inbox
            try? fileManager.createDirectory(at: inbox, withIntermediateDirectories: true)
        } else {
            // Fallback to temp if app group not available (should not happen in production)
            let inbox = fileManager.temporaryDirectory.appendingPathComponent("SharedImports", isDirectory: true)
            self.inboxFolder = inbox
            try? fileManager.createDirectory(at: inbox, withIntermediateDirectories: true)
        }
    }
    
    var lastProjectId: String? {
        defaults.string(forKey: lastProjectIdKey)
    }
    
    var lastProjectName: String? {
        defaults.string(forKey: lastProjectNameKey)
    }
    
    func rememberLastProject(_ project: Project) {
        defaults.set(project.id, forKey: lastProjectIdKey)
        defaults.set(project.name, forKey: lastProjectNameKey)
        
        // Update recent projects list for the share extension
        addToRecentProjects(id: project.id, name: project.name)
    }
    
    private func addToRecentProjects(id: String, name: String) {
        var recent: [[String: String]] = []
        
        // Load existing
        if let data = defaults.data(forKey: recentProjectsKey),
           let decoded = try? JSONDecoder().decode([[String: String]].self, from: data) {
            recent = decoded
        }
        
        // Remove if already exists (we'll re-add at top)
        recent.removeAll { $0["id"] == id }
        
        // Add to front
        recent.insert(["id": id, "name": name], at: 0)
        
        // Keep only last 10
        if recent.count > 10 {
            recent = Array(recent.prefix(10))
        }
        
        // Save
        if let encoded = try? JSONEncoder().encode(recent) {
            defaults.set(encoded, forKey: recentProjectsKey)
        }
    }
    
    /// Called from onOpenURL when the app is launched from the iOS share sheet.
    func handleIncomingURLs(_ urls: [URL]) {
        let targetProjectId = lastProjectId
        var storedPaths: [String] = []
        
        for url in urls where url.isFileURL {
            let needsStop = url.startAccessingSecurityScopedResource()
            defer {
                if needsStop {
                    url.stopAccessingSecurityScopedResource()
                }
            }
            
            let destination = inboxFolder.appendingPathComponent(url.lastPathComponent)
            
            // Replace any existing file with the same name
            if fileManager.fileExists(atPath: destination.path) {
                try? fileManager.removeItem(at: destination)
            }
            
            do {
                try fileManager.copyItem(at: url, to: destination)
                storedPaths.append(destination.path)
                print("📥 [ShareHandoffManager] Stored shared file at \(destination.path)")
            } catch {
                print("❌ [ShareHandoffManager] Failed to copy shared file: \(error.localizedDescription)")
            }
        }
        
        guard !storedPaths.isEmpty else { return }
        
        let payload = SharedFilePayload(projectId: targetProjectId, filePaths: storedPaths)
        if let data = try? JSONEncoder().encode(payload) {
            defaults.set(data, forKey: pendingKey)
        }
        
        NotificationCenter.default.post(
            name: ShareHandoffManager.sharedFilesQueuedNotification,
            object: nil,
            userInfo: ["projectId": targetProjectId as Any]
        )
    }
    
    /// Returns and clears any pending files for the given project (or all files when no project was remembered).
    func consumePendingFiles(for projectId: String) -> [URL] {
        guard
            let data = defaults.data(forKey: pendingKey),
            let payload = try? JSONDecoder().decode(SharedFilePayload.self, from: data)
        else { return [] }
        
        // If we stored a specific project, only hand off when it matches.
        if let payloadProject = payload.projectId, payloadProject != projectId {
            return []
        }
        
        defaults.removeObject(forKey: pendingKey)
        
        let urls = payload.filePaths.compactMap { path -> URL? in
            let url = URL(fileURLWithPath: path)
            return fileManager.fileExists(atPath: url.path) ? url : nil
        }
        
        return urls
    }
}

extension Notification.Name {
    static let sharedFilesQueued = ShareHandoffManager.sharedFilesQueuedNotification
}

