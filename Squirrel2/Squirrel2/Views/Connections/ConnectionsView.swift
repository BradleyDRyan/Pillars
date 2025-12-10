import SwiftUI

struct ConnectionsView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    @StateObject private var viewModel = ConnectionsViewModel()
    @State private var showingAddPerson = false
    @State private var selectedPerson: Person?

    private var hasReachedLimit: Bool {
        viewModel.people.count >= ConnectionsViewModel.maxPeople
    }

    var body: some View {
        NavigationView {
            ZStack {
                S2.Colors.squirrelBackground
                    .ignoresSafeArea()

                VStack(alignment: .leading, spacing: S2.Spacing.lg) {
                    header

                    if let errorMessage = viewModel.errorMessage, !errorMessage.isEmpty {
                        Text(errorMessage)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(S2.Colors.error)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(S2.Colors.secondarySurface)
                            .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.lg))
                    }

                    content

                    Spacer(minLength: 0)
                }
                .padding(.horizontal, S2.Spacing.xl)
                .padding(.top, S2.Spacing.xxxl)
            }
            .navigationBarHidden(true)
        }
        .sheet(isPresented: $showingAddPerson) {
            AddPersonSheet(viewModel: viewModel)
            .presentationDetents([.medium, .large])
        }
        .sheet(item: $selectedPerson) { person in
            NavigationView {
                PersonDetailView(person: person)
                    .environmentObject(firebaseManager)
            }
        }
        .onAppear {
            guard let userId = firebaseManager.currentUser?.uid else { return }
            viewModel.startListening(userId: userId)
        }
        .onDisappear {
            viewModel.stopListening()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.sm) {
            HStack(alignment: .center, spacing: S2.Spacing.md) {
                VStack(alignment: .leading, spacing: S2.Spacing.xs) {
                    Text("Connections")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundStyle(S2.Colors.primaryText)

                    Text("Stay close to the people who matter.")
                        .font(.system(size: 16, weight: .regular))
                        .foregroundStyle(S2.Colors.secondaryText)
                }

                Spacer()

                Button {
                    showingAddPerson = true
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(S2.Colors.primaryBrand)
                        .clipShape(Circle())
                        .shadow(color: S2.Colors.squirrelShadow, radius: 8, x: 0, y: 4)
                }
                .disabled(hasReachedLimit)
                .opacity(hasReachedLimit ? 0.4 : 1.0)
                .accessibilityLabel("Add a person")
            }

            if hasReachedLimit {
                Text("You’ve reached the 30 person limit for now.")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(S2.Colors.secondaryText)
            } else {
                Text("Add up to \(ConnectionsViewModel.maxPeople) people to your inner circle.")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(S2.Colors.secondaryText)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading {
            VStack(spacing: S2.Spacing.md) {
                ProgressView()
                Text("Loading your people...")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(S2.Colors.secondaryText)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        } else if viewModel.people.isEmpty {
            EmptyStateView {
                showingAddPerson = true
            }
        } else {
            ScrollView {
                LazyVStack(spacing: S2.Spacing.lg) {
                    ForEach(viewModel.people) { person in
                        Button {
                            selectedPerson = person
                        } label: {
                            PersonCard(person: person)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                    .animation(.easeInOut, value: viewModel.people)
                }
                .padding(.bottom, S2.Spacing.xxxl)
            }
        }
    }
}

// MARK: - Empty State
private struct EmptyStateView: View {
    var onAddTap: () -> Void

    var body: some View {
        VStack(spacing: S2.Spacing.lg) {
            Image(systemName: "sparkles")
                .font(.system(size: 40, weight: .semibold))
                .foregroundStyle(S2.Colors.primaryBrand.opacity(0.9))
                .padding()
                .background(S2.Colors.secondarySurface)
                .clipShape(Circle())

            Text("Add someone you care about.")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(S2.Colors.primaryText)

            Text("All we need is their name, how you know them, and anything you love talking about together.")
                .font(.system(size: 16))
                .foregroundStyle(S2.Colors.secondaryText)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)

            Button(action: onAddTap) {
                Text("Add a person")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.vertical, S2.Spacing.md)
                    .padding(.horizontal, S2.Spacing.xxxl)
                    .background(S2.Colors.primaryBrand)
                    .clipShape(Capsule())
                    .shadow(color: S2.Colors.squirrelShadow, radius: 8, x: 0, y: 4)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, S2.Spacing.xxxl)
    }
}

// MARK: - Person Card
private struct PersonCard: View {
    let person: Person

    var body: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.md) {
            VStack(alignment: .leading, spacing: S2.Spacing.xs) {
                Text(person.name)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(S2.Colors.primaryText)

                Text(person.relationship)
                    .font(.system(size: 16, weight: .regular))
                    .foregroundStyle(S2.Colors.secondaryText)
            }

            if !person.sharedInterests.isEmpty {
                VStack(alignment: .leading, spacing: S2.Spacing.xs) {
                    Text("Shared interests")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(S2.Colors.secondaryText)

                    Text(person.sharedInterests.joined(separator: ", "))
                        .font(.system(size: 15))
                        .foregroundStyle(S2.Colors.primaryText)
                }
            }
        }
        .padding(S2.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: S2.CornerRadius.xl, style: .continuous)
                .fill(S2.Colors.primarySurface)
        )
        .shadow(color: S2.Colors.squirrelShadow.opacity(0.4), radius: 12, x: 0, y: 6)
    }
}

