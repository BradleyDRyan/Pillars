//
//  PillarIcon.swift
//  Pillars
//
//  Icons for pillars.
//

import SwiftUI

enum PillarIcon: String, Codable, CaseIterable, Identifiable {
    // Life domains
    case heart       // Relationships, Love
    case house       // Home
    case briefcase   // Career, Work
    case figure2     // Family
    case dollarsign  // Finances
    case brain       // Mind, Learning
    case figure      // Health, Fitness
    case book        // Education
    case sparkles    // Creativity
    case leaf        // Growth, Nature
    case star        // Goals, Aspirations
    case globe       // Travel, World
    case airplane
    case car
    case bus
    case bicycle
    case train
    case camera
    case photo
    case paintbrush
    case musicnote
    case headphones
    case microphone
    case speaker
    case tv
    case gamecontroller
    case bookopen
    case newspaper
    case pencil
    case ruler
    case wrench
    case hammer
    case key
    case creditcard
    case cart
    case bag
    case gift
    case trophy
    case target
    case flame
    case drop
    case umbrella
    case cloud
    case sun
    case moon
    case bell
    case clock
    case calendar
    case chart
    case shield
    case flag
    case mountain
    
    var id: String { rawValue }
    
    /// SF Symbol name
    var systemName: String {
        switch self {
        case .heart: return "heart.fill"
        case .house: return "house.fill"
        case .briefcase: return "briefcase.fill"
        case .figure2: return "figure.2"
        case .dollarsign: return "dollarsign.circle.fill"
        case .brain: return "brain.head.profile"
        case .figure: return "figure.walk"
        case .book: return "book.fill"
        case .sparkles: return "sparkles"
        case .leaf: return "leaf.fill"
        case .star: return "star.fill"
        case .globe: return "globe"
        case .airplane: return "airplane"
        case .car: return "car.fill"
        case .bus: return "bus"
        case .bicycle: return "bicycle"
        case .train: return "tram.fill"
        case .camera: return "camera.fill"
        case .photo: return "photo"
        case .paintbrush: return "paintbrush.fill"
        case .musicnote: return "music.note"
        case .headphones: return "headphones"
        case .microphone: return "mic.fill"
        case .speaker: return "speaker.wave.3.fill"
        case .tv: return "tv.fill"
        case .gamecontroller: return "gamecontroller.fill"
        case .bookopen: return "book.closed.fill"
        case .newspaper: return "newspaper.fill"
        case .pencil: return "pencil.tip"
        case .ruler: return "ruler"
        case .wrench: return "wrench.and.screwdriver"
        case .hammer: return "hammer.fill"
        case .key: return "key.fill"
        case .creditcard: return "creditcard.fill"
        case .cart: return "cart.fill"
        case .bag: return "bag.fill"
        case .gift: return "gift.fill"
        case .trophy: return "trophy.fill"
        case .target: return "target"
        case .flame: return "flame.fill"
        case .drop: return "drop.fill"
        case .umbrella: return "umbrella.fill"
        case .cloud: return "cloud.fill"
        case .sun: return "sun.max.fill"
        case .moon: return "moon.fill"
        case .bell: return "bell.fill"
        case .clock: return "clock.fill"
        case .calendar: return "calendar"
        case .chart: return "chart.bar.fill"
        case .shield: return "shield.fill"
        case .flag: return "flag.fill"
        case .mountain: return "mountain.2.fill"
        }
    }
    
