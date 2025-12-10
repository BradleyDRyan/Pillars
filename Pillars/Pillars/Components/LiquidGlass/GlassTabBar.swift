//
//  GlassTabBar.swift
//  Pillars
//
//  Custom liquid glass tab bar similar to Linear's iOS 26 implementation
//  Provides flexible navigation with glass material, haptics, and animations
//

import SwiftUI

// MARK: - Tab Bar Item

struct GlassTabItem: Identifiable, Equatable {
    let id: String
    let icon: String
    let selectedIcon: String?
    let title: String
    
    init(id: String, icon: String, selectedIcon: String? = nil, title: String) {
        self.id = id
        self.icon = icon
        self.selectedIcon = selectedIcon
        self.title = title
    }
    
    var activeIcon: String {
        selectedIcon ?? icon
    }
}

// MARK: - Glass Tab Bar Configuration

struct GlassTabBarConfiguration {
    var cornerRadius: CGFloat = 28
    var height: CGFloat = 60
    var itemSpacing: CGFloat = 8
    var horizontalPadding: CGFloat = 16
    var bottomPadding: CGFloat = 8
    var showLabels: Bool = true
    var hapticFeedback: Bool = true
    var glassConfig: GlassConfiguration = .regular
    
    static let `default` = GlassTabBarConfiguration()
    
    static let compact = GlassTabBarConfiguration(
        height: 52,
        showLabels: false
    )
    
    static let expanded = GlassTabBarConfiguration(
        height: 68,
        showLabels: true
    )
}

// MARK: - Glass Tab Bar View

struct GlassTabBar: View {
    let items: [GlassTabItem]
    @Binding var selectedId: String
    var configuration: GlassTabBarConfiguration = .default
    var onItemTap: ((GlassTabItem) -> Void)? = nil
    
    @Environment(\.colorScheme) var colorScheme
    @Namespace private var tabNamespace
    
    var body: some View {
        HStack(spacing: configuration.itemSpacing) {
            ForEach(items) { item in
                GlassTabBarItem(
                    item: item,
                    isSelected: item.id == selectedId,
                    showLabel: configuration.showLabels,
                    namespace: tabNamespace
                ) {
                    selectItem(item)
                }
            }
        }
        .padding(.horizontal, configuration.horizontalPadding)
        .frame(height: configuration.height)
        .liquidGlass(GlassConfiguration(
            cornerRadius: configuration.cornerRadius,
            highlightIntensity: 0.5,
            shadowRadius: 16,
            shadowOpacity: 0.12
        ))
        .padding(.horizontal, configuration.horizontalPadding)
        .padding(.bottom, configuration.bottomPadding)
    }
    
    private func selectItem(_ item: GlassTabItem) {
        guard item.id != selectedId else { return }
        
        if configuration.hapticFeedback {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
        }
        
        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
            selectedId = item.id
        }
        
        onItemTap?(item)
    }
}

// MARK: - Tab Bar Item View

struct GlassTabBarItem: View {
    let item: GlassTabItem
    let isSelected: Bool
    let showLabel: Bool
    let namespace: Namespace.ID
    let action: () -> Void
    
    @State private var isPressed = false
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                ZStack {
                    // Selection indicator background
                    if isSelected {
                        Capsule()
                            .fill(Color.primary.opacity(0.1))
                            .matchedGeometryEffect(id: "selection", in: namespace)
                    }
                    
                    // Icon
                    Image(systemName: isSelected ? item.activeIcon : item.icon)
                        .font(.system(size: showLabel ? 20 : 22, weight: isSelected ? .semibold : .regular))
                        .foregroundColor(isSelected ? .primary : .secondary)
                        .symbolEffect(.bounce, value: isSelected)
                }
                .frame(height: showLabel ? 28 : 36)
                .frame(maxWidth: .infinity)
                
                // Label
                if showLabel {
                    Text(item.title)
                        .font(.system(size: 10, weight: isSelected ? .medium : .regular))
                        .foregroundColor(isSelected ? .primary : .secondary)
                        .lineLimit(1)
                }
            }
            .padding(.vertical, 6)
            .padding(.horizontal, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(TabItemButtonStyle())
    }
}

// MARK: - Tab Item Button Style

