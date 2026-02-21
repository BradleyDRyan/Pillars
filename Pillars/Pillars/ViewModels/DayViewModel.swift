//
//  DayViewModel.swift
//  Pillars
//
//  Block System view model backed by Firestore snapshots and direct mutations.
//

import Foundation
import FirebaseAuth
import FirebaseFirestore

@MainActor
class DayViewModel: ObservableObject, BackendRequesting {
    @Published var day: Day?
    @Published var isLoading = true
    @Published var errorMessage: String?
    @Published var customBlockTypes: [BlockType] = []

    private var mutationTask: Task<Void, Never>?
    private var blockTypes: [BlockType] = BlockType.all
    private var blockTypesListener: ListenerRegistration?
    private var dayBlocksListener: ListenerRegistration?
    private var dayTodosListener: ListenerRegistration?
    private var habitsListener: ListenerRegistration?
    private var habitLogsListener: ListenerRegistration?
    private var activeDayUserId: String?
    private var activeDayDate: String?
    private var activeBlockTypeUserId: String?
    private var daySnapshotLoaded: (blocks: Bool, todos: Bool, habits: Bool, logs: Bool) = (false, false, false, false)
    private var liveDayBlocks: [Block] = []
    private var liveDayTodos: [DayTodoPrimitive] = []
    private var liveHabits: [HabitPrimitive] = []
    private var liveHabitLogs: [HabitLogPrimitive] = []

    var allBlockTypes: (builtIns: [BlockType], custom: [BlockType]) {
        (
            builtIns: blockTypes.filter { $0.category == "built-in" },
            custom: customBlockTypes
        )
    }

    func loadToday(userId: String) {
        loadDay(userId: userId, dateStr: Day.todayDateString)
    }

    func loadBlockTypes(userId: String) {
        startBlockTypeListener(userId: userId)
    }

    func loadDay(userId: String, dateStr: String) {
        isLoading = true
        errorMessage = nil
        activeDayUserId = userId
        activeDayDate = dateStr
        daySnapshotLoaded = (false, false, false, false)
        liveDayBlocks = []
        liveDayTodos = []
        liveHabits = []
        liveHabitLogs = []

        startBlockTypeListener(userId: userId)
        startDayListeners(userId: userId, date: dateStr)
    }

    func stopListening() {
        mutationTask?.cancel()
        mutationTask = nil
        blockTypesListener?.remove()
        blockTypesListener = nil
        activeBlockTypeUserId = nil
        stopDayListeners()
        activeDayUserId = nil
        activeDayDate = nil
        daySnapshotLoaded = (false, false, false, false)
        liveDayBlocks = []
        liveDayTodos = []
        liveHabits = []
        liveHabitLogs = []
    }

    func toggleBlock(_ blockId: String, in section: DaySection.TimeSection) {
        guard var day = day else { return }
        guard let sectionIndex = day.sections.firstIndex(where: { $0.id == section }),
              let blockIndex = day.sections[sectionIndex].blocks.firstIndex(where: { $0.id == blockId }) else {
            return
        }

        day.sections[sectionIndex].blocks[blockIndex].isExpanded.toggle()
        self.day = day

        let block = day.sections[sectionIndex].blocks[blockIndex]
        updateBlock(block, in: section)
    }

