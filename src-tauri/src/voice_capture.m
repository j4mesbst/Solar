#import <AVFoundation/AVFoundation.h>
#import <Foundation/Foundation.h>
static AVAudioRecorder *solarRecorder;
int solar_voice_permission(void){
 AVAuthorizationStatus status=[AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio];
 if(status==AVAuthorizationStatusAuthorized)return 1;
 if(status!=AVAuthorizationStatusNotDetermined)return 0;
 dispatch_semaphore_t wait=dispatch_semaphore_create(0);__block BOOL granted=NO;
 dispatch_async(dispatch_get_main_queue(),^{[AVCaptureDevice requestAccessForMediaType:AVMediaTypeAudio completionHandler:^(BOOL ok){granted=ok;dispatch_semaphore_signal(wait);}];});
 dispatch_semaphore_wait(wait,DISPATCH_TIME_FOREVER);return granted?1:0;
}
int solar_voice_start(const char *path){
 __block int ok=0;NSString *file=[NSString stringWithUTF8String:path];
 dispatch_sync(dispatch_get_main_queue(),^{
  if(solarRecorder)return;
  NSDictionary *settings=@{AVFormatIDKey:@(kAudioFormatLinearPCM),AVSampleRateKey:@16000,AVNumberOfChannelsKey:@1,AVLinearPCMBitDepthKey:@16,AVLinearPCMIsFloatKey:@NO,AVLinearPCMIsBigEndianKey:@NO};
  NSError *error=nil;solarRecorder=[[AVAudioRecorder alloc]initWithURL:[NSURL fileURLWithPath:file] settings:settings error:&error];
  solarRecorder.meteringEnabled=YES;if(solarRecorder&&[solarRecorder prepareToRecord]&&[solarRecorder recordForDuration:120])ok=1;else{[solarRecorder stop];solarRecorder=nil;}
 });return ok;
}
void solar_voice_stop(void){void (^stop)(void)=^{[solarRecorder stop];solarRecorder=nil;};if([NSThread isMainThread])stop();else dispatch_sync(dispatch_get_main_queue(),stop);}
double solar_voice_level(void){__block double level=-160;dispatch_sync(dispatch_get_main_queue(),^{if(solarRecorder){[solarRecorder updateMeters];level=[solarRecorder averagePowerForChannel:0];}});return level;}
