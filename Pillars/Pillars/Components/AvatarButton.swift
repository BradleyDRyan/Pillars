//
//  AvatarButton.swift
//  Squirrel2
//
//  Reusable avatar/profile button component with Liquid Glass style (iOS 26+)
//

import SwiftUI

struct AvatarButton: View {
    let imageName: String
    let size: CGFloat
    let action: () -> Void
    
    init(imageName: String, size: CGFloat = 44, action: @escaping () -> Void) {
        self.imageName = imageName
        self.size = size
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            Image(imageName)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: size, height: size)
                .clipShape(Circle())
                .glassEffect(.regular.interactive())
        }
        .buttonStyle(.plain)
        .glassShadow()
    }
}

#Preview {
    VStack(spacing: 20) {
        AvatarButton(imageName: "profile-pic") {}
        
        AvatarButton(imageName: "profile-pic", size: 32) {}
        
        AvatarButton(imageName: "profile-pic", size: 56) {}
    }
    .padding(40)
    .background(
        LinearGradient(
            colors: [.blue.opacity(0.3), .purple.opacity(0.3)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    )
}