    func updateBlock(_ block: Block, in section: DaySection.TimeSection) {
        guard var day = day else { return }
        guard let sectionIndex = day.sections.firstIndex(where: { $0.id == section }),
              let blockIndex = day.sections[sectionIndex].blocks.firstIndex(where: { $0.id == block.id }) else {
            return
        }

        day.sections[sectionIndex].blocks[blockIndex] = block
        self.day = day

        let date = day.date
        mutationTask?.cancel()
        mutationTask = Task {
            do {
                try await patchBlock(block: block, section: section, date: date)
            } catch {
                self.errorMessage = "Failed to update block: \(friendlyErrorMessage(error))"
            }
            self.mutationTask = nil
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

    func createTodo(
        title: String,
        dueDate: String?,
        section: DaySection.TimeSection = .afternoon
    ) {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        Task {
            do {
                guard let userId = activeDayUserId ?? Auth.auth().currentUser?.uid else {
                    throw BackendError.notAuthenticated
                }
                let now = Date().timeIntervalSince1970
                let todoRef = Firestore.firestore().collection("todos").document()
                let body: [String: Any] = [
                    "id": todoRef.documentID,
                    "userId": userId,
                    "content": trimmed,
                    "description": "",
                    "dueDate": dueDate ?? NSNull(),
                    "sectionId": section.rawValue,
                    "order": nextOrderForSection(section),
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

    func setHabitPillar(habitId: String, pillarId: String?) {
        Task {
            do {
                try await Firestore.firestore().collection("habits").document(habitId).setData([
                    "pillarId": normalizedPillarIdentifier(pillarId) ?? NSNull(),
                    "updatedAt": Date().timeIntervalSince1970
                ], merge: true)
            } catch {
                self.errorMessage = "Failed to retag habit: \(friendlyErrorMessage(error))"
            }
        }
    }

    func setDayBlockPillar(
        blockId: String,
        section: DaySection.TimeSection,
        pillarId: String?
    ) {
        _ = section

        Task {
            do {
                let normalizedPillarId: Any = normalizedPillarIdentifier(pillarId) ?? NSNull()
                if blockId.hasPrefix("proj_todo_") {
                    let todoId = String(blockId.dropFirst("proj_todo_".count))
                    try await Firestore.firestore().collection("todos").document(todoId).setData([
                        "pillarId": normalizedPillarId,
                        "updatedAt": Date().timeIntervalSince1970
                    ], merge: true)
                    return
                }

                if blockId.hasPrefix("proj_habit_") {
                    let habitId = String(blockId.dropFirst("proj_habit_".count))
                    try await Firestore.firestore().collection("habits").document(habitId).setData([
                        "pillarId": normalizedPillarId,
                        "updatedAt": Date().timeIntervalSince1970
                    ], merge: true)
                    return
                }

                try await Firestore.firestore().collection("dayBlocks").document(blockId).setData([
                    "pillarId": normalizedPillarId,
                    "updatedAt": Date().timeIntervalSince1970
                ], merge: true)
            } catch {
                self.errorMessage = "Failed to retag block: \(friendlyErrorMessage(error))"
            }
        }
    }

    func projectedTodoId(for block: Block) -> String? {
        if block.id.hasPrefix("proj_todo_") {
            let value = String(block.id.dropFirst("proj_todo_".count))
            return value.isEmpty ? nil : value
        }

        return block.data["todoId"]?.stringValue
    }

    func projectedHabitId(for block: Block) -> String? {
        if block.id.hasPrefix("proj_habit_") {
            let value = String(block.id.dropFirst("proj_habit_".count))
            return value.isEmpty ? nil : value
        }

        if block.typeId == "habit-stack" {
            return habitStackItems(for: block).first?.habitId
        }

        return block.data["habitId"]?.stringValue
    }

    func habitStackItems(for block: Block) -> [HabitStackItem] {
        guard block.typeId == "habit-stack" else { return [] }
        if let rawItems = block.data["habitItems"]?.arrayValue {
            let parsed = rawItems.compactMap { item -> HabitStackItem? in
                guard let object = item.objectValue,
                      let habitId = object["habitId"]?.stringValue else {
                    return nil
                }

                return HabitStackItem(
                    habitId: habitId,
                    name: object["name"]?.stringValue ?? "Habit",
                    isCompleted: object["completed"]?.boolValue ?? false,
                    order: Int(object["order"]?.numberValue ?? 0)
                )
            }

            return parsed.sorted { lhs, rhs in
                if lhs.order != rhs.order {
                    return lhs.order < rhs.order
                }
                return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
            }
        }

        let primaryId = block.data["primaryHabitId"]?.stringValue
        let primaryName = block.data["primaryHabitName"]?.stringValue
        guard let habitId = primaryId else { return [] }
        return [HabitStackItem(
            habitId: habitId,
            name: primaryName ?? "Habit",
            isCompleted: block.data["primaryCompleted"]?.boolValue ?? false,
            order: Int(block.data["primaryOrder"]?.numberValue ?? 0)
        )]
    }

    func setHabitCompletion(
        habitId: String,
        isCompleted: Bool,
        status: HabitLogStatus? = nil,
        date: String? = nil
    ) {
        let targetDate = date ?? activeDayDate ?? Day.todayDateString

        Task {
            do {
                guard let userId = activeDayUserId ?? Auth.auth().currentUser?.uid else {
                    throw BackendError.notAuthenticated
                }
                let logId = "\(habitId)_\(targetDate)"
                let pointEventId = "pe_habit_\(habitId)_\(targetDate)"
                let logRef = Firestore.firestore().collection("habitLogs").document(logId)
                let existing = try await logRef.getDocument()
                let existingData = existing.data() ?? [:]
                let now = Date().timeIntervalSince1970
                let createdAt = timestampValue(existingData["createdAt"]) ?? now
                let resolvedStatus = resolveHabitLogStatus(for: isCompleted, requestedStatus: status)
                let expectPaid = resolvedStatus == .completed

                do {
                    let habitSnapshot = try await Firestore.firestore().collection("habits").document(habitId).getDocument()
                    let habitData = habitSnapshot.data() ?? [:]
                    let bountyReasonRaw = (habitData["bountyReason"] as? String)?
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    let bountyReason = (bountyReasonRaw?.isEmpty == false) ? (bountyReasonRaw ?? "nil") : "nil"
                    print(
                        "🧪 [Habit Bounty][Day] Preflight habitId=\(habitId) date=\(targetDate) expectedPointEventId=\(pointEventId) expectPaid=\(expectPaid) "
                        + "habitPillarId=\((habitData["pillarId"] as? String) ?? "nil") "
                        + "bountyPillarId=\((habitData["bountyPillarId"] as? String) ?? "nil") "
                        + "bountyPoints=\(String(describing: intValue(habitData["bountyPoints"]))) "
                        + "bountyAllocations=\(allocationsSummary(habitData["bountyAllocations"])) "
                        + "bountyReason=\(bountyReason)"
                    )
                } catch {
                    print("⚠️ [Habit Bounty][Day] Preflight read failed habitId=\(habitId) date=\(targetDate): \(friendlyErrorMessage(error))")
                }

                let payload: [String: Any] = [
                    "id": logId,
                    "userId": userId,
                    "habitId": habitId,
                    "date": targetDate,
                    "completed": resolvedStatus == .completed,
                    "status": resolvedStatus.rawValue,
                    "value": existingData["value"] ?? NSNull(),
                    "notes": existingData["notes"] as? String ?? "",
                    "createdAt": createdAt,
                    "updatedAt": now
                ]

                print("🧪 [Habit Bounty][Day] Request completion update habitId=\(habitId) date=\(targetDate) status=\(resolvedStatus.rawValue) expectPaid=\(expectPaid) expectedPointEventId=\(pointEventId)")
                try await logRef.setData(payload, merge: true)
                print("✅ [Habit Bounty][Day] Firestore log write succeeded habitId=\(habitId) date=\(targetDate) status=\(resolvedStatus.rawValue)")

                Task { @MainActor [weak self] in
                    await self?.verifyHabitBountyTrigger(
                        habitId: habitId,
                        date: targetDate,
                        expectPaid: expectPaid
                    )
                }
            } catch {
                self.errorMessage = "Failed to update habit completion: \(self.friendlyErrorMessage(error))"
            }
        }
    }

    func skipHabit(habitId: String, date: String? = nil) {
        setHabitCompletion(habitId: habitId, isCompleted: false, status: .skipped, date: date)
    }

    func markHabitPending(habitId: String, date: String? = nil) {
        setHabitCompletion(habitId: habitId, isCompleted: false, status: .pending, date: date)
    }

    func addBlock(typeId: String, to section: DaySection.TimeSection, customType: BlockType? = nil) {
        if typeId == "todo" {
            addTodoBlock(title: "New Task", to: section)
            return
        }

        if typeId == "habits" {
            addHabitItem(title: "New Habit", to: section)
            return
        }

        if typeId == "habit-stack" {
            return
        }

        guard let date = day?.date else { return }
        let nextOrder = nextOrderForSection(section)
        let block = Block.make(typeId: typeId, sectionId: section, order: nextOrder, customType: customType)

        Task {
            do {
                guard let userId = activeDayUserId ?? Auth.auth().currentUser?.uid else {
                    throw BackendError.notAuthenticated
                }
                let now = Date().timeIntervalSince1970
                let blockRef = Firestore.firestore().collection("dayBlocks").document()
                let payload: [String: Any] = [
                    "id": blockRef.documentID,
                    "userId": userId,
                    "date": date,
                    "typeId": block.typeId,
                    "sectionId": section.rawValue,
                    "order": block.order,
                    "isExpanded": block.isExpanded,
                    "title": block.title ?? NSNull(),
                    "subtitle": block.subtitle ?? NSNull(),
                    "icon": block.icon ?? NSNull(),
                    "pillarId": block.pillarId ?? NSNull(),
                    "source": block.source ?? "user",
                    "data": block.dataDictionary(),
                    "createdAt": now,
                    "updatedAt": now
                ]

                try await blockRef.setData(payload)
            } catch {
                self.errorMessage = "Failed to add block: \(friendlyErrorMessage(error))"
            }
        }
    }

    func addTodoBlock(title: String, to section: DaySection.TimeSection = .afternoon) {
        createTodo(title: title, dueDate: day?.date, section: section)
    }

    func addHabitItem(title: String, to section: DaySection.TimeSection = .morning) {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        Task {
            do {
                guard let userId = activeDayUserId ?? Auth.auth().currentUser?.uid else {
                    throw BackendError.notAuthenticated
                }
                let now = Date().timeIntervalSince1970
                let habitRef = Firestore.firestore().collection("habits").document()
                let body: [String: Any] = [
                    "id": habitRef.documentID,
                    "userId": userId,
                    "name": trimmed,
                    "sectionId": section.rawValue,
                    "order": nextOrderForSection(section),
                    "schedule": [
                        "type": "daily",
                        "daysOfWeek": []
                    ],
                    "target": [
                        "type": "binary",
                        "value": 1
                    ],
                    "isActive": true,
                    "pillarId": NSNull(),
                    "groupId": NSNull(),
                    "groupName": NSNull(),
                    "createdAt": now,
                    "updatedAt": now,
                    "archivedAt": NSNull()
                ]

                try await habitRef.setData(body)
            } catch {
                self.errorMessage = "Failed to add habit: \(friendlyErrorMessage(error))"
            }
        }
    }

    func deleteBlock(_ blockId: String, from section: DaySection.TimeSection) {
        _ = section

        Task {
            do {
                let now = Date().timeIntervalSince1970
                if blockId.hasPrefix("proj_todo_") {
                    let todoId = String(blockId.dropFirst("proj_todo_".count))
                    try await Firestore.firestore().collection("todos").document(todoId).setData([
                        "archivedAt": now,
                        "updatedAt": now
                    ], merge: true)
                    return
                }

                if blockId.hasPrefix("proj_habit_") {
                    let habitId = String(blockId.dropFirst("proj_habit_".count))
                    try await Firestore.firestore().collection("habits").document(habitId).setData([
                        "isActive": false,
                        "archivedAt": now,
                        "updatedAt": now
                    ], merge: true)
                    return
                }

                try await Firestore.firestore().collection("dayBlocks").document(blockId).delete()
            } catch {
                self.errorMessage = "Failed to delete block: \(friendlyErrorMessage(error))"
            }
        }
    }

    func moveBlock(from source: IndexSet, to destination: Int, in section: DaySection.TimeSection) {
        guard var day = day else { return }
        guard let sectionIndex = day.sections.firstIndex(where: { $0.id == section }) else { return }

        day.sections[sectionIndex].blocks.move(fromOffsets: source, toOffset: destination)
        for idx in day.sections[sectionIndex].blocks.indices {
            day.sections[sectionIndex].blocks[idx].order = idx
            day.sections[sectionIndex].blocks[idx].sectionId = section
        }

        self.day = day
        let date = day.date
        let blocks = day.sections[sectionIndex].blocks

        Task {
            do {
                for block in blocks {
                    if let todoId = projectedTodoId(for: block) {
                        try await Firestore.firestore().collection("todos").document(todoId).setData([
                            "sectionId": section.rawValue,
                            "order": block.order,
                            "updatedAt": Date().timeIntervalSince1970
                        ], merge: true)
                        continue
                    }

                    if let habitId = projectedHabitId(for: block) {
                        try await Firestore.firestore().collection("habits").document(habitId).setData([
                            "sectionId": section.rawValue,
                            "order": block.order,
                            "updatedAt": Date().timeIntervalSince1970
                        ], merge: true)
                        continue
                    }

                    try await Firestore.firestore().collection("dayBlocks").document(block.id).setData([
                        "sectionId": section.rawValue,
                        "order": block.order,
                        "updatedAt": Date().timeIntervalSince1970
                    ], merge: true)
                }
            } catch {
                self.errorMessage = "Failed to move blocks: \(friendlyErrorMessage(error))"
            }
        }
    }

    // MARK: - Internal

    private func nextOrderForSection(_ section: DaySection.TimeSection) -> Int {
        guard let blocks = day?.sections.first(where: { $0.id == section })?.blocks else {
            return 0
        }
        let highest = blocks.map(\.order).max() ?? -1
        return highest + 1
    }

    private func normalizedPillarIdentifier(_ rawPillarId: String?) -> String? {
        guard let rawPillarId else { return nil }
        let trimmed = rawPillarId.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private struct DayTodoPrimitive {
        let id: String
        let content: String
        let description: String
        let dueDate: String?
        let sectionId: DaySection.TimeSection
        let order: Int
        let status: String
        let completedAt: TimeInterval?
        let bountyPoints: Int?
        let parentId: String?
        let pillarId: String?
        let archivedAt: TimeInterval?
    }

    private struct HabitPrimitive {
        let id: String
        let name: String
        let sectionId: DaySection.TimeSection
        let order: Int
        let pillarId: String?
        let groupId: String?
        let groupName: String?
        let isActive: Bool
        let scheduleType: String
        let daysOfWeek: [String]
    }

    struct HabitStackItem: Identifiable {
        let habitId: String
        let name: String
        let isCompleted: Bool
        let order: Int

        var id: String {
            habitId
        }
    }

    private struct HabitLogPrimitive {
        let habitId: String
        let date: String
        let completed: Bool
        let status: String?
        let value: Double?
        let notes: String
    }

    private func startBlockTypeListener(userId: String) {
        guard activeBlockTypeUserId != userId || blockTypesListener == nil else { return }

        blockTypesListener?.remove()
        activeBlockTypeUserId = userId

        blockTypesListener = Firestore.firestore()
            .collection("blockTypes")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                Task { @MainActor in
                    if let error {
                        self.errorMessage = "Failed to load block types: \(self.friendlyErrorMessage(error))"
                        return
                    }

                    let parsed = snapshot?.documents.compactMap { self.blockType(from: $0) } ?? []
                    self.applyBlockTypes(parsed)
                }
            }
    }

    private func applyBlockTypes(_ firestoreTypes: [BlockType]) {
        var mergedById = Dictionary(uniqueKeysWithValues: BlockType.fallbackBuiltIns.map { ($0.id, $0) })
        for type in firestoreTypes {
            mergedById[type.id] = type
        }

        let merged = Array(mergedById.values).sorted { lhs, rhs in
            if lhs.category != rhs.category {
                return lhs.category == "built-in"
            }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }

        blockTypes = merged
        BlockType.setCached(merged)
        customBlockTypes = merged
            .filter { $0.category != "built-in" }
    }

    private func blockType(from document: QueryDocumentSnapshot) -> BlockType? {
        let data = document.data()
        guard let name = data["name"] as? String else { return nil }

        let dataSchema = data["dataSchema"] as? [String: Any]
        let rawFields = dataSchema?["fields"] as? [[String: Any]] ?? []
        let fields = rawFields.compactMap { raw -> BlockTypeFieldSchema? in
            guard let id = raw["id"] as? String,
                  let label = raw["label"] as? String,
                  let type = raw["type"] as? String else {
                return nil
            }
            return BlockTypeFieldSchema(
                id: id,
                label: label,
                type: type,
                min: doubleValue(raw["min"]),
                max: doubleValue(raw["max"]),
                options: raw["options"] as? [String],
                required: raw["required"] as? Bool
            )
        }

        let defaultSectionRaw = (data["defaultSection"] as? String) ?? "afternoon"
        let defaultSection = DaySection.TimeSection(rawValue: defaultSectionRaw) ?? .afternoon
        let category = (data["category"] as? String) ?? "custom"

        return BlockType(
            id: (data["id"] as? String) ?? document.documentID,
            userId: data["userId"] as? String,
            name: name,
            icon: (data["icon"] as? String) ?? BlockIcon.fallback,
            color: (data["color"] as? String) ?? "#64748b",
            category: category,
            defaultSection: defaultSection,
            subtitleTemplate: (data["subtitleTemplate"] as? String) ?? "",
            dataSchema: BlockTypeDataSchema(fields: fields),
            isDeletable: category == "built-in" ? false : (data["isDeletable"] as? Bool ?? true),
            createdAt: timestampValue(data["createdAt"]),
            updatedAt: timestampValue(data["updatedAt"])
        )
    }

    private func startDayListeners(userId: String, date: String) {
        stopDayListeners()

        dayBlocksListener = Firestore.firestore()
            .collection("dayBlocks")
            .whereField("userId", isEqualTo: userId)
            .whereField("date", isEqualTo: date)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                Task { @MainActor in
                    self.daySnapshotLoaded.blocks = true
                    if let error {
                        self.errorMessage = "Failed to load day: \(self.friendlyErrorMessage(error))"
                        self.rebuildLiveDay(clearError: false)
                        return
                    }

                    self.liveDayBlocks = snapshot?.documents.compactMap { self.dayBlock(from: $0) } ?? []
                    self.rebuildLiveDay(clearError: true)
                }
            }

        dayTodosListener = Firestore.firestore()
            .collection("todos")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                Task { @MainActor in
                    self.daySnapshotLoaded.todos = true
                    if let error {
                        self.errorMessage = "Failed to load day todos: \(self.friendlyErrorMessage(error))"
                        self.rebuildLiveDay(clearError: false)
                        return
                    }

                    self.liveDayTodos = snapshot?.documents.compactMap { self.dayTodo(from: $0) } ?? []
                    self.rebuildLiveDay(clearError: true)
                }
            }

        habitsListener = Firestore.firestore()
            .collection("habits")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                Task { @MainActor in
                    self.daySnapshotLoaded.habits = true
                    if let error {
                        self.errorMessage = "Failed to load habits: \(self.friendlyErrorMessage(error))"
                        self.rebuildLiveDay(clearError: false)
                        return
                    }

                    self.liveHabits = snapshot?.documents.compactMap { self.habit(from: $0) } ?? []
                    self.rebuildLiveDay(clearError: true)
                }
            }

        habitLogsListener = Firestore.firestore()
            .collection("habitLogs")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                Task { @MainActor in
                    self.daySnapshotLoaded.logs = true
                    if let error {
                        self.errorMessage = "Failed to load habit logs: \(self.friendlyErrorMessage(error))"
                        self.rebuildLiveDay(clearError: false)
                        return
                    }

                    self.liveHabitLogs = snapshot?.documents.compactMap { self.habitLog(from: $0) } ?? []
                    self.rebuildLiveDay(clearError: true)
                }
            }
    }

    private func stopDayListeners() {
        dayBlocksListener?.remove()
        dayBlocksListener = nil
        dayTodosListener?.remove()
        dayTodosListener = nil
        habitsListener?.remove()
        habitsListener = nil
        habitLogsListener?.remove()
        habitLogsListener = nil
    }

    private func dayBlock(from document: QueryDocumentSnapshot) -> Block? {
        let raw = document.data()
        guard let typeId = raw["typeId"] as? String else { return nil }

        let legacyProjectedTypes = Set(["todo", "todos", "habits", "morninghabits", "habit-stack"])
        if legacyProjectedTypes.contains(typeId.lowercased()) {
            return nil
        }

        let sectionIdRaw = raw["sectionId"] as? String
        let sectionId = sectionIdRaw.flatMap(DaySection.TimeSection.init(rawValue:))
        let data = (raw["data"] as? [String: Any] ?? [:]).mapValues(JSONValue.fromAny)

        return Block(
            id: document.documentID,
            typeId: typeId,
            sectionId: sectionId,
            order: intValue(raw["order"]) ?? 0,
            isExpanded: boolValue(raw["isExpanded"]) ?? false,
            title: raw["title"] as? String,
            subtitle: raw["subtitle"] as? String,
            icon: raw["icon"] as? String,
            pillarId: raw["pillarId"] as? String,
            source: raw["source"] as? String,
            data: data,
            resolvedTitle: nil,
            resolvedSubtitle: nil,
            resolvedIcon: nil,
            pillar: nil,
            isProjected: false
        )
    }

    private func dayTodo(from document: QueryDocumentSnapshot) -> DayTodoPrimitive? {
        let raw = document.data()
        guard let content = raw["content"] as? String else { return nil }

        let section = DaySection.TimeSection(rawValue: (raw["sectionId"] as? String) ?? "afternoon") ?? .afternoon
        return DayTodoPrimitive(
            id: document.documentID,
            content: content,
            description: raw["description"] as? String ?? "",
            dueDate: raw["dueDate"] as? String,
            sectionId: section,
            order: intValue(raw["order"]) ?? 0,
            status: (raw["status"] as? String) ?? "active",
            completedAt: timestampValue(raw["completedAt"]),
            bountyPoints: intValue(raw["bountyPoints"]),
            parentId: raw["parentId"] as? String,
            pillarId: raw["pillarId"] as? String,
            archivedAt: timestampValue(raw["archivedAt"])
        )
    }

    private func habit(from document: QueryDocumentSnapshot) -> HabitPrimitive? {
        let raw = document.data()
        guard let name = raw["name"] as? String else { return nil }

        let schedule = raw["schedule"] as? [String: Any]
        let scheduleType = ((schedule?["type"] as? String) ?? "daily").lowercased()
        let daysOfWeek = ((schedule?["daysOfWeek"] as? [String]) ?? []).map { $0.lowercased() }

        return HabitPrimitive(
            id: document.documentID,
            name: name,
            sectionId: DaySection.TimeSection(rawValue: (raw["sectionId"] as? String) ?? "morning") ?? .morning,
            order: intValue(raw["order"]) ?? 0,
            pillarId: raw["pillarId"] as? String,
            groupId: raw["groupId"] as? String,
            groupName: raw["groupName"] as? String,
            isActive: boolValue(raw["isActive"]) ?? true,
            scheduleType: scheduleType,
            daysOfWeek: daysOfWeek
        )
    }

    private func habitLog(from document: QueryDocumentSnapshot) -> HabitLogPrimitive? {
        let raw = document.data()
        guard let habitId = raw["habitId"] as? String,
              let date = raw["date"] as? String else {
            return nil
        }

        return HabitLogPrimitive(
            habitId: habitId,
            date: date,
            completed: boolValue(raw["completed"]) ?? false,
            status: raw["status"] as? String,
            value: doubleValue(raw["value"]),
            notes: raw["notes"] as? String ?? ""
        )
    }

    private func rebuildLiveDay(clearError: Bool) {
        guard let userId = activeDayUserId, let date = activeDayDate else { return }

        let todoBlocks = liveDayTodos
            .filter { $0.dueDate == date && $0.archivedAt == nil }
            .map { projectedTodoBlock(from: $0) }

        let logsByHabitId = Dictionary(uniqueKeysWithValues: liveHabitLogs
            .filter { $0.date == date }
            .map { ($0.habitId, $0) })

        let todayHabits = liveHabits
            .filter { habitAppliesToDate($0, date: date) }
        let habitStacks = projectedHabitStacks(from: todayHabits, logsByHabitId: logsByHabitId)

        self.day = buildDay(userId: userId, date: date, blocks: liveDayBlocks + todoBlocks + habitStacks)
        self.isLoading = !allDaySnapshotsLoaded()
        if clearError {
            self.errorMessage = nil
        }
    }

    private func allDaySnapshotsLoaded() -> Bool {
        daySnapshotLoaded.blocks
            && daySnapshotLoaded.todos
            && daySnapshotLoaded.habits
            && daySnapshotLoaded.logs
    }

    private func projectedTodoBlock(from todo: DayTodoPrimitive) -> Block {
        Block(
            id: "proj_todo_\(todo.id)",
            typeId: "todo",
            sectionId: todo.sectionId,
            order: todo.order,
            isExpanded: false,
            title: nil,
            subtitle: nil,
            icon: nil,
            pillarId: todo.pillarId,
            source: "auto-sync",
            data: [
            "todoId": .string(todo.id),
            "title": .string(todo.content),
            "description": .string(todo.description),
            "status": .string(todo.status),
            "completedAt": todo.completedAt.map(JSONValue.number) ?? .null,
            "bountyPoints": todo.bountyPoints.map(Double.init).map(JSONValue.number) ?? .null,
            "parentId": todo.parentId.map(JSONValue.string) ?? .null
        ],
            resolvedTitle: nil,
            resolvedSubtitle: nil,
            resolvedIcon: nil,
            pillar: nil,
            isProjected: true
        )
    }

    private func projectedHabitBlock(
        from habit: HabitPrimitive,
        log: HabitLogPrimitive?
    ) -> Block {
        let status = habitLogStatus(log)
        let completed = status == .completed

        return Block(
            id: "proj_habit_\(habit.id)",
            typeId: "habits",
            sectionId: habit.sectionId,
            order: habit.order,
            isExpanded: false,
            title: nil,
            subtitle: nil,
            icon: nil,
            pillarId: habit.pillarId,
            source: "auto-sync",
            data: [
                "habitId": .string(habit.id),
                "name": .string(habit.name),
                "groupId": habit.groupId.map(JSONValue.string) ?? .null,
                "groupName": habit.groupName.map(JSONValue.string) ?? .null,
                "completed": .bool(completed),
                "value": log?.value.map(JSONValue.number) ?? .null,
                "notes": .string(log?.notes ?? ""),
                "status": .string(status.rawValue)
            ],
            resolvedTitle: nil,
            resolvedSubtitle: nil,
            resolvedIcon: nil,
            pillar: nil,
            isProjected: true
        )
    }

    private func projectedHabitStacks(
        from habits: [HabitPrimitive],
        logsByHabitId: [String: HabitLogPrimitive]
    ) -> [Block] {
        guard !habits.isEmpty else { return [] }

        let grouped = Dictionary(grouping: habits, by: { habitStackGroupKey(for: $0) })
        return grouped.values.compactMap { group in
            let sorted = group.sorted { lhs, rhs in
                if lhs.order != rhs.order {
                    return lhs.order < rhs.order
                }
                return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
            }
            guard let section = sorted.first?.sectionId else { return nil }
            return projectedHabitStackBlock(from: sorted, section: section, logsByHabitId: logsByHabitId)
        }
    }

    private func projectedHabitStackBlock(
        from habits: [HabitPrimitive],
        section: DaySection.TimeSection,
        logsByHabitId: [String: HabitLogPrimitive]
    ) -> Block {
        let items = habits.map { habit in
            HabitStackItem(
                habitId: habit.id,
                name: habit.name,
                isCompleted: logsByHabitId[habit.id]?.completed ?? false,
                order: habit.order
            )
        }.sorted { lhs, rhs in
            if lhs.order != rhs.order {
                return lhs.order < rhs.order
            }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }

        let stackId = "proj_habit_stack_\(habitStackStableIdentifier(for: habits))"
        let title = habitStackTitle(for: habits, items: items)
        let completedCount = items.filter(\.isCompleted).count
        let habitItems = items.map {
            JSONValue.object([
                "habitId": .string($0.habitId),
                "name": .string($0.name),
                "completed": .bool($0.isCompleted),
                "order": .number(Double($0.order))
            ])
        }

        return Block(
            id: stackId,
            typeId: "habit-stack",
            sectionId: section,
            order: habits.first?.order ?? 0,
            isExpanded: false,
            title: title,
            subtitle: nil,
            icon: nil,
            pillarId: habits.first?.pillarId,
            source: "auto-sync",
            data: [
                "habitStackName": .string(title),
                "habitStackCount": .number(Double(items.count)),
                "habitStackCompleted": .number(Double(completedCount)),
                "primaryHabitId": .string(items.first?.habitId ?? ""),
                "primaryCompleted": .bool(items.first?.isCompleted ?? false),
                "primaryOrder": .number(Double(items.first?.order ?? 0)),
                "primaryHabitName": .string(items.first?.name ?? ""),
                "habitItems": .array(habitItems),
                "groupName": normalizedHabitStackGroupName(for: habits).map(JSONValue.string) ?? .null,
                "groupId": habits.first?.groupId.map(JSONValue.string) ?? .null
            ],
            resolvedTitle: nil,
            resolvedSubtitle: nil,
            resolvedIcon: nil,
            pillar: nil,
            isProjected: true
        )
    }

    private func habitStackTitle(for habits: [HabitPrimitive], items: [HabitStackItem]) -> String {
        if items.count == 1 {
            return items.first?.name ?? "Habit"
        }

        let groupName = normalizedHabitStackGroupName(for: habits)
        if let groupName, !groupName.isEmpty {
            return groupName
        }

        return "Habit Stack"
    }

    private func habitStackGroupKey(for habit: HabitPrimitive) -> String {
        let normalizedSection = habit.sectionId.rawValue

        if let groupId = habit.groupId?.trimmingCharacters(in: .whitespacesAndNewlines),
           !groupId.isEmpty {
            return "\(normalizedSection)|id:\(groupId.lowercased())"
        }

        if let groupName = habit.groupName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !groupName.isEmpty {
            return "\(normalizedSection)|name:\(groupName.lowercased())"
        }

        return "\(normalizedSection)|ungrouped"
    }

    private func habitStackStableIdentifier(for habits: [HabitPrimitive]) -> String {
        guard let first = habits.first else { return UUID().uuidString }
        return habitStackGroupKey(for: first)
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9_-]", with: "-", options: .regularExpression)
            .replacingOccurrences(of: "-{2,}", with: "-", options: .regularExpression)
    }

    private func normalizedHabitStackGroupName(for habits: [HabitPrimitive]) -> String? {
        return habits.compactMap { $0.groupName?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .map { $0 }
            .first { !$0.isEmpty }
    }

    private func habitAppliesToDate(_ habit: HabitPrimitive, date: String) -> Bool {
        guard habit.isActive else { return false }
        guard habit.scheduleType == "weekly" else { return true }
        return habit.daysOfWeek.contains(weekday(from: date))
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

    private func habitLogStatus(_ log: HabitLogPrimitive?) -> HabitLogStatus {
        if let rawStatus = log?.status?.lowercased(),
           let status = HabitLogStatus(rawValue: rawStatus) {
            return status
        }

        if log?.completed == true {
            return .completed
        }

        return .pending
    }

    private func patchBlock(block: Block, section: DaySection.TimeSection, date: String) async throws {
        let now = Date().timeIntervalSince1970

        if let todoId = projectedTodoId(for: block) {
            let rootItem = block.checklistData?.items.first
            let isCompleted = rootItem?.isCompleted ?? false
            let body: [String: Any] = [
                "content": (rootItem?.title ?? "").trimmingCharacters(in: .whitespacesAndNewlines),
                "status": isCompleted ? "completed" : "active",
                "completedAt": isCompleted ? now : NSNull(),
                "sectionId": section.rawValue,
                "order": block.order,
                "pillarId": normalizedPillarIdentifier(block.pillarId) ?? NSNull(),
                "updatedAt": now
            ]

            print("🧪 [Todo Bounty][Day] Request completion update todoId=\(todoId) isCompleted=\(isCompleted)")
            try await Firestore.firestore().collection("todos").document(todoId).setData(body, merge: true)
            print("✅ [Todo Bounty][Day] Firestore completion write succeeded todoId=\(todoId) isCompleted=\(isCompleted)")

            Task { @MainActor [weak self] in
                await self?.verifyBountyTrigger(todoId: todoId, expectPaid: isCompleted)
            }
            return
        }

        if let habitId = projectedHabitId(for: block) {
            guard let userId = activeDayUserId ?? Auth.auth().currentUser?.uid else {
                throw BackendError.notAuthenticated
            }

            let firstItem = block.checklistData?.items.first
            let body: [String: Any] = [
                "name": (firstItem?.title ?? "").trimmingCharacters(in: .whitespacesAndNewlines),
                "sectionId": section.rawValue,
                "order": block.order,
                "pillarId": normalizedPillarIdentifier(block.pillarId) ?? NSNull(),
                "updatedAt": now
            ]
            try await Firestore.firestore().collection("habits").document(habitId).setData(body, merge: true)

            let logId = "\(habitId)_\(date)"
            let logRef = Firestore.firestore().collection("habitLogs").document(logId)
            let existingLog = try await logRef.getDocument()
            let existingData = existingLog.data() ?? [:]
            let createdAt = timestampValue(existingData["createdAt"]) ?? now
            let logBody: [String: Any] = [
                "id": logId,
                "userId": userId,
                "habitId": habitId,
                "date": date,
                "completed": firstItem?.isCompleted ?? false,
                "status": (firstItem?.isCompleted ?? false) ? HabitLogStatus.completed.rawValue : HabitLogStatus.pending.rawValue,
                "value": existingData["value"] ?? NSNull(),
                "notes": existingData["notes"] as? String ?? "",
                "createdAt": createdAt,
                "updatedAt": now
            ]
            try await logRef.setData(logBody, merge: true)
            return
        }

        let body: [String: Any] = [
            "sectionId": section.rawValue,
            "order": block.order,
            "isExpanded": block.isExpanded,
            "title": block.title ?? NSNull(),
            "subtitle": block.subtitle ?? NSNull(),
            "icon": block.icon ?? NSNull(),
            "pillarId": normalizedPillarIdentifier(block.pillarId) ?? NSNull(),
            "data": block.dataDictionary(),
            "updatedAt": now
        ]

        try await Firestore.firestore().collection("dayBlocks").document(block.id).setData(body, merge: true)
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
                            "✅ [Todo Bounty][Day] Verified payout todoId=\(todoId) attempt=\(attempt) bountyPaidAt=\(String(describing: bountyPaidAt)) pointEventId=\(pointEventId) totalPoints=\(String(describing: totalPoints)) allocations=\(allocations)"
                        )
                        return
                    }

                    print(
                        "⏳ [Todo Bounty][Day] Waiting for payout todoId=\(todoId) attempt=\(attempt) bountyPaidAt=\(String(describing: bountyPaidAt)) pointEventExists=\(eventExists) voidedAt=\(String(describing: voidedAt))"
                    )
                } else {
                    let isReversed = bountyPaidAt == nil && (!eventExists || voidedAt != nil)
                    if isReversed {
                        print(
                            "✅ [Todo Bounty][Day] Verified reversal todoId=\(todoId) attempt=\(attempt) bountyPaidAt=nil pointEventExists=\(eventExists) voidedAt=\(String(describing: voidedAt))"
                        )
                        return
                    }

                    print(
                        "⏳ [Todo Bounty][Day] Waiting for reversal todoId=\(todoId) attempt=\(attempt) bountyPaidAt=\(String(describing: bountyPaidAt)) pointEventExists=\(eventExists) voidedAt=\(String(describing: voidedAt))"
                    )
                }
            } catch {
                print("❌ [Todo Bounty][Day] Verification read failed todoId=\(todoId) attempt=\(attempt): \(friendlyErrorMessage(error))")
            }

