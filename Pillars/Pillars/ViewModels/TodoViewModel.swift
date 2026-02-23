//
//  TodoViewModel.swift
//  Pillars
//
//  Todo tab view model with direct Firestore reads and writes.
//

import Foundation
import FirebaseFirestore

@MainActor
final class TodoViewModel: ObservableObject, BackendRequesting {
    @Published var todos: [Todo] = []
    @Published var isLoading = true
    @Published var errorMessage: String?
    @Published var infoMessage: String?
    @Published var isClassifyingAssignment = false
    @Published private(set) var bountyResolvingTodoIds: Set<String> = []

    private var todoListener: ListenerRegistration?
    private var includeCompleted = false
    private var classificationInFlightCount = 0
    private var serverTodos: [Todo] = []
    private var optimisticTodosById: [String: Todo] = [:]
    private var pendingServerTodosById: [String: Todo] = [:]
    private var debugPillarNamesById: [String: String] = [:]
    private let api = APIService.shared

    func loadTodos(userId: String, includeCompleted: Bool = false) {
        self.includeCompleted = includeCompleted
        todoListener?.remove()
        todoListener = nil
        isLoading = true
        errorMessage = nil
        Task { @MainActor in
            await refreshDebugPillarNames(userId: userId)
        }

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

                    self.serverTodos = items
                    let serverIds = Set(items.map(\.id))
                    if !serverIds.isEmpty {
                        self.pendingServerTodosById = self.pendingServerTodosById.filter { !serverIds.contains($0.key) }
                    }
                    self.rebuildTodos()
                    self.errorMessage = nil
                    self.isLoading = false
                }
            }
    }

    func stopListening() {
        todoListener?.remove()
        todoListener = nil
        serverTodos = []
        optimisticTodosById = [:]
        pendingServerTodosById = [:]
        debugPillarNamesById = [:]
        bountyResolvingTodoIds = []
        todos = []
    }

    func createTodo(
        title: String,
        dueDate: String?,
        assignment: TodoAssignmentSelection,
        section: DaySection.TimeSection = .afternoon
    ) {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let now = Date().timeIntervalSince1970
        let optimisticId = "local_\(UUID().uuidString)"
        let optimisticTodo = Todo(
            id: optimisticId,
            content: trimmed,
            description: nil,
            dueDate: dueDate,
            sectionId: section.rawValue,
            status: "active",
            pillarId: nil,
            parentId: nil,
            bountyPoints: nil,
            bountyAllocations: nil,
            bountyPillarId: nil,
            assignmentMode: assignment.mode.rawValue,
            bountyPaidAt: nil,
            createdAt: now,
            updatedAt: now,
            completedAt: nil,
            archivedAt: nil
        )
        optimisticTodosById[optimisticId] = optimisticTodo
        bountyResolvingTodoIds.insert(optimisticId)
        rebuildTodos()

        Task { @MainActor in
            beginClassificationWork()
            defer { endClassificationWork() }
            do {
                print(
                    "🧠 [Todo Classifier] create start mode=\(assignment.mode.rawValue) "
                    + "pillars=\(debugPillarListSummary(assignment.pillarIds)) "
                    + "text=\"\(debugTextPreview(trimmed))\""
                )
                let response = try await api.createTodo(
                    content: trimmed,
                    dueDate: dueDate,
                    assignment: assignment
                )
                await ensureDebugPillarNames(
                    for: (response.classificationSummary?.matchedPillarIds ?? [])
                        + (response.classificationSummary?.trimmedPillarIds ?? [])
                        + (response.todo.bountyAllocations?.map(\.pillarId) ?? [])
                )
                print(
                    "✅ [Todo Classifier] create done method=\(response.classificationSummary?.method ?? "unknown") "
                    + "model=\(response.classificationSummary?.modelUsed ?? "n/a") "
                    + "fallback=\(response.classificationSummary?.fallbackUsed ?? false) "
                    + "matched=\(debugPillarListSummary(response.classificationSummary?.matchedPillarIds ?? [])) "
                    + "trimmed=\(debugPillarListSummary(response.classificationSummary?.trimmedPillarIds ?? [])) "
                    + "allocations=\(debugAllocationSummary(response.todo.bountyAllocations)) "
                    + "points=\(response.todo.resolvedBountyPoints ?? 0) "
                    + "assignmentMode=\(response.todo.assignmentMode ?? "n/a")"
                )
                if let summary = response.classificationSummary {
                    if let rationale = summary.modelRationale,
                       !rationale.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        print("🧠 [Todo Classifier] create rationale=\(rationale)")
                    }
                    if let systemPrompt = summary.modelSystemPrompt,
                       !systemPrompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        print("🧠 [Todo Classifier] create model_system_prompt=\n\(systemPrompt)")
                    }
                    if let userPrompt = summary.modelUserPrompt,
                       !userPrompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        print("🧠 [Todo Classifier] create model_user_prompt=\n\(userPrompt)")
                    }
                    if let rawResponse = summary.modelResponseRaw,
                       !rawResponse.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        print("🧠 [Todo Classifier] create model_raw_response=\n\(rawResponse)")
                    }
                }
                self.optimisticTodosById.removeValue(forKey: optimisticId)
                self.bountyResolvingTodoIds.remove(optimisticId)
                self.pendingServerTodosById[response.todo.id] = response.todo
                self.rebuildTodos()
                if let trimmedPillars = response.classificationSummary?.trimmedPillarIds,
                   !trimmedPillars.isEmpty {
                    self.infoMessage = "Some pillar matches were trimmed to fit the point cap."
                }
            } catch {
                print("❌ [Todo Classifier] create failed: \(friendlyErrorMessage(error))")
                self.optimisticTodosById.removeValue(forKey: optimisticId)
                self.bountyResolvingTodoIds.remove(optimisticId)
                self.rebuildTodos()
                self.errorMessage = "Failed to add todo: \(friendlyErrorMessage(error))"
            }
        }
    }

    func setTodoAssignment(todoId: String, assignment: TodoAssignmentSelection) {
        bountyResolvingTodoIds.insert(todoId)
        Task { @MainActor in
            beginClassificationWork()
            defer { endClassificationWork() }
            do {
                print(
                    "🧠 [Todo Classifier] retag start todoId=\(todoId) mode=\(assignment.mode.rawValue) "
                    + "pillars=\(debugPillarListSummary(assignment.pillarIds))"
                )
                let response = try await api.updateTodoAssignment(
                    todoId: todoId,
                    assignment: assignment
                )
                await ensureDebugPillarNames(
                    for: (response.classificationSummary?.matchedPillarIds ?? [])
                        + (response.classificationSummary?.trimmedPillarIds ?? [])
                        + (response.todo.bountyAllocations?.map(\.pillarId) ?? [])
                )
                print(
                    "✅ [Todo Classifier] retag done todoId=\(todoId) method=\(response.classificationSummary?.method ?? "unknown") "
                    + "model=\(response.classificationSummary?.modelUsed ?? "n/a") "
                    + "fallback=\(response.classificationSummary?.fallbackUsed ?? false) "
                    + "matched=\(debugPillarListSummary(response.classificationSummary?.matchedPillarIds ?? [])) "
                    + "trimmed=\(debugPillarListSummary(response.classificationSummary?.trimmedPillarIds ?? [])) "
                    + "allocations=\(debugAllocationSummary(response.todo.bountyAllocations)) "
                    + "points=\(response.todo.resolvedBountyPoints ?? 0) "
                    + "assignmentMode=\(response.todo.assignmentMode ?? "n/a")"
                )
                if let summary = response.classificationSummary {
                    if let rationale = summary.modelRationale,
                       !rationale.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        print("🧠 [Todo Classifier] retag rationale=\(rationale)")
                    }
                    if let systemPrompt = summary.modelSystemPrompt,
                       !systemPrompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        print("🧠 [Todo Classifier] retag model_system_prompt=\n\(systemPrompt)")
                    }
                    if let userPrompt = summary.modelUserPrompt,
                       !userPrompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        print("🧠 [Todo Classifier] retag model_user_prompt=\n\(userPrompt)")
                    }
                    if let rawResponse = summary.modelResponseRaw,
                       !rawResponse.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        print("🧠 [Todo Classifier] retag model_raw_response=\n\(rawResponse)")
                    }
                }
                self.pendingServerTodosById[response.todo.id] = response.todo
                self.bountyResolvingTodoIds.remove(todoId)
                self.rebuildTodos()
                if let trimmedPillars = response.classificationSummary?.trimmedPillarIds,
                   !trimmedPillars.isEmpty {
                    self.infoMessage = "Some pillar matches were trimmed to fit the point cap."
                }
            } catch {
                print("❌ [Todo Classifier] retag failed todoId=\(todoId): \(friendlyErrorMessage(error))")
                self.bountyResolvingTodoIds.remove(todoId)
                self.rebuildTodos()
                self.errorMessage = "Failed to retag todo: \(friendlyErrorMessage(error))"
            }
        }
    }

    func setTodoBountyAllocations(todoId: String, allocations: [TodoBountyAllocation]) {
        let normalized = allocations.compactMap { allocation -> TodoBountyAllocation? in
            let pillarId = allocation.pillarId.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !pillarId.isEmpty else { return nil }
            let points = max(0, min(100, allocation.points))
            guard points > 0 else { return nil }
            return TodoBountyAllocation(pillarId: pillarId, points: points)
        }

        bountyResolvingTodoIds.insert(todoId)
        Task { @MainActor in
            do {
                let summary = normalized
                    .sorted { $0.pillarId < $1.pillarId }
                    .map { "\(debugPillarLabel(for: $0.pillarId)):\($0.points)" }
                    .joined(separator: ", ")
                print("🧮 [Todo Points] update start todoId=\(todoId) allocations=\(summary.isEmpty ? "none" : summary)")
                let response = try await api.updateTodoBountyAllocations(
                    todoId: todoId,
                    allocations: normalized
                )
                await ensureDebugPillarNames(for: response.todo.bountyAllocations?.map(\.pillarId) ?? [])
                print(
                    "✅ [Todo Points] update done todoId=\(todoId) "
                    + "allocations=\(debugAllocationSummary(response.todo.bountyAllocations)) "
                    + "points=\(response.todo.resolvedBountyPoints ?? 0)"
                )
                self.pendingServerTodosById[response.todo.id] = response.todo
                self.bountyResolvingTodoIds.remove(todoId)
                self.rebuildTodos()
            } catch {
                print("❌ [Todo Points] update failed todoId=\(todoId): \(friendlyErrorMessage(error))")
                self.bountyResolvingTodoIds.remove(todoId)
                self.rebuildTodos()
                self.errorMessage = "Failed to update todo points: \(friendlyErrorMessage(error))"
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

    func setTodoContent(todoId: String, content: String) {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        Task {
            do {
                try await Firestore.firestore().collection("todos").document(todoId).setData([
                    "content": trimmed,
                    "updatedAt": Date().timeIntervalSince1970
                ], merge: true)
            } catch {
                self.errorMessage = "Failed to update todo: \(friendlyErrorMessage(error))"
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

    func clearInfoMessage() {
        infoMessage = nil
    }

    func isBountyResolving(todoId: String) -> Bool {
        bountyResolvingTodoIds.contains(todoId)
    }

    private func beginClassificationWork() {
        classificationInFlightCount += 1
        isClassifyingAssignment = classificationInFlightCount > 0
    }

    private func endClassificationWork() {
        classificationInFlightCount = max(0, classificationInFlightCount - 1)
        isClassifyingAssignment = classificationInFlightCount > 0
    }

    private func rebuildTodos() {
        var mergedById: [String: Todo] = [:]

        for todo in serverTodos {
            mergedById[todo.id] = todo
        }

        for (todoId, todo) in pendingServerTodosById where mergedById[todoId] == nil {
            mergedById[todoId] = todo
        }

        for (todoId, todo) in optimisticTodosById {
            mergedById[todoId] = todo
        }

        todos = Array(mergedById.values)
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
            bountyAllocations: parseBountyAllocations(data["bountyAllocations"]),
            bountyPillarId: data["bountyPillarId"] as? String,
            assignmentMode: data["assignmentMode"] as? String,
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

    private func parseBountyAllocations(_ raw: Any?) -> [TodoBountyAllocation]? {
        guard let allocations = raw as? [[String: Any]], !allocations.isEmpty else {
            return nil
        }

        let mapped = allocations.compactMap { allocation -> TodoBountyAllocation? in
            guard let pillarId = allocation["pillarId"] as? String else { return nil }
            guard let points = intValue(allocation["points"]), points > 0 else { return nil }
            return TodoBountyAllocation(pillarId: pillarId, points: points)
        }

        return mapped.isEmpty ? nil : mapped
    }

    private func refreshDebugPillarNames(userId: String) async {
        do {
            let snapshot = try await Firestore.firestore()
                .collection("pillars")
                .whereField("userId", isEqualTo: userId)
                .getDocuments()

            var mapping: [String: String] = [:]
            for document in snapshot.documents {
                let rawName = (document.data()["name"] as? String)?
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                let name = (rawName?.isEmpty == false) ? rawName! : document.documentID
                mapping[document.documentID] = name
            }
            debugPillarNamesById = mapping
            print("🧭 [Todo Classifier] debug pillar map loaded count=\(mapping.count)")
        } catch {
            print("⚠️ [Todo Classifier] failed to load debug pillar map: \(friendlyErrorMessage(error))")
        }
    }

    private func ensureDebugPillarNames(for ids: [String]) async {
        let missing = Set(ids.filter { debugPillarNamesById[$0] == nil && !$0.isEmpty })
        guard !missing.isEmpty else { return }

        for pillarId in missing {
            do {
                let document = try await Firestore.firestore().collection("pillars").document(pillarId).getDocument()
                if let data = document.data(),
                   let rawName = data["name"] as? String {
                    let trimmed = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
                    debugPillarNamesById[pillarId] = trimmed.isEmpty ? pillarId : trimmed
                } else {
                    debugPillarNamesById[pillarId] = pillarId
                }
            } catch {
                debugPillarNamesById[pillarId] = pillarId
                print("⚠️ [Todo Classifier] failed to resolve pillar name for id=\(pillarId): \(friendlyErrorMessage(error))")
            }
        }
    }

    private func debugTextPreview(_ text: String, limit: Int = 120) -> String {
        let compact = text
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard compact.count > limit else { return compact }
        let index = compact.index(compact.startIndex, offsetBy: limit)
        return "\(compact[..<index])..."
    }

    private func debugPillarLabel(for pillarId: String) -> String {
        guard !pillarId.isEmpty else { return "(empty)" }
        if let name = debugPillarNamesById[pillarId], !name.isEmpty {
            return "\(name){\(pillarId)}"
        }
        return pillarId
    }

    private func debugPillarListSummary(_ pillarIds: [String]) -> String {
        let labels = pillarIds.map { debugPillarLabel(for: $0) }
        return labels.isEmpty ? "[]" : "[\(labels.joined(separator: ", "))]"
    }

    private func debugAllocationSummary(_ allocations: [TodoBountyAllocation]?) -> String {
        guard let allocations, !allocations.isEmpty else {
            return "none"
        }
        let entries = allocations.map { allocation in
            "\(debugPillarLabel(for: allocation.pillarId)):\(allocation.points)"
        }
        return entries.joined(separator: ", ")
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

}
