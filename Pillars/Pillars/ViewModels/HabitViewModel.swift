//
//  HabitViewModel.swift
//  Pillars
//
//  Habits tab view model with direct Firestore reads and writes.
//

import Foundation
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class HabitViewModel: ObservableObject, BackendRequesting {
    @Published var habits: [ScheduledHabit] = []
    @Published var habitGroups: [HabitGroup] = []
    @Published var isLoading = true
    @Published var errorMessage: String?

    private var habitsListener: ListenerRegistration?
    private var habitLogsListener: ListenerRegistration?
    private var habitGroupsListener: ListenerRegistration?
    private var activeUserId: String?
    private var activeDate: String = Day.todayDateString
    private var snapshotsLoaded: (habits: Bool, logs: Bool, groups: Bool) = (false, false, false)
    private var liveHabits: [Habit] = []
    private var liveLogs: [HabitLog] = []
    private var liveGroups: [HabitGroup] = []

    func loadHabits(userId: String, date: String = Day.todayDateString) {
        print("🧭 [Habits] loadHabits(userId: \(userId), date: \(date))")
        activeUserId = userId
        activeDate = date
        isLoading = true
        errorMessage = nil
        snapshotsLoaded = (false, false, false)
        liveHabits = []
        liveLogs = []
        liveGroups = []

        stopListeners()
        startListeners(userId: userId)
    }

    func stopListening() {
        print("🧹 [Habits] stopListening()")
        stopListeners()
        activeUserId = nil
        habits = []
        habitGroups = []
        liveHabits = []
        liveLogs = []
        liveGroups = []
        snapshotsLoaded = (false, false, false)
        isLoading = false
        errorMessage = nil
    }

    func reloadActiveHabits() {
        guard let activeUserId else { return }
        loadHabits(userId: activeUserId, date: activeDate)
    }

    func createHabit(_ input: HabitCreateInput) {
        let trimmedTitle = input.title.trimmingCharacters(in: .whitespacesAndNewlines)
        print("📝 [Habits] createHabit requested with title='\(trimmedTitle)'")

        guard !trimmedTitle.isEmpty else {
            print("🚫 [Habits] createHabit blocked: title is empty")
            return
        }
        guard input.scheduleType == .daily || !input.daysOfWeek.isEmpty else {
            print("🚫 [Habits] createHabit blocked: weekly schedule with no weekdays selected")
            return
        }
        guard input.targetType == .binary || input.targetValue > 0 else {
            print("🚫 [Habits] createHabit blocked: invalid target value \(input.targetValue)")
            return
        }

        runMutation(errorPrefix: "Failed to add habit") {
            guard let userId = self.activeUserId ?? Auth.auth().currentUser?.uid else {
                throw BackendError.notAuthenticated
            }
            print("🔐 [Habits] Resolved userId for create = \(userId)")

            let scheduleDays = input.scheduleType == .weekly
                ? input.daysOfWeek.map(\.rawValue)
                : []
            let targetValue = input.targetType == .binary ? 1 : input.targetValue
            let normalizedUnit = self.normalizedOptionalString(input.targetUnit)
            let resolvedGroup = try await self.resolveGroupForCreate(
                selectedGroupId: input.groupId,
                newGroupName: input.newGroupName,
                userId: userId
            )

            let now = Date().timeIntervalSince1970
            let habitRef = Firestore.firestore().collection("habits").document()
            let normalizedPillarId = self.normalizedPillarIdentifier(input.pillarId)
            let normalizedBountyReason = self.normalizedOptionalString(input.bountyReason)
            let singleBountyAllocation: Any = {
                guard let points = input.bountyPoints, let pillarId = normalizedPillarId else {
                    return NSNull()
                }
                return [["pillarId": pillarId, "points": points]]
            }()
            let payload: [String: Any] = [
                "id": habitRef.documentID,
                "userId": userId,
                "name": trimmedTitle,
                "description": "",
                "sectionId": "morning",
                "order": 0,
                "schedule": [
                    "type": input.scheduleType.rawValue,
                    "daysOfWeek": scheduleDays
                ],
                "target": [
                    "type": input.targetType.rawValue,
                    "value": targetValue,
                    "unit": normalizedUnit ?? NSNull()
                ],
                "isActive": true,
                "pillarId": normalizedPillarId ?? NSNull(),
                "bountyPoints": input.bountyPoints ?? NSNull(),
                "bountyReason": normalizedBountyReason ?? NSNull(),
                "bountyPillarId": NSNull(),
                "bountyAllocations": singleBountyAllocation,
                "groupId": resolvedGroup.id ?? NSNull(),
                "groupName": resolvedGroup.name ?? NSNull(),
                "createdAt": now,
                "updatedAt": now,
                "archivedAt": NSNull()
            ]
            print("🚀 [Habits] Writing new habit \(habitRef.documentID) with groupId=\(String(describing: resolvedGroup.id)) groupName=\(String(describing: resolvedGroup.name))")

            try await habitRef.setData(payload)
            print("✅ [Habits] setData succeeded for habitId=\(habitRef.documentID)")
        }
    }

    func updateHabit(habitId: String, input: HabitCreateInput) {
        let trimmedTitle = input.title.trimmingCharacters(in: .whitespacesAndNewlines)
        print("📝 [Habits] updateHabit requested habitId='\(habitId)' title='\(trimmedTitle)'")

        guard !trimmedTitle.isEmpty else {
            print("🚫 [Habits] updateHabit blocked: title is empty")
            return
        }
        guard input.scheduleType == .daily || !input.daysOfWeek.isEmpty else {
            print("🚫 [Habits] updateHabit blocked: weekly schedule with no weekdays selected")
            return
        }
        guard input.targetType == .binary || input.targetValue > 0 else {
            print("🚫 [Habits] updateHabit blocked: invalid target value \(input.targetValue)")
            return
        }

        runMutation(errorPrefix: "Failed to update habit") {
            guard let userId = self.activeUserId ?? Auth.auth().currentUser?.uid else {
                throw BackendError.notAuthenticated
            }
            print("🔐 [Habits] Resolved userId for update = \(userId)")

            let scheduleDays = input.scheduleType == .weekly
                ? input.daysOfWeek.map(\.rawValue)
                : []
            let targetValue = input.targetType == .binary ? 1 : input.targetValue
            let normalizedUnit = self.normalizedOptionalString(input.targetUnit)
            let resolvedGroup = try await self.resolveGroupForCreate(
                selectedGroupId: input.groupId,
                newGroupName: input.newGroupName,
                userId: userId
            )

            let payload: [String: Any] = [
                "name": trimmedTitle,
                "description": "",
                "schedule": [
                    "type": input.scheduleType.rawValue,
                    "daysOfWeek": scheduleDays
                ],
                "target": [
                    "type": input.targetType.rawValue,
                    "value": targetValue,
                    "unit": normalizedUnit ?? NSNull()
                ],
                "pillarId": self.normalizedPillarIdentifier(input.pillarId) ?? NSNull(),
                "bountyPoints": input.bountyPoints ?? NSNull(),
                "bountyReason": self.normalizedOptionalString(input.bountyReason) ?? NSNull(),
                "bountyPillarId": NSNull(),
                "bountyAllocations": {
                    guard let points = input.bountyPoints,
                          let pillarId = self.normalizedPillarIdentifier(input.pillarId) else {
                        return NSNull()
                    }
                    return [["pillarId": pillarId, "points": points]]
                }(),
                "groupId": resolvedGroup.id ?? NSNull(),
                "groupName": resolvedGroup.name ?? NSNull(),
                "updatedAt": Date().timeIntervalSince1970
            ]

            print(
                "🚀 [Habits] Updating habit \(habitId) with groupId=\(String(describing: resolvedGroup.id)) "
                + "groupName=\(String(describing: resolvedGroup.name))"
            )

            try await Firestore.firestore().collection("habits").document(habitId).setData(payload, merge: true)
            print("✅ [Habits] update setData succeeded for habitId=\(habitId)")
        }
    }

    func setHabitPillar(habitId: String, pillarId: String?) {
        runMutation(errorPrefix: "Failed to retag habit") {
            try await Firestore.firestore().collection("habits").document(habitId).setData([
                "pillarId": self.normalizedPillarIdentifier(pillarId) ?? NSNull(),
                "updatedAt": Date().timeIntervalSince1970
            ], merge: true)
        }
    }

    func setHabitCompletion(
        habitId: String,
        isCompleted: Bool,
        status: HabitLogStatus? = nil,
        date: String = Day.todayDateString
    ) {
        runMutation(errorPrefix: "Failed to update habit") {
            guard let userId = self.activeUserId ?? Auth.auth().currentUser?.uid else {
                throw BackendError.notAuthenticated
            }

            let logId = "\(habitId)_\(date)"
            let pointEventId = "pe_habit_\(habitId)_\(date)"
            let logRef = Firestore.firestore().collection("habitLogs").document(logId)
            let existing = try await logRef.getDocument()
            let existingData = existing.data() ?? [:]
            let now = Date().timeIntervalSince1970
            let createdAt = self.timestampValue(existingData["createdAt"]) ?? now
            let resolvedStatus = self.resolveHabitLogStatus(for: isCompleted, requestedStatus: status)
            let expectPaid = resolvedStatus == .completed

            do {
                let habitSnapshot = try await Firestore.firestore().collection("habits").document(habitId).getDocument()
                let habitData = habitSnapshot.data() ?? [:]
                let bountyReasonRaw = (habitData["bountyReason"] as? String)?
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                let bountyReason = (bountyReasonRaw?.isEmpty == false) ? (bountyReasonRaw ?? "nil") : "nil"
                print(
                    "🧪 [Habit Bounty] Preflight habitId=\(habitId) date=\(date) expectedPointEventId=\(pointEventId) expectPaid=\(expectPaid) "
                    + "habitPillarId=\((habitData["pillarId"] as? String) ?? "nil") "
                    + "bountyPillarId=\((habitData["bountyPillarId"] as? String) ?? "nil") "
                    + "bountyPoints=\(String(describing: self.intValue(habitData["bountyPoints"]))) "
                    + "bountyAllocations=\(self.allocationsSummary(habitData["bountyAllocations"])) "
                    + "bountyReason=\(bountyReason)"
                )
            } catch {
                print("⚠️ [Habit Bounty] Preflight read failed habitId=\(habitId) date=\(date): \(self.friendlyErrorMessage(error))")
            }

            let payload: [String: Any] = [
                "id": logId,
                "userId": userId,
                "habitId": habitId,
                "date": date,
                "completed": resolvedStatus == .completed,
                "status": resolvedStatus.rawValue,
                "value": existingData["value"] ?? NSNull(),
                "notes": existingData["notes"] as? String ?? "",
                "createdAt": createdAt,
                "updatedAt": now
            ]

            print("🧪 [Habit Bounty] Request completion update habitId=\(habitId) date=\(date) status=\(resolvedStatus.rawValue) expectPaid=\(expectPaid) expectedPointEventId=\(pointEventId)")
            try await logRef.setData(payload, merge: true)
            print("✅ [Habit Bounty] Firestore log write succeeded habitId=\(habitId) date=\(date) status=\(resolvedStatus.rawValue)")

            Task { @MainActor [weak self] in
                await self?.verifyHabitBountyTrigger(
                    habitId: habitId,
                    date: date,
                    expectPaid: expectPaid
                )
            }
        }
    }

    func skipHabit(habitId: String, date: String = Day.todayDateString) {
        setHabitCompletion(habitId: habitId, isCompleted: false, status: .skipped, date: date)
    }

    func markHabitPending(habitId: String, date: String = Day.todayDateString) {
        setHabitCompletion(habitId: habitId, isCompleted: false, status: .pending, date: date)
    }

    func deleteHabit(habitId: String) {
        runMutation(errorPrefix: "Failed to delete habit") {
            let now = Date().timeIntervalSince1970
            try await Firestore.firestore().collection("habits").document(habitId).setData([
                "isActive": false,
                "archivedAt": now,
                "updatedAt": now
            ], merge: true)
        }
    }

    func currentDate() -> String {
        activeDate
    }

    private func startListeners(userId: String) {
        print("👂 [Habits] Starting listeners for userId=\(userId)")

        habitsListener = Firestore.firestore()
            .collection("habits")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                Task { @MainActor in
                    print("📥 [Habits] habits snapshot docs=\(snapshot?.documents.count ?? 0), error=\(error?.localizedDescription ?? "none")")
                    self.snapshotsLoaded.habits = true
                    if let error {
                        self.errorMessage = "Failed to load habits: \(self.friendlyErrorMessage(error))"
                        self.rebuildScheduledHabits(clearError: false)
                        return
                    }

                    self.liveHabits = snapshot?.documents.compactMap { self.habit(from: $0) } ?? []
                    self.rebuildScheduledHabits(clearError: true)
                }
            }

        habitLogsListener = Firestore.firestore()
            .collection("habitLogs")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                Task { @MainActor in
                    print("📥 [Habits] habitLogs snapshot docs=\(snapshot?.documents.count ?? 0), error=\(error?.localizedDescription ?? "none")")
                    self.snapshotsLoaded.logs = true
                    if let error {
                        self.errorMessage = "Failed to load habits: \(self.friendlyErrorMessage(error))"
                        self.rebuildScheduledHabits(clearError: false)
                        return
                    }

                    self.liveLogs = snapshot?.documents.compactMap { self.habitLog(from: $0) } ?? []
                    self.rebuildScheduledHabits(clearError: true)
                }
            }

        habitGroupsListener = Firestore.firestore()
            .collection("habitGroups")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                Task { @MainActor in
                    print("📥 [Habits] habitGroups snapshot docs=\(snapshot?.documents.count ?? 0), error=\(error?.localizedDescription ?? "none")")
                    self.snapshotsLoaded.groups = true
                    if let error {
                        self.errorMessage = "Failed to load habits: \(self.friendlyErrorMessage(error))"
                        self.rebuildScheduledHabits(clearError: false)
                        return
                    }

                    self.liveGroups = snapshot?.documents.compactMap { self.habitGroup(from: $0) } ?? []
                    self.rebuildScheduledHabits(clearError: true)
                }
            }
    }

    private func stopListeners() {
        habitsListener?.remove()
        habitsListener = nil
        habitLogsListener?.remove()
        habitLogsListener = nil
        habitGroupsListener?.remove()
        habitGroupsListener = nil
    }

    private func rebuildScheduledHabits(clearError: Bool) {
        let allLoaded = snapshotsLoaded.habits && snapshotsLoaded.logs && snapshotsLoaded.groups
        isLoading = !allLoaded
        guard allLoaded else { return }

        let activeGroups = sortedGroups(liveGroups.filter { !$0.isArchived })
        let logsByHabitId = Dictionary(uniqueKeysWithValues: liveLogs
            .filter { $0.date == activeDate }
            .map { ($0.habitId, $0) })

        let scheduledItems = liveHabits
            .filter { habitAppliesToDate($0, date: activeDate) }
            .map { habit in
                let log = logsByHabitId[habit.id] ?? HabitLog(
                    id: nil,
                    userId: habit.userId,
                    habitId: habit.id,
                    date: activeDate,
                    completed: false,
                    value: nil,
                    notes: "",
                    createdAt: nil,
                    updatedAt: nil
                )

                return ScheduledHabit(
                    id: habit.id,
                    userId: habit.userId,
                    name: habit.name,
                    description: habit.description,
                    sectionId: habit.sectionId,
                    order: habit.order,
                    schedule: habit.schedule,
                    target: habit.target,
                    isActive: habit.isActive,
                    pillarId: habit.pillarId,
                    bountyPoints: habit.bountyPoints,
                    bountyPillarId: habit.bountyPillarId,
                    bountyReason: habit.bountyReason,
                    bountyAllocations: habit.bountyAllocations,
                    groupId: habit.groupId,
                    groupName: habit.groupName,
                    createdAt: habit.createdAt,
                    updatedAt: habit.updatedAt,
                    archivedAt: habit.archivedAt,
                    log: log
                )
            }

        habitGroups = activeGroups
        habits = sortedHabits(scheduledItems, groups: activeGroups)
        if clearError {
            errorMessage = nil
        }
    }

    private func runMutation(
        errorPrefix: String,
        operation: @escaping () async throws -> Void
    ) {
        Task { [weak self] in
            guard let self else { return }

            do {
                try await operation()
                print("✅ [Habits] Mutation success")
            } catch {
                print("❌ [Habits] Mutation failed: \(self.friendlyErrorMessage(error))")
                self.errorMessage = "\(errorPrefix): \(self.friendlyErrorMessage(error))"
            }
        }
    }

    private struct ResolvedGroupForCreate {
        let id: String?
        let name: String?
    }

    private func resolveGroupForCreate(
        selectedGroupId: String?,
        newGroupName: String?,
        userId: String
    ) async throws -> ResolvedGroupForCreate {
        print("🧩 [Habits] resolveGroupForCreate(selectedGroupId:\(String(describing: selectedGroupId)), newGroupName:\(String(describing: newGroupName)), userId:\(userId))")

        if let normalizedGroupName = normalizedOptionalString(newGroupName) {
            if let existing = liveGroups.first(where: {
                $0.name.compare(normalizedGroupName, options: [.caseInsensitive, .diacriticInsensitive]) == .orderedSame
            }) {
                print("♻️ [Habits] Reusing existing habit group '\(existing.name)' (\(existing.id))")
                return ResolvedGroupForCreate(
                    id: existing.id,
                    name: existing.name
                )
            }

            let now = Date().timeIntervalSince1970
            let groupRef = Firestore.firestore().collection("habitGroups").document()
            print("🆕 [Habits] Creating new habit group '\(normalizedGroupName)' as \(groupRef.documentID)")
            let payload: [String: Any] = [
                "id": groupRef.documentID,
                "userId": userId,
                "name": normalizedGroupName,
                "createdAt": now,
                "updatedAt": now,
                "archivedAt": NSNull()
            ]
            try await groupRef.setData(payload)
            print("✅ [Habits] New group created id=\(groupRef.documentID)")
            return ResolvedGroupForCreate(
                id: groupRef.documentID,
                name: normalizedGroupName
            )
        }

        if let groupId = normalizedOptionalString(selectedGroupId) {
            let existingName = liveGroups.first(where: { $0.id == groupId })?.name
            print("✅ [Habits] Using selected groupId=\(groupId) name=\(String(describing: existingName))")
            return ResolvedGroupForCreate(
                id: groupId,
                name: existingName
            )
        }

        print("⚪️ [Habits] No group selected/created for habit")
        return ResolvedGroupForCreate(id: nil, name: nil)
    }

    private func normalizedPillarIdentifier(_ rawPillarId: String?) -> String? {
        guard let rawPillarId else { return nil }
        let trimmed = rawPillarId.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func normalizedOptionalString(_ rawValue: String?) -> String? {
        guard let rawValue else { return nil }
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func sortedHabits(_ items: [ScheduledHabit], groups: [HabitGroup]) -> [ScheduledHabit] {
        let groupsById = Dictionary(uniqueKeysWithValues: groups.map { ($0.id, $0.name) })

        return items.sorted { lhs, rhs in
            let lhsGroup = normalizedGroupSortValue(for: lhs, groupsById: groupsById)
            let rhsGroup = normalizedGroupSortValue(for: rhs, groupsById: groupsById)
            if lhsGroup != rhsGroup {
                return lhsGroup < rhsGroup
            }

            if lhs.name != rhs.name {
                return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
            }

            let lhsCreated = lhs.createdAt ?? 0
            let rhsCreated = rhs.createdAt ?? 0
            if lhsCreated != rhsCreated {
                return lhsCreated < rhsCreated
            }

            return lhs.id < rhs.id
        }
    }

    private func sortedGroups(_ groups: [HabitGroup]) -> [HabitGroup] {
        groups.sorted { lhs, rhs in
            if lhs.name != rhs.name {
                return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
            }

            let lhsCreated = lhs.createdAt ?? 0
            let rhsCreated = rhs.createdAt ?? 0
            if lhsCreated != rhsCreated {
                return lhsCreated < rhsCreated
            }

            return lhs.id < rhs.id
        }
    }

    private func normalizedGroupSortValue(
        for habit: ScheduledHabit,
        groupsById: [String: String]
    ) -> String {
        let resolvedName: String?
        if let groupId = normalizedOptionalString(habit.groupId) {
            resolvedName = groupsById[groupId]
        } else {
            resolvedName = nil
        }

        let raw = (resolvedName ?? habit.groupName)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if raw.isEmpty {
            return "0-no-group"
        }
        return "1-\(raw.lowercased())"
    }

    private func habitAppliesToDate(_ habit: Habit, date: String) -> Bool {
        guard !habit.isArchived else { return false }
        guard habit.isActive ?? true else { return false }

        let scheduleType = habit.schedule?.normalizedType ?? "daily"
        if scheduleType == "weekly" {
            let weekday = weekday(from: date)
            return habit.schedule?.normalizedDaysOfWeek.contains(weekday) ?? false
        }

        return true
    }

    private func weekday(from dateStr: String) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: dateStr) else { return "monday" }

        let weekdayIndex = Calendar(identifier: .gregorian).component(.weekday, from: date) - 1
        let weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
        guard weekdays.indices.contains(weekdayIndex) else { return "monday" }
        return weekdays[weekdayIndex]
    }

    private func habit(from document: QueryDocumentSnapshot) -> Habit? {
        let data = document.data()
        guard let name = data["name"] as? String else { return nil }

        let scheduleData = data["schedule"] as? [String: Any]
        let targetData = data["target"] as? [String: Any]

        let schedule = HabitSchedule(
            type: scheduleData?["type"] as? String,
            daysOfWeek: scheduleData?["daysOfWeek"] as? [String]
        )
        let target = HabitTarget(
            type: targetData?["type"] as? String,
            value: doubleValue(targetData?["value"]),
            unit: targetData?["unit"] as? String
        )

        return Habit(
            id: document.documentID,
            userId: data["userId"] as? String,
            name: name,
            description: data["description"] as? String,
            sectionId: data["sectionId"] as? String,
            order: intValue(data["order"]),
            schedule: scheduleData == nil ? nil : schedule,
            target: targetData == nil ? nil : target,
            isActive: boolValue(data["isActive"]) ?? true,
            pillarId: data["pillarId"] as? String,
            bountyPoints: intValue(data["bountyPoints"]),
            bountyPillarId: data["bountyPillarId"] as? String,
            bountyReason: data["bountyReason"] as? String,
            bountyAllocations: (data["bountyAllocations"] as? [[String: Any]])?.compactMap { allocation in
                guard let pillarId = allocation["pillarId"] as? String,
                      let points = intValue(allocation["points"]) else {
                    return nil
                }
                return HabitBountyAllocation(pillarId: pillarId, points: points)
            },
            groupId: data["groupId"] as? String,
            groupName: data["groupName"] as? String,
            createdAt: timestampValue(data["createdAt"]),
            updatedAt: timestampValue(data["updatedAt"]),
            archivedAt: timestampValue(data["archivedAt"])
        )
    }

    private func habitLog(from document: QueryDocumentSnapshot) -> HabitLog? {
        let data = document.data()
        guard let habitId = data["habitId"] as? String,
              let date = data["date"] as? String else {
            return nil
        }
        let normalizedStatus = (data["status"] as? String)?.lowercased()

        return HabitLog(
            id: document.documentID,
            userId: data["userId"] as? String,
            habitId: habitId,
            date: date,
            completed: boolValue(data["completed"]) ?? false,
            status: HabitLogStatus(rawValue: normalizedStatus ?? ""),
            value: doubleValue(data["value"]),
            notes: data["notes"] as? String ?? "",
            createdAt: timestampValue(data["createdAt"]),
            updatedAt: timestampValue(data["updatedAt"])
        )
    }

    private func resolveHabitLogStatus(
        for isCompleted: Bool,
        requestedStatus: HabitLogStatus?
    ) -> HabitLogStatus {
        guard let requestedStatus else {
            return isCompleted ? .completed : .pending
        }

        if requestedStatus == .skipped {
            return isCompleted ? .completed : .skipped
        }

        if requestedStatus == .completed {
            return .completed
        }

        return isCompleted ? .completed : .pending
    }

    private func habitGroup(from document: QueryDocumentSnapshot) -> HabitGroup? {
        let data = document.data()
        guard let name = data["name"] as? String else { return nil }

        return HabitGroup(
            id: document.documentID,
            userId: data["userId"] as? String,
            name: name,
            createdAt: timestampValue(data["createdAt"]),
            updatedAt: timestampValue(data["updatedAt"]),
            archivedAt: timestampValue(data["archivedAt"])
        )
    }

    private func intValue(_ raw: Any?) -> Int? {
        switch raw {
        case let value as Int:
            return value
        case let value as Int64:
            return Int(value)
        case let value as Double:
            return Int(value.rounded(.towardZero))
        case let value as NSNumber:
            return value.intValue
        default:
            return nil
        }
    }

    private func doubleValue(_ raw: Any?) -> Double? {
        switch raw {
        case let value as Double:
            return value
        case let value as Int:
            return Double(value)
        case let value as Int64:
            return Double(value)
        case let value as NSNumber:
            return value.doubleValue
        default:
            return nil
        }
    }

    private func boolValue(_ raw: Any?) -> Bool? {
        switch raw {
        case let value as Bool:
            return value
        case let value as NSNumber:
            return value.boolValue
        default:
            return nil
        }
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

    private func verifyHabitBountyTrigger(habitId: String, date: String, expectPaid: Bool) async {
        guard !habitId.isEmpty, !date.isEmpty else { return }
        let db = Firestore.firestore()
        let pointEventId = "pe_habit_\(habitId)_\(date)"
        print("🧪 [Habit Bounty] Verify start habitId=\(habitId) date=\(date) expectedPointEventId=\(pointEventId) expectPaid=\(expectPaid)")

        for attempt in 1...8 {
            do {
                let pointEventSnapshot = try await db.collection("pointEvents").document(pointEventId).getDocument()
                let pointEventData = pointEventSnapshot.data() ?? [:]
                let eventExists = pointEventSnapshot.exists
                let voidedAt = timestampValue(pointEventData["voidedAt"])
                let totalPoints = intValue(pointEventData["totalPoints"])
                let allocations = allocationsSummary(pointEventData["allocations"])

                if expectPaid {
                    let isPaid = eventExists && voidedAt == nil
                    if isPaid {
                        print(
                            "✅ [Habit Bounty] Verified payout habitId=\(habitId) date=\(date) attempt=\(attempt) pointEventId=\(pointEventId) totalPoints=\(String(describing: totalPoints)) allocations=\(allocations)"
                        )
                        return
                    }

                    print(
                        "⏳ [Habit Bounty] Waiting for payout habitId=\(habitId) date=\(date) attempt=\(attempt) pointEventExists=\(eventExists) voidedAt=\(String(describing: voidedAt))"
                    )
                } else {
                    let isReversed = !eventExists || voidedAt != nil
                    if isReversed {
                        print(
                            "✅ [Habit Bounty] Verified reversal habitId=\(habitId) date=\(date) attempt=\(attempt) pointEventExists=\(eventExists) voidedAt=\(String(describing: voidedAt))"
                        )
                        return
                    }

                    print(
                        "⏳ [Habit Bounty] Waiting for reversal habitId=\(habitId) date=\(date) attempt=\(attempt) pointEventExists=\(eventExists) voidedAt=\(String(describing: voidedAt))"
                    )
                }
            } catch {
                print("❌ [Habit Bounty] Verification read failed habitId=\(habitId) date=\(date) attempt=\(attempt): \(friendlyErrorMessage(error))")
            }

            try? await Task.sleep(nanoseconds: 1_000_000_000)
        }

        print("⚠️ [Habit Bounty] Verification timed out habitId=\(habitId) date=\(date) expectedPaid=\(expectPaid)")
    }
}
