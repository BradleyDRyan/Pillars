//
//  Font+Optimistic.swift
//  Squirrel2
//
//  Optimistic AI Variable Font extension
//  Supports variable font features: weight (100-900), optical size (opsz), and italic
//

import SwiftUI
import CoreGraphics
import CoreText

extension Font {
    /// Optimistic AI Variable Font names taken from the TTF name table
    /// Family: Optimistic AI VF App
    /// PostScript (full): OptimisticAIVFApp-Regular
    private static let optimisticFontPostScriptName = "OptimisticAIVFApp-Regular"
    private static let optimisticFontFamilyName = "Optimistic AI VF App"
    
    /// Track if we've already logged font failure to avoid spam
    private static var hasLoggedFontFailure = false
    /// Track if we already tried to register the font at runtime
    private static var hasTriedRegistration = false
    
    // MARK: - Font Registration Logging
    
    /// Logs all available fonts in the bundle for debugging
    static func logAvailableFonts() {
        print("🔍 [FONT DEBUG] Checking available fonts...")
        
        // List all font families
        let fontFamilies = UIFont.familyNames.sorted()
        print("📦 [FONT DEBUG] Total font families: \(fontFamilies.count)")
        
        // Check for Optimistic font family
        let optimisticFound = fontFamilies.contains { $0.contains("Optimistic") || $0.contains("optimistic") }
        print("✅ [FONT DEBUG] Optimistic font family found: \(optimisticFound)")
        
        // List all fonts containing "Optimistic"
        let optimisticFonts = fontFamilies.filter { $0.contains("Optimistic") || $0.contains("optimistic") }
        if !optimisticFonts.isEmpty {
            print("📝 [FONT DEBUG] Optimistic font families:")
            for family in optimisticFonts {
                print("   - \(family)")
                let fonts = UIFont.fontNames(forFamilyName: family)
                for font in fonts {
                    print("     • \(font)")
                }
            }
        } else {
            print("⚠️ [FONT DEBUG] No Optimistic font families found!")
        }
        
        // Check if the specific font name is available
        let testFont = UIFont(name: optimisticFontPostScriptName, size: 16)
            ?? UIFont(name: optimisticFontFamilyName, size: 16)
        if let testFont {
            print("✅ [FONT DEBUG] Font '\(optimisticFontPostScriptName)' is AVAILABLE")
            print("   Requested PostScript: \(optimisticFontPostScriptName)")
            print("   Requested family: \(optimisticFontFamilyName)")
            print("   Resolved font name: \(testFont.fontName)")
        } else {
            print("❌ [FONT DEBUG] Font '\(optimisticFontPostScriptName)' is NOT AVAILABLE")
            print("   Tried PostScript: \(optimisticFontPostScriptName)")
            print("   Tried family: \(optimisticFontFamilyName)")
            
            // Try to find similar font names
            print("🔍 [FONT DEBUG] Searching for similar font names...")
            for family in fontFamilies {
                if family.lowercased().contains("optimistic") {
                    let fonts = UIFont.fontNames(forFamilyName: family)
                    print("   Found similar family '\(family)' with fonts: \(fonts)")
                }
            }
        }
        
        // Check bundle for font files - try multiple possible paths
        var fontURL: URL?
        
        // Try with directory path first
        if let url = Bundle.main.url(forResource: "OptimisticAIVF_A_DrkmOpszWghtItal", withExtension: "ttf", subdirectory: "Fonts") {
            fontURL = url
            print("✅ [FONT DEBUG] Font file found in bundle at: Fonts/\(url.lastPathComponent)")
        }
        // Try without directory (at bundle root)
        else if let url = Bundle.main.url(forResource: "OptimisticAIVF_A_DrkmOpszWghtItal", withExtension: "ttf") {
            fontURL = url
            print("✅ [FONT DEBUG] Font file found in bundle at root: \(url.lastPathComponent)")
        } else {
            print("⚠️ [FONT DEBUG] Font file 'OptimisticAIVF_A_DrkmOpszWghtItal.ttf' NOT found in bundle")
            print("   Tried paths: root, Fonts/")
        }
        
        // Extract font name from the file if found
        if let fontURL = fontURL {
            // Try to extract font name from the file
            if let fontData = try? Data(contentsOf: fontURL),
               let fontProvider = CGDataProvider(data: fontData as CFData),
               let cgFont = CGFont(fontProvider) {
                // Get PostScript name
                if let postScriptName = cgFont.postScriptName {
                    print("📝 [FONT DEBUG] Actual PostScript name from file: \(postScriptName)")
                }
                // Get full name using CTFont
                let ctFont = CTFontCreateWithGraphicsFont(cgFont, 16, nil, nil)
                if let fullName = CTFontCopyName(ctFont, kCTFontFullNameKey) {
                    print("📝 [FONT DEBUG] Actual full name from file: \(fullName)")
                }
                if let familyName = CTFontCopyName(ctFont, kCTFontFamilyNameKey) {
                    print("📝 [FONT DEBUG] Actual family name from file: \(familyName)")
                }
            } else {
                print("⚠️ [FONT DEBUG] Could not read font data from file")
            }
        }
        
        // List all font files in bundle
        let ttfPaths = Bundle.main.paths(forResourcesOfType: "ttf", inDirectory: nil)
        if !ttfPaths.isEmpty {
            print("📁 [FONT DEBUG] TTF files in bundle: \(ttfPaths.count)")
            for path in ttfPaths {
                print("   - \(URL(fileURLWithPath: path).lastPathComponent)")
            }
        } else {
            print("⚠️ [FONT DEBUG] No TTF files found in bundle!")
        }
        let otfPaths = Bundle.main.paths(forResourcesOfType: "otf", inDirectory: nil)
        if !otfPaths.isEmpty {
            print("📁 [FONT DEBUG] OTF files in bundle: \(otfPaths.count)")
            for path in otfPaths {
                print("   - \(URL(fileURLWithPath: path).lastPathComponent)")
            }
        }
    }
    