            try? await Task.sleep(nanoseconds: 1_000_000_000)
        }

        print("⚠️ [Todo Bounty][Day] Verification timed out todoId=\(todoId) expectedPaid=\(expectPaid)")
    }

    private func verifyHabitBountyTrigger(habitId: String, date: String, expectPaid: Bool) async {
        guard !habitId.isEmpty, !date.isEmpty else { return }
        let db = Firestore.firestore()
        let pointEventId = "pe_habit_\(habitId)_\(date)"
        print("🧪 [Habit Bounty][Day] Verify start habitId=\(habitId) date=\(date) expectedPointEventId=\(pointEventId) expectPaid=\(expectPaid)")

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
                            "✅ [Habit Bounty][Day] Verified payout habitId=\(habitId) date=\(date) attempt=\(attempt) pointEventId=\(pointEventId) totalPoints=\(String(describing: totalPoints)) allocations=\(allocations)"
                        )
                        return
                    }

                    print(
                        "⏳ [Habit Bounty][Day] Waiting for payout habitId=\(habitId) date=\(date) attempt=\(attempt) pointEventExists=\(eventExists) voidedAt=\(String(describing: voidedAt))"
                    )
                } else {
                    let isReversed = !eventExists || voidedAt != nil
                    if isReversed {
                        print(
                            "✅ [Habit Bounty][Day] Verified reversal habitId=\(habitId) date=\(date) attempt=\(attempt) pointEventExists=\(eventExists) voidedAt=\(String(describing: voidedAt))"
                        )
                        return
                    }

                    print(
                        "⏳ [Habit Bounty][Day] Waiting for reversal habitId=\(habitId) date=\(date) attempt=\(attempt) pointEventExists=\(eventExists) voidedAt=\(String(describing: voidedAt))"
                    )
                }
            } catch {
                print("❌ [Habit Bounty][Day] Verification read failed habitId=\(habitId) date=\(date) attempt=\(attempt): \(friendlyErrorMessage(error))")
            }

            try? await Task.sleep(nanoseconds: 1_000_000_000)
        }

        print("⚠️ [Habit Bounty][Day] Verification timed out habitId=\(habitId) date=\(date) expectedPaid=\(expectPaid)")
    }

    private func buildDay(userId: String, date: String, blocks: [Block]) -> Day {
        let now = Date()
        var sectionBuckets: [DaySection.TimeSection: [Block]] = [:]
        DaySection.TimeSection.allCases.forEach { sectionBuckets[$0] = [] }

        for var block in blocks {
            let section = block.sectionId ?? block.blockType?.defaultSection ?? .afternoon
            block.sectionId = section
            sectionBuckets[section, default: []].append(block)
        }

        let sections: [DaySection] = DaySection.TimeSection.allCases.map { section in
            let sorted = (sectionBuckets[section] ?? []).sorted { lhs, rhs in
                if lhs.order != rhs.order {
                    return lhs.order < rhs.order
                }
                return lhs.id < rhs.id
            }
            return DaySection(id: section, blocks: sorted)
        }

        return Day(
            id: "day_\(userId)_\(date)",
            userId: userId,
            date: date,
            templateId: nil,
            sections: sections,
            createdAt: now,
            updatedAt: now
        )
    }

}
