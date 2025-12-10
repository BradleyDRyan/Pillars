//
//  ShareViewController.swift
//  Squirrel2ShareExtension
//
//  Created by Brad Ryan on 12/5/25.
//

import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UINavigationController {
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        let contentVC = ShareContentViewController()
        contentVC.shareExtensionContext = self.extensionContext
        self.setViewControllers([contentVC], animated: false)
    }
}

final class ShareContentViewController: UIViewController {
    var shareExtensionContext: NSExtensionContext?
    
    private let appGroupId = "group.com.msldesign.sidekick"
    private let pendingKey = "share.pending.files"
    private let recentProjectsKey = "share.recent.projects"
    
    private var projects: [[String: String]] = []
    private var selectedProjectId: String?
    private var selectedProjectName: String?
    
    private let tableView = UITableView(frame: .zero, style: .insetGrouped)
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        view.backgroundColor = .systemBackground
        title = "Add to Project"
        
        // Navigation bar
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .cancel,
            target: self,
            action: #selector(cancelTapped)
        )
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            title: "Save",
            style: .done,
            target: self,
            action: #selector(saveTapped)
        )
        navigationItem.rightBarButtonItem?.isEnabled = false
        
        // Load recent projects from shared UserDefaults
        loadRecentProjects()
        
        // Table view
        tableView.delegate = self
        tableView.dataSource = self
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "ProjectCell")
        tableView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(tableView)
        
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    private func loadRecentProjects() {
        guard let defaults = UserDefaults(suiteName: appGroupId),
              let data = defaults.data(forKey: recentProjectsKey),
              let decoded = try? JSONDecoder().decode([[String: String]].self, from: data)
        else {
            projects = []
            return
        }
        projects = decoded
    }
    
    @objc private func cancelTapped() {
        shareExtensionContext?.cancelRequest(withError: NSError(domain: "user.cancelled", code: 0))
    }
    
    @objc private func saveTapped() {
        Task {
            await saveAttachments()
            shareExtensionContext?.completeRequest(returningItems: nil)
        }
    }
    
    private func saveAttachments() async {
        guard let inputItems = shareExtensionContext?.inputItems as? [NSExtensionItem],
              let defaults = UserDefaults(suiteName: appGroupId),
              let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId)
        else { return }
        
        let inbox = container.appendingPathComponent("SharedImports", isDirectory: true)
        try? FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)
        
        var storedPaths: [String] = []
        
        for item in inputItems {
            guard let providers = item.attachments else { continue }
            for provider in providers {
                if let url = await loadFile(from: provider, to: inbox) {
                    storedPaths.append(url.path)
                }
            }
        }
        
        guard !storedPaths.isEmpty else { return }
        
        let payload: [String: Any] = [
            "projectId": selectedProjectId as Any,
            "projectName": selectedProjectName as Any,
            "filePaths": storedPaths
        ]
        defaults.set(try? JSONSerialization.data(withJSONObject: payload), forKey: pendingKey)
    }
    
    private func loadFile(from provider: NSItemProvider, to inbox: URL) async -> URL? {
        let types: [UTType] = [.pdf, .image, .png, .jpeg, .heic, .plainText, .data]
        
        for type in types where provider.hasItemConformingToTypeIdentifier(type.identifier) {
            do {
                let result: URL? = try await withCheckedThrowingContinuation { continuation in
                    provider.loadFileRepresentation(forTypeIdentifier: type.identifier) { url, error in
                        if let error = error {
                            print("❌ [ShareExtension] Error loading file: \(error.localizedDescription)")
                            continuation.resume(returning: nil)
                            return
                        }
                        
                        guard let sourceURL = url else {
                            continuation.resume(returning: nil)
                            return
                        }
                        
                        // Must copy synchronously - the temp file is deleted after this callback
                        let fileName = sourceURL.lastPathComponent
                        let destURL = inbox.appendingPathComponent(fileName)
                        
                        do {
                            // Remove existing file if present
                            if FileManager.default.fileExists(atPath: destURL.path) {
                                try FileManager.default.removeItem(at: destURL)
                            }
                            
                            // Copy the file
                            try FileManager.default.copyItem(at: sourceURL, to: destURL)
                            print("✅ [ShareExtension] Copied file to: \(destURL.path)")
                            continuation.resume(returning: destURL)
                        } catch {
                            print("❌ [ShareExtension] Failed to copy: \(error.localizedDescription)")
                            continuation.resume(returning: nil)
                        }
                    }
                }
                
                if let result = result {
                    return result
                }
            } catch {
                print("❌ [ShareExtension] Error: \(error.localizedDescription)")
            }
        }
        
        // Try loading as data if file representation fails
        for type in types where provider.hasItemConformingToTypeIdentifier(type.identifier) {
            do {
                let data = try await provider.loadItem(forTypeIdentifier: type.identifier) as? Data
                if let data = data {
                    let fileName = "shared_\(UUID().uuidString.prefix(8)).\(type.preferredFilenameExtension ?? "dat")"
                    let destURL = inbox.appendingPathComponent(fileName)
                    try data.write(to: destURL)
                    print("✅ [ShareExtension] Wrote data to: \(destURL.path)")
                    return destURL
                }
            } catch {
                continue
            }
        }
        
        return nil
    }
}

// MARK: - UITableViewDelegate & DataSource
extension ShareContentViewController: UITableViewDelegate, UITableViewDataSource {
    
    func numberOfSections(in tableView: UITableView) -> Int {
        return 1
    }
    
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return max(projects.count, 1)
    }
    
    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        return "Select a Project"
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "ProjectCell", for: indexPath)
        
        if projects.isEmpty {
            cell.textLabel?.text = "No projects yet - open Sidekick to create one"
            cell.textLabel?.textColor = .secondaryLabel
            cell.selectionStyle = .none
            cell.accessoryType = .none
        } else {
            let project = projects[indexPath.row]
            cell.textLabel?.text = project["name"] ?? "Untitled"
            cell.textLabel?.textColor = .label
            cell.selectionStyle = .default
            cell.accessoryType = selectedProjectId == project["id"] ? .checkmark : .none
        }
        
        return cell
    }
    
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        
        guard !projects.isEmpty else { return }
        
        let project = projects[indexPath.row]
        selectedProjectId = project["id"]
        selectedProjectName = project["name"]
        navigationItem.rightBarButtonItem?.isEnabled = true
        tableView.reloadData()
    }
}
