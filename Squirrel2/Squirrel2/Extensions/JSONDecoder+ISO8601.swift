import Foundation

extension JSONDecoder.DateDecodingStrategy {
    /// Custom ISO8601 date decoding that handles fractional seconds
    static let iso8601WithFractionalSeconds = custom {
        let container = try $0.singleValueContainer()
        let string = try container.decode(String.self)
        
        // Try multiple formatters to handle different ISO8601 variants
        let formatters = [
            ISO8601DateFormatter.withFractionalSeconds,
            ISO8601DateFormatter.withoutFractionalSeconds,
            ISO8601DateFormatter.basic
        ]
        
        for formatter in formatters {
            if let date = formatter.date(from: string) {
                return date
            }
        }
        
        throw DecodingError.dataCorruptedError(
            in: container,
            debugDescription: "Cannot decode date string \(string)"
        )
    }
}

extension JSONEncoder.DateEncodingStrategy {
    /// Custom ISO8601 date encoding that includes fractional seconds
    static let iso8601WithFractionalSeconds = custom {
        var container = $1.singleValueContainer()
        let string = ISO8601DateFormatter.withFractionalSeconds.string(from: $0)
        try container.encode(string)
    }
}

private extension ISO8601DateFormatter {
    /// ISO8601 formatter with fractional seconds (milliseconds)
    static let withFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
    
    /// ISO8601 formatter without fractional seconds
    static let withoutFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
    
    /// Basic ISO8601 formatter
    static let basic: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        return formatter
    }()
}