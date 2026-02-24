import Foundation
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class ActionViewModel: ObservableObject, BackendRequesting {
    @Published var actions: [Action] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var selectedDate: String = Day.todayDateString

    private let db = Firestore.firestore()
    private var actionsListener: ListenerRegistration?
    private var activeUserId: String?
    private var allUserActions: [Action] = []
    private var ensureTask: Task<Void, Never>?

    var pendingActions: [Action] {
        sorted(actions.filter { $0.status == .pending })
    }

    var doneActions: [Action] {
        sorted(actions.filter { $0.status.isDone })
    }

    func load(date: String? = nil, ensure: Bool = true) {
        let targetDate = date ?? selectedDate
        selectedDate = targetDate

        errorMessage = nil
        isLoading = true

        do {
            let userId = try currentUserId()
            if activeUserId != userId || actionsListener == nil {
                startActionsListener(for: userId)
            } else {
                publishSelectedDateActions()
                isLoading = false
            }

            ensureTask?.cancel()
            if ensure {
                ensureTask = Task { [weak self] in
                    guard let self else { return }
                    do {
                        try await self.ensureActionsForDate(userId: userId, dateStr: targetDate)
                    } catch {
                        await MainActor.run {
                            self.errorMessage = "Failed to ensure recurring actions: \(self.friendlyErrorMessage(error))"
                        }
                    }
                }
            }
        } catch {
            stopListening()
            actions = []
            isLoading = false
            errorMessage = "Failed to load actions: \(friendlyErrorMessage(error))"
        }
    }

    func refresh(ensure: Bool = true) {
        load(date: selectedDate, ensure: ensure)
    }

    func createAction(
        title: String,
        notes: String? = nil,
        section: DaySection.TimeSection = .afternoon
    ) {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        let userId: String
        do {
            userId = try currentUserId()
        } catch {
            errorMessage = "Failed to create action: \(friendlyErrorMessage(error))"
            return
        }

        Task {
            do {
                let ref = db.collection("actions").document()
                let now = Date().timeIntervalSince1970
                let normalizedNotes = notes?
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                var payload: [String: Any] = [
                    "id": ref.documentID,
                    "userId": userId,
                    "title": trimmed,
                    "status": ActionStatus.pending.rawValue,
                    "targetDate": selectedDate,
                    "sectionId": section.rawValue,
                    "order": nextOrder(in: section),
                    "templateId": NSNull(),
                    "bounties": [],
                    "completedAt": NSNull(),
                    "createdAt": now,
                    "updatedAt": now,
                    "archivedAt": NSNull(),
                    "source": "user"
                ]
                payload["notes"] = (normalizedNotes?.isEmpty == false) ? normalizedNotes! : NSNull()
                try await ref.setData(payload)
            } catch {
                errorMessage = "Failed to create action: \(friendlyErrorMessage(error))"
            }
        }
    }

    func setStatus(actionId: String, status: ActionStatus) {
        let userId: String
        do {
            userId = try currentUserId()
        } catch {
            errorMessage = "Failed to update action: \(friendlyErrorMessage(error))"
            return
        }

        Task {
            do {
                let ref = db.collection("actions").document(actionId)
                let snapshot = try await ref.getDocument()
                guard snapshot.exists else {
                    throw BackendError.notFound
                }
                if let ownerId = snapshot.data()?["userId"] as? String, ownerId != userId {
                    throw BackendError.notFound
                }

                let now = Date().timeIntervalSince1970
                var payload: [String: Any] = [
                    "status": status.rawValue,
                    "updatedAt": now
                ]
                payload["completedAt"] = status == .completed ? now : NSNull()
                try await ref.setData(payload, merge: true)
            } catch {
                errorMessage = "Failed to update action: \(friendlyErrorMessage(error))"
            }
        }
    }

    func reorderPending(in section: DaySection.TimeSection, actionIds: [String]) {
        let pendingInSection = pendingActions
            .filter { $0.section == section }
            .map(\.id)

        guard Set(pendingInSection) == Set(actionIds) else {
            return
        }

        Task {
            do {
                let now = Date().timeIntervalSince1970
                let batch = db.batch()
                for (index, actionId) in actionIds.enumerated() {
                    let ref = db.collection("actions").document(actionId)
                    batch.setData([
                        "sectionId": section.rawValue,
                        "order": index,
                        "updatedAt": now
                    ], forDocument: ref, merge: true)
                }
                try await batch.commit()
            } catch {
                errorMessage = "Failed to reorder actions: \(friendlyErrorMessage(error))"
            }
        }
    }

    func stopListening() {
        ensureTask?.cancel()
        ensureTask = nil
        actionsListener?.remove()
        actionsListener = nil
        activeUserId = nil
        allUserActions = []
    }

    private func nextOrder(in section: DaySection.TimeSection) -> Int {
        let sectionActions = pendingActions.filter { $0.section == section }
        let maxOrder = sectionActions.compactMap { $0.order }.max() ?? -1
        return maxOrder + 1
    }

    private func sorted(_ items: [Action]) -> [Action] {
        items.sorted { lhs, rhs in
            let lhsSection = sectionSortOrder(lhs.section)
            let rhsSection = sectionSortOrder(rhs.section)
            if lhsSection != rhsSection {
                return lhsSection < rhsSection
            }
            if (lhs.order ?? 0) != (rhs.order ?? 0) {
                return (lhs.order ?? 0) < (rhs.order ?? 0)
            }
            if (lhs.createdAt ?? 0) != (rhs.createdAt ?? 0) {
                return (lhs.createdAt ?? 0) < (rhs.createdAt ?? 0)
            }
            return lhs.id < rhs.id
        }
    }

    private func sectionSortOrder(_ section: DaySection.TimeSection) -> Int {
        switch section {
        case .morning:
            return 0
        case .afternoon:
            return 1
        case .evening:
            return 2
        }
    }

    private func currentUserId() throws -> String {
        guard let userId = Auth.auth().currentUser?.uid else {
            throw BackendError.notAuthenticated
        }
        return userId
    }

    private func startActionsListener(for userId: String) {
        actionsListener?.remove()
        actionsListener = nil
        activeUserId = userId
        allUserActions = []

        actionsListener = db.collection("actions")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                Task { @MainActor in
                    if let error {
                        self.errorMessage = "Failed to load actions: \(self.friendlyErrorMessage(error))"
                        self.isLoading = false
                        return
                    }

                    self.allUserActions = snapshot?.documents.compactMap { self.actionItem(from: $0) } ?? []
                    self.publishSelectedDateActions()
                    self.isLoading = false
                }
            }
    }

    private func publishSelectedDateActions() {
        actions = sorted(
            allUserActions.filter { action in
                action.targetDate == selectedDate && action.archivedAt == nil
            }
        )
    }

    private func actionItem(from document: QueryDocumentSnapshot) -> Action? {
        let data = document.data()
        guard let title = data["title"] as? String,
              let targetDate = data["targetDate"] as? String else {
            return nil
        }

        let statusRaw = (data["status"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        let status = ActionStatus(rawValue: statusRaw ?? "") ?? .pending
        let notes = (data["notes"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let templateId = (data["templateId"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let sectionId = (data["sectionId"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let source = (data["source"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)

        return Action(
            id: document.documentID,
            userId: data["userId"] as? String,
            title: title,
            notes: (notes?.isEmpty == false) ? notes : nil,
            status: status,
            targetDate: targetDate,
            sectionId: (sectionId?.isEmpty == false) ? sectionId : nil,
            order: intValue(data["order"]),
            templateId: (templateId?.isEmpty == false) ? templateId : nil,
            bounties: parseBounties(data["bounties"]),
            completedAt: timestampValue(data["completedAt"]),
            createdAt: timestampValue(data["createdAt"]),
            updatedAt: timestampValue(data["updatedAt"]),
            archivedAt: timestampValue(data["archivedAt"]),
            source: (source?.isEmpty == false) ? source : nil
        )
    }

    private func parseBounties(_ raw: Any?) -> [ActionBounty] {
        guard let bountyRows = raw as? [[String: Any]] else {
            return []
        }

        return bountyRows.compactMap { row in
            guard let pillarId = row["pillarId"] as? String,
                  let points = intValue(row["points"]) else {
                return nil
            }

            let rubricItemId = (row["rubricItemId"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)

            return ActionBounty(
                pillarId: pillarId,
                rubricItemId: (rubricItemId?.isEmpty == false) ? rubricItemId : nil,
                points: points
            )
        }
    }

    private func intValue(_ raw: Any?) -> Int? {
        switch raw {
        case let value as Int:
            return value
        case let value as Int64:
            return Int(value)
        case let value as Double:
            return Int(value)
        case let value as NSNumber:
            return value.intValue
        default:
            return nil
        }
    }

    private func timestampValue(_ raw: Any?) -> TimeInterval? {
        switch raw {
        case let value as TimeInterval:
            return value
        case let value as NSNumber:
            return value.doubleValue
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

    private struct ActionTemplateSeed {
        let id: String
        let title: String
        let notes: String?
        let cadence: ActionCadence
        let defaultSectionId: String?
        let defaultOrder: Int
        let defaultBounties: [ActionBounty]
        let isActive: Bool
        let startDate: String?
        let endDate: String?
        let archivedAt: TimeInterval?
    }

    private func ensureActionsForDate(userId: String, dateStr: String) async throws {
        guard !Task.isCancelled else { return }
        let templateSnapshot = try await db.collection("actionTemplates")
            .whereField("userId", isEqualTo: userId)
            .getDocuments()

        let templateSeeds = templateSnapshot.documents.compactMap { templateSeed(from: $0) }
        let existingActionIds = Set(
            allUserActions
                .filter { $0.targetDate == dateStr }
                .map(\.id)
        )
        let now = Date().timeIntervalSince1970

        for template in templateSeeds {
            guard !Task.isCancelled else { return }
            guard template.isActive else { continue }
            guard template.archivedAt == nil else { continue }
            if let startDate = template.startDate, dateStr < startDate {
                continue
            }
            if let endDate = template.endDate, dateStr > endDate {
                continue
            }
            guard cadenceAppliesToDate(template.cadence, dateStr: dateStr) else {
                continue
            }

            let actionId = deterministicActionIdFromTemplate(templateId: template.id, dateStr: dateStr)
            if existingActionIds.contains(actionId) {
                continue
            }

            let actionRef = db.collection("actions").document(actionId)
            let actionSnapshot = try await actionRef.getDocument()
            if actionSnapshot.exists {
                continue
            }

            let section = DaySection.TimeSection(rawValue: template.defaultSectionId ?? "")?.rawValue
                ?? DaySection.TimeSection.afternoon.rawValue
            var payload: [String: Any] = [
                "id": actionId,
                "userId": userId,
                "title": template.title,
                "status": ActionStatus.pending.rawValue,
                "targetDate": dateStr,
                "sectionId": section,
                "order": template.defaultOrder,
                "templateId": template.id,
                "bounties": template.defaultBounties.map { bounty in
                    var row: [String: Any] = [
                        "pillarId": bounty.pillarId,
                        "points": bounty.points
                    ]
                    row["rubricItemId"] = bounty.rubricItemId ?? NSNull()
                    return row
                },
                "completedAt": NSNull(),
                "createdAt": now,
                "updatedAt": now,
                "archivedAt": NSNull(),
                "source": "template"
            ]
            payload["notes"] = template.notes ?? NSNull()
            try await actionRef.setData(payload)
        }
    }

    private func templateSeed(from document: QueryDocumentSnapshot) -> ActionTemplateSeed? {
        let data = document.data()
        guard let title = data["title"] as? String,
              let cadence = parseCadence(data["cadence"]) else {
            return nil
        }

        let notes = (data["notes"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let sectionId = (data["defaultSectionId"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)

        return ActionTemplateSeed(
            id: document.documentID,
            title: title,
            notes: (notes?.isEmpty == false) ? notes : nil,
            cadence: cadence,
            defaultSectionId: (sectionId?.isEmpty == false) ? sectionId : nil,
            defaultOrder: intValue(data["defaultOrder"]) ?? 0,
            defaultBounties: parseBounties(data["defaultBounties"]),
            isActive: (data["isActive"] as? Bool) ?? true,
            startDate: data["startDate"] as? String,
            endDate: data["endDate"] as? String,
            archivedAt: timestampValue(data["archivedAt"])
        )
    }

    private func parseCadence(_ raw: Any?) -> ActionCadence? {
        if let rawType = raw as? String {
            let normalizedType = rawType.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard let type = ActionCadenceType(rawValue: normalizedType) else {
                return nil
            }
            return ActionCadence(type: type, daysOfWeek: nil)
        }

        guard let map = raw as? [String: Any] else {
            return nil
        }

        let typeRaw = ((map["type"] as? String) ?? (map["kind"] as? String) ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard let type = ActionCadenceType(rawValue: typeRaw) else {
            return nil
        }

        let days = (map["daysOfWeek"] as? [Any])?
            .compactMap { ($0 as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
            .filter { !$0.isEmpty }

        return ActionCadence(type: type, daysOfWeek: days?.isEmpty == false ? days : nil)
    }

    private func cadenceAppliesToDate(_ cadence: ActionCadence, dateStr: String) -> Bool {
        switch cadence.type {
        case .daily:
            return true
        case .weekdays:
            guard let weekday = weekdayName(for: dateStr) else { return false }
            return ["monday", "tuesday", "wednesday", "thursday", "friday"].contains(weekday)
        case .weekly:
            guard let weekday = weekdayName(for: dateStr) else { return false }
            let days = cadence.daysOfWeek ?? []
            return days.contains(weekday)
        }
    }

    private func weekdayName(for dateStr: String) -> String? {
        let parts = dateStr.split(separator: "-")
        guard parts.count == 3,
              let year = Int(parts[0]),
              let month = Int(parts[1]),
              let day = Int(parts[2]) else {
            return nil
        }

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
        let components = DateComponents(
            calendar: calendar,
            timeZone: calendar.timeZone,
            year: year,
            month: month,
            day: day
        )
        guard let date = calendar.date(from: components) else {
            return nil
        }

        switch calendar.component(.weekday, from: date) {
        case 1: return "sunday"
        case 2: return "monday"
        case 3: return "tuesday"
        case 4: return "wednesday"
        case 5: return "thursday"
        case 6: return "friday"
        case 7: return "saturday"
        default: return nil
        }
    }

    private func deterministicActionIdFromTemplate(templateId: String, dateStr: String) -> String {
        let safeTemplateId = templateId.replacingOccurrences(
            of: "[^a-zA-Z0-9_-]",
            with: "_",
            options: .regularExpression
        )
        let safeDate = dateStr.replacingOccurrences(
            of: "[^0-9]",
            with: "",
            options: .regularExpression
        )
        let normalizedTemplateId = safeTemplateId.isEmpty ? "template" : safeTemplateId
        return "act_tpl_\(normalizedTemplateId)_\(safeDate)"
    }
}
