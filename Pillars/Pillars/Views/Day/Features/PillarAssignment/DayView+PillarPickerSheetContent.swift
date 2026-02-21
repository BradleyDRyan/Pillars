import SwiftUI

// Pillar assignment sheet content.
// This file is the one place that opens the pillar picker UI.
extension DayView {
    func pillarPickerSheetContent(target: PillarPickerTarget) -> some View {
        PillarPickerSheet(
            title: "Assign Pillar",
            pillars: pillarPickerSource.pillars,
            selectedPillarId: target.currentPillarId
        ) { selectedPillarId in
            applyPillarSelection(selectedPillarId, for: target)
        }
    }
}
