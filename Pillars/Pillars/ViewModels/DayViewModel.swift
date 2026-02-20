//
//  DayViewModel.swift
//  Pillars
//
//  Block System v1 view model backed by /api/block-types and /api/days/:date/blocks.
//

import Foundation
import FirebaseAuth
import FirebaseFirestore

@MainActor
class DayViewModel: ObservableObject, BackendRequesting {
    @Published var day: Day?
    @Published var isLoading = true
    @Published var errorMessage: String?
    @Published var customBlockTypes: [CustomBlockType] = []

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

    var allBlockTypes: (builtIns: [BlockType], custom: [CustomBlockType]) {
        (
            builtIns: blockTypes.filter { $0.category == "built-in" },
            custom: customBlockTypes
        )
    }

    func loadToday(userId: String) {
        loadDay(userId: userId, dateStr: Day.todayDateString)
    }

    func loadCustomBlockTypes(userId: String) {
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
                try await refreshCurrentDay()
            } catch {
                self.errorMessage = "Failed to update block: \(friendlyErrorMessage(error))"
            }
            self.mutationTask = nil
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
                try await refreshCurrentDay()
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
                let body: [String: Any] = [
                    "content": trimmed,
                    "dueDate": dueDate ?? NSNull(),
                    "sectionId": section.rawValue,
                    "status": "active",
                    "pillarId": NSNull()
                ]

