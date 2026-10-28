#import <AppKit/AppKit.h>
// AppKit may reset the button origin independently of Tao's titlebar inset.
// Convert the actual frames rather than assuming a fixed origin for this OS.
void solar_align_window_header(void *raw, double centerFromTop) {
  NSWindow *window = (__bridge NSWindow *)raw;
  if (!window || ![NSThread isMainThread] || centerFromTop < 18 || centerFromTop > 40 || (window.styleMask & NSWindowStyleMaskFullScreen)) return;
  NSView *content = window.contentView;
  if (!content) return;
  NSButton *close = [window standardWindowButton:NSWindowCloseButton];
  if (!close) return;
  NSRect closeRect = [close convertRect:close.bounds toView:content];
  CGFloat horizontalShift = 20.0 - NSMinX(closeRect);
  for (NSNumber *kind in @[@(NSWindowCloseButton), @(NSWindowMiniaturizeButton), @(NSWindowZoomButton)]) {
    NSButton *button = [window standardWindowButton:kind.unsignedIntegerValue];
    NSView *parent = button.superview;
    if (!button || !parent) continue;
    NSRect current = [button convertRect:button.bounds toView:content];
    NSPoint desired = NSMakePoint(NSMidX(current) + horizontalShift, content.isFlipped ? NSMinY(content.bounds) + 20.0 + current.size.height/2 : NSMaxY(content.bounds) - 20.0 - current.size.height/2);
    NSPoint local = [parent convertPoint:desired fromView:content];
    NSRect frame = button.frame;
    frame.origin.x = local.x - frame.size.width / 2;
    frame.origin.y = local.y - frame.size.height / 2;
    button.frame = frame;
  }
}
