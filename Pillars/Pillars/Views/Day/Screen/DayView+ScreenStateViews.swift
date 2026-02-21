import SwiftUI

// Small screen-level views used directly by DayView.
extension DayView {
    // Error screen with a retry button.
    var errorState: some View {
        VStack(spacing: S2.MyDay.Spacing.sectionContent) {
            Text(viewModel.errorMessage ?? "Could not load your day.")
                .font(S2.MyDay.Typography.emptyState)
                .foregroundColor(S2.Semantics.onSurfaceSecondary)
                .multilineTextAlignment(.center)

            S2Button(title: "Retry", variant: .primary, size: .small, fullWidth: false, centerContent: true) {
                guard let userId = firebaseManager.currentUser?.uid else { return }
                viewModel.loadBlockTypes(userId: userId)
                viewModel.loadDay(userId: userId, dateStr: dayString(from: selectedDate))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(S2.MyDay.Spacing.errorPadding)
        .background(dayCardVisualStyle.dayViewBackground.color)
    }

    // Top area showing title and week date selector.
    var dateHeader: some View {
        DayDateHeaderView(selectedDate: $selectedDate)
    }
}
