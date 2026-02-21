import SwiftUI

// Screen-level shared types and visual tokens.
extension DayView {
    // Shared style token used across Day screen and entry rendering.
    var dayCardVisualStyle: DayCardVisualStyle {
        S2.MyDay.DayCardStyleTokens.visualStyle
    }

    // Identifies what should receive a pillar tag.
    struct PillarPickerTarget: Identifiable {
        // The kind of item being tagged.
        enum Kind {
            case dayBlock(section: DaySection.TimeSection, blockId: String)
            case todo(todoId: String)
            case habit(habitId: String)
        }

        let id: String
        let currentPillarId: String?
        let kind: Kind
    }
}
