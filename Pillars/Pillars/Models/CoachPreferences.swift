//
//  CoachPreferences.swift
//  Pillars
//
//  Coach preferences that personalize AI coaching
//

import Foundation

struct CoachPreferences: Codable, Equatable {
    var id: String?
    var userId: String?
    
    // Communication Style
    var communicationStyle: CommunicationStyle
    var tone: CoachingTone
    
    // Check-in Preferences
    var checkInFrequency: CheckInFrequency
    var preferredTime: PreferredTime
    
    // Coaching Focus
    var focusAreas: [FocusArea]
    
    // Additional Preferences
    var useEmojis: Bool
    var messageLength: MessageLength
    var proactiveCheckIns: Bool
    
    var createdAt: Date?
    var updatedAt: Date?
    
    // MARK: - Default
    static var `default`: CoachPreferences {
        CoachPreferences(
            communicationStyle: .balanced,
            tone: .supportive,
            checkInFrequency: .whenIReachOut,
            preferredTime: .anytime,
            focusAreas: [.goals, .habits],
            useEmojis: true,
            messageLength: .concise,
            proactiveCheckIns: false
        )
    }
    
    // MARK: - Generate Prompt Instructions
    func toPromptInstructions() -> String {
        var instructions: [String] = []
        
        // Communication style
        switch communicationStyle {
        case .direct:
            instructions.append("Be direct and to-the-point. Skip pleasantries and get straight to actionable advice.")
        case .gentle:
            instructions.append("Be warm, gentle, and encouraging. Take time to acknowledge feelings before offering guidance.")
        case .balanced:
            instructions.append("Balance warmth with directness. Be friendly but focused.")
        }
        
        // Tone
        switch tone {
        case .motivational:
            instructions.append("Use a motivational, energizing tone. Celebrate wins and push for growth.")
        case .analytical:
            instructions.append("Be analytical and logical. Focus on data, patterns, and systematic approaches.")
        case .supportive:
            instructions.append("Be supportive and understanding. Prioritize emotional support and validation.")
        case .challenging:
            instructions.append("Be challenging and push back constructively. Ask tough questions to promote growth.")
        }
        
        // Focus areas
        if !focusAreas.isEmpty {
            let areas = focusAreas.map { $0.rawValue }.joined(separator: ", ")
            instructions.append("Focus coaching on: \(areas).")
        }
        
        // Message length
        switch messageLength {
        case .brief:
            instructions.append("Keep responses very brief (1-2 sentences max).")
        case .concise:
            instructions.append("Keep responses concise (2-4 sentences).")
        case .detailed:
            instructions.append("Provide detailed responses with examples when helpful.")
        }
        
        // Emojis
        if useEmojis {
            instructions.append("Feel free to use emojis occasionally to add warmth.")
        } else {
            instructions.append("Avoid using emojis.")
        }
        
        return instructions.joined(separator: " ")
    }
}

// MARK: - Enums

enum CommunicationStyle: String, Codable, CaseIterable {
    case direct = "Direct"
    case gentle = "Gentle"
    case balanced = "Balanced"
    
    var description: String {
        switch self {
        case .direct: return "Straight to the point, no fluff"
        case .gentle: return "Warm and encouraging"
        case .balanced: return "Mix of warmth and directness"
        }
    }
    
    var icon: String {
        switch self {
        case .direct: return "bolt.fill"
        case .gentle: return "heart.fill"
        case .balanced: return "scale.3d"
        }
    }
}

enum CoachingTone: String, Codable, CaseIterable {
    case motivational = "Motivational"
    case analytical = "Analytical"
    case supportive = "Supportive"
    case challenging = "Challenging"
    
    var description: String {
        switch self {
        case .motivational: return "Energizing and encouraging"
        case .analytical: return "Logical and data-driven"
        case .supportive: return "Understanding and validating"
        case .challenging: return "Pushes you to grow"
        }
    }
    
    var icon: String {
        switch self {
        case .motivational: return "flame.fill"
        case .analytical: return "chart.bar.fill"
        case .supportive: return "hand.raised.fill"
        case .challenging: return "figure.climbing"
        }
    }
}

enum CheckInFrequency: String, Codable, CaseIterable {
    case daily = "Daily"
    case weekly = "Weekly"
    case whenIReachOut = "When I reach out"
    
    var description: String {
        switch self {
        case .daily: return "Check in with me every day"
        case .weekly: return "Weekly check-ins are enough"
        case .whenIReachOut: return "Only when I start a conversation"
        }
    }
}

enum PreferredTime: String, Codable, CaseIterable {
    case morning = "Morning"
    case afternoon = "Afternoon"
    case evening = "Evening"
    case anytime = "Anytime"
    
    var icon: String {
        switch self {
        case .morning: return "sunrise.fill"
        case .afternoon: return "sun.max.fill"
        case .evening: return "moon.fill"
        case .anytime: return "clock.fill"
        }
    }
}

enum FocusArea: String, Codable, CaseIterable {
    case goals = "Goals"
    case habits = "Habits"
    case emotions = "Emotions"
    case relationships = "Relationships"
    case career = "Career"
    case health = "Health"
    case mindfulness = "Mindfulness"
    
    var icon: String {
        switch self {
        case .goals: return "target"
        case .habits: return "repeat"
        case .emotions: return "heart.fill"
        case .relationships: return "person.2.fill"
        case .career: return "briefcase.fill"
        case .health: return "figure.run"
        case .mindfulness: return "brain.head.profile"
        }
    }
}

enum MessageLength: String, Codable, CaseIterable {
    case brief = "Brief"
    case concise = "Concise"
    case detailed = "Detailed"
    
    var description: String {
        switch self {
        case .brief: return "1-2 sentences"
        case .concise: return "2-4 sentences"
        case .detailed: return "Longer, with examples"
        }
    }
}
