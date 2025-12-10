#if canImport(UIKit)
import UIKit

extension UIImage {
    /// Returns a new image scaled so that its longest side matches `maxDimension` while preserving aspect ratio.
    /// If the image is already smaller than the desired size, the original image is returned.
    func scaledTo(maxDimension: CGFloat) -> UIImage? {
        let maxSide = max(size.width, size.height)
        guard maxSide > maxDimension, maxDimension > 0 else {
            return self
        }

        let scale = maxDimension / maxSide
        let targetSize = CGSize(width: size.width * scale, height: size.height * scale)

        UIGraphicsBeginImageContextWithOptions(targetSize, true, 1.0)
        defer { UIGraphicsEndImageContext() }

        draw(in: CGRect(origin: .zero, size: targetSize))
        return UIGraphicsGetImageFromCurrentImageContext()
    }
}
#endif
