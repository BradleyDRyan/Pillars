//
//  LibraryView.swift
//  Squirrel2
//
//  Library view for saved conversations, documents, and media
//

import SwiftUI

struct LibraryView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    
    // Navigation callbacks
    var onMenuTapped: (() -> Void)?
    
    @State private var selectedTab: LibraryTab = .all
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            LibraryHeader(onMenuTapped: onMenuTapped)
            
            // Tab selector
            LibraryTabBar(selectedTab: $selectedTab)
            
            // Content
            ScrollView(showsIndicators: false) {
                VStack(spacing: 16) {
                    if selectedTab == .all || selectedTab == .chats {
                        LibrarySection(title: "Recent Chats", icon: "bubble.left.and.bubble.right.fill") {
                            ForEach(0..<3) { _ in
                                LibraryChatRow()
                            }
                        }
                    }
                    
                    if selectedTab == .all || selectedTab == .images {
                        LibrarySection(title: "Images", icon: "photo.fill") {
                            LazyVGrid(columns: [
                                GridItem(.flexible(), spacing: 8),
                                GridItem(.flexible(), spacing: 8),
                                GridItem(.flexible(), spacing: 8)
                            ], spacing: 8) {
                                ForEach(0..<6) { index in
                                    LibraryImageThumbnail(index: index)
                                }
                            }
                        }
                    }
                    
                    if selectedTab == .all || selectedTab == .documents {
                        LibrarySection(title: "Documents", icon: "doc.fill") {
                            ForEach(0..<2) { _ in
                                LibraryDocumentRow()
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 100)
            }
            .scrollEdgeEffectStyle(.soft, for: .top)
        }
        .background(Color.white)
    }
}

// MARK: - Library Tab
enum LibraryTab: String, CaseIterable {
    case all = "All"
    case chats = "Chats"
    case images = "Images"
    case documents = "Documents"
}

// MARK: - Library Header
struct LibraryHeader: View {
    var onMenuTapped: (() -> Void)?
    
    var body: some View {
        HStack {
            if let onMenuTapped = onMenuTapped {
                IconButton(icon: "Menu", action: onMenuTapped)
            }
            
            Spacer()
            
            Text("Library")
                .font(.system(size: 17, weight: .semibold))
            
            Spacer()
            
            // Search button
            Button(action: {}) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 18))
                    .foregroundColor(S2.Colors.primaryIcon)
            }
            .frame(width: 44, height: 44)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
}

// MARK: - Library Tab Bar
struct LibraryTabBar: View {
    @Binding var selectedTab: LibraryTab
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(LibraryTab.allCases, id: \.self) { tab in
                    Button(action: { selectedTab = tab }) {
                        Text(tab.rawValue)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(selectedTab == tab ? .white : S2.Colors.primaryText)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(
                                Capsule()
                                    .fill(selectedTab == tab ? Color.black : S2.Colors.secondarySurface)
                            )
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }
}

// MARK: - Library Section
struct LibrarySection<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: Content
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundColor(S2.Colors.secondaryText)
                
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(S2.Colors.primaryText)
                
                Spacer()
                
                Button(action: {}) {
                    Text("See all")
                        .font(.system(size: 13))
                        .foregroundColor(S2.Colors.secondaryText)
                }
            }
            
            content
        }
    }
}

// MARK: - Library Chat Row
struct LibraryChatRow: View {
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(LinearGradient(
                    colors: [.blue, .purple],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ))
                .frame(width: 44, height: 44)
                .overlay(
                    Image(systemName: "bubble.left.fill")
                        .foregroundColor(.white)
                        .font(.system(size: 16))
                )
            
            VStack(alignment: .leading, spacing: 4) {
                Text("Chat conversation")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(S2.Colors.primaryText)
                
                Text("Last message preview...")
                    .font(.system(size: 13))
                    .foregroundColor(S2.Colors.secondaryText)
                    .lineLimit(1)
            }
            
            Spacer()
            
            Text("2d ago")
                .font(.system(size: 12))
                .foregroundColor(S2.Colors.tertiaryText)
        }
        .padding(12)
        .background(S2.Colors.secondarySurface)
        .cornerRadius(12)
    }
}

// MARK: - Library Image Thumbnail
struct LibraryImageThumbnail: View {
    let index: Int
    
    private let colors: [Color] = [.blue, .purple, .pink, .orange, .green, .teal]
    
    var body: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(colors[index % colors.count].opacity(0.3))
            .aspectRatio(1, contentMode: .fit)
            .overlay(
                Image(systemName: "photo")
                    .foregroundColor(colors[index % colors.count])
            )
    }
}

// MARK: - Library Document Row
struct LibraryDocumentRow: View {
    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 8)
                .fill(S2.Colors.secondarySurface)
                .frame(width: 44, height: 44)
                .overlay(
                    Image(systemName: "doc.text.fill")
                        .foregroundColor(.blue)
                        .font(.system(size: 18))
                )
            
            VStack(alignment: .leading, spacing: 4) {
                Text("Document.pdf")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(S2.Colors.primaryText)
                
                Text("PDF • 2.4 MB")
                    .font(.system(size: 13))
                    .foregroundColor(S2.Colors.secondaryText)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.system(size: 14))
                .foregroundColor(S2.Colors.tertiaryText)
        }
        .padding(12)
        .background(S2.Colors.secondarySurface)
        .cornerRadius(12)
    }
}

#Preview {
    LibraryView()
}

