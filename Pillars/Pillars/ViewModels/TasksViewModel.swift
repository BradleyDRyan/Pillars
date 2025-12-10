//
//  TasksViewModel.swift
//  Squirrel2
//

import SwiftUI
import FirebaseAuth
import FirebaseFirestore
import Combine

@MainActor
class TasksViewModel: ObservableObject {
    @Published var tasks: [UserTask] = []
    @Published var isLoading = true
    @Published var errorMessage: String?

    var userId: String? {
        Auth.auth().currentUser?.uid
    }

    private var tasksListener: ListenerRegistration?
    private let db = Firestore.firestore()
    
    func startListening(userId: String) {
        print("[TasksViewModel] Starting tasks listener for user: \(userId)")
        
        // Remove any existing listener
        stopListening()
        
        // Note: Using Firestore snapshot listeners for real-time updates (read-only)
        // All write operations should still go through the backend API
        tasksListener = db.collection("tasks")
            .whereField("userId", isEqualTo: userId)
            .whereField("status", isEqualTo: "pending")
            .order(by: "createdAt", descending: true)
            .limit(to: 50)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { return }
                
                if let error = error {
                    print("[TasksViewModel] Error listening to tasks: \(error)")
                    Task { @MainActor in
                        self.errorMessage = error.localizedDescription
                        self.isLoading = false
                    }
                    return
                }
                
                guard let documents = snapshot?.documents else {
                    print("[TasksViewModel] No documents in snapshot")
                    Task { @MainActor in
                        self.tasks = []
                        self.isLoading = false
                    }
                    return
                }
                
                print("[TasksViewModel] Received \(documents.count) tasks from snapshot")
                
                let newTasks = documents.compactMap { document -> UserTask? in
                    let data = document.data()
                    guard let title = data["title"] as? String,
                          let statusString = data["status"] as? String,
                          let userId = data["userId"] as? String else {
                        print("[TasksViewModel] Missing required fields in document: \(document.documentID)")
                        return nil
                    }
                    
                    let projectIds = data["projectIds"] as? [String] ?? []
                    
                    return UserTask(
                        id: document.documentID,
                        userId: userId,
                        projectIds: projectIds,
                        conversationId: data["conversationId"] as? String,
                        title: title,
                        description: data["description"] as? String ?? "",
                        status: UserTask.TaskStatus(rawValue: statusString) ?? .pending,
                        priority: UserTask.TaskPriority(rawValue: data["priority"] as? String ?? "medium") ?? .medium,
                        dueDate: (data["dueDate"] as? Timestamp)?.dateValue(),
                        completedAt: (data["completedAt"] as? Timestamp)?.dateValue(),
                        tags: data["tags"] as? [String] ?? [],
                        createdAt: (data["createdAt"] as? Timestamp)?.dateValue() ?? Date(),
                        updatedAt: (data["updatedAt"] as? Timestamp)?.dateValue() ?? Date(),
                        metadata: data["metadata"] as? [String: String]
                    )
                }
                
                Task { @MainActor in
                    self.tasks = newTasks
                    self.isLoading = false
                    self.errorMessage = nil
                    print("[TasksViewModel] Updated tasks list with \(self.tasks.count) items")
                }
            }
    }
    
    func stopListening() {
        tasksListener?.remove()
        tasksListener = nil
    }

    // MARK: - Task Creation (uses backend API)
    func createTask(_ task: UserTask) async {
        guard let user = Auth.auth().currentUser else {
            errorMessage = "Not authenticated"
            return
        }

        do {
            let token = try await user.getIDToken()

            guard let url = URL(string: "\(AppConfig.apiBaseURL)/tasks") else {
                errorMessage = "Invalid URL"
                return
            }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            // Create task payload
            let body: [String: Any] = [
                "title": task.title,
                "description": task.description,
                "priority": task.priority.rawValue,
                "status": task.status.rawValue,
                "dueDate": task.dueDate?.ISO8601Format() ?? NSNull(),
                "tags": task.tags,
                "projectIds": task.projectIds
            ]

            request.httpBody = try JSONSerialization.data(withJSONObject: body)

            let (_, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 201 else {
                errorMessage = "Failed to create task"
                return
            }

            // Success - Firestore listener will update the UI automatically
            print("✅ [TasksViewModel] Task created successfully")

        } catch {
            errorMessage = "Error creating task: \(error.localizedDescription)"
            print("❌ [TasksViewModel] Error creating task: \(error)")
        }
    }

    // MARK: - Generate Subtasks with AI
    func generateSubtasks(for task: UserTask) async {
        print("🚀 [TasksViewModel] generateSubtasks called for task: \(task.id) - \(task.title)")

        guard let user = Auth.auth().currentUser else {
            print("❌ [TasksViewModel] No authenticated user")
            errorMessage = "Not authenticated"
            return
        }
        print("✅ [TasksViewModel] User authenticated: \(user.uid)")

        // Update task to show it's processing
        if let index = tasks.firstIndex(where: { $0.id == task.id }) {
            print("📝 [TasksViewModel] Found task at index \(index), marking as processing")
            await MainActor.run {
                tasks[index].isProcessingSubtasks = true
            }
        } else {
            print("⚠️ [TasksViewModel] Task not found in tasks array")
        }

        do {
            print("🔑 [TasksViewModel] Getting auth token...")
            let token = try await user.getIDToken()
            print("✅ [TasksViewModel] Got auth token")

            // Create prompt for subtask generation
            let prompt = """
            Break down this task into smaller, actionable subtasks:
            Task: \(task.title)
            Description: \(task.description)

            Generate 3-5 specific subtasks that would help complete this main task.
            Return as a JSON array with objects containing 'title' and 'description' fields.
            """

            // Call OpenAI API through our backend
            let urlString = "\(AppConfig.apiBaseURL)/ai/generate-subtasks"
            print("📡 [TasksViewModel] API URL: \(urlString)")

            guard let url = URL(string: urlString) else {
                print("❌ [TasksViewModel] Invalid URL: \(urlString)")
                errorMessage = "Invalid URL"
                return
            }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            let body: [String: Any] = [
                "taskId": task.id,
                "prompt": prompt
            ]

            print("📤 [TasksViewModel] Request body: \(body)")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)

            print("🌐 [TasksViewModel] Making API request...")
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [TasksViewModel] Invalid response type")
                errorMessage = "Invalid response"
                return
            }

            print("📥 [TasksViewModel] Response status code: \(httpResponse.statusCode)")

            guard httpResponse.statusCode == 200 else {
                let responseString = String(data: data, encoding: .utf8) ?? "No response body"
                print("❌ [TasksViewModel] API error. Response: \(responseString)")
                errorMessage = "Failed to generate subtasks (Status: \(httpResponse.statusCode))"
                return
            }

            // Parse response
            let responseString = String(data: data, encoding: .utf8) ?? "No response"
            print("📋 [TasksViewModel] API Response: \(responseString)")

            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let subtasksData = json["subtasks"] as? [[String: String]] {

                print("✅ [TasksViewModel] Parsed \(subtasksData.count) subtasks")
                var subtasks: [UserTask] = []
                for (index, subtaskData) in subtasksData.enumerated() {
                    print("  📌 Subtask \(index): \(subtaskData["title"] ?? "No title")")
                    let subtask = UserTask(
                        id: UUID().uuidString,
                        userId: task.userId,
                        projectIds: task.projectIds,
                        conversationId: nil,
                        title: subtaskData["title"] ?? "",
                        description: subtaskData["description"] ?? "",
                        status: .pending,
                        priority: task.priority,
                        dueDate: nil,
                        completedAt: nil,
                        tags: [],
                        createdAt: Date(),
                        updatedAt: Date(),
                        metadata: nil,
                        parentTaskId: task.id
                    )
                    subtasks.append(subtask)
                }

                // Update task with subtasks
                if let index = tasks.firstIndex(where: { $0.id == task.id }) {
                    print("🔄 [TasksViewModel] Updating task at index \(index) with \(subtasks.count) subtasks")
                    await MainActor.run {
                        tasks[index].subtasks = subtasks
                        tasks[index].isProcessingSubtasks = false
                        tasks[index].hasProcessedSubtasks = true
                        print("✅ [TasksViewModel] Task updated successfully")
                    }
                } else {
                    print("❌ [TasksViewModel] Could not find task to update")
                }
            } else {
                print("❌ [TasksViewModel] Failed to parse JSON response")
            }

        } catch {
            errorMessage = "Error generating subtasks: \(error.localizedDescription)"
            print("❌ [TasksViewModel] Error generating subtasks: \(error)")

            // Reset processing state on error
            if let index = tasks.firstIndex(where: { $0.id == task.id }) {
                await MainActor.run {
                    tasks[index].isProcessingSubtasks = false
                }
            }
        }
    }

    deinit {
        // Cleanup is handled by the listener itself when the object is deallocated
        tasksListener?.remove()
    }
}
