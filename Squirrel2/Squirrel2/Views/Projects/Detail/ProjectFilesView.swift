//
//  ProjectFilesView.swift
//  Squirrel2
//
//  Dedicated view for the Project "Files" tab, including native picker
//

import SwiftUI
import UniformTypeIdentifiers

struct ProjectFilesView: View {
    let project: Project
    var onFilesPicked: (([URL]) -> Void)? = nil
    
    @State private var isShowingFileImporter = false
    @State private var fileImportError: String?
    @State private var uploadingFiles: [UploadingFile] = []
    @State private var uploadedFiles: [UploadedFile] = []
    @State private var isLoadingFiles = true
    @State private var loadError: String?
    
    var body: some View {
        VStack(spacing: 0) {
            if isLoadingFiles {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if uploadingFiles.isEmpty && uploadedFiles.isEmpty {
                ProjectContentEmptyState(filter: .files, projectName: project.name)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                // Show uploaded/uploading files
                ScrollView {
                    LazyVStack(spacing: 0) {
                        // Currently uploading
                        ForEach(uploadingFiles) { file in
                            UploadingFileRow(file: file)
                        }
                        
                        // Already uploaded
                        ForEach(uploadedFiles) { file in
                            UploadedFileRow(file: file) { fileToDelete in
                                Task {
                                    await deleteFile(fileToDelete)
                                }
                            }
                        }
                    }
                    .padding(.top, 40) // Space for filter pills
                    .padding(.bottom, S2.Spacing.lg)
                    .padding(.horizontal, 12)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            
            ProjectAttachFileButton {
                print("📎 [ProjectFilesView] Attach file tapped")
                isShowingFileImporter = true
            }
            .padding(.horizontal, S2.Spacing.lg)
        }
        .fileImporter(
            isPresented: $isShowingFileImporter,
            allowedContentTypes: [.pdf, .image, .plainText],
            allowsMultipleSelection: true
        ) { result in
            switch result {
            case .success(let urls):
                urls.forEach { url in
                    print("📂 [ProjectFilesView] Selected file: \(url.lastPathComponent)")
                }
                onFilesPicked?(urls)
                uploadFiles(urls)
            case .failure(let error):
                print("❌ [ProjectFilesView] File import failed: \(error.localizedDescription)")
                fileImportError = error.localizedDescription
            }
        }
        .alert(
            "Unable to attach file",
            isPresented: Binding(
                get: { fileImportError != nil },
                set: { isPresented in
                    if !isPresented { fileImportError = nil }
                }
            )
        ) {
            Button("OK", role: .cancel) {
                fileImportError = nil
            }
        } message: {
            Text(fileImportError ?? "Please try again.")
        }
        .task {
            await loadExistingFiles()
            await processPendingSharedFiles()
        }
        .onReceive(NotificationCenter.default.publisher(for: .sharedFilesQueued)) { notification in
            let targetProjectId = notification.userInfo?["projectId"] as? String
            if targetProjectId == nil || targetProjectId == project.id {
                Task {
                    await processPendingSharedFiles()
                }
            }
        }
    }
    
    // MARK: - Load Existing Files
    
    private func loadExistingFiles() async {
        print("📂 [ProjectFilesView] Loading existing files for project: \(project.id)")
        isLoadingFiles = true
        
        do {
            let response = try await APIService.shared.fetchAttachments(projectId: project.id)
            print("✅ [ProjectFilesView] Loaded \(response.count) files")
            
            await MainActor.run {
                // Convert API response to local model
                uploadedFiles = response.attachments.map { attachment in
                    let ocrProcessing = attachment.ocrStatus == "processing" || attachment.ocrStatus == "pending"
                    
                    // Parse createdAt from Firestore timestamp
                    var createdAtDate: Date? = nil
                    if let createdAtDict = attachment.createdAt,
                       let secondsValue = createdAtDict["seconds"],
                       let seconds = secondsValue.value as? Int64 {
                        createdAtDate = Date(timeIntervalSince1970: TimeInterval(seconds))
                    }
                    
                    return UploadedFile(
                        id: attachment.id,
                        fileName: attachment.displayTitle,
                        url: attachment.displayUrl,
                        mimeType: attachment.displayMimeType,
                        size: attachment.displaySize,
                        ocrStatus: attachment.ocrStatus ?? "not_applicable",
                        ocrProcessing: ocrProcessing,
                        createdAt: createdAtDate
                    )
                }
                isLoadingFiles = false
            }
        } catch {
            print("❌ [ProjectFilesView] Failed to load files: \(error.localizedDescription)")
            await MainActor.run {
                loadError = error.localizedDescription
                isLoadingFiles = false
            }
        }
    }
    
    // MARK: - Shared Sheet Intake
    private func processPendingSharedFiles() async {
        let sharedFiles = ShareHandoffManager.shared.consumePendingFiles(for: project.id)
        guard !sharedFiles.isEmpty else { return }
        
        await MainActor.run {
            print("📥 [ProjectFilesView] Importing \(sharedFiles.count) shared files")
            uploadFiles(sharedFiles)
        }
    }
    
    // MARK: - Upload Logic
    
    private func uploadFiles(_ urls: [URL]) {
        for url in urls {
            let uploadingFile = UploadingFile(
                id: UUID().uuidString,
                fileName: url.lastPathComponent,
                fileURL: url,
                progress: 0,
                status: .uploading
            )
            uploadingFiles.append(uploadingFile)
            
            Task {
                await uploadFile(uploadingFile)
            }
        }
    }
    
    private func uploadFile(_ file: UploadingFile) async {
        do {
            print("📤 [ProjectFilesView] Starting upload for: \(file.fileName)")
            
            let response = try await APIService.shared.uploadAttachment(
                file.fileURL,
                projectId: project.id
            ) { progress in
                // Update progress on main thread
                Task { @MainActor in
                    if let index = uploadingFiles.firstIndex(where: { $0.id == file.id }) {
                        uploadingFiles[index].progress = progress
                    }
                }
            }
            
            print("✅ [ProjectFilesView] Upload successful: \(response.attachmentId)")
            print("📄 [ProjectFilesView] OCR Status: \(response.ocrStatus), Processing: \(response.ocrProcessing)")
            
            // Move from uploading to uploaded
            await MainActor.run {
                uploadingFiles.removeAll { $0.id == file.id }
                
                let uploadedFile = UploadedFile(
                    id: response.attachmentId,
                    fileName: response.fileName,
                    url: response.url,
                    mimeType: response.mimeType,
                    size: response.size,
                    ocrStatus: response.ocrStatus,
                    ocrProcessing: response.ocrProcessing,
                    createdAt: Date() // Use current date for newly uploaded files
                )
                uploadedFiles.insert(uploadedFile, at: 0)
            }
            
            // If OCR is processing, poll for status
            if response.ocrProcessing {
                await pollOCRStatus(attachmentId: response.attachmentId, projectId: project.id)
            }
            
        } catch {
            print("❌ [ProjectFilesView] Upload failed: \(error.localizedDescription)")
            
            await MainActor.run {
                if let index = uploadingFiles.firstIndex(where: { $0.id == file.id }) {
                    uploadingFiles[index].status = .failed
                    uploadingFiles[index].errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    private func pollOCRStatus(attachmentId: String, projectId: String) async {
        // Poll every 3 seconds for up to 2 minutes
        for _ in 0..<40 {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            
            do {
                let result = try await APIService.shared.getAttachmentOCRResults(projectId: projectId, attachmentId: attachmentId)
                
                await MainActor.run {
                    if let index = uploadedFiles.firstIndex(where: { $0.id == attachmentId }) {
                        uploadedFiles[index].ocrStatus = result.ocrStatus
                        uploadedFiles[index].ocrProcessing = result.ocrStatus == "processing" || result.ocrStatus == "pending"
                    }
                }
                
                // Stop polling if completed or failed
                if result.ocrStatus == "completed" || result.ocrStatus == "failed" {
                    print("📄 [ProjectFilesView] OCR finished with status: \(result.ocrStatus)")
                    break
                }
            } catch {
                print("⚠️ [ProjectFilesView] OCR status check failed: \(error.localizedDescription)")
            }
        }
    }
    
    private func deleteFile(_ file: UploadedFile) async {
        do {
            try await APIService.shared.deleteAttachment(projectId: project.id, attachmentId: file.id)
            await MainActor.run {
                uploadedFiles.removeAll { $0.id == file.id }
            }
        } catch {
            print("❌ [ProjectFilesView] Failed to delete file: \(error.localizedDescription)")
        }
    }
}

// MARK: - File Models

struct UploadingFile: Identifiable {
    let id: String
    let fileName: String
    let fileURL: URL
    var progress: Double
    var status: UploadStatus
    var errorMessage: String?
    
    enum UploadStatus {
        case uploading
        case completed
        case failed
    }
}

struct UploadedFile: Identifiable {
    let id: String
    let fileName: String
    let url: String
    let mimeType: String
    let size: Int
    var ocrStatus: String
    var ocrProcessing: Bool
    let createdAt: Date?
    
    var isPDF: Bool {
        mimeType == "application/pdf"
    }
    
    var formattedSize: String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(size))
    }
    
    var ocrStatusText: String {
        switch ocrStatus {
        case "pending", "processing":
            return "Processing..."
        case "completed":
            return "Text extracted"
        case "failed":
            return "OCR failed"
        case "not_applicable":
            return ""
        default:
            return ocrStatus
        }
    }
    
    var relativeDate: String {
        guard let createdAt = createdAt else { return "" }
        let calendar = Calendar.current
        let now = Date()
        let date = createdAt
        
        let components = calendar.dateComponents([.minute, .hour, .day, .weekOfYear, .month], from: date, to: now)
        
        // Minutes ago (less than 1 hour)
        if let minutes = components.minute, minutes < 60 {
            if minutes < 1 {
                return "Just now"
            } else if minutes == 1 {
                return "1 min ago"
            } else {
                return "\(minutes) min ago"
            }
        }
        
        // Hours ago (less than 24 hours)
        if let hours = components.hour, hours < 24 {
            if hours == 1 {
                return "1 hour ago"
            } else {
                return "\(hours) hours ago"
            }
        }
        
        // Days ago
        if let days = components.day {
            if days == 1 {
                return "Yesterday"
            } else if days < 7 {
                return "\(days) days ago"
            } else if days < 30 {
                let weeks = days / 7
                return weeks == 1 ? "1 week ago" : "\(weeks) weeks ago"
            } else if days < 365 {
                let months = days / 30
                return months == 1 ? "1 month ago" : "\(months) months ago"
            } else {
                let years = days / 365
                return years == 1 ? "1 year ago" : "\(years) years ago"
            }
        }
        
        // Fallback to formatted date
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}

// MARK: - File Row Views

private struct UploadingFileRow: View {
    let file: UploadingFile
    
    var body: some View {
        ListItem(
            leadingAccessory: {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.black.opacity(0.05), lineWidth: 1)
                        .frame(width: 40, height: 40)
                    Image(systemName: "text.document")
                        .font(.system(size: 19, weight: .regular))
                        .foregroundColor(S2.Colors.secondaryText)
                }
            },
            title: file.fileName,
            subtitle: {
                if file.status == .failed {
                    Text(file.errorMessage ?? "Upload failed")
                        .font(.squirrelCaption)
                        .foregroundColor(.red)
                } else {
                    Text("Processing...")
                        .font(.squirrelCaption)
                        .foregroundColor(S2.Colors.secondaryText)
                        .lineLimit(1)
                }
            }
        ) {
            if file.status == .uploading {
                ProgressView()
                    .scaleEffect(0.9)
            } else {
                EmptyView()
            }
        }
    }
}

private struct UploadedFileRow: View {
    let file: UploadedFile
    let onDelete: (UploadedFile) -> Void
    @State private var showCheckmark = false
    @State private var hasShownCheckmark = false
    
    var body: some View {
        ListItem(
            leadingAccessory: {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.black.opacity(0.05), lineWidth: 1)
                        .frame(width: 40, height: 40)
                    Image(systemName: "text.document")
                        .font(.system(size: 19, weight: .regular))
                        .foregroundColor(S2.Colors.secondaryText)
                }
            },
            title: file.fileName,
            subtitle: {
                HStack(spacing: 6) {
                    // Show OCR status when processing (without file size)
                    if file.isPDF && file.ocrProcessing && !file.ocrStatusText.isEmpty {
                        Text(file.ocrStatusText)
                            .font(.squirrelCaption)
                            .foregroundColor(S2.Colors.secondaryText)
                            .lineLimit(1)
                    } else {
                        // Show file size and relative date when processing is complete
                        Text(file.formattedSize)
                            .font(.squirrelCaption)
                            .foregroundColor(S2.Colors.secondaryText)
                            .lineLimit(1)
                        
                        if file.isPDF && file.ocrStatus == "failed" {
                            // Show failed status with relative date
                            if !file.relativeDate.isEmpty {
                                Text("·")
                                    .foregroundColor(S2.Colors.tertiaryText)
                                
                                Text(file.relativeDate)
                                    .font(.squirrelCaption)
                                    .foregroundColor(S2.Colors.secondaryText)
                                    .lineLimit(1)
                                
                                Text("·")
                                    .foregroundColor(S2.Colors.tertiaryText)
                            }
                            
                            HStack(spacing: 4) {
                                Image(systemName: "exclamationmark.circle.fill")
                                    .font(.system(size: 12))
                                    .foregroundColor(.red)
                                
                                Text(file.ocrStatusText)
                                    .font(.squirrelCaption)
                                    .foregroundColor(S2.Colors.secondaryText)
                                    .lineLimit(1)
                            }
                        } else if !file.relativeDate.isEmpty {
                            // Show relative date when not processing
                            Text("·")
                                .foregroundColor(S2.Colors.tertiaryText)
                            
                            Text(file.relativeDate)
                                .font(.squirrelCaption)
                                .foregroundColor(S2.Colors.secondaryText)
                                .lineLimit(1)
                        }
                    }
                }
            }
        ) {
            // Show spinner if OCR is processing, checkmark briefly when completed, then trash can
            if file.ocrProcessing {
                ProgressView()
                    .scaleEffect(0.9)
                    .frame(width: 24, height: 24)
            } else if showCheckmark {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 20, weight: .regular))
                    .foregroundColor(.black)
                    .frame(width: 24, height: 24)
                    .scaleEffect(showCheckmark ? 1.0 : 0.0)
                    .animation(.spring(response: 0.4, dampingFraction: 0.6), value: showCheckmark)
            } else {
                Button {
                    onDelete(file)
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 16, weight: .regular))
                        .foregroundColor(S2.Colors.secondaryText)
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.plain)
            }
        }
        .onChange(of: file.ocrStatus) { oldStatus, newStatus in
            // When OCR completes, show checkmark briefly then transition to trash
            if oldStatus != "completed" && newStatus == "completed" && !file.ocrProcessing && !hasShownCheckmark {
                hasShownCheckmark = true
                withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) {
                    showCheckmark = true
                }
                // After 1.5 seconds, hide checkmark and show trash
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        showCheckmark = false
                    }
                }
            }
        }
        .onChange(of: file.ocrProcessing) { wasProcessing, isProcessing in
            // When processing stops and status is completed, trigger checkmark
            if wasProcessing && !isProcessing && file.ocrStatus == "completed" && !hasShownCheckmark {
                hasShownCheckmark = true
                withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) {
                    showCheckmark = true
                }
                // After 1.5 seconds, hide checkmark and show trash
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        showCheckmark = false
                    }
                }
            }
        }
    }
}

// Helper function for file icons
private func iconForFile(_ fileName: String) -> String {
    let ext = (fileName as NSString).pathExtension.lowercased()
    switch ext {
    case "pdf":
        return "doc.fill"
    case "jpg", "jpeg", "png", "gif", "webp", "heic":
        return "photo.fill"
    case "txt":
        return "doc.text.fill"
    case "doc", "docx":
        return "doc.richtext.fill"
    default:
        return "doc.fill"
    }
}

// MARK: - Attach File Button

private struct ProjectAttachFileButton: View {
    let action: () -> Void
    
    var body: some View {
        S2Button(
            title: "Add Files",
            icon: "paperclip",
            variant: .primary,
            size: .medium,
            fullWidth: true,
            centerContent: true,
            action: action
        )
    }
}


