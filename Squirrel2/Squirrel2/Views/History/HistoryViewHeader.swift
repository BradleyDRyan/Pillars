//
//  HistoryViewHeader.swift
//  Squirrel2
//
//  Header component for history view with menu button
//

import SwiftUI

struct HistoryViewHeader: View {
    var onMenuTapped: (() -> Void)?
    
    var body: some View {
        HStack {
            // Menu button (if callback provided)
            if let onMenuTapped = onMenuTapped {
                IconButton(icon: "Menu", action: onMenuTapped)
            }
            
            Spacer()
            
            Text("History")
                .font(.system(size: 17, weight: .semibold))
            
            Spacer()
            
            // Balance spacer
            if onMenuTapped != nil {
                Color.clear.frame(width: 44, height: 44)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
}