    // MARK: - Optimistic Font Factory
    
    /// Creates an Optimistic font with specified size and weight
    /// Variable fonts automatically adjust based on the weight parameter
    /// - Parameters:
    ///   - size: Font size in points
    ///   - weight: Font weight. Defaults to .regular
    /// - Returns: Custom font with Optimistic AI VF, or system font as fallback
    static func optimistic(
        size: CGFloat,
        weight: Font.Weight = .regular
    ) -> Font {
        // Ensure font is registered if it's present in the bundle but not yet active
        if !hasTriedRegistration {
            registerOptimisticFontIfNeeded()
        }
        
        // Check if Optimistic font is available
        // UIFont will return nil if the font isn't registered
        if let availableFontName = availableOptimisticFontName(for: size) {
            // Create custom font - SwiftUI will automatically handle variable font weights
            return .custom(availableFontName, size: size)
                .weight(weight)
        }
        
        // Fallback to system font if Optimistic is not available
        // Only log failures to avoid console spam
        if !Self.hasLoggedFontFailure {
            print("⚠️ [FONT DEBUG] Optimistic font NOT available, using system font fallback")
            print("   Attempted PostScript: '\(optimisticFontPostScriptName)'")
            print("   Attempted family: '\(optimisticFontFamilyName)'")
            print("   This message will only appear once to avoid spam")
            Self.hasLoggedFontFailure = true
        }
        return .system(size: size, weight: weight, design: .default)
    }
    
    /// Checks if Optimistic font is available in the app bundle
    static var isOptimisticAvailable: Bool {
        let available = availableOptimisticFontName(for: 16) != nil
        print("🔍 [FONT DEBUG] isOptimisticAvailable check: \(available)")
        return available
    }
    
    /// Returns the first available Optimistic font name (PostScript or family)
    private static func availableOptimisticFontName(for size: CGFloat) -> String? {
        if UIFont(name: optimisticFontPostScriptName, size: size) != nil {
            return optimisticFontPostScriptName
        }
        if UIFont(name: optimisticFontFamilyName, size: size) != nil {
            return optimisticFontFamilyName
        }
        return nil
    }
    
    /// Attempts to register the Optimistic font at runtime if it's present in the bundle
    private static func registerOptimisticFontIfNeeded() {
        hasTriedRegistration = true
        
        guard let fontURL = Bundle.main.url(forResource: "OptimisticAIVF_A_DrkmOpszWghtItal", withExtension: "ttf") ??
                Bundle.main.url(forResource: "OptimisticAIVF_A_DrkmOpszWghtItal", withExtension: "ttf", subdirectory: "Fonts") else {
            print("⚠️ [FONT DEBUG] Could not find Optimistic font file to register at runtime")
            return
        }
        
        var registrationError: Unmanaged<CFError>?
        let success = CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, &registrationError)
        if success {
            print("✅ [FONT DEBUG] Registered Optimistic font at runtime from \(fontURL.lastPathComponent)")
        } else if let error = registrationError?.takeRetainedValue() {
            print("❌ [FONT DEBUG] Failed to register Optimistic font: \(error)")
        } else {
            print("❌ [FONT DEBUG] Failed to register Optimistic font for an unknown reason")
        }
    }
    
    // MARK: - Predefined Optimistic Font Styles
    
    // Headlines
    static let optimisticHeadline = optimistic(size: 30, weight: .semibold)
    static let optimisticTitle1 = optimistic(size: 21, weight: .semibold)
    static let optimisticTitle2 = optimistic(size: 18, weight: .medium)
    static let optimisticTitle3 = optimistic(size: 20, weight: .semibold)
    
    // Body text
    static let optimisticBodyEmphasized = optimistic(size: 16, weight: .semibold)
    static let optimisticBodyMedium = optimistic(size: 16, weight: .medium)
    static let optimisticBodyRegular = optimistic(size: 16, weight: .regular)
    
    // Subheadlines
    static let optimisticSubheadlineMedium = optimistic(size: 14, weight: .medium)
    static let optimisticSubheadlineRegular = optimistic(size: 14, weight: .regular)
    
    // Captions
    static let optimisticCaption = optimistic(size: 13, weight: .regular)
    
    // Chat specific
    static let optimisticChatMessage = optimistic(size: 16, weight: .regular)
    static let optimisticChatTimestamp = optimistic(size: 11, weight: .regular)
}

// MARK: - View Extension for Easy Font Application
extension View {
    /// Applies Optimistic font with specified size and weight
    func optimisticFont(
        size: CGFloat,
        weight: Font.Weight = .regular
    ) -> some View {
        self.font(.optimistic(size: size, weight: weight))
    }
}