// MARK: - Add Person Sheet
private struct AddPersonSheet: View {
    @ObservedObject var viewModel: ConnectionsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var relationship: String = ""
    @State private var interestInput: String = ""
    @State private var interests: [String] = []
    @State private var localError: String?
    @FocusState private var focusedField: Field?

    private enum Field {
        case name
        case relationship
        case interest
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !relationship.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !viewModel.isSaving
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: S2.Spacing.xl) {
                    Group {
                        Text("Name")
                            .formLabelStyle()

                        TextField("Mary Johnson", text: $name)
                            .textInputAutocapitalization(.words)
                            .autocorrectionDisabled()
                            .padding()
                            .background(S2.Colors.primarySurface)
                            .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.lg))
                            .focused($focusedField, equals: .name)
                    }

                    Group {
                        Text("Relationship")
                            .formLabelStyle()

                        TextField("Bradley's grandma", text: $relationship, axis: .vertical)
                            .autocorrectionDisabled()
                            .padding()
                            .background(S2.Colors.primarySurface)
                            .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.lg))
                            .focused($focusedField, equals: .relationship)
                    }

                    Group {
                        Text("Shared interests (optional)")
                            .formLabelStyle()

                        VStack(spacing: S2.Spacing.sm) {
                            HStack(spacing: S2.Spacing.sm) {
                                TextField("Tennis, poetry, travel...", text: $interestInput)
                                    .autocorrectionDisabled()
                                    .textInputAutocapitalization(.words)
                                    .onSubmit(addInterestFromInput)
                                    .focused($focusedField, equals: .interest)

                                Button("Add") {
                                    addInterestFromInput()
                                }
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(.white)
                                .padding(.vertical, S2.Spacing.xs)
                                .padding(.horizontal, S2.Spacing.md)
                                .background(S2.Colors.primaryBrand)
                                .clipShape(Capsule())
                                .disabled(interestInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                                .opacity(interestInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.4 : 1.0)
                            }
                            .padding()
                            .background(S2.Colors.primarySurface)
                            .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.lg))

                            if !interests.isEmpty {
                                VStack(alignment: .leading, spacing: S2.Spacing.xs) {
                                    ForEach(interests, id: \.self) { interest in
                                        HStack {
                                            Text(interest)
                                                .font(.system(size: 15))
                                                .foregroundStyle(S2.Colors.primaryText)
                                            Spacer()
                                            Button {
                                                removeInterest(interest)
                                            } label: {
                                                Image(systemName: "xmark.circle.fill")
                                                    .foregroundStyle(S2.Colors.secondaryText.opacity(0.8))
                                            }
                                            .buttonStyle(.plain)
                                        }
                                        .padding(.vertical, S2.Spacing.xs)
                                        .padding(.horizontal, S2.Spacing.sm)
                                        .background(S2.Colors.secondarySurface)
                                        .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.md))
                                    }
                                }
                                .padding(.leading, S2.Spacing.xs)
                            }
                        }
                    }

                    if let localError {
                        Text(localError)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(S2.Colors.error)
                    } else if let viewModelError = viewModel.errorMessage, !viewModelError.isEmpty {
                        Text(viewModelError)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(S2.Colors.error)
                    }
                }
                .padding(.horizontal, S2.Spacing.xl)
                .padding(.top, S2.Spacing.xl)
                .padding(.bottom, S2.Spacing.xxxl)
            }
            .background(S2.Colors.squirrelBackground.ignoresSafeArea())
            .navigationTitle("Add Person")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismissSheet()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button(action: savePerson) {
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
        .onAppear {
            focusedField = .name
        }
    }

    private func addInterestFromInput() {
        let trimmed = interestInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        if !interests.contains(where: { $0.caseInsensitiveCompare(trimmed) == .orderedSame }) {
            interests.append(trimmed)
        }
        interestInput = ""
    }

    private func removeInterest(_ interest: String) {
        interests.removeAll { $0.caseInsensitiveCompare(interest) == .orderedSame }
    }

    private func savePerson() {
        localError = nil

        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedRelationship = relationship.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedName.isEmpty else {
            localError = "Name is required."
            return
        }

        guard !trimmedRelationship.isEmpty else {
            localError = "Relationship is required."
            return
        }

        // Include the current interest input if the user hasn't tapped add
        if !interestInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            addInterestFromInput()
        }

        Task {
            let success = await viewModel.addPerson(
                name: trimmedName,
                relationship: trimmedRelationship,
                sharedInterests: interests
            )

            if success {
                dismissSheet()
            }
        }
    }

    private func dismissSheet() {
        dismiss()
    }
}

private extension Text {
    func formLabelStyle() -> some View {
        self
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(S2.Colors.secondaryText)
    }
}