    /// Default color for this icon type
    var defaultColor: Color {
        switch self {
        case .heart: return Color(hex: "FF6B6B")
        case .house: return Color(hex: "4DABF7")
        case .briefcase: return Color(hex: "868E96")
        case .figure2: return Color(hex: "CC5DE8")
        case .dollarsign: return Color(hex: "51CF66")
        case .brain: return Color(hex: "FF922B")
        case .figure: return Color(hex: "20C997")
        case .book: return Color(hex: "845EF7")
        case .sparkles: return Color(hex: "FAB005")
        case .leaf: return Color(hex: "40C057")
        case .star: return Color(hex: "FCC419")
        case .globe: return Color(hex: "339AF0")
        case .airplane: return Color(hex: "4DABF7")
        case .car: return Color(hex: "9775FA")
        case .bus: return Color(hex: "4DABF7")
        case .bicycle: return Color(hex: "20C997")
        case .train: return Color(hex: "FF922B")
        case .camera: return Color(hex: "FF6B6B")
        case .photo: return Color(hex: "CC5DE8")
        case .paintbrush: return Color(hex: "12B886")
        case .musicnote: return Color(hex: "F06595")
        case .headphones: return Color(hex: "748FFC")
        case .microphone: return Color(hex: "FF6B6B")
        case .speaker: return Color(hex: "7950F2")
        case .tv: return Color(hex: "69DB7C")
        case .gamecontroller: return Color(hex: "FFD43B")
        case .bookopen: return Color(hex: "63E6BE")
        case .newspaper: return Color(hex: "74C0FC")
        case .pencil: return Color(hex: "96F97E")
        case .ruler: return Color(hex: "FFA94D")
        case .wrench: return Color(hex: "9775FA")
        case .hammer: return Color(hex: "495057")
        case .key: return Color(hex: "868E96")
        case .creditcard: return Color(hex: "845EF7")
        case .cart: return Color(hex: "38D9A9")
        case .bag: return Color(hex: "FAB005")
        case .gift: return Color(hex: "DA77F2")
        case .trophy: return Color(hex: "20C997")
        case .target: return Color(hex: "FF8A5B")
        case .flame: return Color(hex: "FFE066")
        case .drop: return Color(hex: "4DABF7")
        case .umbrella: return Color(hex: "66D9E8")
        case .cloud: return Color(hex: "74B9FF")
        case .sun: return Color(hex: "FFE66D")
        case .moon: return Color(hex: "845EF7")
        case .bell: return Color(hex: "FF8CC8")
        case .clock: return Color(hex: "69DB7C")
        case .calendar: return Color(hex: "B197FC")
        case .chart: return Color(hex: "5C7CFA")
        case .shield: return Color(hex: "51CF66")
        case .flag: return Color(hex: "FF922B")
        case .mountain: return Color(hex: "C5FAD5")
        }
    }
    
    /// Display name for picker
    var displayName: String {
        switch self {
        case .heart: return "Heart"
        case .house: return "Home"
        case .briefcase: return "Work"
        case .figure2: return "Family"
        case .dollarsign: return "Finances"
        case .brain: return "Mind"
        case .figure: return "Health"
        case .book: return "Learning"
        case .sparkles: return "Creativity"
        case .leaf: return "Growth"
        case .star: return "Goals"
        case .globe: return "Travel"
        case .airplane: return "Travel"
        case .car: return "Car"
        case .bus: return "Transit"
        case .bicycle: return "Cycling"
        case .train: return "Train"
        case .camera: return "Camera"
        case .photo: return "Photo"
        case .paintbrush: return "Creativity"
        case .musicnote: return "Music"
        case .headphones: return "Audio"
        case .microphone: return "Voice"
        case .speaker: return "Sound"
        case .tv: return "Media"
        case .gamecontroller: return "Gaming"
        case .bookopen: return "Reading"
        case .newspaper: return "News"
        case .pencil: return "Writing"
        case .ruler: return "Design"
        case .wrench: return "Tools"
        case .hammer: return "Build"
        case .key: return "Security"
        case .creditcard: return "Money"
        case .cart: return "Shopping"
        case .bag: return "Items"
        case .gift: return "Gift"
        case .trophy: return "Achievement"
        case .target: return "Focus"
        case .flame: return "Energy"
        case .drop: return "Focus"
        case .umbrella: return "Protection"
        case .cloud: return "Weather"
        case .sun: return "Light"
        case .moon: return "Night"
        case .bell: return "Reminder"
        case .clock: return "Time"
        case .calendar: return "Planning"
        case .chart: return "Progress"
        case .shield: return "Safety"
        case .flag: return "Priority"
        case .mountain: return "Adventure"
        }
    }
    
    static var `default`: PillarIcon { .star }

    static func resolve(_ raw: String?) -> PillarIcon? {
        guard let normalized = raw?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased(),
              !normalized.isEmpty else {
            return nil
        }

        return PillarIcon(rawValue: normalized)
    }
}

// MARK: - SwiftUI View Helper
extension PillarIcon {
    @ViewBuilder
    func iconView(size: CGFloat = 24, color: Color? = nil) -> some View {
        Image(systemName: systemName)
            .font(.system(size: size * 0.6, weight: .medium))
            .foregroundColor(color ?? defaultColor)
            .frame(width: size, height: size)
            .background(
                RoundedRectangle(cornerRadius: size * 0.25)
                    .fill((color ?? defaultColor).opacity(0.15))
            )
    }
}
