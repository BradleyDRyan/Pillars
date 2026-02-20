//
//  TodoViewModel.swift
//  Pillars
//
//  Todo tab view model with direct Firestore reads and API-backed mutations.
//

import Foundation
import FirebaseFirestore

@MainActor
final class TodoViewModel: ObservableObject, BackendRequesting {
    @Published var todos: [Todo] = []
    @Published var isLoading = true
    @Published var errorMessage: String?

    private var todoListener: ListenerRegistration?
    private var includeCompleted = false

    func loadTodos(userId: String, includeCompleted: Bool = false) {
        self.includeCompleted = includeCompleted
        todoListener?.remove()
        todoListener = nil
        isLoading = true
        errorMessage = nil

        todoListener = Firestore.firestore()
            .collection("todos")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                Task { @MainActor in
                    if let error {
                        self.errorMessage = "Failed to load todos: \(self.friendlyErrorMessage(error))"
                        self.isLoading = false
                        return
                    }

                    let items = snapshot?.documents
                        .compactMap { self.todoItem(from: $0) }
                        .filter { item in
                            let isArchived = item.archivedAt != nil
                            let hasParent = item.parentId?.isEmpty == false
                            let isActive = (item.status ?? "active").lowercased() == "active"
                            return !isArchived
                                && !hasParent
                                && (self.includeCompleted || isActive)
                        }
                        .sorted { lhs, rhs in
                            let leftCreated = lhs.createdAt ?? 0
                            let rightCreated = rhs.createdAt ?? 0
                            if leftCreated != rightCreated {
                                return leftCreated < rightCreated
                            }
                            return lhs.id < rhs.id
                        } ?? []

                    self.todos = items
                    self.errorMessage = nil
                    self.isLoading = false
                }
            }
    }

    func stopListening() {
        todoListener?.remove()
        todoListener = nil
        todos = []
    }

    func createTodo(
        title: String,
        dueDate: String?,
        section: DaySection.TimeSection = .afternoon
    ) {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        Task {
            do {
                let body: [String: Any] = [
                    "content": trimmed,
                    "dueDate": dueDate ?? NSNull(),
                    "sectionId": section.rawValue,
                    "status": "active",
                    "pillarId": NSNull()
                ]
                _ = try await performAPIRequest(path: "/todos", method: "POST", body: body)
            } catch {
                self.errorMessage = "Failed to add todo: \(friendlyErrorMessage(error))"
            }
        }
    }

    func setTodoPillar(todoId: String, pillarId: String?) {
        Task {
            do {
                _ = try await performAPIRequest(
                    path: "/todos/\(encodedPathComponent(todoId))",
                    method: "PUT",
                    body: ["pillarId": normalizedPillarIdentifier(pillarId) ?? NSNull()]
                )
            } catch {
                self.errorMessage = "Failed to retag todo: \(friendlyErrorMessage(error))"
            }
        }
    }

    func setTodoCompletion(todoId: String, isCompleted: Bool) {
        Task {
            do {
                let path = isCompleted
                    ? "/todos/\(encodedPathComponent(todoId))/close"
                    : "/todos/\(encodedPathComponent(todoId))/reopen"
                _ = try await performAPIRequest(path: path, method: "POST", body: [:])
            } catch {
                self.errorMessage = "Failed to update todo: \(friendlyErrorMessage(error))"
            }
        }
    }

    func setTodoDueDate(todoId: String, dueDate: String?) {
        Task {
            do {
                _ = try await performAPIRequest(
                    path: "/todos/\(encodedPathComponent(todoId))",
                    method: "PUT",
                    body: ["dueDate": dueDate ?? NSNull()]
                )
            } catch {
                self.errorMessage = "Failed to schedule todo: \(friendlyErrorMessage(error))"
            }
        }
    }

    func deleteTodo(todoId: String) {
        Task {
            do {
                _ = try await performAPIRequest(
                    path: "/todos/\(encodedPathComponent(todoId))",
                    method: "DELETE"
                )
            } catch {
                self.errorMessage = "Failed to delete todo: \(friendlyErrorMessage(error))"
            }
        }
    }

    private func todoItem(from document: QueryDocumentSnapshot) -> Todo? {
        let data = document.data()
        guard let content = data["content"] as? String else { return nil }

        return Todo(
            id: document.documentID,
            content: content,
            description: data["description"] as? String,
            dueDate: data["dueDate"] as? String,
            sectionId: data["sectionId"] as? String,
            status: data["status"] as? String,
            pillarId: data["pillarId"] as? String,
            parentId: data["parentId"] as? String,
            createdAt: timestampValue(data["createdAt"]),
            updatedAt: timestampValue(data["updatedAt"]),
            completedAt: timestampValue(data["completedAt"]),
            archivedAt: timestampValue(data["archivedAt"])
        )
    }

    private func timestampValue(_ raw: Any?) -> TimeInterval? {
        switch raw {
        case let value as NSNumber:
            return value.doubleValue
        case let value as Double:
            return value
        case let value as Int:
            return TimeInterval(value)
        case let value as Int64:
            return TimeInterval(value)
        case let value as Timestamp:
            return value.dateValue().timeIntervalSince1970
        default:
            return nil
        }
    }

    private func normalizedPillarIdentifier(_ rawPillarId: String?) -> String? {
        guard let rawPillarId else { return nil }
        let trimmed = rawPillarId.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
