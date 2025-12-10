import SwiftUI

struct CollectionEntryDetailView: View {
    let entry: Entry
    let collectionEntry: CollectionEntry?
    let collection: Collection

    @StateObject private var viewModel: CollectionEntryDetailViewModel
    @EnvironmentObject private var firebaseManager: FirebaseManager
    @Environment(\.openURL) private var openURL

    init(entry: Entry, collectionEntry: CollectionEntry?, collection: Collection) {
        self.entry = entry
        self.collectionEntry = collectionEntry
        self.collection = collection
        _viewModel = StateObject(wrappedValue: CollectionEntryDetailViewModel(entryId: entry.id, collectionEntryId: collectionEntry?.id))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                entryHeader
                suggestionsSection
            }
            .padding()
        }
        .navigationTitle(entry.title.isEmpty ? "Entry" : entry.title)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if let userId = firebaseManager.currentUser?.uid {
                viewModel.startListening(userId: userId)
            }
        }
        .onDisappear {
            viewModel.stopListening()
        }
    }

    private var entryHeader: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let imageUrlString = collectionEntry?.formattedData["imageUrl"] as? String ?? entry.imageUrl,
               let url = URL(string: imageUrlString) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .scaledToFit()
                        .cornerRadius(12)
                } placeholder: {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.gray.opacity(0.1))
                        .overlay(ProgressView())
                        .frame(maxHeight: 280)
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                if !entry.title.isEmpty {
                    Text(entry.title)
                        .font(.title3.bold())
                }

                Text(entry.content)
                    .font(.body)
                    .foregroundColor(.primary)

                if !entry.tags.isEmpty {
                    WrapTagsView(tags: entry.tags)
                }

                HStack {
                    Image(systemName: "calendar")
                        .foregroundColor(.secondary)
                        .font(.caption)
                    Text(entry.createdAt.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder
    private var suggestionsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Suggestions")
                .font(.headline)

            if viewModel.isLoading {
                ProgressView("Gathering ideas…")
                    .progressViewStyle(CircularProgressViewStyle())
            } else if let errorMessage = viewModel.errorMessage {
                VStack(alignment: .leading, spacing: 8) {
                    Text("We couldn't load suggestions right now.")
                        .font(.subheadline)
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } else if viewModel.suggestions.isEmpty {
                Text("No suggestions yet. Check back soon!")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            } else {
                ForEach(viewModel.suggestions) { suggestion in
                    suggestionCard(for: suggestion)
                }
            }
        }
    }

    @ViewBuilder
    private func suggestionCard(for suggestion: CollectionEntrySuggestion) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                switch suggestion.type {
                case .fetchProduct:
                    Label("Where to buy", systemImage: "cart")
                        .font(.subheadline.bold())
                case .recipe:
                    Label("Recipe idea", systemImage: "fork.knife")
                        .font(.subheadline.bold())
                default:
                    Label("Suggestion", systemImage: "lightbulb")
                        .font(.subheadline.bold())
                }

                Spacer()

                Text(suggestion.status.rawValue.capitalized)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(statusColor(for: suggestion.status).opacity(0.15))
                    .foregroundColor(statusColor(for: suggestion.status))
                    .clipShape(Capsule())
            }

            if suggestion.status == .failed {
                Text(suggestion.error ?? "Couldn't generate this suggestion.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else {
                suggestionContent(for: suggestion)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder
    private func suggestionContent(for suggestion: CollectionEntrySuggestion) -> some View {
        switch suggestion.type {
        case .fetchProduct:
            ProductSuggestionList(suggestions: suggestion.productSuggestions, openURL: openURL)
        case .recipe:
            Text("Recipe suggestions coming soon.")
                .font(.caption)
                .foregroundColor(.secondary)
        default:
            Text("We're still learning how to help here.")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    private func statusColor(for status: CollectionEntrySuggestion.Status) -> Color {
        switch status {
        case .completed: return Color.green
        case .pending: return Color.orange
        case .failed: return Color.red
        }
    }
}

private struct ProductSuggestionList: View {
    let suggestions: [CollectionEntrySuggestion.ProductSuggestion]
    let openURL: OpenURLAction

    var body: some View {
        if suggestions.isEmpty {
            Text("No stores found yet. We'll keep looking.")
                .font(.caption)
                .foregroundColor(.secondary)
        } else {
            VStack(spacing: 12) {
                ForEach(suggestions) { item in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(item.title)
                            .font(.subheadline.bold())

                        HStack {
                            Text(item.merchant)
                                .font(.caption)
                                .foregroundColor(.secondary)

                            if let price = item.price {
                                Text(price)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }

                        if let notes = item.notes {
                            Text(notes)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        if let url = item.url {
                            Button(action: { openURL(url) }) {
                                Label("View offer", systemImage: "arrow.up.right")
                                    .font(.caption.bold())
                                    .padding(.vertical, 6)
                                    .padding(.horizontal, 12)
                                    .background(Color.accentColor.opacity(0.15))
                                    .foregroundColor(.accentColor)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(Color(.tertiarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }
}

private struct WrapTagsView: View {
    let tags: [String]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(tags, id: \.self) { tag in
                    Text(tag)
                        .font(.caption)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.gray.opacity(0.15))
                        .clipShape(Capsule())
                }
            }
        }
    }
}
