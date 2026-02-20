"""Quick restart server script - kills old processes and starts fresh."""

import subprocess
import time
import requests
import os
import signal

PORT = 8000

def kill_port():
    """Kill any process on port 8000."""
    killed = set()
    try:
        result = subprocess.run(
            f'netstat -ano | findstr :{PORT}',
            shell=True, capture_output=True, text=True
        )
        for line in result.stdout.strip().split('\n'):
            if line.strip():
                pid = line.strip().split()[-1]
                if pid.isdigit() and int(pid) > 0 and pid not in killed:
                    subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
                    killed.add(pid)
        if killed:
            print(f"Killed {len(killed)} process(es)")
    except Exception as e:
        print(f"Kill error: {e}")

def wait_for_server(timeout=10):
    """Wait until server responds."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get(f'http://localhost:{PORT}/nodes', timeout=1)
            if r.status_code == 200:
                return len(r.json())
        except:
            pass
        time.sleep(0.5)
    return None

if __name__ == "__main__":
    print("Killing old server...")
    kill_port()
    time.sleep(1)
    
    print("Starting server...")
    # Start server in background
    subprocess.Popen(
        ['python', '-c', 'import uvicorn; uvicorn.run("core.server:app", host="0.0.0.0", port=8000)'],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
    )
    
    print("Waiting for server...")
    count = wait_for_server()
    
    if count:
        print(f"[OK] Server ready! {count} nodes loaded")
        print(f"  API: http://localhost:{PORT}")
        print(f"  UI:  http://localhost:3000 (clear localStorage if stale)")
    else:
        print("[FAIL] Server failed to start - check for errors")
