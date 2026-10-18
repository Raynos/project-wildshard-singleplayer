from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[2]);ThreadingHTTPServer(('127.0.0.1',8794),SimpleHTTPRequestHandler).serve_forever()
