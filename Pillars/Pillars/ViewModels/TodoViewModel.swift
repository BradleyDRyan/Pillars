//
//  TodoViewModel.swift
//  Pillars
//
//  Todo tab view model with direct Firestore reads and writes.
//

import Foundation
import FirebaseAuth
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
                guard let user = Auth.auth().currentUser else { throw BackendError.notAuthenticated }
                let now = Date().timeIntervalSince1970
                let todoRef = Firestore.firestore().collection("todos").document()

                let body: [String: Any] = [
                    "id": todoRef.documentID,
                    "userId": user.uid,
                    "content": trimmed,
                    "description": "",
                    "dueDate": dueDate ?? NSNull(),
                    "sectionId": section.rawValue,
                    "order": 0,
                    "status": "active",
                    "pillarId": NSNull(),
                    "parentId": NSNull(),
                    "createdAt": now,
                    "updatedAt": now,
                    "completedAt": NSNull(),
                    "archivedAt": NSNull()
                ]
                try await todoRef.setData(body)
            } catch {
                self.errorMessage = "Failed to add todo: \(friendlyErrorMessage(error))"
            }
        }
    }

    func setTodoPillar(todoId: String, pillarId: String?) {
        Task {
            do {
                try await Firestore.firestore().collection("todos").document(todoId).setData([
                    "pillarId": normalizedPillarIdentifier(pillarId) ?? NSNull(),
                    "updatedAt": Date().timeIntervalSince1970
                ], merge: true)
            } catch {
                self.errorMessage = "Failed to retag todo: \(friendlyErrorMessage(error))"
            }
        }
    }

    func setTodoCompletion(todoId: String, isCompleted: Bool) {
        Task {
            do {
                let now = Date().timeIntervalSince1970
                let pointEventId = "pe_todo_\(todoId)"
                let statusPayload: [String: Any] = [
                    "status": isCompleted ? "completed" : "active",
                    "completedAt": isCompleted ? now : NSNull(),
                    "updatedAt": now
                ]

                do {
                    let todoSnapshot = try await Firestore.firestore().collection("todos").document(todoId).getDocument()
                    let todoData = todoSnapshot.data() ?? [:]
                    print(
                        "🧪 [Todo Bounty] Preflight todoId=\(todoId) expectedPointEventId=\(pointEventId) expectPaid=\(isCompleted) "
                        + "status=\((todoData["status"] as? String) ?? "nil") "
                        + "pillarId=\((todoData["pillarId"] as? String) ?? "nil") "
                        + "bountyPillarId=\((todoData["bountyPillarId"] as? String) ?? "nil") "
                        + "bountyPoints=\(String(describing: intValue(todoData["bountyPoints"]))) "
                        + "bountyAllocations=\(allocationsSummary(todoData["bountyAllocations"])) "
                        + "bountyPaidAt=\(String(describing: timestampValue(todoData["bountyPaidAt"])))"
                    )
                } catch {
                    print("⚠️ [Todo Bounty] Preflight read failed todoId=\(todoId): \(friendlyErrorMessage(error))")
                }

                print("🧪 [Todo Bounty] Request completion update todoId=\(todoId) isCompleted=\(isCompleted) expectedPointEventId=\(pointEventId)")
                try await Firestore.firestore().collection("todos").document(todoId).setData(statusPayload, merge: true)
                print("✅ [Todo Bounty] Firestore completion write succeeded todoId=\(todoId) isCompleted=\(isCompleted)")

                Task { @MainActor [weak self] in
                    await self?.verifyBountyTrigger(todoId: todoId, expectPaid: isCompleted)
                }
            } catch {
                print("❌ [Todo Bounty] Completion write failed todoId=\(todoId): \(friendlyErrorMessage(error))")
                self.errorMessage = "Failed to update todo: \(friendlyErrorMessage(error))"
            }
        }
    }

    func setTodoDueDate(todoId: String, dueDate: String?) {
        Task {
            do {
                try await Firestore.firestore().collection("todos").document(todoId).setData([
                    "dueDate": dueDate ?? NSNull(),
                    "updatedAt": Date().timeIntervalSince1970
                ], merge: true)
            } catch {
                self.errorMessage = "Failed to schedule todo: \(friendlyErrorMessage(error))"
            }
        }
    }

    func deleteTodo(todoId: String) {
        Task {
            do {
                let now = Date().timeIntervalSince1970
                try await Firestore.firestore().collection("todos").document(todoId).setData([
                    "archivedAt": now,
                    "updatedAt": now
                ], merge: true)
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
            bountyPoints: data["bountyPoints"] as? Int,
            bountyPillarId: data["bountyPillarId"] as? String,
            bountyPaidAt: timestampValue(data["bountyPaidAt"]),
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

    private func intValue(_ raw: Any?) -> Int? {
        switch raw {
        case let value as NSNumber:
            return value.intValue
        case let value as Int:
            return value
        case let value as Int64:
            return Int(value)
        case let value as Double:
            return Int(value)
        default:
            return nil
        }
    }

    private func allocationsSummary(_ raw: Any?) -> String {
        guard let allocations = raw as? [[String: Any]], !allocations.isEmpty else {
            return "none"
        }

        let entries = allocations.compactMap { allocation -> String? in
            guard let pillarId = allocation["pillarId"] as? String else { return nil }
            guard let points = intValue(allocation["points"]) else { return nil }
            return "\(pillarId):\(points)"
        }

        return entries.isEmpty ? "none" : entries.joined(separator: ",")
    }

    private func verifyBountyTrigger(todoId: String, expectPaid: Bool) async {
        let db = Firestore.firestore()
        let pointEventId = "pe_todo_\(todoId)"
        print("🧪 [Todo Bounty] Verify start todoId=\(todoId) expectedPointEventId=\(pointEventId) expectPaid=\(expectPaid)")

        for attempt in 1...8 {
            do {
                let todoSnapshot = try await db.collection("todos").document(todoId).getDocument()
                let todoData = todoSnapshot.data() ?? [:]
                let bountyPaidAt = timestampValue(todoData["bountyPaidAt"])

                let pointEventSnapshot = try await db.collection("pointEvents").document(pointEventId).getDocument()
                let pointEventData = pointEventSnapshot.data() ?? [:]
                let eventExists = pointEventSnapshot.exists
                let voidedAt = timestampValue(pointEventData["voidedAt"])
                let totalPoints = intValue(pointEventData["totalPoints"])
                let allocations = allocationsSummary(pointEventData["allocations"])

                if expectPaid {
                    let isPaid = bountyPaidAt != nil && eventExists && voidedAt == nil
                    if isPaid {
                        print(
                            "✅ [Todo Bounty] Verified payout todoId=\(todoId) attempt=\(attempt) bountyPaidAt=\(String(describing: bountyPaidAt)) pointEventId=\(pointEventId) totalPoints=\(String(describing: totalPoints)) allocations=\(allocations)"
                        )
                        return
                    }

                    print(
                        "⏳ [Todo Bounty] Waiting for payout todoId=\(todoId) attempt=\(attempt) bountyPaidAt=\(String(describing: bountyPaidAt)) pointEventExists=\(eventExists) voidedAt=\(String(describing: voidedAt))"
                    )
                } else {
                    let isReversed = bountyPaidAt == nil && (!eventExists || voidedAt != nil)
                    if isReversed {
                        print(
                            "✅ [Todo Bounty] Verified reversal todoId=\(todoId) attempt=\(attempt) bountyPaidAt=nil pointEventExists=\(eventExists) voidedAt=\(String(describing: voidedAt))"
                        )
                        return
                    }

                    print(
                        "⏳ [Todo Bounty] Waiting for reversal todoId=\(todoId) attempt=\(attempt) bountyPaidAt=\(String(describing: bountyPaidAt)) pointEventExists=\(eventExists) voidedAt=\(String(describing: voidedAt))"
                    )
                }
            } catch {
                print("❌ [Todo Bounty] Verification read failed todoId=\(todoId) attempt=\(attempt): \(friendlyErrorMessage(error))")
            }

            try? await Task.sleep(nanoseconds: 1_000_000_000)
        }

        print("⚠️ [Todo Bounty] Verification timed out todoId=\(todoId) expectedPaid=\(expectPaid)")
    }

    private func normalizedPillarIdentifier(_ rawPillarId: String?) -> String? {
        guard let rawPillarId else { return nil }
        let trimmed = rawPillarId.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
