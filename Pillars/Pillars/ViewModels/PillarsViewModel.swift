//
//  PillarsViewModel.swift
//  Pillars
//
//  ViewModel for managing pillars with Firestore
//

import Foundation
import SwiftUI
import FirebaseFirestore
import FirebaseAuth

@MainActor
class PillarsViewModel: ObservableObject {
    @Published var pillars: [Pillar] = []
    @Published var pillarTemplates: [PillarTemplate] = []
    @Published var pillarVisualColors: [PillarVisualColor] = []
    @Published var pillarVisualIcons: [PillarVisualIcon] = []
    @Published var isLoading = false
    @Published var isLoadingTemplates = false
    @Published var errorMessage: String?
    
    private var pillarsListener: ListenerRegistration?
    private let db = Firestore.firestore()
    private var loggedUnknownColorTokens = Set<String>()
    private var loggedUnknownIconTokens = Set<String>()

    var activeVisualColors: [PillarVisualColor] {
        let configured = pillarVisualColors
            .filter { $0.isActive }
            .sorted { left, right in
                if left.order != right.order {
                    return left.order < right.order
                }
                return left.label.localizedCaseInsensitiveCompare(right.label) == .orderedAscending
            }
        if !configured.isEmpty {
            return configured
        }
        return fallbackVisualColors
    }

    var activeVisualIcons: [PillarVisualIcon] {
        let configured = pillarVisualIcons
            .filter { $0.isActive }
            .sorted { left, right in
                if left.order != right.order {
                    return left.order < right.order
                }
                return left.label.localizedCaseInsensitiveCompare(right.label) == .orderedAscending
            }

        if !configured.isEmpty {
            return configured
        }
        return fallbackVisualIcons
    }

    var availableIconsForPicker: [PillarVisualIcon] {
        activeVisualIcons
    }

    var defaultIconToken: String {
        activeVisualIcons.first?.id ?? PillarIcon.default.rawValue
    }
    
    // MARK: - Listeners
    
