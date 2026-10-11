import Foundation
import CoreGraphics
// Observe a real top-level window belonging to the process launched by the packaging test.
let pid = Int(CommandLine.arguments[1])!
let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String:Any]] ?? []
let matches = windows.filter { window in
    guard (window[kCGWindowOwnerPID as String] as? Int) == pid,
          (window[kCGWindowLayer as String] as? Int) == 0,
          let bounds = window[kCGWindowBounds as String] as? [String:Any],
          let width = bounds["Width"] as? Double, let height = bounds["Height"] as? Double else { return false }
    return width >= 760 && height >= 560
}
if matches.isEmpty { fputs("No on-screen Solar window could be observed in this runner session.\n", stderr); exit(1) }
let summary = matches.map { ["owner": $0[kCGWindowOwnerName as String] ?? "", "bounds": $0[kCGWindowBounds as String] ?? [:]] }
print(String(data: try JSONSerialization.data(withJSONObject: summary), encoding: .utf8)!)
