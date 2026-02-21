import SwiftUI

// Add-block picker sheet for DayView.
extension DayView {
    func addBlockSheetContent(section: DaySection.TimeSection) -> some View {
        AddBlockSheet(
            builtIns: viewModel.allBlockTypes.builtIns,
            customTypes: viewModel.allBlockTypes.custom
        ) { typeId, customType in
            viewModel.addBlock(typeId: typeId, to: section, customType: customType)
        }
    }
}
