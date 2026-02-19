//
//  MyDayViewModel.swift
//  Pillars
//
//  ViewModel for the My Day daily logging feature
//

import Foundation
import FirebaseFirestore
import FirebaseAuth

@MainActor
class MyDayViewModel: ObservableObject {
    @Published var day: Day?
    @Published var isLoading = true
    @Published var errorMessage: String?

    private var listener: ListenerRegistration?
    private var saveTask: Task<Void, Never>?
    private let db = Firestore.firestore()

    // MARK: - Load Today

    func loadToday(userId: String) {
        isLoading = true
        errorMessage = nil
        let dateStr = Day.todayDateString

        Task {
            do {
                // 1. Try GET /api/days/today
                let fetchedDay = try await fetchTodayFromBackend(userId: userId, dateStr: dateStr)
                self.day = fetchedDay
                self.isLoading = false
                self.startListening(userId: userId, date: dateStr)
            } catch let err as BackendError where err == .notFound {
                // 2. 404 → get or use built-in template → create day
                do {
                    let template = try await fetchDefaultTemplate(userId: userId)
                    let newDay = Day.from(template: template, userId: userId, date: dateStr)
                    try await createDay(newDay)
                    self.day = newDay
                    self.isLoading = false
                    self.startListening(userId: userId, date: dateStr)
                } catch {
                    self.errorMessage = "Failed to create today's log: \(error.localizedDescription)"
                    self.isLoading = false
                }
            } catch {
                self.errorMessage = "Failed to load today: \(error.localizedDescription)"
                self.isLoading = false
            }
        }
    }

    // MARK: - Firestore Listener

