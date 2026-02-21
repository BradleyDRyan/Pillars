import SwiftUI

// Summary text for custom blocks.
// Custom blocks can have different field types, so this file decides whether
// a custom block looks "logged" and what text should be shown.
extension DayView {
    // Builds row text for a custom block.
    func customSummary(block: Block, customType: BlockType) -> DayEntrySummary {
        let values = block.customData ?? []
        let hasEntry = customType.dataSchema.fields.contains { field in
            guard let value = values.first(where: { $0.id == field.id }) else { return false }
            switch field.fieldKind {
            case .text, .multiline:
                return nonEmpty(value.textValue) != nil
            case .number, .slider, .rating:
                return (value.numberValue ?? 0) != 0
            case .toggle:
                return value.boolValue == true
            }
        }

        return DayEntrySummary(
            title: hasEntry ? "\(customType.name) logged" : customType.name,
            trailing: nil,
            isLogged: hasEntry
        )
    }

    // Finds the custom type definition for a block.
    func customType(for block: Block) -> BlockType? {
        viewModel.customBlockTypes.first(where: { $0.id == block.typeId })
    }

    // Reads one text field value by id from workout-style text data.
    func textFieldValue(_ data: TextFieldData?, id: String) -> String? {
        guard let field = data?.fields.first(where: { $0.id == id }) else { return nil }
        return nonEmpty(field.value)
    }
}
