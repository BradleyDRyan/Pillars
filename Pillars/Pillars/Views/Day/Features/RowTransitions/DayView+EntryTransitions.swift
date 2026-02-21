import SwiftUI

// Row movement animations between Logged and Planned sections.
// Keeping this in a dedicated file makes transition tuning easy to isolate.
extension DayView {
    // Shared motion for moving entries between sections.
    var dayEntryTransferAnimation: Animation {
        .spring(response: 0.22, dampingFraction: 0.78)
    }

    // Slightly larger scale effect to make transitions feel obvious.
    var dayEntryTransferTransition: AnyTransition {
        .asymmetric(
            insertion: .scale(scale: 1.18).combined(with: .opacity),
            removal: .scale(scale: 1.22).combined(with: .opacity)
        )
    }
}