    private func startListening(userId: String, date: String) {
        listener?.remove()
        listener = db.collection("days")
            .whereField("userId", isEqualTo: userId)
            .whereField("date", isEqualTo: date)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error {
                    print("❌ [MyDayViewModel] Snapshot error: \(error.localizedDescription)")
                    return
                }
                guard let doc = snapshot?.documents.first else { return }
                if let updated = Self.parseDay(from: doc) {
                    // Only update from Firestore if we're not mid-edit (save in flight)
                    if self.saveTask == nil {
                        self.day = updated
                    }
                }
            }
    }

    func stopListening() {
        listener?.remove()
        listener = nil
        saveTask?.cancel()
        saveTask = nil
    }

    // MARK: - Block Mutations

    func toggleBlock(_ blockId: String, in section: DaySection.TimeSection) {
        guard var day = day else { return }
        guard let sIdx = day.sections.firstIndex(where: { $0.id == section }),
              let bIdx = day.sections[sIdx].blocks.firstIndex(where: { $0.id == blockId }) else { return }
        day.sections[sIdx].blocks[bIdx].isExpanded.toggle()
        self.day = day
        scheduleSave()
    }

    func updateBlock(_ block: Block, in section: DaySection.TimeSection) {
        guard var day = day else { return }
        guard let sIdx = day.sections.firstIndex(where: { $0.id == section }),
              let bIdx = day.sections[sIdx].blocks.firstIndex(where: { $0.id == block.id }) else { return }
        day.sections[sIdx].blocks[bIdx] = block
        self.day = day
        scheduleSave()
    }

    func addBlock(typeId: String, to section: DaySection.TimeSection) {
        guard var day = day else { return }
        guard let sIdx = day.sections.firstIndex(where: { $0.id == section }) else { return }
        let maxOrder = day.sections[sIdx].blocks.map(\.order).max() ?? -1
        let newBlock = Block.make(typeId: typeId, order: maxOrder + 1)
        day.sections[sIdx].blocks.append(newBlock)
        self.day = day
        scheduleSave()
    }

    func deleteBlock(_ blockId: String, from section: DaySection.TimeSection) {
        guard var day = day else { return }
        guard let sIdx = day.sections.firstIndex(where: { $0.id == section }) else { return }
        day.sections[sIdx].blocks.removeAll { $0.id == blockId }
        // Re-number orders
        for i in day.sections[sIdx].blocks.indices {
            day.sections[sIdx].blocks[i].order = i
        }
        self.day = day
        scheduleSave()
    }

    func moveBlock(from source: IndexSet, to destination: Int, in section: DaySection.TimeSection) {
        guard var day = day else { return }
        guard let sIdx = day.sections.firstIndex(where: { $0.id == section }) else { return }
        day.sections[sIdx].blocks.move(fromOffsets: source, toOffset: destination)
        for i in day.sections[sIdx].blocks.indices {
            day.sections[sIdx].blocks[i].order = i
        }
        self.day = day
        scheduleSave()
    }

    // MARK: - Auto-save (debounced 600ms)

    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(nanoseconds: 600_000_000)
            guard !Task.isCancelled, let day = self.day else { return }
            do {
                try await self.persistDay(day)
            } catch {
                print("❌ [MyDayViewModel] Auto-save failed: \(error.localizedDescription)")
            }
            self.saveTask = nil
        }
    }

    // MARK: - Network

    private func fetchTodayFromBackend(userId: String, dateStr: String) async throws -> Day {
        guard let user = Auth.auth().currentUser else { throw BackendError.notAuthenticated }
        let token = try await user.getIDToken()
        guard let url = URL(string: "\(AppConfig.apiBaseURL)/days/today?date=\(dateStr)") else {
            throw BackendError.invalidURL
        }
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: req)
        if let http = response as? HTTPURLResponse, http.statusCode == 404 {
            throw BackendError.notFound
        }
        return try Self.decodeDay(from: data)
    }

    private func fetchDefaultTemplate(userId: String) async throws -> DayTemplate {
        guard let user = Auth.auth().currentUser else { throw BackendError.notAuthenticated }
        let token = try await user.getIDToken()
        guard let url = URL(string: "\(AppConfig.apiBaseURL)/day-templates/default") else {
            throw BackendError.invalidURL
        }
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: req)
        if let http = response as? HTTPURLResponse, http.statusCode == 404 {
            return DayTemplate.builtInDefault(userId: userId)
        }
        let decoder = JSONDecoder()
        return try decoder.decode(DayTemplate.self, from: data)
    }

    private func createDay(_ day: Day) async throws {
        guard let user = Auth.auth().currentUser else { throw BackendError.notAuthenticated }
        let token = try await user.getIDToken()
        guard let url = URL(string: "\(AppConfig.apiBaseURL)/days") else {
            throw BackendError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(day)
        let (_, response) = try await URLSession.shared.data(for: req)
        if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
            throw BackendError.serverError(http.statusCode)
        }
    }

    private func persistDay(_ day: Day) async throws {
        guard let user = Auth.auth().currentUser else { throw BackendError.notAuthenticated }
        let token = try await user.getIDToken()
        guard let url = URL(string: "\(AppConfig.apiBaseURL)/days/\(day.id)") else {
            throw BackendError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(day)
        let (_, response) = try await URLSession.shared.data(for: req)
        if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
            throw BackendError.serverError(http.statusCode)
        }
    }

    // MARK: - Parsing

    private static func decodeDay(from data: Data) throws -> Day {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .secondsSince1970
        return try decoder.decode(Day.self, from: data)
    }

    private static func parseDay(from doc: QueryDocumentSnapshot) -> Day? {
        let data = doc.data()
        guard let userId = data["userId"] as? String,
              let date = data["date"] as? String else { return nil }

        let createdAt = Date(timeIntervalSince1970: data["createdAt"] as? TimeInterval ?? 0)
        let updatedAt = Date(timeIntervalSince1970: data["updatedAt"] as? TimeInterval ?? 0)

        var sections: [DaySection] = []
        if let sectionsRaw = data["sections"] as? [[String: Any]] {
            for sectionData in sectionsRaw {
                guard let sectionId = sectionData["id"] as? String,
                      let timeSection = DaySection.TimeSection(rawValue: sectionId) else { continue }
                var blocks: [Block] = []
                if let blocksRaw = sectionData["blocks"] as? [[String: Any]] {
                    for blockData in blocksRaw {
                        if let blockJSON = try? JSONSerialization.data(withJSONObject: blockData),
                           let block = try? JSONDecoder().decode(Block.self, from: blockJSON) {
                            blocks.append(block)
                        }
                    }
                }
                blocks.sort { $0.order < $1.order }
                sections.append(DaySection(id: timeSection, blocks: blocks))
            }
        }

        return Day(
            id: doc.documentID,
            userId: userId,
            date: date,
            templateId: data["templateId"] as? String,
            sections: sections,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
}

// MARK: - BackendError

enum BackendError: Error, Equatable {
    case notFound
    case notAuthenticated
    case invalidURL
    case serverError(Int)
}
