"""Serve the app locally with UTF-8 declared.

python3 -m http.server sends no charset, so Safari decodes JS and JSON as
Latin-1 and every Polish letter and emoji arrives as mojibake (learned in
Litery). Usage: python3 serve.py [port]
"""
import http.server
import socketserver
import sys

class H(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        t = super().guess_type(path)
        if t.startswith('text/') or t in ('application/javascript', 'application/json'):
            return t + '; charset=utf-8'
        return t

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', port), H) as httpd:
    print('serving on', port)
    httpd.serve_forever()
