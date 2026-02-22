import SwiftUI

// Chooses the right text builder for each block type.
// This is where we decide what row text to show for each kind of block.
extension DayView {
    // Turns one block into the row title and helper text.
    func dayEntrySummary(for block: Block) -> DayEntrySummary {
        if let builtIn = block.blockType {
            switch builtIn.id {
            case "sleep":
                return sleepSummary(block.sleepData)
            case "feeling":
                return moodSummary(block.sliderData)
            case "habits":
                return habitSummary(block.checklistData)
            case "habit-group-card":
                return habitGroupCardSummary(block)
            case "workout":
                return workoutSummary(block.textFieldData)
            case "todo":
                return todoSummary(block.checklistData)
            case "reflection":
                return freeTextSummary(block.freeText, emptyTitle: "Add reflection")
            default:
                return DayEntrySummary(title: builtIn.name, trailing: nil, isLogged: false)
            }
        }

        if let customType = customType(for: block) {
            return customSummary(block: block, customType: customType)
        }

        return DayEntrySummary(title: "Unknown entry", trailing: nil, isLogged: false)
    }
}
