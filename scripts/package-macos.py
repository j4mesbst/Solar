#!/usr/bin/env python3
"""Build and verify a genuine Tauri release DMG. Run only on an Apple Silicon Mac."""
import hashlib,json,os,pathlib,plistlib,shutil,signal,subprocess,sys,tempfile,time
root=pathlib.Path(__file__).resolve().parents[1]
os.chdir(root)
def run(args,**kwargs):
    return subprocess.run(args,check=True,**kwargs)
if sys.platform!='darwin':
    raise SystemExit('Le DMG doit être compilé et vérifié sur macOS ; aucun installateur factice ne sera créé.')
if subprocess.check_output(['uname','-m'],text=True).strip()!='arm64':
    raise SystemExit('Utilise un Mac Apple Silicon (arm64) pour cette compilation et son test de lancement.')
config=json.loads((root/'src-tauri/tauri.conf.json').read_text())
version=config['version']
env=os.environ.copy();env.setdefault('APPLE_SIGNING_IDENTITY','-')
# Official Tauri release command; build.beforeBuildCommand embeds the production frontend.
run(['npm','run','tauri','--','build','--target','aarch64-apple-darwin','--bundles','app,dmg'],env=env)
bundle=root/'src-tauri/target/aarch64-apple-darwin/release/bundle'
images=list((bundle/'dmg').glob('*.dmg'))
if len(images)!=1:raise SystemExit('Un seul DMG Tauri était attendu.')
output=root/'artifacts';output.mkdir(exist_ok=True)
dmg=output/'Solar-macOS-arm64.dmg';shutil.copy2(images[0],dmg)
if dmg.stat().st_size<1024*1024:raise SystemExit('Le DMG est anormalement petit.')
run(['hdiutil','verify',str(dmg)])
mount=None;launched_pid=None
report={'file':dmg.name,'version':version,'architecture':'arm64','identifier':config['identifier'],'size_bytes':dmg.stat().st_size,'sha256':hashlib.sha256(dmg.read_bytes()).hexdigest(),'release':True,'dmg_verified':True,'official_apple_signature':False,'notarized':False,'accounts':'Supabase public configuration required','provider_tests':'Contracts and browser fixtures; real user credentials not tested'}
try:
    attached=plistlib.loads(subprocess.check_output(['hdiutil','attach','-readonly','-nobrowse','-plist',str(dmg)]))
    mount=next(pathlib.Path(e['mount-point']) for e in attached['system-entities'] if e.get('mount-point'))
    app=mount/'Solar.app';applications=mount/'Applications'
    assert app.is_dir(),'Solar.app absente du DMG'
    assert applications.is_symlink() and applications.resolve()==pathlib.Path('/Applications'),'Raccourci Applications absent ou invalide'
    info=plistlib.loads((app/'Contents/Info.plist').read_bytes())
    assert info['CFBundleIdentifier']==config['identifier']
    assert info['CFBundleShortVersionString']==version
    binary=app/'Contents/MacOS'/info['CFBundleExecutable']
    architectures=subprocess.check_output(['lipo','-archs',str(binary)],text=True).strip().split()
    assert architectures==['arm64'],f'Architecture incorrecte : {architectures}'
    assert binary.stat().st_mode&0o111,'Exécutable sans permission de lancement'
    icon=info.get('CFBundleIconFile','icon.icns');icon=icon if icon.endswith('.icns') else icon+'.icns'
    assert (app/'Contents/Resources'/icon).is_file(),'Icône compilée absente'
    run(['codesign','--verify','--deep','--strict','--verbose=2',str(app)])
    signature=subprocess.run(['codesign','-dv','--verbose=4',str(app)],capture_output=True,text=True,check=True).stderr
    report.update(app_present=True,applications_link=True,executable=info['CFBundleExecutable'],signature_verified=True,signing='ad-hoc' if 'Signature=adhoc' in signature else 'configured identity',icon_present=True,embedded_frontend=True)
    # LaunchServices is also used by Finder. Do not start a development server.
    existing=set(subprocess.run(['pgrep','-x',info['CFBundleExecutable']],capture_output=True,text=True).stdout.split())
    opened=subprocess.run(['open','-n',str(app)],capture_output=True,text=True)
    if opened.returncode:
        report['launch_test']={'status':'unavailable','reason':opened.stderr.strip()}
    else:
        for _ in range(20):
            pids=set(subprocess.run(['pgrep','-x',info['CFBundleExecutable']],capture_output=True,text=True).stdout.split())-existing
            if pids:launched_pid=int(next(iter(pids)));break
            time.sleep(.5)
        if launched_pid is None:raise RuntimeError('Solar a quitté avant le contrôle du processus.')
        time.sleep(8)
        os.kill(launched_pid,0)
        window=subprocess.run(['swift',str(root/'scripts/verify-macos-window.swift'),str(launched_pid)],capture_output=True,text=True,timeout=60)
        report['launch_test']={'status':'running','process_survived_seconds':8,'via':'LaunchServices','window_observed':window.returncode==0,'window_result':window.stdout.strip(),'window_limit':window.stderr.strip() if window.returncode else None}
        report['launch_test']['development_server_started']=False
finally:
    if launched_pid:
        try:os.kill(launched_pid,signal.SIGTERM)
        except ProcessLookupError:pass
        time.sleep(1)
    if mount:run(['hdiutil','detach',str(mount)])
report['dmg_detached']=True
(output/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(output/'Solar-macOS-arm64.dmg.sha256').write_text(report['sha256']+'  '+dmg.name+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
if os.environ.get('SOLAR_COPY_TO_DESKTOP')=='1':
    desktop=pathlib.Path.home()/'Desktop';desktop.mkdir(exist_ok=True);shutil.copy2(dmg,desktop/dmg.name)
