//
//  ListItem.swift
//  Squirrel2
//
//  Reusable list item component with 4 slots: Leading Accessory, Title, Subtitle, Trailing Accessory
//

import SwiftUI

struct ListItem<LeadingAccessory: View, Subtitle: View, TrailingAccessory: View>: View {
    let leadingAccessory: LeadingAccessory
    let title: String
    let subtitle: Subtitle
    let trailingAccessory: TrailingAccessory
    
    init(
        @ViewBuilder leadingAccessory: () -> LeadingAccessory,
        title: String,
        @ViewBuilder subtitle: () -> Subtitle,
        @ViewBuilder trailingAccessory: () -> TrailingAccessory
    ) {
        self.leadingAccessory = leadingAccessory()
        self.title = title
        self.subtitle = subtitle()
        self.trailingAccessory = trailingAccessory()
    }
    
    var body: some View {
        HStack(spacing: 12) {
            leadingAccessory
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.squirrelBody)
                    .foregroundColor(S2.Colors.primaryText)
                    .lineLimit(1)
                
                subtitle
            }
            
            Spacer()
            
            trailingAccessory
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 12)
    }
}

// Convenience initializer for no trailing accessory
extension ListItem where TrailingAccessory == EmptyView {
    init(
        @ViewBuilder leadingAccessory: () -> LeadingAccessory,
        title: String,
        @ViewBuilder subtitle: () -> Subtitle
    ) {
        self.leadingAccessory = leadingAccessory()
        self.title = title
        self.subtitle = subtitle()
        self.trailingAccessory = EmptyView()
    }
}

#Preview {
    VStack(spacing: 16) {
        ListItem(
            leadingAccessory: {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.black.opacity(0.05), lineWidth: 1)
                        .frame(width: 40, height: 40)
                    Image(systemName: "doc.fill")
                        .font(.system(size: 19, weight: .regular))
                        .foregroundColor(S2.Colors.secondaryText)
                }
            },
            title: "Example File.pdf",
            subtitle: {
                Text("2.5 MB")
                    .font(.squirrelCaption)
                    .foregroundColor(S2.Colors.secondaryText)
                    .lineLimit(1)
            }
        ) {
            Image(systemName: "trash")
                .font(.system(size: 16, weight: .regular))
                .foregroundColor(S2.Colors.secondaryText)
        }
        
        ListItem(
            leadingAccessory: {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.black.opacity(0.05), lineWidth: 1)
                        .frame(width: 40, height: 40)
                    Image(systemName: "photo.fill")
                        .font(.system(size: 19, weight: .regular))
                        .foregroundColor(S2.Colors.secondaryText)
                }
            },
            title: "Photo.jpg",
            subtitle: {
                HStack(spacing: 6) {
                    Text("1.2 MB")
                        .font(.squirrelCaption)
                        .foregroundColor(S2.Colors.secondaryText)
                    Text("·")
                        .foregroundColor(S2.Colors.tertiaryText)
                    Text("Text extracted")
                        .font(.squirrelCaption)
                        .foregroundColor(S2.Colors.secondaryText)
                }
            }
        ) {
            EmptyView()
        }
    }
    .padding()
}

