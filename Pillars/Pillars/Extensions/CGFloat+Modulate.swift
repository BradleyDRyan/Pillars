import CoreGraphics

extension CGFloat {
    // Maps a value from one range to another range, with optional clamping.
    static func modulate(
        watchedViewValue: CGFloat,
        watchedViewStart: CGFloat,
        watchedViewEnd: CGFloat,
        appliedViewStart: CGFloat,
        appliedViewEnd: CGFloat,
        limit: Bool = false
    ) -> CGFloat {
        let toLow = appliedViewStart
        let toHigh = appliedViewEnd
        let fromLow = watchedViewStart
        let fromHigh = watchedViewEnd

        guard fromHigh != fromLow else {
            return toLow
        }

        var result = toLow + (((watchedViewValue - fromLow) / (fromHigh - fromLow)) * (toHigh - toLow))

        guard limit else {
            return result
        }

        if toLow < toHigh {
            if result < toLow { result = toLow }
            if result > toHigh { result = toHigh }
        } else {
            if result > toLow { result = toLow }
            if result < toHigh { result = toHigh }
        }

        return result
    }
}
