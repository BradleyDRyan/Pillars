import SwiftUI

// Screen-level loading and refresh behavior.
extension DayView {
    // Starts or stops live updates when the signed-in user changes.
    func handleUserContextChange() {
        guard let userId = firebaseManager.currentUser?.uid else {
            loadedUserId = nil
            viewModel.stopListening()
            viewModel.day = nil
            viewModel.customBlockTypes = []
            pillarPickerSource.stopListening()
            return
        }

        if loadedUserId != userId {
            loadedUserId = userId
            viewModel.loadBlockTypes(userId: userId)
            pillarPickerSource.startListening(userId: userId)
        }

        viewModel.loadDay(userId: userId, dateStr: dayString(from: selectedDate))
    }

    // Reloads day data for the selected date.
    func reloadDay(for date: Date) {
        guard let userId = firebaseManager.currentUser?.uid else { return }
        viewModel.loadDay(userId: userId, dateStr: dayString(from: date))
    }

    // Converts a date into the text key used by day loading.
    func dayString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
