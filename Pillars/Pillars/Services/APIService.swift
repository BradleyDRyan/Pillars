import Foundation
import Combine
import UIKit
import FirebaseAuth

class APIService: ObservableObject {
    static let shared = APIService()
    
    private let baseURL: String
    private let session = URLSession.shared
    private var authToken: String?
    
    init() {
        // Using centralized configuration
        self.baseURL = AppConfig.apiBaseURL
    }
    
    func setAuthToken(_ token: String) {
        self.authToken = token
    }
    
    /// Get current Firebase ID token (refreshes if needed)
    private func getFirebaseToken() async throws -> String? {
        guard let user = Auth.auth().currentUser else {
            print("⚠️ [APIService] No Firebase user logged in")
            return authToken // Fall back to manually set token
        }
        
        do {
            let token = try await user.getIDToken()
            self.authToken = token
            return token
        } catch {
            print("⚠️ [APIService] Failed to get Firebase token: \(error)")
            return authToken // Fall back to manually set token
        }
    }
    
    /// Ensure we have a valid auth token before making requests
    private func ensureAuthToken() async {
        if authToken == nil {
            _ = try? await getFirebaseToken()
        }
    }
    
    private func createRequest(url: URL, method: String = "GET", body: Data? = nil) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        request.httpBody = body
        return request
    }
    
    private func handleResponse<T: Decodable>(_ data: Data, _ response: URLResponse?, _ error: Error?, type: T.Type) async throws -> T {
        if let error = error {
            throw APIError.networkError(error)
        }
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601WithFractionalSeconds
        
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }
    
    func fetchProjects() async throws -> [Project] {
        let url = URL(string: "\(baseURL)/projects")!
        let request = createRequest(url: url)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: [Project].self)
    }
    
    func createProject(_ project: Project) async throws -> Project {
        let url = URL(string: "\(baseURL)/projects")!
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601WithFractionalSeconds
        let body = try encoder.encode(project)
        let request = createRequest(url: url, method: "POST", body: body)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: Project.self)
    }
    
    func updateProject(_ project: Project) async throws -> Project {
        let url = URL(string: "\(baseURL)/projects/\(project.id)")!
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601WithFractionalSeconds
        let body = try encoder.encode(project)
        let request = createRequest(url: url, method: "PUT", body: body)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: Project.self)
    }
    
    func deleteProject(projectId: String) async throws {
        let url = URL(string: "\(baseURL)/projects/\(projectId)")!
        let request = createRequest(url: url, method: "DELETE")
        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.invalidResponse
        }
    }
    
    func fetchConversations(projectId: String? = nil) async throws -> [Conversation] {
        var urlString = "\(baseURL)/conversations"
        if let projectId = projectId {
            urlString += "?projectId=\(projectId)"
        }
        let url = URL(string: urlString)!
        let request = createRequest(url: url)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: [Conversation].self)
    }
    
    func createConversation(_ conversation: Conversation) async throws -> Conversation {
        let url = URL(string: "\(baseURL)/conversations")!
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601WithFractionalSeconds
        let body = try encoder.encode(conversation)
        let request = createRequest(url: url, method: "POST", body: body)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: Conversation.self)
    }
    
    /// Assigns a conversation to a project by adding the projectId to the conversation's projectIds
    func assignConversationToProject(conversationId: String, projectId: String) async throws -> Conversation {
        let url = URL(string: "\(baseURL)/conversations/\(conversationId)/projects/\(projectId)")!
        let request = createRequest(url: url, method: "POST")
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: Conversation.self)
    }
    
    /// Updates a conversation's projectIds
    func updateConversationProjects(conversationId: String, projectIds: [String]) async throws -> Conversation {
        let url = URL(string: "\(baseURL)/conversations/\(conversationId)")!
        let body = try JSONSerialization.data(withJSONObject: ["projectIds": projectIds])
        let request = createRequest(url: url, method: "PATCH", body: body)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: Conversation.self)
    }
    
    func fetchMessages(conversationId: String) async throws -> [Message] {
        let url = URL(string: "\(baseURL)/conversations/\(conversationId)/messages")!
        let request = createRequest(url: url)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: [Message].self)
    }
    
    func sendMessage(_ message: Message) async throws -> Message {
        let url = URL(string: "\(baseURL)/messages")!
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601WithFractionalSeconds
        let body = try encoder.encode(message)
        let request = createRequest(url: url, method: "POST", body: body)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: Message.self)
    }
    
    func fetchTasks(projectId: String? = nil, status: UserTask.TaskStatus? = nil) async throws -> [UserTask] {
        var urlComponents = URLComponents(string: "\(baseURL)/tasks")!
        var queryItems: [URLQueryItem] = []
        
        if let projectId = projectId {
            queryItems.append(URLQueryItem(name: "projectId", value: projectId))
        }
        if let status = status {
            queryItems.append(URLQueryItem(name: "status", value: status.rawValue))
        }
        
        if !queryItems.isEmpty {
            urlComponents.queryItems = queryItems
        }
        
        let request = createRequest(url: urlComponents.url!)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: [UserTask].self)
    }
    
    func createTask(_ task: UserTask) async throws -> UserTask {
        let url = URL(string: "\(baseURL)/tasks")!
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601WithFractionalSeconds
        let body = try encoder.encode(task)
        let request = createRequest(url: url, method: "POST", body: body)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: UserTask.self)
    }
    
    func completeTask(_ taskId: String) async throws -> UserTask {
        let url = URL(string: "\(baseURL)/tasks/\(taskId)/complete")!
        let request = createRequest(url: url, method: "POST")
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: UserTask.self)
    }
    
    func fetchEntries(projectId: String? = nil, type: Entry.EntryType? = nil) async throws -> [Entry] {
        var urlComponents = URLComponents(string: "\(baseURL)/entries")!
        var queryItems: [URLQueryItem] = []
        
        if let projectId = projectId {
            queryItems.append(URLQueryItem(name: "projectId", value: projectId))
        }
        if let type = type {
            queryItems.append(URLQueryItem(name: "type", value: type.rawValue))
        }
        
        if !queryItems.isEmpty {
            urlComponents.queryItems = queryItems
        }
        
        let request = createRequest(url: urlComponents.url!)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: [Entry].self)
    }
    
    func createEntry(_ entry: Entry) async throws -> Entry {
        let url = URL(string: "\(baseURL)/entries")!
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601WithFractionalSeconds
        let body = try encoder.encode(entry)
        let request = createRequest(url: url, method: "POST", body: body)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: Entry.self)
    }

    // MARK: - Photo Upload

    struct PhotoUploadResponse: Codable {
        let success: Bool
        let photoId: String
        let conversationId: String
        let entryId: String
        let collectionId: String
        let collectionName: String
        let description: String
        let message: String
    }

    func uploadPhoto(_ image: UIImage, conversationId: String? = nil, progressHandler: ((Double) -> Void)? = nil) async throws -> PhotoUploadResponse {
        let url = URL(string: "\(baseURL)/photos/process")!

        // Convert image to JPEG data
        guard let imageData = image.jpegData(compressionQuality: 0.8) else {
            throw APIError.invalidResponse
        }

        // Create multipart form data request
        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // Build multipart body
        var body = Data()

        // Add conversation ID if provided
        if let conversationId = conversationId {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"conversationId\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(conversationId)\r\n".data(using: .utf8)!)
        }

        // Add photo data
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"photo\"; filename=\"photo.jpg\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        // Create upload task with progress tracking
        let (data, response) = try await session.data(for: request)

        // Note: For real progress tracking, we'd need to use URLSessionTaskDelegate
        // but for now, we'll just indicate completion
        progressHandler?(1.0)

        return try await handleResponse(data, response, nil, type: PhotoUploadResponse.self)
    }
    
    // MARK: - Attachment Upload

    struct AttachmentUploadResponse: Codable {
        let success: Bool
        let attachmentId: String
        let fileName: String
        let url: String
        let path: String
        let mimeType: String
        let size: Int
        let ocrStatus: String
        let ocrProcessing: Bool
    }
    
    struct AttachmentOCRStatus: Codable {
        let success: Bool
        let attachmentId: String
        let projectId: String?
        let title: String?
        let mimeType: String?
        let ocrStatus: String
        let ocrMetadata: [String: AnyCodable]?
        let hasOcrContent: Bool?
        let ocrContentLength: Int?
        let ocrImagesCount: Int?
    }
    
    struct AttachmentOCRResult: Codable {
        let success: Bool
        let attachmentId: String
        let ocrStatus: String
        let ocrContent: String?
        let ocrMetadata: [String: AnyCodable]?
        let ocrImages: [[String: AnyCodable]]?
        let title: String?
        let url: String?
    }
    
    struct DeleteAttachmentResponse: Codable {
        let success: Bool
        let message: String?
        let attachmentId: String?
    }
    
    /// Upload a file attachment to a project
    /// - Parameters:
    ///   - fileURL: Local URL of the file to upload
    ///   - projectId: The project ID to attach the file to
    ///   - progressHandler: Optional callback for upload progress
    /// - Returns: AttachmentUploadResponse with file details and OCR status
    func uploadAttachment(_ fileURL: URL, projectId: String, progressHandler: ((Double) -> Void)? = nil) async throws -> AttachmentUploadResponse {
        // Ensure we have a valid auth token
        _ = try? await getFirebaseToken()
        
        let url = URL(string: "\(baseURL)/attachments")!
        
        // Try to start accessing security-scoped resource (needed for files from document picker)
        // Files from App Group container don't need this and will return false, which is fine
        let needsSecurityScope = fileURL.startAccessingSecurityScopedResource()
        defer {
            if needsSecurityScope {
                fileURL.stopAccessingSecurityScopedResource()
            }
        }
        
        // Read file data
        let fileData: Data
        do {
            fileData = try Data(contentsOf: fileURL)
        } catch {
            throw APIError.fileAccessError("Failed to read file: \(error.localizedDescription)")
        }
        
        // Determine MIME type from file extension
        let mimeType = mimeTypeForPath(fileURL.pathExtension)
        let fileName = fileURL.lastPathComponent
        
        // Create multipart form data request
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = AppConfig.uploadTimeout
        
        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        } else {
            print("⚠️ [APIService] No auth token available for upload")
        }
        
        // Build multipart body
        var body = Data()
        
        // Add projectId field
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"projectId\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(projectId)\r\n".data(using: .utf8)!)
        
        // Add file data
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        print("📤 [APIService] Uploading file: \(fileName) (\(fileData.count) bytes) to project: \(projectId)")
        
        let (data, response) = try await session.data(for: request)
        
        progressHandler?(1.0)
        
        return try await handleResponse(data, response, nil, type: AttachmentUploadResponse.self)
    }
    
    /// Delete an attachment from a project
    /// - Parameters:
    ///   - projectId: The project ID
    ///   - attachmentId: The attachment ID to delete
    func deleteAttachment(projectId: String, attachmentId: String) async throws {
        _ = try? await getFirebaseToken()
        let url = URL(string: "\(baseURL)/attachments/\(projectId)/\(attachmentId)")!
        var request = createRequest(url: url)
        request.httpMethod = "DELETE"
        
        let (data, response) = try await session.data(for: request)
        _ = try await handleResponse(data, response, nil, type: DeleteAttachmentResponse.self)
    }
    
    /// Check the OCR processing status for an attachment
    func checkAttachmentOCRStatus(attachmentId: String) async throws -> AttachmentOCRStatus {
        _ = try? await getFirebaseToken()
        let url = URL(string: "\(baseURL)/attachments/ocr-status/\(attachmentId)")!
        let request = createRequest(url: url)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: AttachmentOCRStatus.self)
    }
    
    /// Get OCR results for an attachment
    func getAttachmentOCRResults(projectId: String, attachmentId: String) async throws -> AttachmentOCRResult {
        let url = URL(string: "\(baseURL)/attachments/ocr/\(projectId)/\(attachmentId)")!
        let request = createRequest(url: url)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: AttachmentOCRResult.self)
    }
    
    /// Trigger OCR processing manually for an attachment
    func triggerAttachmentOCR(projectId: String, attachmentId: String) async throws -> [String: Any] {
        let url = URL(string: "\(baseURL)/attachments/process-ocr/\(projectId)/\(attachmentId)")!
        let request = createRequest(url: url, method: "POST")
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.invalidResponse
        }
        
        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }
    
    // MARK: - List Attachments
    
    struct SpaceAttachment: Codable, Identifiable {
        let docId: String
        let id: String
        let type: String?
        let title: String?
        let url: String?
        let path: String?
        let mimeType: String?
        let fileType: String?
        let originalName: String?
        let size: Int?
        let ocrStatus: String?
        let ocrContent: String?
        let ocrMetadata: [String: AnyCodable]?
        let ocrImages: [[String: AnyCodable]]?
        let createdAt: [String: AnyCodable]?  // Firestore timestamp object
        
        // Computed properties for safe access
        var displayTitle: String {
            title ?? originalName ?? "Untitled"
        }
        
        var displayUrl: String {
            url ?? ""
        }
        
        var displayMimeType: String {
            mimeType ?? "application/octet-stream"
        }
        
        var displaySize: Int {
            size ?? 0
        }
    }
    
    struct ProjectAttachmentsResponse: Codable {
        let success: Bool
        let projectId: String
        let count: Int
        let attachments: [SpaceAttachment]
    }
    
    /// Fetch all attachments for a project
    /// - Parameter projectId: The project ID to fetch attachments for
    /// - Returns: ProjectAttachmentsResponse with list of attachments
    func fetchAttachments(projectId: String) async throws -> ProjectAttachmentsResponse {
        _ = try? await getFirebaseToken()
        let url = URL(string: "\(baseURL)/attachments/project/\(projectId)")!
        let request = createRequest(url: url)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: ProjectAttachmentsResponse.self)
    }
    
    // Helper to determine MIME type from file extension
    private func mimeTypeForPath(_ pathExtension: String) -> String {
        switch pathExtension.lowercased() {
        case "pdf":
            return "application/pdf"
        case "jpg", "jpeg":
            return "image/jpeg"
        case "png":
            return "image/png"
        case "gif":
            return "image/gif"
        case "webp":
            return "image/webp"
        case "txt":
            return "text/plain"
        case "doc":
            return "application/msword"
        case "docx":
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        default:
            return "application/octet-stream"
        }
    }
}

// MARK: - AnyCodable Helper for dynamic JSON

struct AnyCodable: Codable {
    let value: Any
    
    init(_ value: Any) {
        self.value = value
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        
        if container.decodeNil() {
            self.value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            self.value = bool
        } else if let int = try? container.decode(Int.self) {
            self.value = int
        } else if let double = try? container.decode(Double.self) {
            self.value = double
        } else if let string = try? container.decode(String.self) {
            self.value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            self.value = array.map { $0.value }
        } else if let dictionary = try? container.decode([String: AnyCodable].self) {
            self.value = dictionary.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "AnyCodable cannot decode value")
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        
        switch value {
        case is NSNull:
            try container.encodeNil()
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dictionary as [String: Any]:
            try container.encode(dictionary.mapValues { AnyCodable($0) })
        default:
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: container.codingPath, debugDescription: "AnyCodable cannot encode value"))
        }
    }
}

enum APIError: LocalizedError {
    case networkError(Error)
    case invalidResponse
    case httpError(Int)
    case decodingError(Error)
    case fileAccessError(String)
    
    var errorDescription: String? {
        switch self {
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let code):
            return "HTTP error: \(code)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .fileAccessError(let message):
            return "File access error: \(message)"
        }
    }
}