struct TabItemButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.92 : 1.0)
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .animation(.spring(response: 0.2, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

// MARK: - Floating Glass Tab Bar

/// A floating tab bar that hovers above content with glass effect
struct FloatingGlassTabBar: View {
    let items: [GlassTabItem]
    @Binding var selectedId: String
    var configuration: GlassTabBarConfiguration = .default
    
    var body: some View {
        VStack {
            Spacer()
            GlassTabBar(
                items: items,
                selectedId: $selectedId,
                configuration: configuration
            )
        }
    }
}

// MARK: - Expandable Glass Tab Bar

/// A tab bar that can expand to show more items
struct ExpandableGlassTabBar: View {
    let items: [GlassTabItem]
    @Binding var selectedId: String
    @State private var isExpanded = false
    var maxVisibleItems: Int = 5
    var configuration: GlassTabBarConfiguration = .default
    
    private var visibleItems: [GlassTabItem] {
        if items.count <= maxVisibleItems {
            return items
        }
        return Array(items.prefix(maxVisibleItems - 1))
    }
    
    private var overflowItems: [GlassTabItem] {
        if items.count <= maxVisibleItems {
            return []
        }
        return Array(items.suffix(from: maxVisibleItems - 1))
    }
    
    var body: some View {
        HStack(spacing: configuration.itemSpacing) {
            ForEach(visibleItems) { item in
                tabButton(for: item)
            }
            
            // More button if needed
            if !overflowItems.isEmpty {
                moreButton
            }
        }
        .padding(.horizontal, configuration.horizontalPadding)
        .frame(height: configuration.height)
        .liquidGlass(GlassConfiguration(
            cornerRadius: configuration.cornerRadius,
            highlightIntensity: 0.5
        ))
        .padding(.horizontal, configuration.horizontalPadding)
        .padding(.bottom, configuration.bottomPadding)
        .sheet(isPresented: $isExpanded) {
            overflowSheet
        }
    }
    
    @ViewBuilder
    private func tabButton(for item: GlassTabItem) -> some View {
        Button {
            selectItem(item)
        } label: {
            VStack(spacing: 4) {
                Image(systemName: item.id == selectedId ? item.activeIcon : item.icon)
                    .font(.system(size: 20, weight: item.id == selectedId ? .semibold : .regular))
                    .foregroundColor(item.id == selectedId ? .primary : .secondary)
                
                if configuration.showLabels {
                    Text(item.title)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(item.id == selectedId ? .primary : .secondary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
        }
        .buttonStyle(TabItemButtonStyle())
    }
    
    private var moreButton: some View {
        Button {
            isExpanded = true
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
        } label: {
            VStack(spacing: 4) {
                Image(systemName: "ellipsis")
                    .font(.system(size: 20))
                    .foregroundColor(.secondary)
                
                if configuration.showLabels {
                    Text("More")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.secondary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
        }
        .buttonStyle(TabItemButtonStyle())
    }
    
    private var overflowSheet: some View {
        NavigationStack {
            List(overflowItems) { item in
                Button {
                    selectItem(item)
                    isExpanded = false
                } label: {
                    Label(item.title, systemImage: item.icon)
                }
            }
            .navigationTitle("More")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        isExpanded = false
                    }
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
    
    private func selectItem(_ item: GlassTabItem) {
        guard item.id != selectedId else { return }
        
        if configuration.hapticFeedback {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
        }
        
        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
            selectedId = item.id
        }
    }
}

// MARK: - Preview

#Preview("Glass Tab Bar") {
    ZStack {
        LinearGradient(
            colors: [.blue.opacity(0.3), .purple.opacity(0.3)],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
        
        VStack {
            Spacer()
            
            Text("Content Area")
                .foregroundColor(.secondary)
            
            Spacer()
            
            GlassTabBar(
                items: [
                    GlassTabItem(id: "home", icon: "house", selectedIcon: "house.fill", title: "Home"),
                    GlassTabItem(id: "search", icon: "magnifyingglass", title: "Search"),
                    GlassTabItem(id: "inbox", icon: "tray", selectedIcon: "tray.fill", title: "Inbox"),
                    GlassTabItem(id: "profile", icon: "person", selectedIcon: "person.fill", title: "Profile")
                ],
                selectedId: .constant("home")
            )
        }
    }
}

#Preview("Compact Tab Bar") {
    ZStack {
        Color(UIColor.systemBackground)
            .ignoresSafeArea()
        
        VStack {
            Spacer()
            
            GlassTabBar(
                items: [
                    GlassTabItem(id: "home", icon: "house", selectedIcon: "house.fill", title: "Home"),
                    GlassTabItem(id: "tasks", icon: "checklist", title: "Tasks"),
                    GlassTabItem(id: "chat", icon: "bubble.left", selectedIcon: "bubble.left.fill", title: "Chat"),
                    GlassTabItem(id: "settings", icon: "gear", title: "Settings")
                ],
                selectedId: .constant("home"),
                configuration: .compact
            )
        }
    }
}