                _ = try await performAPIRequest(path: "/todos", method: "POST", body: body)
                try await refreshCurrentDay()
            } catch {
                self.errorMessage = "Failed to add todo: \(friendlyErrorMessage(error))"
            }
        }
    }

    func setHabitPillar(habitId: String, pillarId: String?) {
        guard let date = day?.date else { return }
        let blockId = "proj_habit_\(habitId)"

        Task {
            do {
                _ = try await performAPIRequest(
                    path: "/days/\(date)/blocks/\(encodedPathComponent(blockId))",
                    method: "PATCH",
                    body: ["pillarId": normalizedPillarIdentifier(pillarId) ?? NSNull()]
                )
                try await refreshCurrentDay()
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
        guard let date = day?.date else { return }

        Task {
            do {
                _ = try await performAPIRequest(
                    path: "/days/\(date)/blocks/\(encodedPathComponent(blockId))",
                    method: "PATCH",
                    body: ["pillarId": normalizedPillarIdentifier(pillarId) ?? NSNull()]
                )
                try await refreshCurrentDay()
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

        return block.data["habitId"]?.stringValue
    }

    func addBlock(typeId: String, to section: DaySection.TimeSection, customType: CustomBlockType? = nil) {
        if typeId == "todo" {
            addTodoBlock(title: "New Task", to: section)
            return
        }

        if typeId == "habits" {
            addHabitItem(title: "New Habit", to: section)
            return
        }

        guard let date = day?.date else { return }
        let nextOrder = nextOrderForSection(section)
        let block = Block.make(typeId: typeId, sectionId: section, order: nextOrder, customType: customType)

        Task {
            do {
                let payload: [String: Any] = [
                    "typeId": block.typeId,
                    "sectionId": section.rawValue,
                    "order": block.order,
                    "isExpanded": block.isExpanded,
                    "title": block.title ?? NSNull(),
                    "subtitle": block.subtitle ?? NSNull(),
                    "icon": block.icon ?? NSNull(),
                    "pillarId": block.pillarId ?? NSNull(),
                    "source": block.source ?? "user",
                    "data": block.dataDictionary()
                ]

                _ = try await performAPIRequest(
                    path: "/days/\(date)/blocks?resolve=true",
                    method: "POST",
                    body: payload
                )

                try await refreshCurrentDay()
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
                let body: [String: Any] = [
                    "name": trimmed,
                    "sectionId": section.rawValue,
                    "schedule": [
                        "type": "daily",
                        "daysOfWeek": []
                    ],
                    "target": [
                        "type": "binary",
                        "value": 1
                    ],
                    "isActive": true,
                    "pillarId": NSNull()
                ]

                _ = try await performAPIRequest(path: "/habits", method: "POST", body: body)
                try await refreshCurrentDay()
            } catch {
                self.errorMessage = "Failed to add habit: \(friendlyErrorMessage(error))"
            }
        }
    }

    func deleteBlock(_ blockId: String, from section: DaySection.TimeSection) {
        guard let date = day?.date else { return }

        Task {
            do {
                _ = try await performAPIRequest(
                    path: "/days/\(date)/blocks/\(encodedPathComponent(blockId))",
                    method: "DELETE"
                )
                try await refreshCurrentDay()
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
                    let moveBody: [String: Any] = [
                        "sectionId": section.rawValue,
                        "order": block.order
                    ]
                    _ = try await performAPIRequest(
                        path: "/days/\(date)/blocks/\(encodedPathComponent(block.id))/move?resolve=true",
                        method: "PATCH",
                        body: moveBody
                    )
                }
                try await refreshCurrentDay()
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
        let isActive: Bool
        let scheduleType: String
        let daysOfWeek: [String]
    }

    private struct HabitLogPrimitive {
        let habitId: String
        let date: String
        let completed: Bool
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
                    self.applyBlockTypes(parsed, fallbackUserId: userId)
                }
            }
    }

    private func applyBlockTypes(_ firestoreTypes: [BlockType], fallbackUserId: String) {
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
            .map { toCustomBlockType($0, fallbackUserId: fallbackUserId) }
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
            icon: (data["icon"] as? String) ?? "🧩",
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

        let legacyProjectedTypes = Set(["todo", "todos", "habits", "morninghabits"])
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

        let habitBlocks = liveHabits
            .filter { habitAppliesToDate($0, date: date) }
            .map { projectedHabitBlock(from: $0, log: logsByHabitId[$0.id]) }

        self.day = buildDay(userId: userId, date: date, blocks: liveDayBlocks + todoBlocks + habitBlocks)
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
        let completed = log?.completed ?? false

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
                "completed": .bool(completed),
                "value": log?.value.map(JSONValue.number) ?? .null,
                "notes": .string(log?.notes ?? ""),
                "status": .string(completed ? "completed" : "pending")
            ],
            resolvedTitle: nil,
            resolvedSubtitle: nil,
            resolvedIcon: nil,
            pillar: nil,
            isProjected: true
        )
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

    private func patchBlock(block: Block, section: DaySection.TimeSection, date: String) async throws {
        let path = "/days/\(date)/blocks/\(encodedPathComponent(block.id))?resolve=true"

        if projectedTodoId(for: block) != nil {
            let rootItem = block.checklistData?.items.first
            let body: [String: Any] = [
                "sectionId": section.rawValue,
                "order": block.order,
                "pillarId": normalizedPillarIdentifier(block.pillarId) ?? NSNull(),
                "data": [
                    "title": (rootItem?.title ?? "").trimmingCharacters(in: .whitespacesAndNewlines),
                    "status": (rootItem?.isCompleted ?? false) ? "completed" : "active"
                ]
            ]

            _ = try await performAPIRequest(path: path, method: "PATCH", body: body)
            return
        }

        if projectedHabitId(for: block) != nil {
            let firstItem = block.checklistData?.items.first
            let body: [String: Any] = [
                "sectionId": section.rawValue,
                "order": block.order,
                "pillarId": normalizedPillarIdentifier(block.pillarId) ?? NSNull(),
                "data": [
                    "name": (firstItem?.title ?? "").trimmingCharacters(in: .whitespacesAndNewlines),
                    "completed": firstItem?.isCompleted ?? false
                ]
            ]

            _ = try await performAPIRequest(path: path, method: "PATCH", body: body)
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
            "data": block.dataDictionary()
        ]

        _ = try await performAPIRequest(path: path, method: "PATCH", body: body)
    }

    private func refreshCurrentDay() async throws {
        if dayBlocksListener != nil || dayTodosListener != nil || habitsListener != nil || habitLogsListener != nil {
            return
        }

        guard let existingDay = day else { return }
        guard let user = Auth.auth().currentUser else { throw BackendError.notAuthenticated }

        let blocks = try await fetchBlocks(for: existingDay.date, resolve: true)
        self.day = buildDay(userId: user.uid, date: existingDay.date, blocks: blocks)
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

    private func toCustomBlockType(_ type: BlockType, fallbackUserId: String) -> CustomBlockType {
        let createdAt = Date(timeIntervalSince1970: type.createdAt ?? Date().timeIntervalSince1970)
        let updatedAt = Date(timeIntervalSince1970: type.updatedAt ?? createdAt.timeIntervalSince1970)

        let fields = type.dataSchema.fields.map { field in
            CustomFieldDef(
                id: field.id,
                label: field.label,
                type: mapFieldType(field.type),
                placeholder: nil,
                min: field.min,
                max: field.max,
                step: nil,
                isRequired: field.required ?? false
            )
        }

        return CustomBlockType(
            id: type.id,
            userId: type.userId ?? fallbackUserId,
            name: type.name,
            icon: type.icon,
            description: type.subtitleTemplate,
            defaultSection: type.defaultSection,
            fields: fields,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }

    private func mapFieldType(_ rawType: String) -> CustomFieldType {
        switch rawType.lowercased() {
        case "number":
            return .number
        case "boolean":
            return .toggle
        case "array", "object":
            return .multiline
        default:
            return .text
        }
    }

    private func fetchBlocks(for date: String, resolve: Bool) async throws -> [Block] {
        let query = resolve ? "?resolve=true" : ""
        let (data, _, _) = try await performAPIRequest(path: "/days/\(date)/blocks\(query)")
        let payload = try decodePayload(BlockListResponse.self, from: data, context: "day blocks")
        return payload.items
    }
}

private struct BlockListResponse: Decodable {
    let items: [Block]
}
