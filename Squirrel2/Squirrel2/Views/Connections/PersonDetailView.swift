import SwiftUI

struct PersonDetailView: View {
    let person: Person
    @EnvironmentObject var firebaseManager: FirebaseManager
    @StateObject private var signalsViewModel = SignalsViewModel()
    @State private var showingAddSignal = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: S2.Spacing.xxl) {
                header
                signalsSection
            }
            .padding(.horizontal, S2.Spacing.xl)
            .padding(.top, S2.Spacing.xxxl)
            .padding(.bottom, S2.Spacing.xxxl)
        }
        .background(S2.Colors.squirrelBackground.ignoresSafeArea())
        .navigationTitle(person.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showingAddSignal = true
                } label: {
                    Image(systemName: "sparkle")
                        .font(.system(size: 18, weight: .semibold))
                }
                .accessibilityLabel("Log new signal")
            }
        }
        .sheet(isPresented: $showingAddSignal) {
            AddSignalSheet(person: person, viewModel: signalsViewModel)
        }
        .onAppear {
            guard
                let userId = firebaseManager.currentUser?.uid
            else { return }

            signalsViewModel.startListening(personId: person.id, userId: userId)
        }
        .onDisappear {
            signalsViewModel.stopListening()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.md) {
            Text(person.relationship)
                .font(.system(size: 16, weight: .regular))
                .foregroundStyle(S2.Colors.secondaryText)

            sharedInterestsSection

            VStack(alignment: .leading, spacing: S2.Spacing.xs) {
                Text("Why they matter")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(S2.Colors.secondaryText)

                Text("Connection keeps track of moments that make reaching out feel easy.")
                    .font(.system(size: 15))
                    .foregroundStyle(S2.Colors.primaryText)
            }
        }
        .padding(S2.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: S2.CornerRadius.xl, style: .continuous)
                .fill(S2.Colors.primarySurface)
        )
        .shadow(color: S2.Colors.squirrelShadow.opacity(0.35), radius: 10, x: 0, y: 6)
    }

    @ViewBuilder
    private var signalsSection: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.md) {
            HStack {
                Text("Recent & upcoming moments")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(S2.Colors.primaryText)

                Spacer()

                Button {
                    showingAddSignal = true
                } label: {
                    Label("Add signal", systemImage: "plus")
                        .labelStyle(.iconOnly)
                        .font(.system(size: 16, weight: .semibold))
                }
                .accessibilityLabel("Add a signal for \(person.name)")
            }

            if let error = signalsViewModel.errorMessage, !error.isEmpty {
                Text(error)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(S2.Colors.error)
            }

            if signalsViewModel.isLoading {
                VStack(spacing: S2.Spacing.md) {
                    ProgressView()
                    Text("Collecting moments...")
                        .font(.system(size: 15))
                        .foregroundStyle(S2.Colors.secondaryText)
                }
                .frame(maxWidth: .infinity)
                .padding(S2.Spacing.xl)
                .background(S2.Colors.primarySurface)
                .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.lg))
            } else if signalsViewModel.signals.isEmpty {
                emptyState
            } else {
                VStack(spacing: S2.Spacing.lg) {
                    ForEach(signalsViewModel.signals) { signal in
                        SignalRow(signal: signal)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.md) {
            Text("No events yet")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(S2.Colors.primaryText)

            Text("As we spot meaningful moments for \(person.name), they’ll show up here. Add one manually to get started.")
                .font(.system(size: 15))
                .foregroundStyle(S2.Colors.secondaryText)
        }
        .padding(S2.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: S2.CornerRadius.lg, style: .continuous)
                .fill(S2.Colors.secondarySurface)
        )
    }
}

private extension PersonDetailView {
    @ViewBuilder
    var sharedInterestsSection: some View {
        if !person.sharedInterests.isEmpty {
            VStack(alignment: .leading, spacing: S2.Spacing.sm) {
                Text("Shared interests")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(S2.Colors.secondaryText)

                Text(person.sharedInterests.joined(separator: ", "))
                    .font(.system(size: 15))
                    .foregroundStyle(S2.Colors.primaryText)
            }
        }
    }
}

private struct SignalRow: View {
    let signal: Signal
    private let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    var body: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text(signal.type.capitalized)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(S2.Colors.secondaryText)

                Spacer()

                Text(dateFormatter.string(from: signal.occurredAt))
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(S2.Colors.tertiaryText)
            }

            Text(signal.description)
                .font(.system(size: 16))
                .foregroundStyle(S2.Colors.primaryText)

            HStack {
                Text("Source: \(signal.source.isEmpty ? "manual" : signal.source)")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(S2.Colors.tertiaryText)

                Spacer()

                Text("Importance \(signal.importance)/100")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(S2.Colors.secondaryText)
                    .padding(.vertical, S2.Spacing.xs)
                    .padding(.horizontal, S2.Spacing.sm)
                    .background(S2.Colors.secondarySurface)
                    .clipShape(Capsule())
            }
        }
        .padding(S2.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: S2.CornerRadius.lg, style: .continuous)
                .fill(S2.Colors.primarySurface)
        )
        .shadow(color: S2.Colors.squirrelShadow.opacity(0.25), radius: 8, x: 0, y: 5)
    }
}

private struct AddSignalSheet: View {
    let person: Person
    @ObservedObject var viewModel: SignalsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var type: String = ""
    @State private var source: String = ""
    @State private var description: String = ""
    @State private var occurredAt: Date = Date()
    @State private var localError: String?
    @State private var importance: Double = 50

    private var canSave: Bool {
        !type.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !viewModel.isSaving
    }

    var body: some View {
        NavigationView {
            Form {
                Section("Signal Info") {
                    TextField("Signal type (e.g., Tournament, Holiday)", text: $type)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()

                    TextField("Source (optional)", text: $source)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()

                    DatePicker(
                        "Relevant date",
                        selection: $occurredAt,
                        displayedComponents: .date
                    )

                    VStack(alignment: .leading, spacing: S2.Spacing.xs) {
                        Text("Importance")
                        Slider(value: $importance, in: 0...100, step: 5)
                        Text("\(Int(importance))/100")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(S2.Colors.secondaryText)
                    }
                }

                Section("Description") {
                    TextEditor(text: $description)
                        .frame(minHeight: 120)
                }

                if let localError {
                    Section {
                        Text(localError)
                            .foregroundStyle(S2.Colors.error)
                    }
                } else if let viewModelError = viewModel.errorMessage, !viewModelError.isEmpty {
                    Section {
                        Text(viewModelError)
                            .foregroundStyle(S2.Colors.error)
                    }
                }
            }
            .navigationTitle("Log a signal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button(action: saveSignal) {
                        if viewModel.isSaving {
                            ProgressView()
                        } else {
                            Text("Save")
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(!canSave)
                }
            }
        }
    }

    private func saveSignal() {
        localError = nil

        let trimmedType = type.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedType.isEmpty else {
            localError = "Signal type is required."
            return
        }

        guard !trimmedDescription.isEmpty else {
            localError = "Signal description is required."
            return
        }

        Task {
            let success = await viewModel.addSignal(
                person: person,
                type: trimmedType,
                source: source,
                description: trimmedDescription,
                importance: Int(importance.rounded()),
                occurredAt: occurredAt
            )

            if success {
                dismiss()
            }
        }
    }
}