    func startListening(userId: String) {
        print("🔍 [PillarsViewModel] Starting to listen for pillars for userId: \(userId)")
        pillarsListener?.remove()
        isLoading = true
        Task {
            await loadPillarVisuals(force: true)
        }
        
        pillarsListener = db.collection("pillars")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { return }
                
                if let error = error {
                    print("❌ [PillarsViewModel] Error listening to pillars: \(error.localizedDescription)")
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                    return
                }
                
                guard let documents = snapshot?.documents else {
                    print("⚠️ [PillarsViewModel] No pillar documents")
                    self.pillars = []
                    self.isLoading = false
                    return
                }
                
                print("📊 [PillarsViewModel] Found \(documents.count) pillar documents")
                
                var pillars = documents.compactMap { doc -> Pillar? in
                    let data = doc.data()
                    
                    guard let userId = data["userId"] as? String,
                          let name = data["name"] as? String,
                          let createdTimestamp = data["createdAt"] as? Timestamp,
                          let updatedTimestamp = data["updatedAt"] as? Timestamp else {
                        print("❌ [PillarsViewModel] Missing required fields in pillar \(doc.documentID)")
                        return nil
                    }
                    
                    // Filter out archived pillars
                    let isArchived = data["isArchived"] as? Bool ?? false
                    if isArchived {
                        return nil
                    }
                    
                    let description = data["description"] as? String ?? ""
                    let explicitColorToken = self.normalizeColorToken(self.parseString(data["colorToken"]))
                    let legacyColorToken = PillarColorRegistry.token(forHex: data["color"] as? String)
                    let colorToken = explicitColorToken ?? legacyColorToken
                    let color = self.colorHex(forColorToken: colorToken)
                    let isDefault = data["isDefault"] as? Bool ?? false
                    let rubricItems = self.parseRubricItems(data["rubricItems"])
                    
                    // Parse icon
                    let iconToken = self.normalizeIconToken(data["icon"] as? String)
                    let pillarType = PillarType.resolve(data["pillarType"] as? String)
                        ?? PillarType.infer(name: name, iconToken: iconToken)
                    
                    // Parse stats
                    let statsData = data["stats"] as? [String: Any] ?? [:]
                    let stats = Pillar.PillarStats(
                        conversationCount: statsData["conversationCount"] as? Int ?? 0,
                        principleCount: statsData["principleCount"] as? Int ?? 0,
                        wisdomCount: statsData["wisdomCount"] as? Int ?? 0,
                        resourceCount: statsData["resourceCount"] as? Int ?? 0,
                        pointEventCount: statsData["pointEventCount"] as? Int ?? 0,
                        pointTotal: statsData["pointTotal"] as? Int ?? 0
                    )
                    
                    return Pillar(
                        id: doc.documentID,
                        userId: userId,
                        name: name,
                        description: description,
                        color: color,
                        colorToken: colorToken,
                        customColorHex: nil,
                        pillarType: pillarType,
                        iconToken: iconToken,
                        emoji: data["emoji"] as? String,
                        isDefault: isDefault,
                        isArchived: isArchived,
                        rubricItems: rubricItems,
                        settings: data["settings"] as? [String: String],
                        stats: stats,
                        createdAt: createdTimestamp.dateValue(),
                        updatedAt: updatedTimestamp.dateValue(),
                        metadata: data["metadata"] as? [String: String]
                    )
                }
                
                // Sort by createdAt ascending
                pillars.sort { $0.createdAt < $1.createdAt }
                self.pillars = pillars
                self.isLoading = false
                
                print("✅ [PillarsViewModel] Loaded \(self.pillars.count) pillars")
            }
    }
    
    func stopListening() {
        pillarsListener?.remove()
        pillarsListener = nil
    }
    
    // MARK: - Create Pillar
    
    func createPillar(
        name: String,
        description: String = "",
        colorToken: String? = nil,
        iconToken: String? = nil,
        pillarType: PillarType? = nil,
        pillarTypeRaw: String? = nil
    ) async throws -> Pillar {
        guard Auth.auth().currentUser != nil else {
            throw PillarError.notAuthenticated
        }

        let resolvedIconToken = normalizeIconToken(iconToken) ?? defaultIconToken
        let resolvedTypeRaw = pillarTypeRaw?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            ?? pillarType?.rawValue
            ?? PillarType.infer(name: name, iconToken: resolvedIconToken)?.rawValue
            ?? "custom"
        let resolvedColorToken = normalizeColorToken(colorToken)
            ?? defaultColorToken(forIconToken: resolvedIconToken)

        let created = try await APIService.shared.createPillar(
            name: name,
            description: description,
            colorToken: resolvedColorToken,
            iconToken: resolvedIconToken,
            pillarType: resolvedTypeRaw
        )
        
        print("✅ [PillarsViewModel] Created pillar '\(name)' via backend")
        return created
    }

    func createPillarFromTemplate(_ template: PillarTemplate) async throws -> Pillar {
        let resolvedIconToken = normalizeIconToken(template.iconToken) ?? defaultIconToken
        let matchedColorToken = normalizeColorToken(template.colorToken)
            ?? defaultColorToken(forIconToken: resolvedIconToken)
        return try await createPillar(
            name: template.name,
            description: template.description ?? "",
            colorToken: matchedColorToken,
            iconToken: resolvedIconToken,
            pillarTypeRaw: template.pillarType
        )
    }

    func loadPillarTemplates(includeInactive: Bool = false, force: Bool = false) async {
        if !force && !pillarTemplates.isEmpty {
            return
        }

        isLoadingTemplates = true
        defer { isLoadingTemplates = false }

        do {
            let templates = try await APIService.shared.fetchPillarTemplates(includeInactive: includeInactive)
            pillarTemplates = templates
                .filter { includeInactive || $0.isActive }
                .sorted { left, right in
                    if left.order != right.order {
                        return left.order < right.order
                    }
                    return left.name.localizedCaseInsensitiveCompare(right.name) == .orderedAscending
                }
        } catch {
            errorMessage = error.localizedDescription
            print("⚠️ [PillarsViewModel] Failed to load pillar templates: \(error.localizedDescription)")
        }
    }

    func loadPillarVisuals(force: Bool = false) async {
        if !force && !pillarVisualColors.isEmpty {
            return
        }

        do {
            let visuals = try await APIService.shared.fetchPillarVisuals()
            pillarVisualColors = visuals.colors
            pillarVisualIcons = visuals.icons
            applyVisualPaletteToCurrentPillars()
        } catch {
            errorMessage = error.localizedDescription
            print("⚠️ [PillarsViewModel] Failed to load pillar visuals: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Update Pillar
    
    func updatePillar(
        _ pillar: Pillar,
        name: String? = nil,
        description: String? = nil,
        colorToken: String? = nil,
        iconToken: String? = nil,
        pillarType: PillarType? = nil
    ) async throws {
        let previousPillars = pillars
        var updateData: [String: Any] = [
            "updatedAt": FieldValue.serverTimestamp()
        ]
        
        if let name = name {
            updateData["name"] = name
        }
        if let description = description {
            updateData["description"] = description
        }
        let normalizedColorToken: String? = {
            guard let colorToken else { return nil }
            let trimmed = colorToken.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return trimmed.isEmpty ? nil : trimmed
        }()
        if let colorToken {
            let trimmed = colorToken.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            updateData["colorToken"] = trimmed.isEmpty ? NSNull() : trimmed
        }
        let normalizedIconToken = normalizeIconToken(iconToken)
        if let iconToken {
            updateData["icon"] = normalizedIconToken ?? NSNull()
        }

        let nextName = name ?? pillar.name
        let nextIconToken = normalizedIconToken ?? pillar.iconToken
        let resolvedPillarType = pillarType
            ?? pillar.pillarType
            ?? PillarType.infer(name: nextName, iconToken: nextIconToken)
        if let resolvedPillarType {
            updateData["pillarType"] = resolvedPillarType.rawValue
        }

        // Optimistic local update for instant UI feedback.
        if let index = pillars.firstIndex(where: { $0.id == pillar.id }) {
            var local = pillars[index]
            if let name {
                local.name = name
            }
            if let description {
                local.description = description
            }
            if colorToken != nil {
                local.colorToken = normalizedColorToken
                local.color = colorHex(forColorToken: normalizedColorToken)
            }
            if iconToken != nil {
                local.iconToken = normalizedIconToken
            }
            if let resolvedPillarType {
                local.pillarType = resolvedPillarType
            }
            local.updatedAt = Date()
            pillars[index] = local
        }

        do {
            try await db.collection("pillars").document(pillar.id).updateData(updateData)
        } catch {
            pillars = previousPillars
            throw error
        }
        
        print("✅ [PillarsViewModel] Updated pillar '\(pillar.name)'")
    }
    
    // MARK: - Delete Pillar (Archive)
    
    func deletePillar(_ pillar: Pillar) async throws {
        try await db.collection("pillars").document(pillar.id).updateData([
            "isArchived": true,
            "updatedAt": FieldValue.serverTimestamp()
        ])
        
        print("✅ [PillarsViewModel] Archived pillar '\(pillar.name)'")
    }

    func colorToken(forHex hex: String?) -> String? {
        PillarColorRegistry.token(forHex: hex)
    }

    func normalizeColorToken(_ raw: String?) -> String? {
        PillarColorRegistry.normalizeToken(raw)
    }

    func normalizeIconToken(_ raw: String?) -> String? {
        PillarIconRegistry.normalizeToken(raw)
    }

    func colorHex(forColorToken token: String?) -> String {
        let normalized = normalizeColorToken(token)
        if let normalized, PillarColorRegistry.hasToken(normalized) == false {
            logUnknownColorTokenIfNeeded(normalized)
        }
        return PillarColorRegistry.hex(for: normalized)
    }

    func colorValue(forColorToken token: String?) -> Color {
        Color(hex: colorHex(forColorToken: token))
    }

    func iconSystemName(forToken token: String?) -> String {
        let normalizedToken = normalizeIconToken(token)
        if let normalizedToken {
            let existsInCatalog = activeVisualIcons.contains(where: { $0.id == normalizedToken })
            if !existsInCatalog && PillarIcon.resolve(normalizedToken) == nil {
                logUnknownIconTokenIfNeeded(normalizedToken)
            }
        }
        return PillarIconRegistry.systemName(for: normalizedToken)
    }

    func iconLabel(forToken token: String?) -> String {
        let normalizedToken = normalizeIconToken(token)
        if let normalizedToken,
           let match = activeVisualIcons.first(where: { $0.id == normalizedToken }) {
            return match.label
        }
        if let normalizedToken, PillarIcon.resolve(normalizedToken) == nil {
            logUnknownIconTokenIfNeeded(normalizedToken)
        }
        return PillarIconRegistry.label(for: normalizedToken)
    }

    func defaultColorToken(forIconToken token: String?) -> String {
        let normalizedToken = normalizeIconToken(token)
        if let normalizedToken,
           let match = activeVisualIcons.first(where: { $0.id == normalizedToken }),
           let configuredToken = normalizeColorToken(match.defaultColorToken) {
            return configuredToken
        }

        return PillarIconRegistry.defaultColorToken(for: normalizedToken)
    }

    func defaultColorHex(forIconToken token: String?) -> String {
        colorHex(forColorToken: defaultColorToken(forIconToken: token))
    }

    private func parseString(_ raw: Any?) -> String? {
        guard let value = raw as? String else {
            return nil
        }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func applyVisualPaletteToCurrentPillars() {
        pillars = pillars.map { pillar in
            var next = pillar
            next.color = colorHex(forColorToken: pillar.colorToken)
            return next
        }
    }

    private var fallbackVisualIcons: [PillarVisualIcon] {
        PillarIcon.allCases.enumerated().map { index, icon in
            PillarVisualIcon(
                id: icon.rawValue,
                label: icon.displayName,
                defaultColorToken: PillarIconRegistry.defaultColorToken(for: icon.rawValue),
                order: index * 10,
                isActive: true
            )
        }
    }

    private var fallbackVisualColors: [PillarVisualColor] {
        PillarColorRegistry.definitions.enumerated().map { index, definition in
            PillarVisualColor(
                id: definition.token,
                label: definition.label,
                order: index * 10,
                isActive: true
            )
        }
    }

    private func logUnknownColorTokenIfNeeded(_ token: String) {
        guard !loggedUnknownColorTokens.contains(token) else { return }
        loggedUnknownColorTokens.insert(token)
        print("⚠️ [PillarsViewModel] Unknown color token '\(token)'; rendering fallback '\(PillarColorRegistry.fallbackToken)'")
    }

    private func logUnknownIconTokenIfNeeded(_ token: String) {
        guard !loggedUnknownIconTokens.contains(token) else { return }
        loggedUnknownIconTokens.insert(token)
        print("⚠️ [PillarsViewModel] Unknown icon token '\(token)'; rendering fallback icon")
    }

    private func parseRubricItems(_ raw: Any?) -> [PillarRubricItem] {
        guard let rows = raw as? [[String: Any]] else {
            return []
        }

        return rows.compactMap { row in
            guard let id = row["id"] as? String,
                  let activityType = row["activityType"] as? String,
                  let tier = row["tier"] as? String,
                  let points = parseInt(row["points"]) else {
                return nil
            }

            return PillarRubricItem(
                id: id,
                activityType: activityType,
                tier: tier,
                label: row["label"] as? String,
                points: points,
                examples: row["examples"] as? String,
                createdAt: parseTimeInterval(row["createdAt"]),
                updatedAt: parseTimeInterval(row["updatedAt"])
            )
        }
    }

    private func parseInt(_ raw: Any?) -> Int? {
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

    private func parseTimeInterval(_ raw: Any?) -> TimeInterval? {
        switch raw {
        case let value as TimeInterval:
            return value
        case let value as NSNumber:
            return value.doubleValue
        case let value as Timestamp:
            return value.dateValue().timeIntervalSince1970
        default:
            return nil
        }
    }

}

// MARK: - Error Types

enum PillarError: LocalizedError {
    case notAuthenticated
    
    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You must be logged in to perform this action"
        }
    }
}
