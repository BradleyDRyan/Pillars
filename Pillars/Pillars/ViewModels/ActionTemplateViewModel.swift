import Foundation
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class ActionTemplateViewModel: ObservableObject, BackendRequesting {
    @Published var templates: [ActionTemplate] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let db = Firestore.firestore()
    private var templatesListener: ListenerRegistration?
    private var activeUserId: String?
    private var includeInactive = true
    private var allTemplates: [ActionTemplate] = []

    func load(includeInactive: Bool = true) {
        self.includeInactive = includeInactive
        isLoading = true
        errorMessage = nil

        do {
            let userId = try currentUserId()
            if activeUserId != userId || templatesListener == nil {
                startTemplatesListener(for: userId)
            } else {
                publishTemplates()
                isLoading = false
            }
        } catch {
            stopListening()
            templates = []
            isLoading = false
            errorMessage = "Failed to load action templates: \(friendlyErrorMessage(error))"
        }
    }

    func createTemplate(
        title: String,
        notes: String? = nil,
        cadence: ActionCadence,
        section: DaySection.TimeSection = .afternoon
    ) {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        let userId: String
        do {
            userId = try currentUserId()
        } catch {
            errorMessage = "Failed to create action template: \(friendlyErrorMessage(error))"
            return
        }

        Task {
            do {
                let ref = db.collection("actionTemplates").document()
                let now = Date().timeIntervalSince1970
                let normalizedNotes = notes?.trimmingCharacters(in: .whitespacesAndNewlines)

                var payload: [String: Any] = [
                    "id": ref.documentID,
                    "userId": userId,
                    "title": trimmed,
                    "cadence": firestoreCadence(cadence),
                    "defaultSectionId": section.rawValue,
                    "defaultOrder": 0,
                    "defaultBounties": [],
                    "isActive": true,
                    "startDate": NSNull(),
                    "endDate": NSNull(),
                    "createdAt": now,
                    "updatedAt": now,
                    "archivedAt": NSNull()
                ]
                payload["notes"] = (normalizedNotes?.isEmpty == false) ? normalizedNotes! : NSNull()

                try await ref.setData(payload)
            } catch {
                errorMessage = "Failed to create action template: \(friendlyErrorMessage(error))"
            }
        }
    }

    func setTemplateActive(templateId: String, isActive: Bool) {
        let userId: String
        do {
            userId = try currentUserId()
        } catch {
            errorMessage = "Failed to update action template: \(friendlyErrorMessage(error))"
            return
        }

        Task {
            do {
                let ref = db.collection("actionTemplates").document(templateId)
                let snapshot = try await ref.getDocument()
                guard snapshot.exists else {
                    throw BackendError.notFound
                }
                if let ownerId = snapshot.data()?["userId"] as? String, ownerId != userId {
                    throw BackendError.notFound
                }

                try await ref.setData([
                    "isActive": isActive,
                    "updatedAt": Date().timeIntervalSince1970
                ], merge: true)
            } catch {
                errorMessage = "Failed to update action template: \(friendlyErrorMessage(error))"
            }
        }
    }

    func archiveTemplate(templateId: String) {
        let userId: String
        do {
            userId = try currentUserId()
        } catch {
            errorMessage = "Failed to archive action template: \(friendlyErrorMessage(error))"
            return
        }

        Task {
            do {
                let ref = db.collection("actionTemplates").document(templateId)
                let snapshot = try await ref.getDocument()
                guard snapshot.exists else {
                    throw BackendError.notFound
                }
                if let ownerId = snapshot.data()?["userId"] as? String, ownerId != userId {
                    throw BackendError.notFound
                }

                let now = Date().timeIntervalSince1970
                try await ref.setData([
                    "isActive": false,
                    "archivedAt": now,
                    "updatedAt": now
                ], merge: true)
            } catch {
                errorMessage = "Failed to archive action template: \(friendlyErrorMessage(error))"
            }
        }
    }

    func stopListening() {
        templatesListener?.remove()
        templatesListener = nil
        activeUserId = nil
        allTemplates = []
    }

    private func currentUserId() throws -> String {
        guard let userId = Auth.auth().currentUser?.uid else {
            throw BackendError.notAuthenticated
        }
        return userId
    }

    private func startTemplatesListener(for userId: String) {
        templatesListener?.remove()
        templatesListener = nil
        activeUserId = userId
        allTemplates = []

        templatesListener = db.collection("actionTemplates")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                Task { @MainActor in
                    if let error {
                        self.errorMessage = "Failed to load action templates: \(self.friendlyErrorMessage(error))"
                        self.isLoading = false
                        return
                    }

                    self.allTemplates = snapshot?.documents.compactMap { self.templateItem(from: $0) } ?? []
                    self.publishTemplates()
                    self.isLoading = false
                }
            }
    }

    private func publishTemplates() {
        let filtered = allTemplates.filter { template in
            if includeInactive {
                return true
            }
            return template.isActive && template.archivedAt == nil
        }

        templates = filtered.sorted { lhs, rhs in
            if (lhs.createdAt ?? 0) != (rhs.createdAt ?? 0) {
                return (lhs.createdAt ?? 0) < (rhs.createdAt ?? 0)
            }
            return lhs.id < rhs.id
        }
    }

    private func templateItem(from document: QueryDocumentSnapshot) -> ActionTemplate? {
        let data = document.data()
        guard let title = data["title"] as? String,
              let cadence = parseCadence(data["cadence"]) else {
            return nil
        }

        let notes = (data["notes"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let sectionId = (data["defaultSectionId"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)

        return ActionTemplate(
            id: document.documentID,
            userId: data["userId"] as? String,
            title: title,
            notes: (notes?.isEmpty == false) ? notes : nil,
            cadence: cadence,
            defaultSectionId: (sectionId?.isEmpty == false) ? sectionId : nil,
            defaultOrder: intValue(data["defaultOrder"]),
            defaultBounties: parseBounties(data["defaultBounties"]),
            isActive: (data["isActive"] as? Bool) ?? true,
            startDate: data["startDate"] as? String,
            endDate: data["endDate"] as? String,
            createdAt: timestampValue(data["createdAt"]),
            updatedAt: timestampValue(data["updatedAt"]),
            archivedAt: timestampValue(data["archivedAt"])
        )
    }

    private func firestoreCadence(_ cadence: ActionCadence) -> [String: Any] {
        [
            "type": cadence.type.rawValue,
            "daysOfWeek": cadence.daysOfWeek ?? []
        ]
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

    private func parseBounties(_ raw: Any?) -> [ActionBounty] {
        guard let rows = raw as? [[String: Any]] else {
            return []
        }

        return rows.compactMap { row in
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
}
